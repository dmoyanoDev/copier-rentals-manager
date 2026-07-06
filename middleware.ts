import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './src/lib/auth/sessionDecrypt';

const SESSION_COOKIE_NAME = 'ms_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Obtener la cookie de sesión
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const token = sessionCookie?.value;

  // Desencriptar la sesión sin consultar la base de datos (seguro para Edge Runtime)
  const session = token ? await decryptSession(token) : null;

  // Rutas públicas de autenticación
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // Si no está autenticado y no está en una ruta de auth, redirigir a /login
  if (!session) {
    if (!isAuthRoute) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Si ya está autenticado e intenta ir a las pantallas de login/auth, redirigir a inicio
  if (isAuthRoute) {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Protección exclusiva para el usuario Maestro ("dmoyano")
  const isMasterRoute = pathname.startsWith('/usuarios') || pathname.startsWith('/respaldo');
  const isMasterApiRoute = pathname.startsWith('/api/users');

  if (isMasterRoute || isMasterApiRoute) {
    const isMaster = session.username === 'dmoyano' && session.role === 'master';
    if (!isMaster) {
      if (isMasterApiRoute) {
        return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
      }
      // Redirigir al dashboard si intenta entrar a /usuarios o /respaldo
      const dashboardUrl = new URL('/', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png (public logo)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/auth/login|api/auth/forgot-password|api/auth/reset-password).*)',
  ],
};
