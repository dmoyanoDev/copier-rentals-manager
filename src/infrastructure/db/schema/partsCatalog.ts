import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const partsCatalog = sqliteTable('parts_catalog', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  categoria: text('categoria').default('Insumo').notNull(), // 'Insumo' | 'Repuesto'
  unidad: text('unidad').default('Unidad').notNull(),
  costoUnitario: real('costo_unitario').default(0).notNull(),
  stockActual: integer('stock_actual').default(0).notNull(),
  stockMinimo: integer('stock_minimo').default(0).notNull(),
  notas: text('notas'),
  activo: integer('activo', { mode: 'boolean' }).default(true).notNull(),
  // Etapa 6: cuántas copias rinde esta unidad (tóner, módulo de imagen, fusor).
  // Null = no aplica a este ítem, no se asume un valor.
  rendimientoCopias: integer('rendimiento_copias'),
  // Módulo Catálogo/Stock: campos del catálogo de venta (insumos y equipos), separados
  // de `categoria` (Insumo/Repuesto) a propósito — ver pricing.ts. `tipoProducto` es la
  // taxonomía real del Excel (INSUMOS, MULTIFUNCION MONOCROMATICA, etc.) y es la clave de
  // "categoría" para la config de precios en 3 niveles; `categoria` sigue siendo lo que ya
  // era (usado por Ventas/PartsPicker), no se toca.
  codigo: text('codigo'),
  descripcion: text('descripcion'),
  tipoProducto: text('tipo_producto'),
  subcategoria: text('subcategoria'),
  marca: text('marca'),
  modelo: text('modelo'),
  proveedor: text('proveedor'),
  moneda: text('moneda').default('ARS'),
  // Costo de entrada real (en `moneda`). `costoUnitario` de arriba pasa a ser un caché en
  // ARS calculado a partir de este + el dólar manual, para que todo lector existente
  // (stats.ts, PartsPicker, PartUsageEntry) siga funcionando sin cambios.
  costoBase: real('costo_base'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type PartsCatalogSelect = typeof partsCatalog.$inferSelect;
export type PartsCatalogInsert = typeof partsCatalog.$inferInsert;
