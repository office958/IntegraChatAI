'use client';

import { useState, useEffect } from 'react';

interface AutoTypingTextProps {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseTime?: number;
  className?: string;
}

export default function AutoTypingText({ 
  texts, 
  speed = 40, 
  deleteSpeed = 30,
  pauseTime = 2000,
  className = '' 
}: AutoTypingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (texts.length === 0) return;

    const currentText = texts[currentTextIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Scrie textul
        if (currentCharIndex < currentText.length) {
          setDisplayedText(currentText.slice(0, currentCharIndex + 1));
          setCurrentCharIndex(currentCharIndex + 1);
        } else {
          // Așteaptă după ce termină de scris
          setTimeout(() => {
            setIsDeleting(true);
          }, pauseTime);
        }
      } else {
        // Șterge textul
        if (currentCharIndex > 0) {
          setDisplayedText(currentText.slice(0, currentCharIndex - 1));
          setCurrentCharIndex(currentCharIndex - 1);
        } else {
          // Trece la următorul mesaj
          setIsDeleting(false);
          setCurrentTextIndex((currentTextIndex + 1) % texts.length);
          setCurrentCharIndex(0);
        }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timeout);
  }, [currentCharIndex, currentTextIndex, isDeleting, texts, speed, deleteSpeed, pauseTime]);

  return (
    <p className={className}>
      {displayedText}
      <span className="inline-block w-0.5 h-5 bg-white ml-1 animate-pulse" />
    </p>
  );
}

