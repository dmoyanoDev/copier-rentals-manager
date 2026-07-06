import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { passwordResetTokens } from '@/infrastructure/db/schema/passwordResetTokens';
import { eq, or } from 'drizzle-orm';
import { webcrypto } from 'crypto';
import nodemailer from 'nodemailer';
import { logSecurityEvent } from '@/lib/security/audit';

async function hashToken(token: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const { identity } = await request.json(); // Puede ser username o email

    if (!identity) {
      return NextResponse.json({ error: 'Usuario o correo electrónico requerido.' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // 1. Buscar usuario
    const results = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identity), eq(users.email, identity)))
      .limit(1);

    const user = results[0];

    // Siempre retornar mensaje genérico de éxito para evitar enumeración
    const genericResponse = {
      success: true,
      message: 'Si la cuenta existe, se ha enviado un correo electrónico con instrucciones para restablecer su contraseña.',
    };

    if (!user) {
      await logSecurityEvent(
        'forgot_password_requested',
        identity,
        `Solicitud de recuperación para usuario inexistente. IP: ${ip}`
      );
      return NextResponse.json(genericResponse);
    }

    // 2. Generar token de recuperación seguro
    const rawToken = generateResetToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de expiración

    const tokenId = 'tok-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    // 3. Registrar el token en base de datos
    await db.insert(passwordResetTokens).values({
      id: tokenId,
      userId: user.id,
      tokenHash,
      expiresAt,
      requestedIp: ip,
      requestedUserAgent: userAgent,
    });

    await logSecurityEvent(
      'forgot_password_requested',
      user.username,
      `Solicitud de recuperación de contraseña iniciada. IP: ${ip}`
    );

    // 4. Enviar correo usando Nodemailer con Yahoo SMTP
    const yahooEmail = process.env.YAHOO_EMAIL;
    const yahooPassword = process.env.YAHOO_APP_PASSWORD;

    if (!yahooEmail || !yahooPassword) {
      console.warn('Credenciales SMTP de Yahoo ausentes. Impresión del token en logs locales para desarrollo.');
      console.log(`[DESARROLLO] Token de reset para ${user.username}: ${rawToken}`);
      return NextResponse.json(genericResponse);
    }

    const transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
        user: yahooEmail,
        pass: yahooPassword,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

    const mailOptions = {
      from: `"M&S Soporte" <${yahooEmail}>`,
      to: user.email,
      subject: 'Restablecimiento de Contraseña - M&S Tecnología Digital',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #0f172a;">M&S Tecnología Digital</h2>
          <p>Hola, <strong>${user.fullname}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta administrativa.</p>
          <p>Para continuar, haz clic en el siguiente botón (este enlace expira en 15 minutos):</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
            <a href="${resetLink}" style="color: #3b82f6;">${resetLink}</a>
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 11px;">
            Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual seguirá siendo válida.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json(genericResponse);
  } catch (error: any) {
    console.error('Error en API forgot-password:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la solicitud.' }, { status: 500 });
  }
}
