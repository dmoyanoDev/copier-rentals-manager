import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Singleton table: always one row with id='singleton' (same pattern as cobranzaConfig).
// manualStockRate is the dollar rate actually used for internal calculations — independent
// of the reference quotes below, which are informational only (fetched from /api/dolar).
export const dollarSettings = sqliteTable('dollar_settings', {
  id: text('id').primaryKey().default('singleton'),
  manualStockRate: real('manual_stock_rate').default(0).notNull(),
  lastOficialVenta: real('last_oficial_venta'),
  lastBlueVenta: real('last_blue_venta'),
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
  lastFetchStatus: text('last_fetch_status').default('never').notNull(), // 'ok' | 'error' | 'never'
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type DollarSettingsSelect = typeof dollarSettings.$inferSelect;
export type DollarSettingsInsert = typeof dollarSettings.$inferInsert;
