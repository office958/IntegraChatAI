'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/Login.module.css';
import ParticleBackground from '../login/ParticleBackground';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Aici poți adăuga logica de trimitere email
    // De exemplu, un apel API
    
    // Simulare delay pentru demo
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-white">
      {/* Logo în stânga sus */}
      <div className="absolute top-6 left-6 z-30">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="h-12 w-auto object-contain"
        />
      </div>

      {/* Formular centrat cu particle animation */}
      <div className="w-full flex flex-col items-center justify-center px-8 py-12 min-h-screen relative overflow-hidden">
        <ParticleBackground />
        <div className="w-full max-w-md relative z-10">
          {/* Container cu umbră pentru tot conținutul */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Titlu */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-4" style={{ color: '#150d44' }}>
                Recuperare parolă
              </h1>
              <p className="text-gray-600 text-sm mb-6">
                {isSubmitted 
                  ? 'Verifică-ți email-ul pentru instrucțiunile de resetare a parolei.'
                  : 'Introdu email-ul tău și îți vom trimite instrucțiuni pentru resetarea parolei.'
                }
              </p>
            </div>

            {!isSubmitted ? (
              <>
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
                        Se trimite...
                      </span>
                    ) : (
                      'Trimite email'
                    )}
                  </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-600">
                    Îți amintești parola?{' '}
                    <Link
                      href="/login"
                      className="font-medium hover:underline transition-colors"
                      style={{ color: '#16549e' }}
                    >
                      Autentifică-te
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Mesaj de succes */}
                <div className="text-center py-4">
                  <div className="mb-4">
                    <svg 
                      className="mx-auto h-16 w-16 text-green-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Am trimis un email la <strong>{email}</strong> cu instrucțiunile de resetare.
                  </p>
                  <Link
                    href="/login"
                    className="inline-block w-full py-3 rounded-full font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl text-center"
                    style={{ backgroundColor: '#16549e' }}
                  >
                    Înapoi la autentificare
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

