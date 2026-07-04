import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const emailLogs = sqliteTable('email_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  presupuestoId: text('presupuesto_id').notNull(),
  numeroPresupuesto: text('numero_presupuesto').notNull(),
  emailDestinatario: text('email_destinatario').notNull(),
  clienteNombre: text('cliente_nombre').notNull(),
  fechaEnvio: text('fecha_envio').notNull(),
  estado: text('estado').notNull(), // "enviado" o "error"
});
