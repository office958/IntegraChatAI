let currentSpeech: SpeechSynthesisUtterance | null = null;

export function speakText(text: string, onEnd?: () => void) {
  if (!text || text.trim() === '') {
    return;
  }

  // Oprește vorbirea curentă dacă există
  if (currentSpeech) {
    window.speechSynthesis.cancel();
    currentSpeech = null;
    if (onEnd) onEnd();
    return;
  }

  // Verifică dacă browserul suportă Web Speech API
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech nu este suportat în acest browser.');
    return;
  }

  // Creează un nou utterance
  const utterance = new SpeechSynthesisUtterance(text.trim());
  // Setează limba/vocea din setările salvate (dacă există)
  try {
    const savedLang = (localStorage.getItem('speechLanguage') as string) || 'ro-RO';
    utterance.lang = savedLang;

    const savedVoiceName = localStorage.getItem('voice');
    if (savedVoiceName && savedVoiceName !== 'default') {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === savedVoiceName || (`${v.name} (${v.lang})`) === savedVoiceName);
      if (match) {
        utterance.voice = match;
      }
    }
  } catch (e) {
    utterance.lang = 'ro-RO';
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    currentSpeech = utterance;
  };

  utterance.onend = () => {
    currentSpeech = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    currentSpeech = null;
    if (onEnd) onEnd();
  };

  // Pornește citirea
  window.speechSynthesis.speak(utterance);
}

