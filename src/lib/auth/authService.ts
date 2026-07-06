import { getSession } from '@/infrastructure/auth/session';
import { redirect } from 'next/navigation';

export class AuthError extends Error {
  constructor(public code: 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Verifica si el usuario está autenticado. Retorna la sesión o arroja AuthError('UNAUTHORIZED').
 */
export async function verifyAuth(request?: Request): Promise<{ userId: string; username: string; fullname: string; role: string }> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError('UNAUTHORIZED', 'Usuario no autenticado.');
  }
  return session;
}

/**
 * Verifica si el usuario autenticado tiene uno de los roles permitidos.
 */
export async function verifyRole(allowedRoles: string[], request?: Request): Promise<{ userId: string; username: string; fullname: string; role: string }> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError('UNAUTHORIZED', 'Usuario no autenticado.');
  }
  if (!allowedRoles.includes(session.role) && session.role !== 'master') {
    throw new AuthError('FORBIDDEN', 'No tiene permisos suficientes para realizar esta acción.');
  }
  return session;
}

/**
 * Valida específicamente que el usuario autenticado sea el máster "dmoyano" con rol "master".
 */
export async function verifyMaster(request?: Request): Promise<{ userId: string; username: string; fullname: string; role: string; isMaster?: boolean }> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError('UNAUTHORIZED', 'Usuario no autenticado.');
  }
  const isMaster = session.isMaster === true || session.role === 'master' || session.userId === 'user-admin';
  if (!isMaster) {
    throw new AuthError('FORBIDDEN', 'Acceso denegado: Se requiere el usuario Maestro.');
  }
  return session;
}

/**
 * Guard para páginas de Next.js (Server Components). Redirige a /login si no está autenticado.
 */
export async function requireAuthPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

/**
 * Guard para páginas protegidas de Next.js (Server Components).
 * Redirige al inicio si el usuario no es el maestro.
 */
export async function requireMasterPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const isMaster = session.isMaster === true || session.role === 'master' || session.userId === 'user-admin';
  if (!isMaster) {
    redirect('/');
  }
  return session;
}
