import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';

// Sedes/ubicaciones dentro de un mismo cliente (ej: un hospital con varias áreas, cada
// una con sus propios equipos alquilados). Una oficina no tiene sentido sin su cliente —
// a diferencia de Machine.clientId (que puede quedar en null, un equipo sin asignar),
// clientId acá usa cascade: borrar el cliente borra sus oficinas.
export const oficinas = sqliteTable('oficinas', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
export type OficinaSelect = typeof oficinas.$inferSelect;
export type OficinaInsert = typeof oficinas.$inferInsert;
