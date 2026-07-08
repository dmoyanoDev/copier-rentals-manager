import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { machines } from './machines';
import { clients } from './clients';
import { plans } from './plans';

export const readings = sqliteTable('readings', {
  id: text('id').primaryKey(),
  machineId: text('machine_id').references(() => machines.id).notNull(),
  clientId: text('client_id').references(() => clients.id).notNull(),
  abonoId: text('abono_id').references(() => plans.id).notNull(),
  month: text('month').notNull(), // YYYY-MM
  initial: integer('initial').notNull(),
  final: integer('final').notNull(),
  excessCount: integer('excess_count').default(0).notNull(),
  excessPrice: real('excess_price').default(0).notNull(),
  netAmount: real('net_amount').default(0).notNull(),
  ivaAmount: real('iva_amount').default(0).notNull(),
  totalAmount: real('total_amount').default(0).notNull(),
  readingStatus: text('reading_status').default('Lectura tomada').notNull(),
  billingStatus: text('billing_status').default('No facturado').notNull(), // No facturado, Facturado, Enviada
  collectionStatus: text('collection_status').default('Impago').notNull(), // Impago, Parcial, Pagado
  comments: text('comments'),
  invoiceNumber: text('invoice_number'),
  invoiceDate: text('invoice_date'),
  dueDate: text('due_date'),
  paymentDate: text('payment_date'),
  paymentAmount: real('payment_amount').default(0).notNull(),
  isUnofficial: integer('is_unofficial', { mode: 'boolean' }).default(false).notNull(),
  creditNote: real('credit_note').default(0).notNull(),
  creditNoteReason: text('credit_note_reason'),
  debitNote: real('debit_note').default(0).notNull(),
  debitNoteReason: text('debit_note_reason'),
  invoiceFile: text('invoice_file'), // Base64 or local URL
  history: text('history', { mode: 'json' }).$defaultFn(() => []).notNull(), // Log trace timeline
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
