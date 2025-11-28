import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSpeechToTextOptions {
  onTranscript: (transcript: string) => void;
}

export function useSpeechToText({ onTranscript }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const onTranscriptRef = useRef(onTranscript);

  // Păstrează referința la callback actualizată
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    // Folosim limba salvată în setări, implicit 'ro-RO'
    try {
      const savedSpeechLang = (localStorage.getItem('speechLanguage') as string) || 'ro-RO';
      rec.lang = savedSpeechLang;
    } catch (e) {
      rec.lang = 'ro-RO';
    }

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscriptRef.current(transcript);
      setIsListening(false);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Accesul la microfon a fost refuzat. Vă rugăm permiteți accesul în setările browserului.');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    setRecognition(rec);

    return () => {
      if (rec) {
        rec.abort();
      }
    };
  }, []); // Eliminăm onTranscript din dependencies

  const startListening = useCallback(() => {
    if (!recognition || !isSupported) {
      alert('Speech recognition nu este suportat în acest browser.');
      return;
    }

    try {
      // Asigurăm că folosim limba curentă din setări înainte de start
      try {
        const savedSpeechLang = (localStorage.getItem('speechLanguage') as string) || 'ro-RO';
        recognition.lang = savedSpeechLang;
      } catch (e) {
        // ignore
      }
      recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }, [recognition, isSupported]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
    }
  }, [recognition]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}

