import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './infrastructure/auth/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir archivos estáticos y API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 1. Obtener cookie de sesión
  const sessionCookie = request.cookies.get('ms_session');
  
  // 2. Resolver sesión
  const session = sessionCookie ? await getSession(sessionCookie.value) : null;

  // 3. Si no hay sesión activa y el path no es /login, redirigir a /login
  if (!session && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Si hay sesión y el path es /login, redirigir al Dashboard principal (/)
  if (session && pathname === '/login') {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 5. Protección de roles (RBAC) para técnicos
  if (session && session.role === 'tecnico') {
    // Los técnicos solo pueden acceder a: Dashboard (/), Soporte Técnico (/tecnica) y Consulta de Máquinas (/maquinas)
    const restrictedPaths = ['/lecturas', '/abonos', '/usuarios', '/clientes', '/historial', '/presupuestos', '/respaldo', '/alquileres'];
    const isRestricted = restrictedPaths.some(path => pathname.startsWith(path));
    
    if (isRestricted) {
      const accessDeniedUrl = new URL('/', request.url);
      return NextResponse.redirect(accessDeniedUrl);
    }
  }

  return NextResponse.next();
}

// Interceptar todas las rutas excepto recursos estáticos
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
