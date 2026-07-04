import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sharedPdfs = sqliteTable('shared_pdfs', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  pdfBase64: text('pdf_base64').notNull(),
  createdAt: text('created_at').notNull(),
});
