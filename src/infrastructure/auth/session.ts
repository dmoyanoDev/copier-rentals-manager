import { cookies, headers } from 'next/headers';
import { db } from '@/infrastructure/db/client';
import { sessions } from '@/infrastructure/db/schema/sessions';
import { users } from '@/infrastructure/db/schema/users';
import { eq, and, isNull } from 'drizzle-orm';

import { UserSession, decryptSession, encryptSession, isMasterUser } from '@/lib/auth/sessionDecrypt';

const SESSION_COOKIE_NAME = 'ms_session';
const SESSION_DURATION_DAYS = 14;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const SESSION_RENEWAL_MS = 7 * 24 * 60 * 60 * 1000; // Renew if less than 7 days left

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Crea una sesión en base de datos y genera una cookie encriptada.
 */
export async function createSession(
  user: { id: string; username: string; fullname: string; role: string; isMaster?: boolean },
  ip: string = '',
  userAgent: string = ''
) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS); // 14 días en base de datos

  // 1. Persistir en la base de datos Turso
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
    lastSeenAt: new Date(),
    ip: ip || null,
    userAgent: userAgent || null,
  });

  const sessionPayload: UserSession = {
    userId: user.id,
    username: user.username,
    fullname: user.fullname,
    role: user.role,
    isMaster: isMasterUser(user),
    sessionId,
    expiresAt: expiresAt.getTime(),
  };

  // 2. Encriptar sesión y escribir cookie
  const encrypted = await encryptSession(sessionPayload);
  const cookieStore = await cookies();

  let isSecure = false;
  try {
    const headersList = await headers();
    const proto = headersList.get('x-forwarded-proto') || '';
    const host = headersList.get('host') || '';
    isSecure = proto === 'https' || (host.includes('localhost') === false && process.env.NODE_ENV === 'production');
  } catch (e) {
    isSecure = process.env.NODE_ENV === 'production';
  }

  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // 14 días
  });

  return sessionId;
}

/**
 * Recupera, desencripta y valida la sesión contra la base de datos.
 * Implementa renovación automática ("sliding expiration") cuando queda menos de la mitad del tiempo.
 */
export async function getSession(requestOrCookieValue?: Request | string): Promise<UserSession | null> {
  let token: string | undefined;

  if (requestOrCookieValue && typeof requestOrCookieValue !== 'string') {
    const cookieHeader = requestOrCookieValue.headers.get('cookie') || '';
    const sessionCookieValue = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split('=')[1];
    token = sessionCookieValue ? decodeURIComponent(sessionCookieValue) : undefined;
  } else if (typeof requestOrCookieValue === 'string') {
    token = requestOrCookieValue;
  }

  if (!token) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) return null;
    token = sessionCookie.value;
  }

  const isCustomToken = !!requestOrCookieValue;

  // 1. Desencriptar cookie
  const session = await decryptSession(token);
  if (!session) {
    try {
      await deleteSession();
    } catch (e) {}
    return null;
  }

  // 2. Validar expiración del payload
  if (Date.now() > session.expiresAt) {
    try {
      await deleteSession();
    } catch (e) {}
    return null;
  }

  try {
    // 3. Validar estado en la base de datos (revocaciones e inactividad)
    const results = await db
      .select({
        dbSession: sessions,
        dbUser: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, session.sessionId),
          isNull(sessions.revokedAt),
          eq(users.active, 1)
        )
      )
      .limit(1);

    const match = results[0];
    if (!match) {
      try {
        await deleteSession();
      } catch (e) {}
      return null;
    }

    // 4. Sliding Expiration (Renovación automática) si queda menos de la mitad del tiempo (7 días)
    const now = Date.now();
    const remainingTime = session.expiresAt - now;

    if (remainingTime < SESSION_RENEWAL_MS) {
      const newExpiresAt = new Date(now + SESSION_DURATION_MS);
      
      // Actualizar en base de datos
      db.update(sessions)
        .set({ expiresAt: newExpiresAt, lastSeenAt: new Date() })
        .where(eq(sessions.id, session.sessionId))
        .catch(err => console.error('Error al renovar expiración de sesión en BD:', err));

      // Re-generar cookie con nueva expiración
      const updatedPayload: UserSession = {
        ...session,
        role: match.dbUser.role,
        isMaster: isMasterUser(match.dbUser),
        expiresAt: newExpiresAt.getTime(),
      };

      try {
        const encrypted = await encryptSession(updatedPayload);
        const cookieStore = await cookies();

        let isSecure = false;
        try {
          const headersList = await headers();
          const proto = headersList.get('x-forwarded-proto') || '';
          const host = headersList.get('host') || '';
          isSecure = proto === 'https' || (host.includes('localhost') === false && process.env.NODE_ENV === 'production');
        } catch (e) {
          isSecure = process.env.NODE_ENV === 'production';
        }

        cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
        });
      } catch (cookieErr) {
        console.error('Error al renovar cookie de sesión (puede no estar en request context):', cookieErr);
      }

      return {
        ...session,
        role: match.dbUser.role,
        isMaster: isMasterUser(match.dbUser),
        expiresAt: newExpiresAt.getTime(),
      };
    } else {
      // Solo actualizar lastSeenAt
      db.update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, session.sessionId))
        .catch(err => console.error('Error al actualizar lastSeenAt:', err));

      return {
        ...session,
        role: match.dbUser.role,
        isMaster: isMasterUser(match.dbUser),
      };
    }
  } catch (error) {
    console.error('Error en base de datos al validar sesión:', error);
    // Si la base de datos no está disponible, mantener offline-fallback de la cookie encriptada
    return session;
  }
}

/**
 * Revoca la sesión en la base de datos y borra la cookie.
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie) {
    const session = await decryptSession(sessionCookie.value);
    if (session) {
      try {
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.id, session.sessionId));
      } catch (e) {
        console.error('Error al revocar sesión en BD:', e);
      }
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Revoca todas las sesiones activas de un usuario.
 */
export async function revokeAllSessionsForUser(userId: string) {
  try {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  } catch (e) {
    console.error('Error al revocar todas las sesiones del usuario:', e);
  }
}
