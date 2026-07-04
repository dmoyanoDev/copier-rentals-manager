import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { plans } from './plans';

export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  serial: text('serial').unique().notNull(),
  type: text('type').notNull(), // Monocromática, Color
  status: text('status').default('Usado').notNull(), // Nuevo, Usado, Scrap, No funciona
  machineCounter: integer('machine_counter').default(0).notNull(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  abonoId: text('abono_id').references(() => plans.id, { onDelete: 'set null' }),
  installationDate: text('installation_date'),
  initialCounter: integer('initial_counter').default(0).notNull(),
  applyIva: integer('apply_iva', { mode: 'boolean' }).default(false).notNull(),
  readingDay: integer('reading_day').default(10).notNull(),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true).notNull(),
  pdfUrl: text('pdf_url'),
  features: text('features'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
