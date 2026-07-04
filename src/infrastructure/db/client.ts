import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || 'file:local.db';

// Setup LibSQL/SQLite client (requires ZERO external server processes, runs from local file)
export const client = createClient({
  url: databaseUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Setup Drizzle instance
export const db = drizzle(client, { schema });
