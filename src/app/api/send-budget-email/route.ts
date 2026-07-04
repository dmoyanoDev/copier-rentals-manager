import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, pdfBase64, filename } = await req.json();

    if (!to || !subject || !body || !pdfBase64 || !filename) {
      return NextResponse.json({ error: 'Faltan campos requeridos para enviar el correo.' }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Convertir el pdfBase64 a buffer para adjuntarlo
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    if (smtpHost && smtpUser && smtpPass) {
      // Configuración de SMTP real
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === '465', // true para 465, false para otros puertos
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"M&S Tecnología Digital" <${smtpUser}>`,
        to,
        subject,
        text: body,
        attachments: [
          {
            filename: filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      console.log(`[SMTP] Correo enviado exitosamente a ${to}`);
      return NextResponse.json({ success: true, message: 'Correo enviado vía SMTP real.' });
    } else {
      // Simulación en Desarrollo
      console.log('==================================================');
      console.log('[SMTP SIMULADO - Desarrollo]');
      console.log(`Destinatario: ${to}`);
      console.log(`Asunto: ${subject}`);
      console.log(`Cuerpo: ${body}`);
      console.log(`Adjunto: ${filename} (${pdfBuffer.length} bytes)`);
      console.log('==================================================');

      return NextResponse.json({ 
        success: true, 
        simulated: true, 
        message: 'Correo simulado con éxito (configura SMTP_HOST, SMTP_USER y SMTP_PASS en .env para envíos reales).' 
      });
    }
  } catch (error: any) {
    console.error('Error al enviar correo:', error);
    return NextResponse.json({ error: 'Error interno del servidor al enviar el correo.' }, { status: 500 });
  }
}
