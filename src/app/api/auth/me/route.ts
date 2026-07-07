import { NextResponse } from 'next/server';
import { getSession, createSession } from '@/infrastructure/auth/session';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, and, ne } from 'drizzle-orm';
import { logSecurityEvent } from '@/lib/security/audit';

// Never cache session checks — always verify against the live cookie
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
};

export async function GET(request: Request) {

  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({
        ok: false,
        authenticated: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' }
      }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const isMaster = session.isMaster === true || session.role === 'master' || session.userId === 'user-admin';

    // Fetch email from DB
    const results = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = results[0];
    const email = user?.email || '';

    return NextResponse.json({
      ok: true,
      authenticated: true,
      data: {
        id: session.userId,
        username: session.username,
        email,
        role: session.role,
        isMaster,
      },
      // Backward compatibility fields
      user: {
        id: session.userId,
        username: session.username,
        fullname: session.fullname,
        role: session.role,
        permissions: {
          isMaster,
          canAccessUsers: isMaster,
          canAccessBackups: isMaster,
          canManageSystem: isMaster || session.role === 'admin',
        },
      },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error) {
    console.error('Error en API GET /api/auth/me:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' }
      }, { status: 401 });
    }

    const body = await request.json();
    const { fullname, email, username, phone, whatsapp } = body;

    const results = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = results[0];

    if (!user) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' }
      }, { status: 404 });
    }

    const isMaster = user.isMaster === 1 || user.id === 'user-admin';

    // 1. Validaciones de Duplicados
    if (email && email.trim().toLowerCase() !== user.email) {
      const emailDup = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email.trim().toLowerCase()), ne(users.id, user.id)))
        .limit(1);

      if (emailDup.length > 0) {
        return NextResponse.json({
          ok: false,
          error: { code: 'CONFLICT', message: 'El correo electrónico ya se encuentra registrado por otro usuario.' }
        }, { status: 409 });
      }
    }

    if (username && username.trim().toLowerCase() !== user.username) {
      const usernameDup = await db
        .select()
        .from(users)
        .where(and(eq(users.username, username.trim().toLowerCase()), ne(users.id, user.id)))
        .limit(1);

      if (usernameDup.length > 0) {
        return NextResponse.json({
          ok: false,
          error: { code: 'CONFLICT', message: 'El nombre de usuario ya se encuentra registrado.' }
        }, { status: 409 });
      }
    }

    // 2. Preparar valores de actualización
    const updateValues: any = {
      updatedAt: new Date(),
    };

    if (fullname) updateValues.fullname = fullname.trim();
    if (email) updateValues.email = email.trim().toLowerCase();
    if (username) updateValues.username = username.trim().toLowerCase();
    if (phone !== undefined) updateValues.phone = phone || null;
    if (whatsapp !== undefined) updateValues.whatsapp = whatsapp || null;

    // Actualizar en base de datos
    await db.update(users).set(updateValues).where(eq(users.id, user.id));

    // Loguear auditoría
    await logSecurityEvent('user_updated', user.username, `Perfil del usuario (${isMaster ? 'master' : 'usuario'}) actualizado por sí mismo. IP: ${ip}`);

    // Obtener los datos actualizados
    const updatedUserResults = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const updatedUser = updatedUserResults[0];

    // 3. Regenerar cookie de sesión
    await createSession(
      {
        id: updatedUser.id,
        username: updatedUser.username,
        fullname: updatedUser.fullname,
        role: updatedUser.role,
        isMaster: updatedUser.isMaster === 1,
      },
      ip,
      userAgent
    );

    const { passwordHash: _, ...safeUser } = updatedUser;

    return NextResponse.json({
      ok: true,
      data: {
        user: safeUser,
      }
    });
  } catch (error: any) {
    console.error('Error en PATCH /api/auth/me:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}
