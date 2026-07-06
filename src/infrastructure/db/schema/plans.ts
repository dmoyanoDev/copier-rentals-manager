import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  limit: integer('limit').default(0).notNull(),
  price: real('price').default(0).notNull(),
  excessPrice: real('excess_price').default(0).notNull(),
  ivaRate: real('iva_rate').default(21.0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
