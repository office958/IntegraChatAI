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
  utterance.lang = 'ro-RO';
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

