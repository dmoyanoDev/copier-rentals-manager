import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { plans } from './plans';
import { oficinas } from './oficinas';

export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  serial: text('serial').unique().notNull(),
  type: text('type').notNull(), // Monocromática, Color
  status: text('status').default('Usado').notNull(), // Nuevo, Usado, Scrap, No funciona
  machineCounter: integer('machine_counter').default(0).notNull(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  abonoId: text('abono_id').references(() => plans.id, { onDelete: 'set null' }),
  // Sede/oficina dentro del cliente asignado — solo tiene sentido si clientId está
  // seteado, y debe pertenecer a ese mismo cliente (validado en la UI de /maquinas).
  oficinaId: text('oficina_id').references(() => oficinas.id, { onDelete: 'set null' }),
  installationDate: text('installation_date'),
  initialCounter: integer('initial_counter').default(0).notNull(),
  applyIva: integer('apply_iva', { mode: 'boolean' }).default(false).notNull(),
  readingDay: integer('reading_day').default(10).notNull(),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true).notNull(),
  pdfUrl: text('pdf_url'),
  features: text('features'),
  lastServiceCounter: integer('last_service_counter').default(0).notNull(),
  preventiveInterval: integer('preventive_interval').default(15000).notNull(),
  // Placeholder simple de costo de insumos por copia (manual, por máquina) hasta que la
  // Etapa 6 del plan de rentabilidad calcule esto a partir del rendimiento real de
  // tóner/módulo/fusor. Null = no cargado, no se asume $0 de costo silenciosamente en
  // los cálculos que lo consuman (deben mostrar "sin dato" en vez de inventar un número).
  costoPorCopiaInsumos: real('costo_por_copia_insumos'),
  // Etapa 4: datos para amortización lineal (costoAdquisición ÷ vidaÚtilMeses, desde
  // fechaAdquisición). Los 3 son opcionales — sin datos, la máquina no calcula
  // resultadoNetoContable, solo resultadoOperativo (ver stats.ts).
  acquisitionCost: real('acquisition_cost'),
  acquisitionDate: text('acquisition_date'),
  usefulLifeMonths: integer('useful_life_months'),
  // Etapa 6: casilleros de consumibles instalados actualmente (tóner, módulo de
  // imagen, fusor). catalogId apunta a un parts_catalog con rendimiento_copias
  // cargado; installedAtCounter es el machine_counter al momento de instalarlo.
  tonerCatalogId: text('toner_catalog_id'),
  tonerInstalledAtCounter: integer('toner_installed_at_counter'),
  imageUnitCatalogId: text('image_unit_catalog_id'),
  imageUnitInstalledAtCounter: integer('image_unit_installed_at_counter'),
  fuserCatalogId: text('fuser_catalog_id'),
  fuserInstalledAtCounter: integer('fuser_installed_at_counter'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
