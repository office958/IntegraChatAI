'use client';

import { useState } from 'react';
import { MessageType } from './MessageList';
import { formatMessageText } from '@/utils/messageFormatter';
import { speakText } from '@/utils/textToSpeech';
import { copyToClipboard } from '@/utils/clipboard';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

export default function Message({ message, isStreaming = false }: MessageProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleTTS = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakText(message.content, () => setIsSpeaking(false));
      setIsSpeaking(true);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (message.role === 'user') {
    return (
      <div className={`${styles.message} ${styles.user}`}>
        <div className={styles.messageContent}>
          {/* Afișează textul mesajului dacă există */}
          {message.content && message.content.trim() && (
            <div style={{ marginBottom: message.files && message.files.length > 0 ? '12px' : '0' }}>
              {message.content}
            </div>
          )}
          
          {/* Afișează fișierele dacă există */}
          {message.files && message.files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {message.files.map((file, index) => (
                <div key={index} className={styles.fileMessage}>
                  <div className={styles.fileMessageContent}>
                    {file.type === 'pdf' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                        <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <div className={styles.fileMessageInfo}>
                      <div className={styles.fileMessageName}>{file.filename}</div>
                      <div className={styles.fileMessageType}>{file.type === 'pdf' ? 'PDF' : 'IMAGINE'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Timestamp la sfârșit */}
          {(message.content || (message.files && message.files.length > 0)) && (
            <div className={styles.messageTime}>
              {message.timestamp.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.message} ${styles.ai}`} data-streaming={isStreaming ? 'true' : 'false'}>
      <div className={styles.messageContent}>
        {/* Afișează doar dacă există conținut */}
        {message.content && message.content.trim() ? (
          <>
            <div
              className={styles.messageText}
              dangerouslySetInnerHTML={{ __html: formatMessageText(message.content) }}
            />
            {/* Afișează iconurile doar când nu mai este streaming */}
            {!isStreaming && (
              <div className={styles.messageFooter}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${isSpeaking ? styles.speaking : ''}`}
                  onClick={handleTTS}
                  title="Citește mesajul (Text to Speech)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 12C17.0039 13.3308 16.4774 14.6024 15.54 15.54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleCopy}
                  title="Copiază mesajul"
                >
                  {isCopied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

