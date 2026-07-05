import nodemailer from 'nodemailer';
import { db } from '@/infrastructure/db/client';
import { notificationSettings } from '@/infrastructure/db/schema/notificationSettings';
import { notificationHistory } from '@/infrastructure/db/schema/notificationHistory';
import { eq } from 'drizzle-orm';
import { Ticket, User } from '@/lib/mockData';

export type NotificationEvent = 
  | 'creado'
  | 'asignado'
  | 'reasignado'
  | 'sla_por_vencer'
  | 'sla_vencido'
  | 'esperando_repuesto'
  | 'resuelto'
  | 'cerrado';

interface NotificationResult {
  emailSent: boolean;
  whatsappSent: boolean;
  logAction: string;
  errorDetail?: string;
}

// Default settings mapping
const DEFAULT_EVENTS_CONFIG = {
  creado: true,
  asignado: true,
  reasignado: true,
  sla_por_vencer: true,
  sla_vencido: true,
  esperando_repuesto: true,
  resuelto: true,
  cerrado: true
};

const DEFAULT_TEMPLATES_CONFIG = {
  whatsapp: `📢 M&S TECNOLOGÍA DIGITAL - ÁREA TÉCNICA
Se registró el evento {evento} en el Ticket TCK-{ticket}.
Cliente: {cliente}
Dirección: {direccion}
Equipo: {equipo} (S/N: {serie})
Prioridad: {prioridad}
Hora Límite SLA: {sla}
Falla: {falla}
Ver Ticket: {enlace}`,

  email: `<div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b; background-color: #ffffff;">
  <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">M&S Asistencia Técnica</h2>
  <p style="font-size: 14px; font-weight: bold; color: #334155;">Notificación: Evento {evento} en Ticket TCK-{ticket}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; color: #1e293b;">
    <tr><td style="padding: 8px; font-weight: bold; width: 150px; background-color: #f8fafc; border: 1px solid #e2e8f0;">Cliente:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{cliente}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Dirección:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{direccion}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Equipo:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{equipo} (S/N: {serie})</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Prioridad:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{prioridad}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Límite SLA:</td><td style="padding: 8px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: bold;">{sla}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Técnico Asignado:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{tecnico}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc; border: 1px solid #e2e8f0;">Falla Reportada:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{falla}</td></tr>
  </table>
  <div style="text-align: center; margin: 20px 0;">
    <a href="{enlace}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Atender Ticket en el Panel</a>
  </div>
  <p style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">M&S Tecnología Digital © 2026. Alquiler de copiadoras e impresoras.</p>
</div>`
};

export async function getOrCreateNotificationSettings() {
  try {
    const settingsQuery = await db.select().from(notificationSettings).where(eq(notificationSettings.id, 'settings-global')).limit(1);
    if (settingsQuery.length > 0) {
      const s = settingsQuery[0];
      return {
        whatsappEnabled: s.whatsappEnabled === 1,
        emailEnabled: s.emailEnabled === 1,
        eventsConfig: JSON.parse(s.eventsConfig),
        templatesConfig: JSON.parse(s.templatesConfig)
      };
    }

    // Create default configurations
    const newSettings = {
      id: 'settings-global',
      whatsappEnabled: 1,
      emailEnabled: 1,
      eventsConfig: JSON.stringify(DEFAULT_EVENTS_CONFIG),
      templatesConfig: JSON.stringify(DEFAULT_TEMPLATES_CONFIG),
      updatedAt: new Date()
    };
    await db.insert(notificationSettings).values(newSettings);
    return {
      whatsappEnabled: true,
      emailEnabled: true,
      eventsConfig: DEFAULT_EVENTS_CONFIG,
      templatesConfig: DEFAULT_TEMPLATES_CONFIG
    };
  } catch (error) {
    console.warn('Error reading notification_settings table, using defaults:', error);
    return {
      whatsappEnabled: true,
      emailEnabled: true,
      eventsConfig: DEFAULT_EVENTS_CONFIG,
      templatesConfig: DEFAULT_TEMPLATES_CONFIG
    };
  }
}

export async function sendTechNotification(
  event: NotificationEvent,
  ticket: Ticket,
  tech: User
): Promise<NotificationResult> {
  const settings = await getOrCreateNotificationSettings();

  // Check if notification is enabled for this event
  const isEventEnabled = settings.eventsConfig[event] !== false;
  if (!isEventEnabled) {
    return {
      emailSent: false,
      whatsappSent: false,
      logAction: `Envío omitido: Evento ${event.toUpperCase()} desactivado en configuración.`
    };
  }

  // Parse variables map
  const variables: Record<string, string> = {
    ticket: ticket.id.replace('ticket-', ''),
    evento: event.toUpperCase().replace('_', ' '),
    cliente: ticket.clientName,
    direccion: ticket.clientAddress || 'No especificada',
    equipo: ticket.machineDesc,
    serie: ticket.serialNumber || 'Sin Nro Serie',
    falla: ticket.description,
    prioridad: ticket.priority.toUpperCase(),
    tecnico: tech.fullname,
    sla: ticket.slaDate ? new Date(ticket.slaDate).toLocaleString('es-AR') : 'Sin definir',
    enlace: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/tecnica?ticketId=${ticket.id}`
  };

  const replaceVars = (text: string) => {
    let output = text;
    for (const [k, v] of Object.entries(variables)) {
      output = output.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return output;
  };

  // Compile WhatsApp and Email template text
  const whatsappMsgText = replaceVars(settings.templatesConfig.whatsapp || DEFAULT_TEMPLATES_CONFIG.whatsapp);
  const emailHtmlText = replaceVars(settings.templatesConfig.email || DEFAULT_TEMPLATES_CONFIG.email);

  let emailSent = false;
  let whatsappSent = false;
  let errorDetail = '';

  // 1. Process Yahoo SMTP Email Dispatch
  const isEmailEnabled = settings.emailEnabled && tech.email;
  const yahooEmail = process.env.YAHOO_EMAIL || 'mys_tec_digital@yahoo.com.ar';
  const yahooPassword = process.env.YAHOO_APP_PASSWORD;

  if (isEmailEnabled) {
    if (yahooPassword) {
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
          subject: `[TCK-${variables.ticket}] Alerta: Evento ${variables.evento}`,
          text: whatsappMsgText, // plaintext alternative
          html: emailHtmlText,
        });
        emailSent = true;
        
        // Log notification to history table
        await logNotificationToHistory(ticket.id, tech.id, 'email', tech.email!, event, 'enviado', emailHtmlText);
      } catch (err: any) {
        errorDetail += `Email Error: ${err.message || err}. `;
        console.error('[Notification SMTP Error]:', err);
        await logNotificationToHistory(ticket.id, tech.id, 'email', tech.email!, event, 'error', emailHtmlText, err.message || String(err));
      }
    } else {
      // Mock / Simulado
      emailSent = true;
      console.log(`[Email Simulación]: Enviado a ${tech.email} con texto: \n${whatsappMsgText}`);
      await logNotificationToHistory(ticket.id, tech.id, 'email', tech.email!, event, 'enviado', emailHtmlText, 'Simulado (Sin password env)');
    }
  }

  // 2. Process WhatsApp Dispatch (WhatsApp Business API / Twilio)
  const isWhatsappEnabled = settings.whatsappEnabled && tech.whatsapp;
  if (isWhatsappEnabled) {
    try {
      console.log(`[WhatsApp Simulación Twilio/Business API]: Enviado a ${tech.whatsapp} con cuerpo: \n${whatsappMsgText}`);
      whatsappSent = true;
      
      // Log notification to history table
      await logNotificationToHistory(ticket.id, tech.id, 'whatsapp', tech.whatsapp!, event, 'enviado', whatsappMsgText);
    } catch (err: any) {
      errorDetail += `WhatsApp Error: ${err.message || err}. `;
      await logNotificationToHistory(ticket.id, tech.id, 'whatsapp', tech.whatsapp!, event, 'error', whatsappMsgText, err.message || String(err));
    }
  }

  const channels: string[] = [];
  if (emailSent) channels.push(yahooPassword ? 'Email (Yahoo)' : 'Email (Simulado)');
  if (whatsappSent) channels.push('WhatsApp (Simulado)');

  const logAction = channels.length > 0 
    ? `Aviso enviado (${channels.join(', ')}) para el evento: ${event.toUpperCase()}`
    : `Ningún aviso enviado para el evento ${event.toUpperCase()} (Verifica datos de contacto del técnico).`;

  return {
    emailSent,
    whatsappSent,
    logAction,
    errorDetail: errorDetail || undefined
  };
}

async function logNotificationToHistory(
  ticketId: string,
  techId: string,
  channel: 'email' | 'whatsapp',
  recipient: string,
  event: string,
  status: 'enviado' | 'error' | 'pendiente',
  message: string,
  errorDetail?: string
) {
  try {
    const newHistoryRow = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      ticketId,
      techId,
      channel,
      recipient,
      event,
      status,
      message,
      errorDetail: errorDetail || null,
      createdAt: new Date()
    };
    await db.insert(notificationHistory).values(newHistoryRow);
  } catch (err) {
    console.error('Error logging notification to history table:', err);
  }
}
