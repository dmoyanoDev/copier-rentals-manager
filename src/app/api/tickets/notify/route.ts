import { NextRequest, NextResponse } from 'next/server';
import { sendTechNotification, NotificationEvent } from '@/infrastructure/notifications/notificationService';
import { getSession } from '@/infrastructure/auth/session';

export async function POST(req: NextRequest) {
  try {
    // Sin este chequeo, cualquiera en internet podia mandar el email/whatsapp de
    // notificacion a un destinatario arbitrario (tech.email/tech.whatsapp vienen
    // enteros en el body, sin validar contra la base).
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { ticket, tech, event } = await req.json();

    if (!ticket || !tech || !event) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (ticket, tech, event).' }, { status: 400 });
    }

    // Llamar al servicio desacoplado de notificaciones en el backend
    const result = await sendTechNotification(event as NotificationEvent, ticket, tech);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error en API de notificación de ticket:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la notificación.' }, { status: 500 });
  }
}
