import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rute care nu necesită autentificare
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

// Rute care necesită autentificare
const protectedRoutes = ['/chat', '/admin', '/settings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude endpoint-urile API ale chat-ului (trebuie să treacă prin proxy)
  const chatApiEndpoints = ['/sessions', '/history', '/config', '/ask', '/clear', '/session'];
  const isChatApiEndpoint = pathname.match(/^\/chat\/[^/]+\/(sessions|history|config|ask|clear|session)/);
  
  if (isChatApiEndpoint) {
    // Lasă request-urile API să treacă prin proxy fără interceptare
    return NextResponse.next();
  }
  
  // Verifică dacă este o rută publică
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Verifică dacă este o rută protejată
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Dacă este rută protejată, verifică token-ul
  if (isProtectedRoute && !isPublicRoute) {
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // Redirect la login cu return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // Dacă utilizatorul este autentificat și încearcă să acceseze login/register, redirect la admin
  if (isPublicRoute && (pathname === '/login' || pathname === '/register')) {
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (token) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }
  
  // Dacă accesează ruta root, redirect la login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - chat API endpoints (sessions, history, ask, config, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|chat/[^/]+/sessions|chat/[^/]+/history|chat/[^/]+/config|chat/[^/]+/ask|chat/[^/]+/clear|chat/[^/]+/session|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

