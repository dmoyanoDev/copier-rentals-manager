import { NextRequest, NextResponse } from 'next/server';
import { sendTechNotification, NotificationEvent } from '@/infrastructure/notifications/notificationService';

export async function POST(req: NextRequest) {
  try {
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
