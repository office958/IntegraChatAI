'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  display?: string;
  language?: string;
  spoken_language?: string;
  voice?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Încarcă token-ul și user-ul din localStorage la mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        // Setează cookie-ul dacă există token în localStorage (pentru middleware)
        document.cookie = `auth_token=${storedToken}; path=/; max-age=${7 * 24 * 60 * 60}`;
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    
    setIsLoading(false);
  }, []);

  // Verifică token-ul la fiecare request și setează cookie-ul
  useEffect(() => {
    if (token) {
      // Setează cookie-ul pentru middleware
      document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;
      verifyToken();
    } else {
      // Șterge cookie-ul dacă nu există token
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, [token]);

  const verifyToken = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
      } else {
        // Token invalid, logout
        logout();
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Eroare la autentificare');
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      // Setează cookie pentru middleware
      document.cookie = `auth_token=${data.access_token}; path=/; max-age=${7 * 24 * 60 * 60}`;
      
      // Verifică dacă există un redirect URL
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      
      // Dacă redirect-ul este de tip /chat/{chatId}, creează automat o sesiune
      if (redirect && redirect.startsWith('/chat/')) {
        const chatIdMatch = redirect.match(/\/chat\/(\d+)/);
        if (chatIdMatch) {
          const chatId = chatIdMatch[1];
          try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            headers['Authorization'] = `Bearer ${data.access_token}`;
            
            const sessionResponse = await fetch(`/api/chat/${chatId}/session/create`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ title: null }),
            });
            
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              router.push(`/chat/${chatId}/${sessionData.session_id}`);
              return;
            } else {
              console.error('Error creating session:', sessionResponse.statusText);
              // Fallback: navighează la chat fără sesiune
              router.push(`/chat/${chatId}`);
              return;
            }
          } catch (error) {
            console.error('Error creating session:', error);
            // Fallback: navighează la chat fără sesiune
            router.push(`/chat/${chatId}`);
            return;
          }
        }
      }
      
      router.push(redirect || '/admin');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Eroare la înregistrare');
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      // Setează cookie pentru middleware
      document.cookie = `auth_token=${data.access_token}; path=/; max-age=${7 * 24 * 60 * 60}`;
      
      // Verifică dacă există un redirect URL
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      
      // Dacă redirect-ul este de tip /chat/{chatId}, creează automat o sesiune
      if (redirect && redirect.startsWith('/chat/')) {
        const chatIdMatch = redirect.match(/\/chat\/(\d+)/);
        if (chatIdMatch) {
          const chatId = chatIdMatch[1];
          try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            headers['Authorization'] = `Bearer ${data.access_token}`;
            
            const sessionResponse = await fetch(`/api/chat/${chatId}/session/create`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ title: null }),
            });
            
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              router.push(`/chat/${chatId}/${sessionData.session_id}`);
              return;
            } else {
              console.error('Error creating session:', sessionResponse.statusText);
              // Fallback: navighează la chat fără sesiune
              router.push(`/chat/${chatId}`);
              return;
            }
          } catch (error) {
            console.error('Error creating session:', error);
            // Fallback: navighează la chat fără sesiune
            router.push(`/chat/${chatId}`);
            return;
          }
        }
      }
      
      router.push(redirect || '/admin');
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    // Șterge cookie
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

