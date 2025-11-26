'use client';

import { useState, useEffect } from 'react';
import styles from './GeneralSettings.module.css';

export default function GeneralSettings() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [language, setLanguage] = useState('ro');
  const [speechLanguage, setSpeechLanguage] = useState('ro-RO');
  const [voice, setVoice] = useState('default');

  // Încarcă setările salvate
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    const savedLanguage = localStorage.getItem('language') || 'ro';
    const savedSpeechLanguage = localStorage.getItem('speechLanguage') || 'ro-RO';
    const savedVoice = localStorage.getItem('voice') || 'default';

    if (savedTheme) setTheme(savedTheme);
    setLanguage(savedLanguage);
    setSpeechLanguage(savedSpeechLanguage);
    setVoice(savedVoice);
  }, []);

  // Salvează setările
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const handleSpeechLanguageChange = (newSpeechLanguage: string) => {
    setSpeechLanguage(newSpeechLanguage);
    localStorage.setItem('speechLanguage', newSpeechLanguage);
  };

  const handleVoiceChange = (newVoice: string) => {
    setVoice(newVoice);
    localStorage.setItem('voice', newVoice);
  };

  const applyTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
    if (selectedTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
    }
  };

  // Aplică tema la mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const languages = [
    { value: 'ro', label: 'Română' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'fr', label: 'Français' },
  ];

  const speechLanguages = [
    { value: 'ro-RO', label: 'Română (România)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'de-DE', label: 'Deutsch (Deutschland)' },
    { value: 'fr-FR', label: 'Français (France)' },
  ];

  // Obține vocile disponibile din browser
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis.onvoiceschanged) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  return (
    <div className={styles.settingsSection}>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Setări generale</h1>
        <p className={styles.sectionDescription}>
          Gestionează preferințele generale ale aplicației
        </p>
      </div>

      <div className={styles.settingsContent}>
        <div className={styles.settingGroup}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Afișare</label>
              <p className={styles.settingDescription}>
                Alege modul de afișare al interfeței
              </p>
            </div>
            <select
              className={styles.select}
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'system')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Limbă</label>
              <p className={styles.settingDescription}>
                Selectează limba interfeței
              </p>
            </div>
            <select
              className={styles.select}
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Limbă vorbită</label>
              <p className={styles.settingDescription}>
                Limba folosită pentru Speech-to-Text
              </p>
            </div>
            <select
              className={styles.select}
              value={speechLanguage}
              onChange={(e) => handleSpeechLanguageChange(e.target.value)}
            >
              {speechLanguages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Voice</label>
              <p className={styles.settingDescription}>
                Vocea folosită pentru Text-to-Speech
              </p>
            </div>
            <select
              className={styles.select}
              value={voice}
              onChange={(e) => handleVoiceChange(e.target.value)}
            >
              <option value="default">Default</option>
              {availableVoices.map((v, index) => (
                <option key={index} value={v.name}>
                  {v.name} {v.lang ? `(${v.lang})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

