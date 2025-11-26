'use client';

import { useState, useEffect } from 'react';
import styles from './AccountSettings.module.css';

export default function AccountSettings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEditing, setIsEditing] = useState({
    name: false,
    email: false,
    password: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Încarcă datele utilizatorului
  useEffect(() => {
    // În producție, acestea ar trebui să vină din API/auth context
    const savedName = localStorage.getItem('userName') || 'Antonel';
    const savedEmail = localStorage.getItem('userEmail') || 'antonel@example.com';

    setName(savedName);
    setEmail(savedEmail);
  }, []);

  const handleSave = async (field: 'name' | 'email' | 'password') => {
    setIsSaving(true);
    
    try {
      // Aici ar trebui să fie logica de salvare în backend
      // await updateUser({ [field]: field === 'password' ? password : field === 'name' ? name : email });
      
      // Salvare temporară în localStorage
      if (field === 'name') {
        localStorage.setItem('userName', name);
      } else if (field === 'email') {
        localStorage.setItem('userEmail', email);
      }

      setIsEditing({ ...isEditing, [field]: false });
      
      // Reset password field after save
      if (field === 'password') {
        setPassword('');
      }
    } catch (error) {
      console.error('Eroare la salvarea datelor:', error);
      alert('A apărut o eroare la salvarea datelor. Vă rugăm să încercați din nou.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (field: 'name' | 'email' | 'password') => {
    if (field === 'name') {
      setName(localStorage.getItem('userName') || 'Antonel');
    } else if (field === 'email') {
      setEmail(localStorage.getItem('userEmail') || 'antonel@example.com');
    } else if (field === 'password') {
      setPassword('');
    }
    setIsEditing({ ...isEditing, [field]: false });
  };

  return (
    <div className={styles.settingsSection}>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Setări cont</h1>
        <p className={styles.sectionDescription}>
          Gestionează informațiile contului tău
        </p>
      </div>

      <div className={styles.settingsContent}>
        <div className={styles.settingGroup}>
          {/* Nume */}
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Nume</label>
              <p className={styles.settingDescription}>
                Numele tău complet
              </p>
            </div>
            <div className={styles.inputGroup}>
              {isEditing.name ? (
                <>
                  <input
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Introdu numele"
                    disabled={isSaving}
                  />
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.saveButton}
                      onClick={() => handleSave('name')}
                      disabled={isSaving || !name.trim()}
                    >
                      Salvează
                    </button>
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancel('name')}
                      disabled={isSaving}
                    >
                      Anulează
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.valueDisplay}>{name}</div>
                  <button
                    className={styles.editButton}
                    onClick={() => setIsEditing({ ...isEditing, name: true })}
                  >
                    Editează
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Email */}
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Email</label>
              <p className={styles.settingDescription}>
                Adresa ta de email
              </p>
            </div>
            <div className={styles.inputGroup}>
              {isEditing.email ? (
                <>
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Introdu email-ul"
                    disabled={isSaving}
                  />
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.saveButton}
                      onClick={() => handleSave('email')}
                      disabled={isSaving || !email.trim()}
                    >
                      Salvează
                    </button>
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancel('email')}
                      disabled={isSaving}
                    >
                      Anulează
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.valueDisplay}>{email}</div>
                  <button
                    className={styles.editButton}
                    onClick={() => setIsEditing({ ...isEditing, email: true })}
                  >
                    Editează
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Parolă */}
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Parolă</label>
              <p className={styles.settingDescription}>
                Schimbă parola contului tău
              </p>
            </div>
            <div className={styles.inputGroup}>
              {isEditing.password ? (
                <>
                  <input
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Introdu noua parolă"
                    disabled={isSaving}
                  />
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.saveButton}
                      onClick={() => handleSave('password')}
                      disabled={isSaving || !password.trim() || password.length < 6}
                    >
                      Salvează
                    </button>
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancel('password')}
                      disabled={isSaving}
                    >
                      Anulează
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.valueDisplay}>••••••••</div>
                  <button
                    className={styles.editButton}
                    onClick={() => setIsEditing({ ...isEditing, password: true })}
                  >
                    Schimbă
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

