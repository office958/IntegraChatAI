'use client';

import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className={styles.confirmModal} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.confirmModalContent}>
        <div className={styles.confirmModalHeader}>
          <h3>{title || 'Confirmare'}</h3>
          <button type="button" className={styles.confirmModalClose} onClick={onCancel} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className={styles.confirmModalBody}>
          <p>{message}</p>
        </div>
        <div className={styles.confirmModalFooter}>
          <button type="button" className={styles.confirmCancelBtn} onClick={onCancel}>{cancelText}</button>
          <button type="button" className={styles.confirmBtn} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
