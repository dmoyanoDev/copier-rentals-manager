import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { readings } from './readings';

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  receiptNumber: text('receipt_number').unique().notNull(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  readingId: text('reading_id').references(() => readings.id, { onDelete: 'set null' }),
  amount: real('amount').default(0).notNull(),
  method: text('method').default('Efectivo').notNull(), // Efectivo, Transferencia, Cheque, Tarjeta de Débito, Tarjeta de Crédito, Otro
  date: text('date').notNull(),
  invoiceReference: text('invoice_reference'),
  receivedByUserId: text('received_by_user_id'),
  receivedByName: text('received_by_name').default('').notNull(),
  clientNameSnapshot: text('client_name_snapshot').default('').notNull(),
  clientCuitSnapshot: text('client_cuit_snapshot'),
  period: text('period'),
  concept: text('concept'),
  readingTotalSnapshot: real('reading_total_snapshot'),
  balanceAfter: real('balance_after').default(0).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type PaymentSelect = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;
