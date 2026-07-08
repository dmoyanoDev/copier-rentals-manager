import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession, isMasterUser } from './src/lib/auth/sessionDecrypt';

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

  // Rutas públicas de autenticación y de visualización de PDF compartidos
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  const isPublicPdfRoute = pathname.startsWith('/api/pdf/');

  // Si no está autenticado y no está en una ruta pública
  if (!session) {
    if (!isAuthRoute && !isPublicPdfRoute) {
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

  // Protección de roles (RBAC) para técnicos
  if (session.role === 'tecnico') {
    // Los técnicos solo pueden acceder a: Dashboard (/), Soporte Técnico (/tecnica) y Consulta de Máquinas (/maquinas)
    const restrictedPaths = ['/lecturas', '/abonos', '/usuarios', '/clientes', '/historial', '/presupuestos', '/respaldo', '/alquileres'];
    const isRestricted = restrictedPaths.some(path => pathname.startsWith(path));
    
    if (isRestricted) {
      const accessDeniedUrl = new URL('/', request.url);
      return NextResponse.redirect(accessDeniedUrl);
    }
  }

  // Protección exclusiva para el usuario Maestro
  const isMasterRoute = pathname.startsWith('/usuarios') || pathname.startsWith('/respaldo');
  const isMasterApiRoute = pathname.startsWith('/api/users') || pathname.startsWith('/api/export') || pathname.startsWith('/api/import');
  const isBackupRestore = pathname.startsWith('/api/backup') && request.method !== 'GET';

  if (isMasterRoute || isMasterApiRoute || isBackupRestore) {
    const isMaster = isMasterUser(session);
    if (!isMaster) {
      if (isMasterApiRoute || isBackupRestore || pathname.startsWith('/api/')) {
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
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/auth/login|api/auth/forgot-password|api/auth/reset-password|api/pdf).*)',
  ],
};
