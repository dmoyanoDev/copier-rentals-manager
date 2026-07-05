import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const notificationSettings = sqliteTable('notification_settings', {
  id: text('id').primaryKey(),
  whatsappEnabled: integer('whatsapp_enabled').default(1).notNull(), // 1 = enabled, 0 = disabled
  emailEnabled: integer('email_enabled').default(1).notNull(), // 1 = enabled, 0 = disabled
  eventsConfig: text('events_config').notNull(), // JSON mapping event keys to booleans
  templatesConfig: text('templates_config').notNull(), // JSON mapping event keys to message templates
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
