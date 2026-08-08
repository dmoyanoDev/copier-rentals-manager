import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const gastosGenerales = sqliteTable('gastos_generales', {
  id: text('id').primaryKey(),
  categoria: text('categoria').default('Otros').notNull(),
  monto: real('monto').default(0).notNull(),
  fecha: text('fecha').notNull(),
  descripcion: text('descripcion'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type GastoGeneralSelect = typeof gastosGenerales.$inferSelect;
export type GastoGeneralInsert = typeof gastosGenerales.$inferInsert;
