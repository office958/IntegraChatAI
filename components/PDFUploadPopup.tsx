'use client';

import { useState, useRef } from 'react';
import { PDFFile } from '@/types';
import styles from './PDFUploadPopup.module.css';

interface PDFUploadPopupProps {
  onClose: () => void;
  onFileSelect: (file: PDFFile) => void;
  existingFiles: PDFFile[];
}

export default function PDFUploadPopup({ onClose, onFileSelect, existingFiles }: PDFUploadPopupProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = {
    'application/pdf': 'pdf' as const,
    'image/jpeg': 'image' as const,
    'image/jpg': 'image' as const,
    'image/png': 'image' as const,
    'image/gif': 'image' as const,
    'image/bmp': 'image' as const,
    'image/webp': 'image' as const,
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: PDFFile[] = [];

    for (const file of files) {
      const fileType = allowedTypes[file.type as keyof typeof allowedTypes];
      if (!fileType) {
        alert(`⚠️ ${file.name} nu este PDF sau imagine suportată!`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`⚠️ ${file.name} este prea mare! Maxim 10MB.`);
        continue;
      }

      if (existingFiles.some((f) => f.filename === file.name)) {
        alert(`⚠️ ${file.name} este deja încărcat!`);
        continue;
      }

      validFiles.push({
        file,
        filename: file.name,
        type: fileType,
      });
    }

    validFiles.forEach((file) => onFileSelect(file));
    if (validFiles.length > 0) {
      onClose();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.uploadPopup} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.uploadPopupContent}>
        <div className={styles.uploadPopupHeader}>
          <h3>Încarcă fișiere</h3>
          <button type="button" className={styles.uploadPopupClose} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className={styles.uploadPopupBody}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button type="button" className={styles.uploadPopupBtn} onClick={handleUploadClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM14 13V17H10V13H7L12 8L17 13H14Z" fill="currentColor"/>
            </svg>
            <span>Încarcă fișiere</span>
          </button>
        </div>
      </div>
    </div>
  );
}

