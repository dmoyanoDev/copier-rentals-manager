import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'ms_session';
const SECRET_KEY = process.env.SESSION_SECRET || 'secret-key-that-must-be-32-chars-long-!!';

export interface UserSession {
  userId: string;
  username: string;
  fullname: string;
  role: string;
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
 * Encripta la sesión usando AES-GCM (compatible con Edge Runtime y Node.js).
 */
export async function encryptSession(session: UserSession): Promise<string> {
  const text = JSON.stringify(session);
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV de 12 bytes para GCM
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
 * Desencripta la sesión usando AES-GCM (compatible con Edge Runtime y Node.js).
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

/**
 * Crea una cookie httpOnly encriptada que contiene la sesión del usuario.
 */
export async function createSession(user: { id: string; username: string; fullname: string; role: string }) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 1 día
  const session: UserSession = {
    userId: user.id,
    username: user.username,
    fullname: user.fullname,
    role: user.role,
    expiresAt,
  };

  const encrypted = await encryptSession(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });
}

/**
 * Recupera la sesión actual descifrando la cookie. Retorna null si no existe o expiró.
 */
export async function getSession(cookieValue?: string): Promise<UserSession | null> {
  let token = cookieValue;
  
  if (!token) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) return null;
    token = sessionCookie.value;
  }

  const session = await decryptSession(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    // Si no se pasó cookieValue explícita, podemos borrar la cookie caducada
    if (!cookieValue) {
      await deleteSession();
    }
    return null;
  }

  return session;
}

/**
 * Elimina la cookie de sesión del usuario.
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
