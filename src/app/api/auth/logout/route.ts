import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/infrastructure/auth/session';
import { logSecurityEvent } from '@/lib/security/audit';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const username = session ? session.username : 'Unknown';

    await deleteSession();

    if (session) {
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await logSecurityEvent('logout', username, `Cierre de sesión. IP: ${ip}`);
    }

    return NextResponse.json({ success: true, message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    console.error('Error en API de logout:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la solicitud.' }, { status: 500 });
  }
}
