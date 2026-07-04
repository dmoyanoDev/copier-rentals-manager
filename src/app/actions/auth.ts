'use server';

import { redirect } from 'next/navigation';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createSession, deleteSession } from '@/infrastructure/auth/session';

export interface ActionResponse {
  error?: string;
  success?: boolean;
}

/**
 * Server Action para procesar el inicio de sesión.
 * Si la base de datos no tiene usuarios, autogenera el administrador maestro
 * para facilitar el primer acceso.
 */
export async function loginAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  const username = (formData.get('username') as string)?.trim();
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Por favor, ingresa usuario y contraseña.' };
  }

  try {
    // 1. Verificar si existen usuarios, si no hay ninguno, autosembrar el administrador maestro
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length === 0) {
      const defaultPasswordHash = await bcrypt.hash('Jueves2389$', 10);
      const defaultAdmin = {
        id: 'user-admin',
        username: 'dmoyano',
        fullname: 'Darío Moyano',
        email: 'dmoyano@mstecnologia.com.ar',
        passwordHash: defaultPasswordHash,
        role: 'admin',
      };
      await db.insert(users).values(defaultAdmin);
    }

    // 2. Buscar usuario por nombre de usuario
    const results = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = results[0];

    if (!user) {
      return { error: 'Usuario o contraseña incorrectos.' };
    }

    // 3. Validar hash de la contraseña
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return { error: 'Usuario o contraseña incorrectos.' };
    }

    // 4. Crear cookie de sesión segura httpOnly
    await createSession({
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
    });
  } catch (error: any) {
    console.error('Error en Server Action de Login:', error);
    return { error: 'Error interno del servidor. Compruebe la conexión a la base de datos.' };
  }

  // Redirigir al dashboard tras logueo exitoso
  redirect('/');
}

/**
 * Server Action para cerrar sesión y eliminar la cookie.
 */
export async function logoutAction() {
  await deleteSession();
  redirect('/login');
}
