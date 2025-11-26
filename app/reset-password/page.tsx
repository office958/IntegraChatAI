'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/Login.module.css';
import ParticleBackground from '../login/ParticleBackground';

interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const router = useRouter();

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
    
    // Validare
    if (!passwordStrength?.isValid) {
      return;
    }
    
    if (password !== confirmPassword) {
      setPasswordsMatch(false);
      return;
    }
    
    setIsLoading(true);
    
    // Aici poți adăuga logica de resetare parolă
    // De exemplu, un apel API cu token-ul de resetare
    
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
                Resetare parolă
              </h1>
              <p className="text-gray-600 text-sm mb-6">
                {isSubmitted 
                  ? 'Parola ta a fost resetată cu succes!'
                  : 'Introdu parola nouă pentru contul tău.'
                }
              </p>
            </div>

            {!isSubmitted ? (
              <>
                {/* Formular */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Parolă nouă Field */}
                  <div>
                    <label 
                      htmlFor="password" 
                      className="block text-sm font-medium mb-2"
                      style={{ color: '#150d44' }}
                    >
                      Parolă nouă
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={styles.inputField}
                    />
                    {/* Indicator complexitate parolă */}
                    {passwordStrength && password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs" style={{ color: getStrengthColor(passwordStrength.score) }}>
                            {getStrengthLabel(passwordStrength.score)}
                          </span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="h-1 w-8 rounded-full transition-colors"
                                style={{
                                  backgroundColor: level <= passwordStrength.score 
                                    ? getStrengthColor(passwordStrength.score) 
                                    : '#e5e7eb'
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        {passwordStrength.feedback.length > 0 && (
                          <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                            {passwordStrength.feedback.map((msg, idx) => (
                              <li key={idx}>• {msg}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirmare parolă Field */}
                  <div>
                    <label 
                      htmlFor="confirmPassword" 
                      className="block text-sm font-medium mb-2"
                      style={{ color: '#150d44' }}
                    >
                      Confirmare parolă
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={styles.inputField}
                      style={{
                        borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : undefined
                      }}
                    />
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-red-500 mt-1">
                        Parolele nu se potrivesc
                      </p>
                    )}
                    {confirmPassword && passwordsMatch && password && (
                      <p className="text-xs text-green-500 mt-1">
                        ✓ Parolele se potrivesc
                      </p>
                    )}
                  </div>

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
                        Se resetează...
                      </span>
                    ) : (
                      'Resetează parola'
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
                    Parola ta a fost resetată cu succes. Poți folosi noua parolă pentru a te autentifica.
                  </p>
                  <Link
                    href="/login"
                    className="inline-block w-full py-3 rounded-full font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl text-center"
                    style={{ backgroundColor: '#16549e' }}
                  >
                    Autentifică-te acum
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

