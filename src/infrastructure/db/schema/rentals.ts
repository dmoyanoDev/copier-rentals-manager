import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { machines } from './machines';
import { plans } from './plans';

export const rentals = sqliteTable('rentals', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  machineId: text('machine_id').references(() => machines.id, { onDelete: 'cascade' }).notNull(),
  abonoId: text('abono_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  startDate: text('startDate').notNull(),
  endDate: text('endDate'),
  status: text('status').default('activo').notNull(),
  observations: text('observations'),
  history: text('history'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
