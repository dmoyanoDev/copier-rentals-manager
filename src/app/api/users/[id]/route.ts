import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, and, ne } from 'drizzle-orm';
import { verifyMaster } from '@/lib/auth/authService';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { revokeAllSessionsForUser } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await props.params;
  let masterUser;
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    masterUser = await verifyMaster(request);
  } catch (e: any) {
    await logSecurityEvent('forbidden_access', 'Unknown', `Intento no autorizado de editar usuario. IP: ${ip}`);
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

    const results = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const targetUser = results[0];

    if (!targetUser) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' }
      }, { status: 404 });
    }

    const isTargetMaster = targetUser.username === 'dmoyano';

    if (isTargetMaster) {
      if (active === false || active === 0) {
        await logSecurityEvent(
          'protected_master_modification_attempt',
          masterUser.username,
          `Intento de desactivar al usuario maestro dmoyano. IP: ${ip}`
        );
        return NextResponse.json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'El usuario maestro dmoyano no puede ser desactivado.' }
        }, { status: 403 });
      }

      if (role && role !== 'master') {
        await logSecurityEvent(
          'protected_master_modification_attempt',
          masterUser.username,
          `Intento de cambiar el rol del usuario maestro dmoyano a ${role}. IP: ${ip}`
        );
        return NextResponse.json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'El rol del usuario maestro dmoyano no puede ser degradado.' }
        }, { status: 403 });
      }
    }

    if (email && email.trim().toLowerCase() !== targetUser.email) {
      const emailDup = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email.trim().toLowerCase()), ne(users.id, targetUserId)))
        .limit(1);

      if (emailDup.length > 0) {
        return NextResponse.json({
          ok: false,
          error: { code: 'CONFLICT', message: 'El correo electrónico ya se encuentra registrado por otro usuario.' }
        }, { status: 409 });
      }
    }

    const updateValues: any = {
      updatedAt: new Date(),
    };

    if (fullname) updateValues.fullname = fullname.trim();
    if (email) updateValues.email = email.trim().toLowerCase();
    if (phone !== undefined) updateValues.phone = phone || null;
    if (whatsapp !== undefined) updateValues.whatsapp = whatsapp || null;
    if (zone !== undefined) updateValues.zone = zone || null;
    if (specialty !== undefined) updateValues.specialty = specialty || null;
    if (availability) updateValues.availability = availability;
    if (workHours !== undefined) updateValues.workHours = workHours || null;
    if (internalNotes !== undefined) updateValues.internalNotes = internalNotes || null;

    if (role && !isTargetMaster) {
      updateValues.role = role;
    }

    if (active !== undefined && !isTargetMaster) {
      const activeInt = (active === false || active === 0) ? 0 : 1;
      updateValues.active = activeInt;

      if (activeInt === 0) {
        await revokeAllSessionsForUser(targetUserId);
        await logSecurityEvent('user_deactivated', masterUser.username, `Usuario desactivado: ${targetUser.username}. Sesiones revocadas. IP: ${ip}`);
      }
    }

    if (password) {
      const strength = validatePasswordStrength(password);
      if (!strength.isValid) {
        return NextResponse.json({
          ok: false,
          error: { code: 'BAD_REQUEST', message: strength.error }
        }, { status: 400 });
      }
      updateValues.passwordHash = await hashPassword(password);
      await revokeAllSessionsForUser(targetUserId);
    }

    await db.update(users).set(updateValues).where(eq(users.id, targetUserId));
    await logSecurityEvent('user_updated', masterUser.username, `Usuario modificado: ${targetUser.username}. IP: ${ip}`);

    // Query updated user
    const updatedUserResults = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const updatedUser = updatedUserResults[0];
    const { passwordHash: _, ...safeUser } = updatedUser;

    return NextResponse.json({ ok: true, data: { user: safeUser } });
  } catch (error: any) {
    console.error('Error en PATCH /api/users/[id]:', error);
    return NextResponse.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' }
    }, { status: 500 });
  }
}
