import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

// Setup LibSQL/SQLite client (requires ZERO external server processes, runs from local file)
export const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

// Setup Drizzle instance
export const db = drizzle(client, { schema });
