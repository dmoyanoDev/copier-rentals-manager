import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { verifyAuth } from '@/lib/auth/authService';
import { createSession, revokeAllSessionsForUser } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  try {
    // 1. Validar autenticación
    let session;
    try {
      session = await verifyAuth();
    } catch (e: any) {
      return NextResponse.json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' }
      }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Contraseña actual y nueva son requeridas.' }
      }, { status: 400 });
    }

    // 2. Validar complejidad de contraseña nueva
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: strength.error }
      }, { status: 400 });
    }

    // 3. Buscar usuario en base de datos
    const results = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = results[0];

    if (!user) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' }
      }, { status: 404 });
    }

    // 4. Verificar contraseña actual
    const passwordMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'La contraseña actual ingresada es incorrecta.' }
      }, { status: 401 });
    }

    // 5. Hashear nueva contraseña e insertarla
    const newPasswordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
      })
      .where(eq(users.id, user.id));

    // 6. Invalidar todas las sesiones previas
    await revokeAllSessionsForUser(user.id);

    // 7. Re-crear sesión activa para el dispositivo actual
    await createSession(
      {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        isMaster: user.isMaster === 1,
      },
      ip,
      userAgent
    );

    // Loguear auditoría
    await logSecurityEvent('password_change_success', user.username, `Contraseña cambiada por el usuario (${user.isMaster === 1 ? 'master' : 'usuario'}). IP: ${ip}`);

    return NextResponse.json({
      ok: true,
      message: 'Su contraseña ha sido cambiada correctamente.'
    });
  } catch (error: any) {
    console.error('Error en API change-password:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}
