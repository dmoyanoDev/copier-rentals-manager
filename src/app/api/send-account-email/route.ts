import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSession } from '@/infrastructure/auth/session';

// Sends an account-statement email with a real PDF attachment via the same Yahoo SMTP
// relay as /api/send-email. Kept as a separate route instead of reusing that one because
// /api/send-email is tied to presupuestos (hardcoded subject/body, and it requires +
// writes presupuestoId/numeroPresupuesto to the presupuesto-only emailLogs table). The
// caller here already records the send via registerCobranzaGestion (the same audit trail
// every other client communication on this page uses), so this route doesn't duplicate
// that into emailLogs.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Sesión no válida.' }, { status: 401 });
  }

  let requestData: any = {};
  try {
    requestData = await req.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const { to, clienteNombre, subject, textBody, pdfBase64 } = requestData;

  if (!to || !clienteNombre || !subject || !textBody || !pdfBase64) {
    return NextResponse.json({ success: false, error: 'Faltan campos requeridos.' }, { status: 400 });
  }

  const yahooEmail = process.env.YAHOO_EMAIL || 'mys_tec_digital@yahoo.com.ar';
  const yahooPass = process.env.YAHOO_APP_PASSWORD;

  const filename = `EstadoCuenta_${String(clienteNombre).replace(/ /g, '_')}.pdf`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">M&S Tecnología Digital</h2>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">Soluciones de Impresión Corporativa y Alquileres</p>
      </div>
      <div style="padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; white-space: pre-wrap;">${String(textBody).replace(/</g, '&lt;')}</div>
    </div>
  `;

  // Sin credenciales configuradas, simulamos para desarrollo — mismo comportamiento que
  // /api/send-email, no hay una tabla equivalente a emailLogs que marcar acá.
  if (!yahooPass) {
    console.log('[SMTP SIMULADO - YAHOO - Estado de Cuenta]');
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Adjunto: ${filename}`);
    return NextResponse.json({ success: true, simulated: true });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true,
      auth: {
        user: yahooEmail,
        pass: yahooPass,
      },
    });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await transporter.sendMail({
      from: `"M&S Tecnología Digital" <${yahooEmail}>`,
      to,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al enviar estado de cuenta por SMTP:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error al enviar el correo.' }, { status: 500 });
  }
}
