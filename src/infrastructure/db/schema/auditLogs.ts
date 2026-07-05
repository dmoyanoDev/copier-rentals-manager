import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  module: text('module').notNull(), // 'clientes' | 'maquinas' | 'alquileres' | 'abonos' | 'lecturas' | 'tickets' | 'datos'
  action: text('action').notNull(), // 'crear' | 'editar' | 'eliminar' | 'importar' | 'exportar' | 'backup' | 'limpieza' | 'restauracion'
  details: text('details').notNull(),
  user: text('user').notNull(),
});
