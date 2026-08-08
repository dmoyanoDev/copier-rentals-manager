import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Parámetros comerciales de precios (Módulo Catálogo/Stock), configurables en 3 niveles:
// una fila con scope='global' (id fijo 'pricing-global', siempre completa), y filas
// opcionales scope='categoria'/'unidad' que sobrescriben SOLO los campos que traen no-nulos
// — el resto se hereda. `scopeKey` es null en global, el `tipoProducto` en categoria, el
// id de `parts_catalog` en unidad. Sin FK dura en scopeKey (es polimórfico) — mismo patrón
// ya usado por `ventas.catalogId`/`machines.tonerCatalogId`, resuelto en código.
// Ids determinísticos ('pricing-categoria-<tipo>', 'pricing-unidad-<itemId>') para que
// "ya existe un override para esto" sea una búsqueda directa, no un scan.
export const pricingSettings = sqliteTable('pricing_settings', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(), // 'global' | 'categoria' | 'unidad'
  scopeKey: text('scope_key'),
  transportePct: real('transporte_pct'),
  precioListaPct: real('precio_lista_pct'),
  precioEfectivoPct: real('precio_efectivo_pct'),
  licitacionesPct: real('licitaciones_pct'),
  insumosRepuestosPct: real('insumos_repuestos_pct'),
  equiposPct: real('equipos_pct'),
  promocionesPct: real('promociones_pct'),
  promocionesActiva: integer('promociones_activa', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type PricingSettingSelect = typeof pricingSettings.$inferSelect;
export type PricingSettingInsert = typeof pricingSettings.$inferInsert;
