import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { verifyAuth } from '@/lib/auth/authService';
import { createSession, revokeAllSessionsForUser } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

export async function POST(request: Request) {
  try {
    // 1. Validar autenticación
    let session;
    try {
      session = await verifyAuth();
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'No autorizado.' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Contraseña actual y nueva son requeridas.' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // 2. Validar complejidad de contraseña nueva
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    // 3. Buscar usuario en base de datos
    const results = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = results[0];

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // 4. Verificar contraseña actual
    const passwordMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'La contraseña actual ingresada es incorrecta.' }, { status: 401 });
    }

    // 5. Hashear nueva contraseña e insertarla
    const newPasswordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
      })
      .where(eq(users.id, user.id));

    // 6. Invalidar todas las sesiones previas (incluyendo la actual temporalmente)
    await revokeAllSessionsForUser(user.id);

    // 7. Re-crear sesión activa para el dispositivo actual
    await createSession(
      {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
      },
      ip,
      userAgent
    );

    await logSecurityEvent(
      'password_change_success',
      user.username,
      `Contraseña cambiada voluntariamente por el usuario. IP: ${ip}`
    );

    return NextResponse.json({ success: true, message: 'Su contraseña ha sido cambiada correctamente.' });
  } catch (error: any) {
    console.error('Error en API change-password:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la solicitud.' }, { status: 500 });
  }
}
