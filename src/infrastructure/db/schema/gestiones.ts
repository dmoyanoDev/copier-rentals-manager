import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';

export const gestiones = sqliteTable('gestiones', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  type: text('type').notNull(), // WhatsApp | Email | Llamado | Pago registrado | Promesa de pago | Regularización | Auditoría
  user: text('user').notNull(),
  channel: text('channel').notNull().default(''),
  result: text('result').notNull().default(''),
  observations: text('observations').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
