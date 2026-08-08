import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const ventas = sqliteTable('ventas', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  origen: text('origen').notNull(),
  machineId: text('machine_id'),
  catalogId: text('catalog_id'),
  descripcion: text('descripcion'),
  clientId: text('client_id'),
  clientNameSnapshot: text('client_name_snapshot'),
  cantidad: real('cantidad').default(1).notNull(),
  precioVenta: real('precio_venta').default(0).notNull(),
  costoVenta: real('costo_venta').default(0).notNull(),
  fecha: text('fecha').notNull(),
  notas: text('notas'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type VentaSelect = typeof ventas.$inferSelect;
export type VentaInsert = typeof ventas.$inferInsert;
