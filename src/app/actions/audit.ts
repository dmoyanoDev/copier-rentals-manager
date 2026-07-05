'use server';

import { db } from '@/infrastructure/db/client';
import { auditLogs } from '@/infrastructure/db/schema/auditLogs';
import { desc } from 'drizzle-orm';

export interface AuditLogInsert {
  module: string;
  action: string;
  details: string;
  user: string;
}

/**
 * Registra una acción crítica en el log de auditoría.
 */
export async function addAuditLogAction(log: AuditLogInsert) {
  try {
    const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    await db.insert(auditLogs).values({
      id,
      module: log.module,
      action: log.action,
      details: log.details,
      user: log.user,
      createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error al agregar log de auditoría:', error);
    return { error: 'No se pudo escribir en el registro de auditoría.' };
  }
}

/**
 * Obtiene todos los registros del log de auditoría ordenados por fecha descendente.
 */
export async function getAuditLogsAction() {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));
    
    // Format dates to simple ISO strings for client components compatibility
    return {
      success: true,
      logs: logs.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString()
      }))
    };
  } catch (error) {
    console.error('Error al consultar logs de auditoría:', error);
    return { error: 'Error del servidor al consultar registros.' };
  }
}
