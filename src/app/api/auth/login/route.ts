import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, or } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth/passwordService';
import { createSession } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // 1. Buscar usuario por username o email (normalizado a minúsculas)
    const normalizedUsername = username.trim().toLowerCase();
    const results = await db
      .select()
      .from(users)
      .where(or(eq(users.username, normalizedUsername), eq(users.email, normalizedUsername)))
      .limit(1);

    const user = results[0];

    if (!user) {
      // Para evitar enumeración, logueamos pero retornamos mensaje genérico
      await logSecurityEvent('login_failed', username, `Intento de login fallido: usuario no existe. IP: ${ip}`);
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    // 2. Validar si el usuario está bloqueado temporalmente
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await logSecurityEvent('login_failed', user.username, `Intento de login bloqueado temporalmente. IP: ${ip}`);
      return NextResponse.json({
        error: `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intente de nuevo en ${minutesLeft} minutos.`,
      }, { status: 429 });
    }

    // 3. Validar si el usuario está activo
    if (user.active !== 1) {
      await logSecurityEvent('login_failed', user.username, `Intento de login fallido: usuario inactivo. IP: ${ip}`);
      return NextResponse.json({ error: 'La cuenta de usuario está desactivada.' }, { status: 403 });
    }

    // 4. Verificar contraseña
    const passwordMatch = await verifyPassword(password, user.passwordHash);

    if (!passwordMatch) {
      // Contraseña incorrecta: incrementar intentos fallidos
      const newAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= 5;
      const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null; // Bloqueo de 15 minutos

      await db
        .update(users)
        .set({
          failedLoginAttempts: newAttempts,
          lockedUntil,
        })
        .where(eq(users.id, user.id));

      await logSecurityEvent(
        'login_failed',
        user.username,
        `Contraseña incorrecta. Intento fallido #${newAttempts}. ${shouldLock ? 'Cuenta bloqueada por 15 min.' : ''} IP: ${ip}`
      );

      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    // 5. Autenticación exitosa: Resetear contadores y crear sesión
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Crear sesión server-side persistida en base de datos
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

    await logSecurityEvent('login_success', user.username, `Inicio de sesión exitoso. IP: ${ip}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Error en API de login:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la solicitud.' }, { status: 500 });
  }
}
