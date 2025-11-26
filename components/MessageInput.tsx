'use client';

import { useState, useRef, useCallback } from 'react';
import { usePDFUpload } from '@/hooks/usePDFUpload';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import PDFUploadPopup from './PDFUploadPopup';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  onSendMessage: (message: string, pdfFiles?: File[]) => Promise<void>;
  isStreaming?: boolean;
}

export default function MessageInput({ onSendMessage, isStreaming }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pdfFiles, addPDFFile, removePDFFile, clearPDFFiles } = usePDFUpload();
  
  const handleTranscript = useCallback((transcript: string) => {
    setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);
  
  const { isListening, startListening, stopListening } = useSpeechToText({
    onTranscript: handleTranscript,
  });

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && pdfFiles.length === 0) return;
    if (isStreaming) return;

    const filesToSend = pdfFiles.map((f) => f.file);
    
    // Șterge mesajul și fișierele imediat, înainte de trimitere
    setMessage('');
    clearPDFFiles();
    
    // Trimite mesajul
    await onSendMessage(trimmedMessage || 'Completează formularul folosind informațiile din documentele încărcate.', filesToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      <div className={styles.chatInputWrapper}>
        {pdfFiles.length > 0 && (
          <div className={styles.inputFilesPreview}>
            {pdfFiles.map((file, index) => (
              <div key={index} className={styles.inputFileItem}>
                {file.type === 'pdf' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                    <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <span>{file.filename}</span>
                <button
                  type="button"
                  className={styles.inputFileRemove}
                  onClick={() => removePDFFile(index)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.inputWrapper}>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => setShowUploadPopup(true)}
            title="Atașează fișiere"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            className={styles.chatInput}
            placeholder="Scrie un mesaj..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isStreaming}
            autoComplete="off"
          />

          <button
            type="button"
            className={`${styles.micBtn} ${isListening ? styles.listening : ''}`}
            onClick={handleMicClick}
            title="Vorbește (Speech to Text)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M19 10V12C19 16.42 15.42 20 11 20H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>

          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isStreaming || (!message.trim() && pdfFiles.length === 0)}
            title="Trimite mesajul"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {showUploadPopup && (
        <PDFUploadPopup
          onClose={() => setShowUploadPopup(false)}
          onFileSelect={addPDFFile}
          existingFiles={pdfFiles}
        />
      )}
    </>
  );
}

