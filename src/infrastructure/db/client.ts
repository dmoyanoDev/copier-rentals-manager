import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Singleton pattern para evitar múltiples conexiones en entornos serverless
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (_db) return _db;
  
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  
  if (!url || url === 'file:local.db') {
    throw new Error('DATABASE_URL no está configurada. Verificar variables de entorno en Netlify.');
  }
  
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});
