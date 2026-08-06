import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const machinePresets = sqliteTable('machine_presets', {
  id: text('id').primaryKey(),
  marca: text('marca').notNull(),
  modelo: text('modelo').notNull(),
  nombreComercial: text('nombre_comercial').default('').notNull(),
  tipo: text('tipo').default('B&N').notNull(),
  ppm: integer('ppm').default(40).notNull(),
  funciones: text('funciones').default('').notNull(),
  duplex: integer('duplex', { mode: 'boolean' }).default(true).notNull(),
  escaner: integer('escaner', { mode: 'boolean' }).default(true).notNull(),
  adf: integer('adf', { mode: 'boolean' }).default(true).notNull(),
  conectividad: text('conectividad').default('').notNull(),
  papel: text('papel').default('').notNull(),
  pantalla: text('pantalla').default('').notNull(),
  memoria: text('memoria').default('').notNull(),
  capacidadPapel: text('capacidad_papel').default('').notNull(),
  technicalSummary: text('technical_summary').default('').notNull(),
  commercialNotes: text('commercial_notes').default('').notNull(),
  activo: integer('activo', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type MachinePresetSelect = typeof machinePresets.$inferSelect;
export type MachinePresetInsert = typeof machinePresets.$inferInsert;
