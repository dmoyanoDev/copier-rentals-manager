import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  fullname: text('fullname').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('administrativo').notNull(), // 'admin', 'tecnico', 'administrativo'
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  zone: text('zone'),
  specialty: text('specialty'),
  availability: text('availability').default('Disponible').notNull(), // Disponible, No disponible, Licencia
  active: integer('active').default(1).notNull(), // 1 = Activo, 0 = Inactivo
  workHours: text('work_hours'),
  internalNotes: text('internal_notes'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: integer('locked_until', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
