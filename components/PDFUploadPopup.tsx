'use client';

import { useRef, useCallback } from 'react';
import { PDFFile } from '@/hooks/usePDFUpload';
import styles from './PDFUploadPopup.module.css';

interface PDFUploadPopupProps {
  onClose: () => void;
  onFileSelect: (file: File) => void;
  existingFiles: PDFFile[];
}

export default function PDFUploadPopup({
  onClose,
  onFileSelect,
  existingFiles,
}: PDFUploadPopupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        let fileAdded = false;
        Array.from(files).forEach((file) => {
          // Check if file is already in the list
          const isDuplicate = existingFiles.some(
            (existing) => existing.filename === file.name && existing.file.size === file.size
          );
          
          if (!isDuplicate) {
            onFileSelect(file);
            fileAdded = true;
          }
        });
        
        // Close modal if at least one file was added
        if (fileAdded) {
          onClose();
        }
      }
      
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onFileSelect, existingFiles, onClose]
  );

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div className={styles.uploadPopup} onClick={handleBackdropClick}>
      <div className={styles.uploadPopupContent}>
        <div className={styles.uploadPopupHeader}>
          <h3>Încarcă fișiere</h3>
          <button
            type="button"
            className={styles.uploadPopupClose}
            onClick={onClose}
            aria-label="Închide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className={styles.uploadPopupBody}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-label="Selectează fișiere"
          />
          
          <button
            type="button"
            className={styles.uploadPopupBtn}
            onClick={handleButtonClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Selectează fișiere PDF sau imagini
          </button>
          
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
            Suportă PDF și imagini (JPG, PNG, etc.)
          </p>
        </div>
      </div>
    </div>
  );
}

