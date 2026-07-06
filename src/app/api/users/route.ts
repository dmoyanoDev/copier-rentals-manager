import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, or } from 'drizzle-orm';
import { verifyMaster } from '@/lib/auth/authService';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { logSecurityEvent } from '@/lib/security/audit';

/**
 * GET /api/users: Lista todos los usuarios del sistema.
 * Protegido exclusivamente para el usuario maestro (dmoyano).
 */
export async function GET(request: Request) {
  try {
    let masterUser;
    try {
      masterUser = await verifyMaster();
    } catch (e: any) {
      // Registrar acceso denegado en auditoría
      const actor = (await db.select().from(users).limit(1))[0]?.username || 'system'; // fallback
      await logSecurityEvent('forbidden_access', actor, `Intento no autorizado de listar usuarios. IP: ${request.headers.get('x-forwarded-for') || '127.0.0.1'}`);
      return NextResponse.json({ error: e.message || 'No autorizado.' }, { status: e.code === 'FORBIDDEN' ? 403 : 401 });
    }

    const allUsers = await db.select().from(users);

    // Omitir contraseñas de las respuestas
    const safeUsers = allUsers.map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Error en GET /api/users:', error);
    return NextResponse.json({ error: 'Error del servidor al listar usuarios.' }, { status: 500 });
  }
}

/**
 * POST /api/users: Crea un nuevo usuario.
 * Protegido exclusivamente para el usuario maestro (dmoyano).
 */
export async function POST(request: Request) {
  let masterUser;
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    masterUser = await verifyMaster();
  } catch (e: any) {
    await logSecurityEvent('forbidden_access', 'Unknown', `Intento no autorizado de crear usuario. IP: ${ip}`);
    return NextResponse.json({ error: e.message || 'No autorizado.' }, { status: e.code === 'FORBIDDEN' ? 403 : 401 });
  }

  try {
    const body = await request.json();
    const {
      username,
      fullname,
      email,
      password,
      role,
      phone,
      whatsapp,
      zone,
      specialty,
      availability,
      active,
      workHours,
      internalNotes,
    } = body;

    // Validaciones de presencia
    if (!username || !email || !password || !fullname || !role) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para la creación del usuario.' }, { status: 400 });
    }

    // 1. Validar que el username o email no estén duplicados
    const duplicates = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username.trim()), eq(users.email, email.trim())))
      .limit(1);

    if (duplicates.length > 0) {
      return NextResponse.json({ error: 'El nombre de usuario o correo electrónico ya se encuentra registrado.' }, { status: 409 });
    }

    // 2. Validar complejidad de la contraseña
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    // 3. Hashear la contraseña
    const passwordHash = await hashPassword(password);
    const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    // 4. Insertar en base de datos
    await db.insert(users).values({
      id: userId,
      username: username.trim(),
      fullname: fullname.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role || 'administrativo',
      phone: phone || null,
      whatsapp: whatsapp || null,
      zone: zone || null,
      specialty: specialty || null,
      availability: availability || 'Disponible',
      active: active === false || active === 0 ? 0 : 1,
      workHours: workHours || null,
      internalNotes: internalNotes || null,
    });

    await logSecurityEvent('user_created', masterUser.username, `Usuario creado exitosamente: ${username}. IP: ${ip}`);

    return NextResponse.json({ success: true, message: 'Usuario creado exitosamente.', userId });
  } catch (error: any) {
    console.error('Error en POST /api/users:', error);
    return NextResponse.json({ error: 'Error del servidor al crear usuario: ' + error.message }, { status: 500 });
  }
}
