import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { machines } from './machines';
import { users } from './users';

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  clientType: text('client_type').default('existente').notNull(), // existente, externo
  clientId: text('client_id').references(() => clients.id),
  clientName: text('client_name').notNull(),
  machineId: text('machine_id').references(() => machines.id),
  machineDesc: text('machine_desc').notNull(),
  serialNumber: text('serial_number'),
  category: text('category').notNull(), // Servicio, Repuesto, Insumo
  requestType: text('request_type').default('Telefono').notNull(), // Telefono, WhatsApp, Email
  priority: text('priority').default('Media').notNull(), // Baja, Media, Alta, Urgente
  status: text('status').default('nuevo').notNull(),
  description: text('description').notNull(),
  diagnostic: text('diagnostic'),
  partsNeeded: text('parts_needed'),
  partsUsed: text('parts_used'),
  internalNotes: text('internal_notes'),
  actionTaken: text('action_taken'),
  assignedTechId: text('assigned_tech_id').references(() => users.id),
  slaDate: integer('sla_date', { mode: 'timestamp' }),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  history: text('history', { mode: 'json' }).$defaultFn(() => []).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
