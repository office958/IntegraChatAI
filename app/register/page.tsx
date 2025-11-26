'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from '../login/Login.module.css';
import ParticleBackground from '../login/ParticleBackground';
import AutoTypingText from '../login/AutoTypingText';

interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const { register, isAuthenticated } = useAuth();
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

  // Funcție pentru verificarea complexității parolei
  const checkPasswordStrength = (pwd: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    // Lungime minimă
    if (pwd.length >= 8) {
      score++;
    } else {
      feedback.push('Minim 8 caractere');
    }

    // Majuscule
    if (/[A-Z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Cel puțin o majusculă');
    }

    // Minuscule
    if (/[a-z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Cel puțin o minusculă');
    }

    // Cifre
    if (/[0-9]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Cel puțin o cifră');
    }

    // Caractere speciale
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Cel puțin un caracter special');
    }

    return {
      score,
      feedback: feedback.length > 0 ? feedback : ['Parolă puternică'],
      isValid: score >= 4 && pwd.length >= 8
    };
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      setPasswordStrength(checkPasswordStrength(value));
    } else {
      setPasswordStrength(null);
    }
    // Verifică dacă parolele se potrivesc
    if (confirmPassword) {
      setPasswordsMatch(value === confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setPasswordsMatch(password === value);
  };

  const getStrengthColor = (score: number) => {
    if (score <= 1) return '#ef4444'; // roșu
    if (score <= 2) return '#f59e0b'; // portocaliu
    if (score <= 3) return '#eab308'; // galben
    return '#22c55e'; // verde
  };

  const getStrengthLabel = (score: number) => {
    if (score <= 1) return 'Foarte slabă';
    if (score <= 2) return 'Slabă';
    if (score <= 3) return 'Medie';
    return 'Puternică';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validări finale
    if (!passwordStrength?.isValid) {
      alert('Parola nu îndeplinește cerințele de securitate');
      return;
    }

    if (password !== confirmPassword) {
      alert('Parolele nu se potrivesc');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await register(name, email, password);
      // Navigare se face automat în AuthContext
    } catch (err: any) {
      setError(err.message || 'Eroare la înregistrare');
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
                  "Alătură-te nouă! Creează un cont nou și descoperă toate avantajele platformei noastre.",
                  "Înregistrare gratuită în câteva minute.",
                  "Acces la toate funcționalitățile premium.",
                  "Securitate maximă pentru datele tale personale.",
                  "Asistență dedicată disponibilă 24/7."
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
                Înregistrare
              </h1>
              <p className="text-gray-600 text-sm mb-6">
                Creează un cont nou pentru a continua
              </p>
            </div>

            {/* Formular */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label 
                  htmlFor="name" 
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#150d44' }}
                >
                  Nume complet
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ion Popescu"
                  className={styles.inputField}
                />
              </div>

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
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${styles.inputField} ${password && !passwordStrength?.isValid ? 'border-red-300' : ''}`}
                />
                
                {/* Password Strength Indicator */}
                {password && passwordStrength && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: getStrengthColor(passwordStrength.score) }}>
                        {getStrengthLabel(passwordStrength.score)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {passwordStrength.score}/5
                      </span>
                    </div>
                    {/* Strength Bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.score / 5) * 100}%`,
                          backgroundColor: getStrengthColor(passwordStrength.score)
                        }}
                      />
                    </div>
                    {/* Feedback */}
                    {passwordStrength.feedback.length > 0 && passwordStrength.score < 5 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index} className="flex items-center">
                            <span className="mr-2">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label 
                  htmlFor="confirmPassword" 
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#150d44' }}
                >
                  Confirmă parola
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${styles.inputField} ${confirmPassword && !passwordsMatch ? 'border-red-300' : ''}`}
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="mt-1 text-xs text-red-500">
                    Parolele nu se potrivesc
                  </p>
                )}
                {confirmPassword && passwordsMatch && password && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Parolele se potrivesc
                  </p>
                )}
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
                disabled={isLoading || !passwordStrength?.isValid || !passwordsMatch}
                className="w-full py-3 rounded-full font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                style={{ backgroundColor: '#16549e' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Se înregistrează...
                  </span>
                ) : (
                  'Înregistrează-te'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Ai deja cont?{' '}
                <Link
                  href="/login"
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#16549e' }}
                >
                  Autentifică-te
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
