import { cookies, headers } from 'next/headers';
import { db } from '@/infrastructure/db/client';
import { sessions } from '@/infrastructure/db/schema/sessions';
import { users } from '@/infrastructure/db/schema/users';
import { eq, and, isNull } from 'drizzle-orm';

import { UserSession, decryptSession, encryptSession } from '@/lib/auth/sessionDecrypt';

const SESSION_COOKIE_NAME = 'ms_session';

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
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 año en base de datos

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
    isMaster: user.isMaster || user.role === 'master' || user.id === 'user-admin',
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
    maxAge: 365 * 24 * 60 * 60, // 1 year — matches the DB session TTL
  });

  return sessionId;
}

/**
 * Recupera, desencripta y valida la sesión contra la base de datos.
 */
export async function getSession(cookieValue?: string): Promise<UserSession | null> {
  let token = cookieValue;

  if (!token) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) return null;
    token = sessionCookie.value;
  }

  // 1. Desencriptar cookie
  const session = await decryptSession(token);
  if (!session) return null;

  // 2. Validar expiración del payload
  if (Date.now() > session.expiresAt) {
    if (!cookieValue) await deleteSession();
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
      if (!cookieValue) await deleteSession();
      return null;
    }

    // Actualizar lastSeenAt de forma asíncrona
    db.update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, session.sessionId))
      .catch(err => console.error('Error al actualizar lastSeenAt:', err));

    return session;
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
