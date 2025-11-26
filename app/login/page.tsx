'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Login.module.css';
import ParticleBackground from './ParticleBackground';
import AutoTypingText from './AutoTypingText';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  // Dacă utilizatorul este deja autentificat, redirect
  useEffect(() => {
    if (isAuthenticated) {
      // Verifică dacă există un redirect URL
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      router.push(redirect || '/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      await login(email, password);
      // Navigare se face automat în AuthContext
    } catch (err: any) {
      setError(err.message || 'Eroare la autentificare');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">
      {/* Logo în stânga sus */}
      <div className="absolute top-6 left-6 z-30">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="h-12 w-auto object-contain"
        />
      </div>

      {/* Panou stânga - Gradient */}
      <div 
        className="hidden lg:flex lg:w-3/5 items-center justify-center p-12 relative"
        style={{ 
          background: 'linear-gradient(135deg, #150d44 0%, #16549e 100%)'
        }}
      >
        <div className="max-w-3xl w-full">
          <div className="text-white">
            <div className="text-6xl font-bold mb-8 leading-tight">
              <AutoTypingText 
                texts={[
                  "Bine ai revenit! Accesează contul tău pentru a beneficia de toate funcționalitățile platformei noastre.",
                  "Protecție avansată pentru datele tale personale.",
                  "Suport dedicat disponibil 24/7 pentru utilizatori.",
                  "Acces rapid și securizat la toate serviciile tale."
                ]}
                speed={40}
                deleteSpeed={25}
                pauseTime={3000}
                className="text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Formular dreapta - Fundal alb cu particle animation */}
      <div className="w-full lg:w-2/5 bg-white flex flex-col items-center justify-center px-8 py-12 min-h-screen relative overflow-hidden">
        <ParticleBackground />
        <div className="w-full max-w-md relative z-10">
          {/* Container cu umbră pentru tot conținutul */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Logo/Titlu */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-4" style={{ color: '#150d44' }}>
                Autentificare
              </h1>
              <p className="text-gray-600 text-sm mb-6">
                Introdu email-ul și parola pentru a continua
              </p>
            </div>

            {/* Formular */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#150d44' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nume@exemplu.com"
                  className={styles.inputField}
                />
              </div>

              {/* Password Field */}
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#150d44' }}
                >
                  Parolă
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={styles.inputField}
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 mr-2 cursor-pointer"
                    style={{ accentColor: '#16549e' }}
                  />
                  <span style={{ color: '#6b7280' }}>Ține-mă minte</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#16549e' }}
                >
                  Ai uitat parola?
                </Link>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-full font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                style={{ backgroundColor: '#16549e' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Se autentifică...
                  </span>
                ) : (
                  'Autentifică-te'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Nu ai cont?{' '}
                <Link
                  href="/register"
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#16549e' }}
                >
                  Înregistrează-te
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

