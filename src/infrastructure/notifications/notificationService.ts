import nodemailer from 'nodemailer';
import { Ticket, User } from '@/lib/mockData';

export type NotificationEvent = 
  | 'creado'
  | 'asignado'
  | 'reasignado'
  | 'sla_por_vencer'
  | 'sla_vencido'
  | 'esperando_repuesto'
  | 'resuelto';

interface NotificationResult {
  emailSent: boolean;
  whatsappSent: boolean;
  logAction: string;
}

export async function sendTechNotification(
  event: NotificationEvent,
  ticket: Ticket,
  tech: User
): Promise<NotificationResult> {
  const ticketNum = ticket.id;
  const clientName = ticket.clientName;
  const address = ticket.clientAddress || 'No especificada';
  const machine = `${ticket.machineDesc} (S/N: ${ticket.serialNumber})`;
  const description = ticket.description;
  const priority = ticket.priority.toUpperCase();
  const limitSla = ticket.slaDate ? new Date(ticket.slaDate).toLocaleString('es-AR') : 'Sin definir';
  
  // Enlace dinámico al ticket en el dashboard técnica
  const detailLink = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/tecnica?ticketId=${ticket.id}`;

  let eventText = '';
  switch (event) {
    case 'creado':
      eventText = 'Se ha registrado un NUEVO ticket de asistencia técnica.';
      break;
    case 'asignado':
      eventText = 'Se le ha ASIGNADO un ticket de asistencia técnica.';
      break;
    case 'reasignado':
      eventText = 'Se le ha REASIGNADO un ticket de asistencia técnica.';
      break;
    case 'sla_por_vencer':
      eventText = '⚠️ ALERTA: El SLA de su ticket asignado está POR VENCER.';
      break;
    case 'sla_vencido':
      eventText = '🚨 ALERTA CRÍTICA: El SLA del ticket asignado ha VENCIDO.';
      break;
    case 'esperando_repuesto':
      eventText = 'El ticket ha cambiado de estado a ESPERANDO REPUESTO.';
      break;
    case 'resuelto':
      eventText = 'El ticket ha sido marcado como RESUELTO.';
      break;
  }

  const messageBody = `
=========================================
📢 M&S TECNOLOGÍA DIGITAL - ÁREA TÉCNICA
=========================================
${eventText}

Detalle del Ticket:
- Número: ${ticketNum}
- Cliente: ${clientName}
- Dirección: ${address}
- Equipo: ${machine}
- Falla Reportada: ${description}
- Prioridad: ${priority}
- Hora Límite SLA: ${limitSla}

Ver detalles del ticket en el sistema:
${detailLink}
=========================================
  `;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b; background-color: #ffffff;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">M&S Tecnología Digital - Área Técnica</h2>
      <p style="font-size: 14px; font-weight: bold; color: #334155;">${eventText}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; color: #1e293b;">
        <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold; width: 150px; border: 1px solid #e2e8f0;">Número de Ticket:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${ticketNum}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Cliente:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${clientName}</td></tr>
        <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Dirección:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${address}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Equipo / Serie:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${machine}</td></tr>
        <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Falla Reportada:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${description}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Prioridad:</td><td style="padding: 8px; border: 1px solid #e2e8f0;"><span style="color: ${priority === 'URGENTE' || priority === 'ALTA' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">${priority}</span></td></tr>
        <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Hora Límite SLA:</td><td style="padding: 8px; font-weight: bold; color: #ef4444; border: 1px solid #e2e8f0;">${limitSla}</td></tr>
      </table>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${detailLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Atender Ticket</a>
      </div>
      <p style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-bottom: 0;">M&S Tecnología Digital © 2026. Alquiler de copiadoras e impresoras.</p>
    </div>
  `;

  let emailSent = false;
  let whatsappSent = false;

  const yahooEmail = process.env.YAHOO_EMAIL || 'mys_tec_digital@yahoo.com.ar';
  const yahooPassword = process.env.YAHOO_APP_PASSWORD;

  // Enviar correo real por SMTP de Yahoo si la clave existe
  if (yahooPassword && tech.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true,
        auth: {
          user: yahooEmail,
          pass: yahooPassword,
        },
      });

      await transporter.sendMail({
        from: `"M&S Asistencia Técnica" <${yahooEmail}>`,
        to: tech.email,
        subject: `[TCK-${ticketNum.replace('ticket-', '')}] Notificación: ${eventText.replace(/⚠️|🚨/g, '')}`,
        text: messageBody,
        html: emailHtml,
      });
      emailSent = true;
      console.log(`[Notificación Email] Enviada con éxito a ${tech.email}`);
    } catch (e) {
      console.error('[Notificación Email Error] Falló al enviar por Yahoo SMTP:', e);
    }
  } else {
    console.log(`[Simulación Notificación Email] Para: ${tech.email || 'Sin Email'}. Evento: ${eventText}`);
  }

  // Simulación de WhatsApp (Twilio / Business API)
  if (tech.phone) {
    console.log(`[Simulación Notificación WhatsApp] Enviado mensaje a ${tech.phone}:\n${messageBody}`);
    whatsappSent = true;
  } else {
    console.log('[Simulación Notificación WhatsApp] Técnico no tiene teléfono registrado.');
  }

  const canales = [];
  if (emailSent) {
    canales.push('Email');
  } else if (tech.email && yahooPassword) {
    canales.push('Email (Fallo)');
  } else {
    canales.push('Email (Simulado)');
  }

  if (whatsappSent) {
    canales.push('WhatsApp (Simulado)');
  }

  const logAction = `Aviso técnico enviado (${canales.join(', ')}) para el evento: ${event.toUpperCase()}`;

  return {
    emailSent,
    whatsappSent,
    logAction,
  };
}
