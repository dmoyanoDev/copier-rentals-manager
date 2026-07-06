let SECRET_KEY: string = process.env.SESSION_SECRET || '';

const isProduction = 
  process.env.NODE_ENV === 'production' || 
  process.env.NETLIFY === 'true' || 
  process.env.CONTEXT === 'production' ||
  (typeof window === 'undefined' && 
   process.env.NODE_ENV !== 'development' && 
   process.env.NODE_ENV !== 'test');

if (!SECRET_KEY) {
  if (isProduction) {
    throw new Error('FATAL: La variable de entorno SESSION_SECRET no está definida en el entorno de servidor o middleware de producción. Por favor, asegúrate de configurar SESSION_SECRET en el panel de Netlify y que su ámbito (scope) incluya tanto "Serverless Functions" como "Edge Functions".');
  } else {
    console.warn('WARNING: SESSION_SECRET no está definida. Generando clave efímera para desarrollo/testing.');
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    SECRET_KEY = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export interface UserSession {
  userId: string;
  username: string;
  fullname: string;
  role: string;
  isMaster?: boolean;
  sessionId: string;
  expiresAt: number;
}

export function isMasterUser(user?: { role: string; isMaster?: boolean | number | null } | null): boolean {
  if (!user) return false;
  return user.role === 'master' || user.isMaster === true || user.isMaster === 1;
}

// Convert key string to CryptoKey for Web Crypto API (exactly 256 bits)
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawBytes = enc.encode(secret);
  const keyMaterial = new Uint8Array(32);
  keyMaterial.set(rawBytes.slice(0, 32));

  return await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta la sesión usando AES-GCM (compatible con Edge Runtime y Node.js sin DB).
 */
export async function encryptSession(session: UserSession): Promise<string> {
  const text = JSON.stringify(session);
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encriptar con la clave configurada
  const key = await getCryptoKey(SECRET_KEY);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  );

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${ivHex}:${encryptedHex}`;
}

/**
 * Desencripta la sesión usando AES-GCM (con fallback resiliente para Edge Runtime).
 */
export async function decryptSession(encryptedText: string): Promise<UserSession | null> {
  try {
    const parts = encryptedText.split(':');
    const ivHex = parts[0];
    const encryptedHex = parts[1];
    if (!ivHex || !encryptedHex) return null;

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const key = await getCryptoKey(SECRET_KEY);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    return null;
  }
}
