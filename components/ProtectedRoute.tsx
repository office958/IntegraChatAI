'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ 
  children, 
  requireAuth = true,
  allowedRoles = []
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // Dacă necesită autentificare și user-ul nu este autentificat
    if (requireAuth && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Dacă necesită roluri specifice
    if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, isLoading, user, requireAuth, allowedRoles, router, pathname]);

  // Afișează loading cât timp verifică autentificarea
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Se verifică autentificarea...</p>
        </div>
      </div>
    );
  }

  // Dacă necesită autentificare dar user-ul nu este autentificat, nu afișa nimic
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // Dacă necesită roluri specifice dar user-ul nu are rolul necesar
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

