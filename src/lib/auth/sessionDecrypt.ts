const SECRET_KEY = process.env.SESSION_SECRET || 'secret-key-that-must-be-32-chars-long-!!';

export interface UserSession {
  userId: string;
  username: string;
  fullname: string;
  role: string;
  isMaster?: boolean;
  sessionId: string;
  expiresAt: number;
}

// Convert SECRET_KEY to CryptoKey for Web Crypto API
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = enc.encode(SECRET_KEY.padEnd(32).substring(0, 32));
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
  const key = await getCryptoKey();
  
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
 * Desencripta la sesión usando AES-GCM (compatible con Edge Runtime y Node.js sin DB).
 */
export async function decryptSession(encryptedText: string): Promise<UserSession | null> {
  try {
    const parts = encryptedText.split(':');
    const ivHex = parts[0];
    const encryptedHex = parts[1];
    if (!ivHex || !encryptedHex) return null;

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const key = await getCryptoKey();

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
