import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  numero: text('numero').unique().notNull(),
  fecha: text('fecha').notNull(),
  estado: text('estado').default('borrador').notNull(), // borrador, emitido, enviado, anulado
  tipo: text('tipo').notNull(), // alquiler, insumo, repuesto, servicio_tecnico, mixto
  templateId: text('template_id'),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  isNewClient: integer('is_new_client', { mode: 'boolean' }).default(false).notNull(),
  saveNewClient: integer('save_new_client', { mode: 'boolean' }).default(false).notNull(),
  ivaMode: text('iva_mode').default('ADD_21').notNull(), // INCLUDED, ADD_21, PLUS_IVA, EXEMPT
  moneda: text('moneda').default('ARS').notNull(),
  subtotal: real('subtotal').default(0).notNull(),
  discountType: text('discount_type').default('NONE').notNull(), // PERCENT, FIXED, NONE
  discountValue: real('discount_value').default(0).notNull(),
  discountAmount: real('discount_amount').default(0).notNull(),
  ivaAmount: real('iva_amount').default(0).notNull(),
  total: real('total').default(0).notNull(),
  validezOferta: text('validez_oferta').default('15 Días').notNull(),
  plazoMinimoContrato: text('plazo_minimo_contrato').default('12 Meses').notNull(),
  ajustePrecios: text('ajuste_precios').default('Trimestral según IPC').notNull(),
  observaciones: text('observaciones'),
  introText: text('intro_text').notNull(),
  includesText: text('includes_text').notNull(),
  excludesText: text('excludes_text').notNull(),
  requirementsText: text('requirements_text').notNull(),
  conditionsText: text('conditions_text').notNull(),
  footerText: text('footer_text').notNull(),
  clientSnapshot: text('client_snapshot', { mode: 'json' }).notNull(), // BudgetClientSnapshot
  items: text('items', { mode: 'json' }).notNull(), // BudgetItem[]
  machines: text('machines', { mode: 'json' }).notNull(), // BudgetMachineConfig[]
  sendLogs: text('send_logs', { mode: 'json' }).$defaultFn(() => []).notNull(), // BudgetSendLog[]
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  issuedAt: integer('issued_at', { mode: 'timestamp' }),
});
export type BudgetSelect = typeof budgets.$inferSelect;
export type BudgetInsert = typeof budgets.$inferInsert;
