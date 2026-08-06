import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const budgetTemplates = sqliteTable('budget_templates', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').notNull(), // BudgetType: alquiler, insumo, repuesto, servicio_tecnico, mixto, venta
  defaultIntroText: text('default_intro_text').default('').notNull(),
  defaultConditionsText: text('default_conditions_text').default('').notNull(),
  defaultIncludesText: text('default_includes_text').default('').notNull(),
  defaultExcludesText: text('default_excludes_text').default('').notNull(),
  defaultRequirementsText: text('default_requirements_text').default('').notNull(),
  defaultTaxMode: text('default_tax_mode').default('ADD_21').notNull(),
  activo: integer('activo', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type BudgetTemplateSelect = typeof budgetTemplates.$inferSelect;
export type BudgetTemplateInsert = typeof budgetTemplates.$inferInsert;
