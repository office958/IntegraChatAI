'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './UserProfilePopup.module.css';

interface UserProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  onDeleteAccount?: () => void;
}

export default function UserProfilePopup({
  isOpen,
  onClose,
  userName = 'Utilizator',
  userEmail = 'utilizator@example.com',
  userRole = 'Utilizator',
  onDeleteAccount,
}: UserProfilePopupProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Obține prima literă din nume
  const getInitial = () => {
    if (userName && userName.trim()) {
      return userName.trim().charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Închide popup-ul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Previne scroll-ul paginii când popup-ul este deschis
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Previne închiderea când se face click în interiorul popup-ului
  const handlePopupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (onDeleteAccount) {
      onDeleteAccount();
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Render popup-ul într-un portal pentru a fi deasupra tuturor elementelor
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const popupContent = (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={popupRef} className={styles.popup} onClick={handlePopupClick}>
        <div className={styles.header}>
          <h2 className={styles.title}>Profilul meu</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Închide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>
              <span className={styles.avatarInitial}>{getInitial()}</span>
            </div>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.infoItem}>
              <label className={styles.label}>Nume</label>
              <div className={styles.value}>{userName}</div>
            </div>

            <div className={styles.infoItem}>
              <label className={styles.label}>Email</label>
              <div className={styles.value}>{userEmail}</div>
            </div>

            <div className={styles.infoItem}>
              <label className={styles.label}>Rol</label>
              <div className={styles.value}>
                <span className={styles.roleBadge}>{userRole}</span>
              </div>
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.actionsSection}>
            {!showDeleteConfirm ? (
              <button
                className={styles.deleteButton}
                onClick={handleDeleteClick}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Șterge contul</span>
              </button>
            ) : (
              <div className={styles.deleteConfirm}>
                <p className={styles.deleteConfirmText}>
                  Ești sigur că vrei să ștergi contul? Această acțiune este ireversibilă.
                </p>
                <div className={styles.deleteConfirmButtons}>
                  <button
                    className={styles.confirmButton}
                    onClick={handleConfirmDelete}
                  >
                    Șterge
                  </button>
                  <button
                    className={styles.cancelButton}
                    onClick={handleCancelDelete}
                  >
                    Anulează
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
}

