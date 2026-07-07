import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, or } from 'drizzle-orm';
import { verifyMaster } from '@/lib/auth/authService';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { logSecurityEvent } from '@/lib/security/audit';

// Always fetch live data from Turso — never serve cached user lists
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
};

export async function GET(request: Request) {

  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  try {
    try {
      await verifyMaster(request);
    } catch (e: any) {
      await logSecurityEvent('forbidden_access', 'system', `Intento no autorizado de listar usuarios. IP: ${ip}`);
      const code = e.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED';
      const status = e.code === 'FORBIDDEN' ? 403 : 401;
      const message = e.code === 'FORBIDDEN' 
        ? 'No tenés permisos para acceder a usuarios.' 
        : 'Sesión no válida.';
      return NextResponse.json({ ok: false, error: { code, message } }, { status });
    }

    const allUsers = await db.select().from(users);

    const safeUsers = allUsers.map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });

    return NextResponse.json({ ok: true, data: { users: safeUsers } }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('Error en GET /api/users:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  let masterUser;

  try {
    masterUser = await verifyMaster(request);
  } catch (e: any) {
    await logSecurityEvent('forbidden_access', 'Unknown', `Intento no autorizado de crear usuario. IP: ${ip}`);
    const code = e.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED';
    const status = e.code === 'FORBIDDEN' ? 403 : 401;
    const message = e.code === 'FORBIDDEN' 
      ? 'No tenés permisos para acceder a usuarios.' 
      : 'Sesión no válida.';
    return NextResponse.json({ ok: false, error: { code, message } }, { status });
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

    if (!username || !email || !password || !fullname || !role) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Faltan campos obligatorios para la creación del usuario.' }
      }, { status: 400 });
    }

    const duplicates = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username.trim()), eq(users.email, email.trim())))
      .limit(1);

    if (duplicates.length > 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'CONFLICT', message: 'El nombre de usuario o correo electrónico ya se encuentra registrado.' }
      }, { status: 409 });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      return NextResponse.json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: strength.error }
      }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const newUserValues = {
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
    };

    await db.insert(users).values(newUserValues);

    await logSecurityEvent('user_created', masterUser.username, `Usuario creado exitosamente: ${username}. IP: ${ip}`);

    const { passwordHash: _, ...safeUser } = newUserValues;

    return NextResponse.json({ ok: true, data: { user: safeUser } }, { status: 201 });
  } catch (error: any) {
    console.error('Error en POST /api/users:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}
