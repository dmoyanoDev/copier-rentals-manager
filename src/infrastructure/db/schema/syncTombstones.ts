import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Records a hard delete of any synced entity so that OTHER devices doing an
// incremental pull (WHERE updated_at > since) can learn about it. A DELETE
// removes the row entirely, so the incremental query has nothing to return —
// without this table, a device that already completed its first full sync has
// no way to ever find out a row disappeared on another device.
export const syncTombstones = sqliteTable('sync_tombstones', {
  id: text('id').primaryKey(), // `${entityType}:${entityId}`
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }).notNull(),
});
export type SyncTombstoneSelect = typeof syncTombstones.$inferSelect;
export type SyncTombstoneInsert = typeof syncTombstones.$inferInsert;
