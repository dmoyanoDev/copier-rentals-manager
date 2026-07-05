import { NextRequest, NextResponse } from 'next/server';
import { sendTechNotification, NotificationEvent } from '@/infrastructure/notifications/notificationService';
import { autoAssignTech } from '@/domain/ticket/assignment';
import { Ticket, User } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tickets, users } = body as { tickets: Ticket[]; users: User[] };

    if (!tickets || !users) {
      return NextResponse.json({ error: 'Faltan parámetros (tickets, users).' }, { status: 400 });
    }

    const updatedTickets: Ticket[] = [];
    const executionLogs: string[] = [];

    const now = Date.now();

    for (const ticket of tickets) {
      // Omitir tickets concluidos o cerrados
      if (['resuelto', 'cerrado'].includes(ticket.status)) {
        updatedTickets.push(ticket);
        continue;
      }

      let ticketUpdated = false;
      const history = [...(ticket.history || [])];

      // A. Control de SLA (Alertas de vencimiento)
      if (ticket.slaDate) {
        const sla = new Date(ticket.slaDate);
        if (!isNaN(sla.getTime())) {
          const diffMs = sla.getTime() - now;
          const diffHours = diffMs / (1000 * 60 * 60);

          // 1. Alerta Crítica SLA Vencido
          if (diffMs < 0) {
            const alreadyNotifiedVencido = history.some(h => h.action.includes('Alerta crítica: El ticket ha vencido'));
            if (!alreadyNotifiedVencido) {
              const tech = users.find(u => u.id === ticket.assignedTechId);
              let logText = 'Alerta de SLA vencido registrada.';
              
              if (tech) {
                try {
                  const notifyResult = await sendTechNotification('sla_vencido', ticket, tech);
                  logText = `[Alerta SLA] Alerta crítica: El ticket ha vencido. ${notifyResult.logAction}`;
                } catch (e) {
                  logText = `[Alerta SLA] Alerta crítica: El ticket ha vencido. (WhatsApp/Email simulado)`;
                }
              } else {
                logText = `[Alerta SLA] Alerta crítica: El ticket ha vencido sin técnico asignado.`;
              }

              history.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logText,
                user: 'Sistema'
              });
              ticketUpdated = true;
              executionLogs.push(`TCK-${ticket.id.replace('ticket-', '')}: Alerta de SLA vencido despachada.`);
            }
          }
          // 2. Recordatorio SLA por vencer (menor a 4 horas)
          else if (diffHours < 4) {
            const alreadyNotifiedPorVencer = history.some(h => h.action.includes('Recordatorio enviado: SLA por vencer'));
            if (!alreadyNotifiedPorVencer) {
              const tech = users.find(u => u.id === ticket.assignedTechId);
              let logText = 'Recordatorio de SLA por vencer registrado.';
              
              if (tech) {
                try {
                  const notifyResult = await sendTechNotification('sla_por_vencer', ticket, tech);
                  logText = `[Alerta SLA] Recordatorio enviado: SLA por vencer en menos de 4 horas. ${notifyResult.logAction}`;
                } catch (e) {
                  logText = `[Alerta SLA] Recordatorio enviado: SLA por vencer en menos de 4 horas.`;
                }
              }

              history.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logText,
                user: 'Sistema'
              });
              ticketUpdated = true;
              executionLogs.push(`TCK-${ticket.id.replace('ticket-', '')}: Recordatorio de SLA por vencer despachado.`);
            }
          }
        }
      }

      // B. Regla de Escalamiento por Inactividad (más de 2 horas sin actualizaciones)
      const ticketCreatedTime = ticket.createdAt || (new Date(ticket.date + 'T' + ticket.time).getTime());
      
      // Obtener el timestamp de la última actividad del historial
      let lastActivityTime = ticketCreatedTime;
      if (history.length > 0) {
        const lastH = history[history.length - 1];
        const lastHTime = new Date(lastH.date + 'T' + lastH.time).getTime();
        if (!isNaN(lastHTime)) {
          lastActivityTime = lastHTime;
        }
      }

      const inactivityMs = now - lastActivityTime;
      const inactivityHours = inactivityMs / (1000 * 60 * 60);

      // Si lleva más de 2 horas inactivo en estado nuevo o asignado
      if (['nuevo', 'asignado'].includes(ticket.status) && inactivityHours >= 2) {
        const alreadyEscalated = history.some(h => h.action.includes('Escalamiento Automático'));
        
        if (!alreadyEscalated) {
          // 1. Elevar prioridad a urgente
          const prevPriority = ticket.priority;
          const newPriority = 'urgente';

          // 2. Recalcular SLA a 4 horas críticas
          const newSla = new Date();
          newSla.setHours(newSla.getHours() + 4);

          // 3. Ejecutar autoasignación inteligente
          const activeTicketsList = tickets.filter(t => t.id !== ticket.id);
          const assignResult = autoAssignTech(ticket, users, activeTicketsList);
          
          let escalationLog = `[Escalamiento Automático] Prioridad elevada de ${prevPriority.toUpperCase()} a URGENTE y SLA recalculado a 4 horas por inactividad (>2h).`;

          const assignedTech = users.find(u => u.id === assignResult.techId);
          let newStatus = ticket.status;

          if (assignedTech) {
            newStatus = 'asignado';
            escalationLog += ` Reasignado automáticamente al técnico disponible: ${assignedTech.fullname} (Score: ${assignResult.score}).`;
          } else {
            escalationLog += ` No se encontraron técnicos disponibles para reasignación.`;
          }

          history.push({
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            action: escalationLog,
            user: 'Sistema'
          });

          const escalatedTicket: Ticket = {
            ...ticket,
            priority: newPriority,
            status: newStatus,
            assignedTechId: assignResult.techId || ticket.assignedTechId,
            slaDate: newSla.toISOString(),
            history
          };

          // Intentar notificar al nuevo técnico asignado
          if (assignedTech) {
            try {
              const notifyResult = await sendTechNotification('reasignado', escalatedTicket, assignedTech);
              history.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: `[Notificación Escalamiento] ${notifyResult.logAction}`,
                user: 'Sistema'
              });
            } catch (err) {
              // ignore
            }
          }

          updatedTickets.push(escalatedTicket);
          executionLogs.push(`TCK-${ticket.id.replace('ticket-', '')}: Ticket escalado por inactividad.`);
          continue;
        }
      }

      if (ticketUpdated) {
        updatedTickets.push({
          ...ticket,
          history
        });
      } else {
        updatedTickets.push(ticket);
      }
    }

    return NextResponse.json({
      success: true,
      tickets: updatedTickets,
      logs: executionLogs
    });
  } catch (error: any) {
    console.error('Error in tickets cron route:', error);
    return NextResponse.json({ error: 'Server error processing tickets cron.' }, { status: 500 });
  }
}
