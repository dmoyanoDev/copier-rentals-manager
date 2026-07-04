import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/infrastructure/db/client';
import { emailLogs } from '@/infrastructure/db/schema/emailLogs';

export async function POST(req: NextRequest) {
  let requestData: any = {};
  try {
    requestData = await req.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const { to, clienteNombre, numeroPresupuesto, presupuestoId, pdfBase64 } = requestData;

  if (!to || !clienteNombre || !numeroPresupuesto || !presupuestoId || !pdfBase64) {
    return NextResponse.json({ success: false, error: 'Faltan campos requeridos.' }, { status: 400 });
  }

  const yahooEmail = process.env.YAHOO_EMAIL || 'mys_tec_digital@yahoo.com.ar';
  const yahooPass = process.env.YAHOO_APP_PASSWORD;

  // Si no hay credenciales configuradas, simulamos para desarrollo
  if (!yahooPass) {
    console.log('[SMTP SIMULADO - YAHOO]');
    console.log(`Para: ${to}`);
    console.log(`Asunto: Propuesta Comercial ${numeroPresupuesto} - M&S Tecnología Digital`);
    console.log(`Adjunto: Presupuesto-${numeroPresupuesto}-${clienteNombre}.pdf`);
    
    try {
      await db.insert(emailLogs).values({
        presupuestoId,
        numeroPresupuesto,
        emailDestinatario: to,
        clienteNombre,
        fechaEnvio: new Date().toISOString(),
        estado: 'enviado'
      });
      return NextResponse.json({ success: true, simulated: true });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: 'Error de base de datos: ' + err.message });
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true, // true para 465
      auth: {
        user: yahooEmail,
        pass: yahooPass,
      },
    });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const filename = `Presupuesto-${numeroPresupuesto}-${clienteNombre}.pdf`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1e293b; line-height: 1.6;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">M&S Tecnología Digital</h2>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">Soluciones de Impresión Corporativa y Alquileres</p>
        </div>
        <div style="padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Estimado/a <strong>${clienteNombre}</strong>,</p>
          <p>Le enviamos adjunto el presupuesto correspondiente a la propuesta comercial <strong>${numeroPresupuesto}</strong> solicitada.</p>
          <p>En el documento adjunto encontrará detallados los equipos propuestos, los abonos mensuales sugeridos y las condiciones del servicio.</p>
          <p style="margin-bottom: 0;">Quedamos a su entera disposición ante cualquier consulta o para coordinar los próximos pasos.</p>
          <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">
            Este es un correo automático enviado por el sistema administrativo de M&S Tecnología Digital.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"M&S Tecnología Digital" <${yahooEmail}>`,
      to,
      subject: `Propuesta Comercial ${numeroPresupuesto} - M&S Tecnología Digital`,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Registrar en base de datos como exitoso
    await db.insert(emailLogs).values({
      presupuestoId,
      numeroPresupuesto,
      emailDestinatario: to,
      clienteNombre,
      fechaEnvio: new Date().toISOString(),
      estado: 'enviado',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al enviar correo SMTP:', error);
    
    // Registrar en base de datos como error
    try {
      await db.insert(emailLogs).values({
        presupuestoId,
        numeroPresupuesto,
        emailDestinatario: to,
        clienteNombre,
        fechaEnvio: new Date().toISOString(),
        estado: 'error',
      });
    } catch (dbErr) {
      console.error('Error al registrar fallo de correo en BD:', dbErr);
    }

    return NextResponse.json({ success: false, error: error.message || 'Error al enviar el correo.' }, { status: 500 });
  }
}
