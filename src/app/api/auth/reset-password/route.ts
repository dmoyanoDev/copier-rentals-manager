import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { passwordResetTokens } from '@/infrastructure/db/schema/passwordResetTokens';
import { eq, and, isNull } from 'drizzle-orm';
import { webcrypto } from 'crypto';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { revokeAllSessionsForUser } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

async function hashToken(token: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token y nueva contraseña son requeridos.' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Validar complejidad de contraseña
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    // 2. Buscar token hasheado
    const tokenHash = await hashToken(token);

    const tokenResults = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt)))
      .limit(1);

    const resetToken = tokenResults[0];

    if (!resetToken) {
      return NextResponse.json({
        error: 'El token de restablecimiento es inválido, ya ha sido utilizado o ha expirado.',
      }, { status: 400 });
    }

    // 3. Validar expiración del token
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({
        error: 'El token ha expirado. Por favor, solicite una nueva recuperación.',
      }, { status: 400 });
    }

    // 4. Buscar usuario para loguear auditoría y actualizar contraseña
    const userResults = await db.select().from(users).where(eq(users.id, resetToken.userId)).limit(1);
    const user = userResults[0];

    if (!user) {
      return NextResponse.json({ error: 'El usuario asociado a este token no existe.' }, { status: 400 });
    }

    // 5. Hashear nueva contraseña y persistirla
    const newPasswordHash = await hashPassword(password);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    // 6. Marcar token como utilizado
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // 7. Invalidar todas las sesiones activas del usuario (Seguridad proactiva)
    await revokeAllSessionsForUser(user.id);

    await logSecurityEvent(
      'password_reset_success',
      user.username,
      `Contraseña restablecida con éxito mediante token de recuperación. IP: ${ip}`
    );

    return NextResponse.json({ success: true, message: 'Contraseña cambiada con éxito.' });
  } catch (error: any) {
    console.error('Error en API reset-password:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la solicitud.' }, { status: 500 });
  }
}
