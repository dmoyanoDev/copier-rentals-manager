import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './src/lib/auth/sessionDecrypt';

const SESSION_COOKIE_NAME = 'ms_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Path: ${pathname}`);

  // 1. Obtener la cookie de sesión
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const token = sessionCookie?.value;
  console.log(`[Middleware] Token present: ${!!token}`);

  // Desencriptar la sesión sin consultar la base de datos (seguro para Edge Runtime)
  const session = token ? await decryptSession(token) : null;
  console.log(`[Middleware] Session resolved:`, session);

  // Rutas públicas de autenticación
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // Si no está autenticado y no está en una ruta de auth
  if (!session) {
    if (!isAuthRoute) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' }
        }, { status: 401 });
      }
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

  // Protección exclusiva para el usuario Maestro
  const isMasterRoute = pathname.startsWith('/usuarios') || pathname.startsWith('/respaldo');
  const isMasterApiRoute = pathname.startsWith('/api/users') || pathname.startsWith('/api/backup') || pathname.startsWith('/api/export') || pathname.startsWith('/api/import');

  if (isMasterRoute || isMasterApiRoute) {
    const isMaster = session.isMaster === true || session.role === 'master' || session.userId === 'user-admin';
    if (!isMaster) {
      if (isMasterApiRoute || pathname.startsWith('/api/')) {
        return NextResponse.json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'No tenés permisos para acceder a este recurso.' }
        }, { status: 403 });
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
