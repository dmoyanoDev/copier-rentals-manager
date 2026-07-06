import { NextResponse } from 'next/server';
import { getSession } from '@/infrastructure/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const isMaster = session.username === 'dmoyano' && session.role === 'master';

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        fullname: session.fullname,
        role: session.role,
        permissions: {
          isMaster,
          canAccessUsers: isMaster,
          canAccessBackups: isMaster,
          canManageSystem: isMaster || session.role === 'admin',
        },
      },
    });
  } catch (error) {
    console.error('Error en API auth/me:', error);
    return NextResponse.json({ authenticated: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
