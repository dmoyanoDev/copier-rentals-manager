import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const notificationHistory = sqliteTable('notification_history', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull(),
  techId: text('tech_id').notNull(),
  channel: text('channel').notNull(), // 'email', 'whatsapp'
  recipient: text('recipient').notNull(), // email address or phone number
  event: text('event').notNull(), // e.g. 'creado', 'asignado'
  status: text('status').notNull(), // 'enviado', 'error', 'pendiente'
  message: text('message').notNull(),
  errorDetail: text('error_detail'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
