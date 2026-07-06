import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema/users';
import { eq, and, ne } from 'drizzle-orm';
import { verifyMaster } from '@/lib/auth/authService';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwordService';
import { revokeAllSessionsForUser } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

/**
 * PATCH /api/users/[id]: Actualiza los campos de un usuario o lo desactiva.
 * Protegido exclusivamente para el usuario maestro (dmoyano).
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await props.params;
  let masterUser;
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    masterUser = await verifyMaster();
  } catch (e: any) {
    await logSecurityEvent('forbidden_access', 'Unknown', `Intento no autorizado de editar usuario. IP: ${ip}`);
    return NextResponse.json({ error: e.message || 'No autorizado.' }, { status: e.code === 'FORBIDDEN' ? 403 : 401 });
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

    // 1. Obtener usuario objetivo
    const results = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const targetUser = results[0];

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const isTargetMaster = targetUser.username === 'dmoyano';

    // 2. Blindaje de dmoyano (Master User Protection)
    if (isTargetMaster) {
      // Impedir desactivación
      if (active === false || active === 0) {
        await logSecurityEvent(
          'protected_master_modification_attempt',
          masterUser.username,
          `Intento de desactivar al usuario maestro dmoyano. IP: ${ip}`
        );
        return NextResponse.json({ error: 'El usuario maestro dmoyano no puede ser desactivado.' }, { status: 403 });
      }

      // Impedir cambio de rol
      if (role && role !== 'master') {
        await logSecurityEvent(
          'protected_master_modification_attempt',
          masterUser.username,
          `Intento de cambiar el rol del usuario maestro dmoyano a ${role}. IP: ${ip}`
        );
        return NextResponse.json({ error: 'El rol del usuario maestro dmoyano no puede ser degradado.' }, { status: 403 });
      }
    }

    // 3. Validar duplicación de email
    if (email && email.trim().toLowerCase() !== targetUser.email) {
      const emailDup = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email.trim().toLowerCase()), ne(users.id, targetUserId)))
        .limit(1);

      if (emailDup.length > 0) {
        return NextResponse.json({ error: 'El correo electrónico ya se encuentra registrado por otro usuario.' }, { status: 409 });
      }
    }

    // 4. Preparar payload de actualización
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

    // Solo permitir cambiar rol si no es el master
    if (role && !isTargetMaster) {
      updateValues.role = role;
    }

    // Solo permitir cambiar activo si no es el master
    if (active !== undefined && !isTargetMaster) {
      const activeInt = (active === false || active === 0) ? 0 : 1;
      updateValues.active = activeInt;

      // Si se desactiva, invalidar todas sus sesiones de inmediato
      if (activeInt === 0) {
        await revokeAllSessionsForUser(targetUserId);
        await logSecurityEvent('user_deactivated', masterUser.username, `Usuario desactivado: ${targetUser.username}. Sesiones revocadas. IP: ${ip}`);
      }
    }

    // Si se pasa contraseña, validarla y hashearla
    if (password) {
      const strength = validatePasswordStrength(password);
      if (!strength.isValid) {
        return NextResponse.json({ error: strength.error }, { status: 400 });
      }
      updateValues.passwordHash = await hashPassword(password);
      
      // Forzar cierre de sesiones activas al cambiar contraseña administrativamente
      await revokeAllSessionsForUser(targetUserId);
    }

    await db.update(users).set(updateValues).where(eq(users.id, targetUserId));
    await logSecurityEvent('user_updated', masterUser.username, `Usuario modificado: ${targetUser.username}. IP: ${ip}`);

    return NextResponse.json({ success: true, message: 'Usuario actualizado correctamente.' });
  } catch (error: any) {
    console.error('Error en PATCH /api/users/[id]:', error);
    return NextResponse.json({ error: 'Error del servidor al actualizar usuario: ' + error.message }, { status: 500 });
  }
}
