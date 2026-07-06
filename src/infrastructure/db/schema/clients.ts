import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  cuit: text('cuit'),
  notes: text('notes'),
  taxCategory: text('tax_category').default('Monotributista').notNull(),
  debt: real('debt').default(0).notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

