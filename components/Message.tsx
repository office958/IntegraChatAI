'use client';

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageType } from '@/types';
import { formatMessageText } from '@/utils/messageFormatter';
import { speakText } from '@/utils/textToSpeech';
import { getUILocale } from '@/utils/locale';
import { copyToClipboard } from '@/utils/clipboard';
import { detectRAGDocumentRequest, listRAGFiles, downloadRAGFile } from '@/utils/pdfDownload';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
  chatId?: string | null;
  sessionId?: string | null;
}

export default function Message({ message, isStreaming = false, chatId, sessionId }: MessageProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [ragFilenames, setRagFilenames] = useState<string[]>([]);
  const [isDownloadingRAG, setIsDownloadingRAG] = useState<{ [filename: string]: boolean }>({});
  const router = useRouter();
  const { token } = useAuth();
  const textElementRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string>('');

  // Actualizează DOM-ul când se schimbă conținutul
  useLayoutEffect(() => {
    if (!textElementRef.current) return;
    
    if (message.content) {
      // Verifică dacă conținutul s-a schimbat
      if (lastContentRef.current !== message.content) {
        // Aplicăm formatarea completă (și în timpul streaming-ului pentru efect vizual)
        textElementRef.current.innerHTML = formatMessageText(message.content);
        lastContentRef.current = message.content;
      }
    } else if (!message.content && !isStreaming) {
      // Șterge conținutul dacă nu există
      textElementRef.current.innerHTML = '';
      lastContentRef.current = '';
    }
  }, [message.content, isStreaming]);

  // Memoizează formatarea textului pentru afișare inițială
  const formattedContent = useMemo(() => {
    if (!message.content) return '';
    if (isStreaming) return ''; // Nu folosim formatare în timpul streaming-ului
    return formatMessageText(message.content);
  }, [message.content, isStreaming]);

  // Resetăm ragFilenames când apare un mesaj nou de la utilizator
  useEffect(() => {
    if (message.role === 'user') {
      setRagFilenames([]);
    }
  }, [message.id, message.role]);

  // Detectează dacă mesajul conține cerere de descărcare document RAG
  useEffect(() => {
    if (message.role === 'assistant' && message.content && !isStreaming) {
      // Detectează cereri explicite pentru documente RAG
      const detectedRAGFile = detectRAGDocumentRequest(message.content);
      
      // Dacă s-a detectat un fișier specific, adaugă-l în listă
      if (detectedRAGFile) {
        setRagFilenames([detectedRAGFile]);
      } else if (chatId) {
        // Verifică dacă mesajul menționează tipuri de documente
        const mentionsDocuments = checkIfMentionsDocuments(message.content);
        
        if (mentionsDocuments) {
          // Dacă mesajul menționează documente, caută documente RAG potrivite
          checkForRAGDocuments(message.content, chatId);
        } else {
          // Dacă nu menționează documente, nu afișăm
          setRagFilenames([]);
        }
      } else {
        setRagFilenames([]);
      }
    }
  }, [message.content, message.role, message.id, isStreaming, chatId]);

  // Funcție pentru a verifica dacă assistant-ul sugerează explicit oferirea unui document pentru descărcare
  const checkIfMentionsDocuments = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    
    // Pattern-uri care indică explicit oferirea unui document pentru descărcare
    const explicitOfferPatterns = [
      /pot\s+(?:să\s+)?(?:vă\s+)?(?:oferi|oferă|trimite|trimiteți|da|dati)\s+(?:documentul|cererea|formularul|certificatul|fișierul|fisierul|pdf-ul)/i,
      /(?:vă\s+)?(?:pot\s+)?(?:oferi|oferă|trimite|trimiteți)\s+(?:documentul|cererea|formularul|certificatul|fișierul|fisierul|pdf-ul)/i,
      /(?:documentul|cererea|formularul|certificatul|fișierul|fisierul|pdf-ul)\s+(?:este\s+)?(?:disponibil|gata|pregătit|preparat)/i,
      /(?:pot\s+)?(?:descărca|descarca|download)\s+(?:documentul|cererea|formularul|certificatul|fișierul|fisierul|pdf-ul)/i,
      /(?:documentul|cererea|formularul|certificatul|fișierul|fisierul|pdf-ul)\s+(?:pentru\s+)?(?:descărcare|descarcare|download)/i,
      /(?:vă\s+)?(?:oferim|oferă|putem\s+oferi)\s+(?:documentul|cererea|formularul|certificatul)/i,
      /(?:găsiți|gasiti|puteți\s+găsi|puteti\s+gasii)\s+(?:documentul|cererea|formularul|certificatul)\s+(?:mai\s+jos|jos|dedesubt|pentru\s+descărcare|pentru\s+descarcare)/i
    ];
    
    // Verifică dacă există pattern-uri explicite de oferire
    const hasExplicitOffer = explicitOfferPatterns.some(pattern => pattern.test(content));
    
    // Verifică dacă există o cerere explicită din partea utilizatorului
    const hasExplicitRequest = checkForExplicitDocumentRequest(content);
    
    // Oferim documente DOAR dacă assistant-ul sugerează explicit oferirea unui document
    // SAU dacă există o cerere explicită
    return hasExplicitOffer || hasExplicitRequest;
  };

  // Funcție pentru a verifica dacă există o cerere explicită pentru documente (păstrată pentru compatibilitate)
  const checkForExplicitDocumentRequest = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    
    // Verbe de acțiune care indică o cerere explicită
    const actionVerbs = [
      'descarcă', 'descarca', 'download', 'dă-mi', 'da-mi', 'trimite', 'trimite-mi',
      'arătă', 'arata', 'afișează', 'afiseaza', 'oferă', 'oferă-mi', 'oferă-mi',
      'vreau', 'doresc', 'am nevoie de', 'am nevoie', 'imi trebuie', 'îmi trebuie',
      'pot să', 'poti sa', 'poți să', 'poti sa', 'imi faci', 'îmi faci',
      'imi dai', 'îmi dai', 'imi poti', 'îmi poți', 'imi poti da', 'îmi poți da',
      'pot obține', 'pot obtine', 'pot primi', 'obțin', 'obtin', 'primesc'
    ];
    
    // Cuvinte cheie pentru documente
    const documentKeywords = [
      'document', 'documentul', 'fișier', 'fisier', 'fișierul', 'fisierul',
      'pdf', 'pdf-ul', 'formular', 'formularul', 'cerere', 'cererea',
      'certificat', 'certificatul', 'declarație', 'declaratie', 'declarația',
      'proces verbal', 'proces-verbal', 'extras', 'extrasul', 'stare civilă', 'stare civila'
    ];
    
    // Verifică dacă există un verb de acțiune + cuvânt cheie pentru document
    const hasActionVerb = actionVerbs.some(verb => lowerContent.includes(verb));
    const hasDocumentKeyword = documentKeywords.some(keyword => lowerContent.includes(keyword));
    
    // Dacă există verb de acțiune ȘI cuvânt cheie pentru document → cerere explicită
    if (hasActionVerb && hasDocumentKeyword) {
      return true;
    }
    
    // Dacă mesajul menționează explicit "pot obține", "pot primi" + document → cerere
    if ((lowerContent.includes('pot obține') || lowerContent.includes('pot obtine') || 
         lowerContent.includes('pot primi')) && hasDocumentKeyword) {
      return true;
    }
    
    // Dacă mesajul conține pattern-uri clare de cerere pentru documente
    const requestPatterns = [
      /(?:pot|poti|poți)\s+(?:obține|obtine|primi|avea|descărca|descarca)\s+(?:certificat|document|fișier|fisier|formular|cerere|declarație|declaratie)/i,
      /(?:am nevoie|imi trebuie|îmi trebuie|vreau|doresc)\s+(?:de\s+)?(?:certificat|document|fișier|fisier|formular|cerere|declarație|declaratie)/i
    ];
    
    const hasRequestPattern = requestPatterns.some(pattern => pattern.test(content));
    
    return hasRequestPattern;
  };

  // Funcție pentru a extrage tipurile de documente menționate explicit în mesaj
  const extractMentionedDocumentTypes = (content: string): string[] => {
    const docTypes: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Pattern-uri pentru tipuri de documente comune (mai specifice)
    const patterns = [
      // Cerere Nastere Copil
      /(?:cerere\s+)?(?:nastere|naștere)\s+(?:copil|copilului)/gi,
      /(?:cerere\s+)?(?:certificat|certificatul)\s+(?:de\s+)?(?:nastere|naștere)\s+(?:copil|copilului)/gi,
      
      // Certificat de Nastere Titular
      /(?:certificat|certificatul)\s+(?:de\s+)?(?:nastere|naștere)\s+(?:titular|titularului)/gi,
      /(?:cerere\s+)?(?:certificat|certificatul)\s+(?:de\s+)?(?:nastere|naștere)\s+(?:titular|titularului)/gi,
      
      // Cerere Transcriere
      /(?:cerere\s+)?(?:transcriere|transcrierii)\s+(?:certificat|certificatului)/gi,
      /(?:cerere\s+)?(?:transcriere|transcrierii)/gi,
      
      // Cerere Eliberare Extras
      /(?:cerere\s+)?(?:eliberare|eliberării)\s+(?:extras|extrasului)/gi,
      /(?:extras|extrasul)\s+(?:multilingv|de\s+nastere|de\s+naștere)/gi,
      
      // Certificat de stare civilă
      /(?:certificat|certificatul)\s+(?:de\s+)?(?:stare\s+civilă|stare\s+civila)/gi,
      /(?:cerere\s+)?(?:eliberare|eliberării)\s+(?:certificat|certificatului)\s+(?:de\s+)?(?:stare\s+civilă|stare\s+civila)/gi,
      
      // Declarație fiscală
      /(?:declarație|declarația|declaratie|declaratia)\s+(?:fiscală|fiscala|fiscal)/gi,
      
      // Proces verbal
      /(?:proces|procesul)\s+(?:verbal|verbalul)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.trim().toLowerCase();
          if (!docTypes.includes(normalized)) {
            docTypes.push(normalized);
          }
        });
      }
    });
    
    // Dacă nu s-au găsit pattern-uri specifice, verifică secțiuni cu titluri (ex: "### Cerere Nastere Copil")
    if (docTypes.length === 0) {
      const sectionPattern = /###\s+([^\n]+)/g;
      const sectionMatches = content.match(sectionPattern);
      if (sectionMatches) {
        sectionMatches.forEach(match => {
          const title = match.replace(/###\s+/, '').trim().toLowerCase();
          // Verifică dacă titlul conține cuvinte cheie pentru documente
          if (/(?:cerere|certificat|declarație|declaratie|proces|verbal|extras)/i.test(title)) {
            if (!docTypes.includes(title)) {
              docTypes.push(title);
            }
          }
        });
      }
    }
    
    return docTypes;
  };

  // Funcție pentru a verifica și găsi documente RAG potrivite
  const checkForRAGDocuments = async (content: string, chatId: string) => {
    try {
      // Cuvinte cheie pentru documente comune cu mapare la tipuri de fișiere
      const documentKeywords: { [key: string]: { keywords: string[], filePatterns: string[] } } = {
        'cerere certificat nastere': {
          keywords: ['cerere', 'certificat', 'nastere', 'naștere', 'certificat de naștere'],
          filePatterns: ['cerere', 'certificat', 'nastere', 'naștere']
        },
        'certificat nastere': {
          keywords: ['certificat', 'nastere', 'naștere', 'certificat de naștere'],
          filePatterns: ['certificat', 'nastere', 'naștere']
        },
        'cerere transcriere': {
          keywords: ['cerere', 'transcriere', 'certificat', 'nastere', 'casatorie', 'deces'],
          filePatterns: ['cerere', 'transcriere', 'certificat']
        },
        'declaratie fiscala': {
          keywords: ['declaratie', 'fiscala', 'fiscal', 'declarație', 'declarație fiscală'],
          filePatterns: ['declaratie', 'fiscala', 'fiscal', 'declarație']
        },
        'proces verbal': {
          keywords: ['proces', 'verbal', 'proces-verbal', 'proces verbal', 'procesul verbal'],
          filePatterns: ['proces', 'verbal']
        },
        'extras': {
          keywords: ['extras', 'extras de nastere', 'extras de naștere'],
          filePatterns: ['extras']
        }
      };
      
      const lowerContent = content.toLowerCase();
      
      // Nu mai verificăm doar dacă există cuvinte cheie - funcția este apelată doar dacă există cerere explicită
      // Obține lista de fișiere RAG disponibile
      const ragFiles = await listRAGFiles(chatId, token || undefined);
      
      // Calculează scoruri pentru fiecare fișier
      const fileScores: Array<{ filename: string; score: number }> = [];
      
      for (const file of ragFiles) {
        const filename = file.filename.toLowerCase();
        let score = 0;
        
        // Verifică potrivirea cu tipurile de documente
        for (const [docType, config] of Object.entries(documentKeywords)) {
          // Verifică dacă toate cuvintele cheie principale sunt prezente în conținut
          const keywordsInContent = config.keywords.filter(kw => 
            lowerContent.includes(kw) || lowerContent.includes(kw.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't'))
          );
          
          // Verifică dacă numele fișierului conține pattern-urile
          const patternsInFilename = config.filePatterns.filter(pattern => {
            const normalizedPattern = pattern.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
            const normalizedFilename = filename.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
            return normalizedFilename.includes(normalizedPattern);
          });
          
          // Calculează scorul: cât mai multe cuvinte cheie și pattern-uri se potrivesc, cu atât mai mare scorul
          const matchScore = (keywordsInContent.length / config.keywords.length) * 0.6 + 
                            (patternsInFilename.length / config.filePatterns.length) * 0.4;
          
          // Bonus dacă tipul documentului este menționat explicit (ex: "cerere certificat naștere")
          if (lowerContent.includes(docType) || lowerContent.includes(docType.replace('ă', 'a'))) {
            score += matchScore * 1.5;
          } else {
            score += matchScore;
          }
        }
        
        // Verifică potrivire directă cu numele fișierului
        const filenameBase = filename.replace('.pdf', '').replace(/[-_\s()]+/g, ' ');
        const filenameWords = filenameBase.split(/\s+/).filter(w => w.length > 2);
        const contentWords = lowerContent.split(/\s+/).filter(w => w.length > 2);
        
        const directMatches = filenameWords.filter(fw => 
          contentWords.some(cw => {
            const normalizedFw = fw.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
            const normalizedCw = cw.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
            return normalizedCw.includes(normalizedFw) || normalizedFw.includes(normalizedCw);
          })
        );
        
        score += directMatches.length * 0.3;
        
        if (score > 0) {
          fileScores.push({ filename: file.filename, score });
        }
      }
      
      // Sortează după scor (cel mai mare primul)
      if (fileScores.length > 0) {
        fileScores.sort((a, b) => b.score - a.score);
        
        // Extrage tipurile de documente menționate explicit în mesaj
        const mentionedDocTypes = extractMentionedDocumentTypes(lowerContent);
        
        let matchingFiles: string[] = [];
        
        if (mentionedDocTypes.length > 0) {
          // Dacă există tipuri de documente menționate explicit, găsește doar documentele care se potrivesc
          matchingFiles = fileScores
            .filter(file => {
              const filename = file.filename.toLowerCase();
              // Verifică dacă numele fișierului se potrivește cu tipurile menționate
              const matchesDocType = mentionedDocTypes.some(docType => {
                // Extrage cuvintele cheie din tipul de document
                const docTypeWords = docType
                  .split(/\s+/)
                  .filter(w => w.length > 2 && !['de', 'la', 'pentru', 'cu', 'sau'].includes(w));
                
                // Verifică dacă majoritatea cuvintelor cheie sunt prezente în numele fișierului
                const normalizedFilename = filename.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
                const matchingWords = docTypeWords.filter(word => {
                  const normalizedWord = word.replace('ă', 'a').replace('î', 'i').replace('ș', 's').replace('ț', 't');
                  return normalizedFilename.includes(normalizedWord);
                });
                
                // Trebuie să se potrivească cel puțin 60% din cuvintele cheie
                return matchingWords.length >= Math.ceil(docTypeWords.length * 0.6);
              });
              
              return matchesDocType && file.score >= 0.5; // Prag pentru matching specific
            })
            .map(file => file.filename);
        } else {
          // Dacă nu există tipuri specifice menționate, folosește doar documentele cu scor foarte bun
          // Limitează la top 3 documente cu cel mai mare scor și scor >= 0.7
          matchingFiles = fileScores
            .filter(file => file.score >= 0.7)
            .slice(0, 3) // Limitează la maxim 3 documente
            .map(file => file.filename);
        }
        
        if (matchingFiles.length > 0) {
          setRagFilenames(matchingFiles);
          return;
        }
      }
      
      // Dacă nu s-au găsit documente, resetează lista
      setRagFilenames([]);
    } catch (error) {
      console.error('Eroare la verificarea documentelor RAG:', error);
    }
  };

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

  const handleDownloadRAG = async (filename: string) => {
    if (!chatId || !filename) {
      alert('Chat ID sau nume fișier nu este disponibil');
      return;
    }

    setIsDownloadingRAG(prev => ({ ...prev, [filename]: true }));
    try {
      await downloadRAGFile(chatId, filename, token || undefined);
    } catch (error) {
      console.error('Eroare la descărcarea documentului RAG:', error);
      alert(error instanceof Error ? error.message : 'Nu s-a putut descărca documentul');
    } finally {
      setIsDownloadingRAG(prev => ({ ...prev, [filename]: false }));
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
              {message.timestamp.toLocaleTimeString(getUILocale(), { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.message} ${styles.ai}`} data-streaming={isStreaming ? 'true' : 'false'} data-message-id={message.id}>
      <div className={styles.messageContent}>
        {/* Afișează dacă există conținut sau dacă se stream-uiește */}
        {(message.content || isStreaming) ? (
          <>
            <div className={styles.messageTextWrapper}>
              {message.content || isStreaming ? (
                <div
                  ref={textElementRef}
                  className={styles.messageText}
                  data-message-id={message.id}
                  dangerouslySetInnerHTML={!isStreaming ? { __html: formattedContent } : undefined}
                />
              ) : (
                <div className={styles.messageText} data-message-id={message.id}></div>
              )}
              {/* Cursor animat când se stream-uiește */}
              {isStreaming && (
                <span className={styles.typingCursor}>|</span>
              )}
            </div>
            {/* Afișează fișierele generate (dacă există) */}
            {message.files && message.files.some(f => f.generated) && (
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #e5e7eb' 
              }}>
                <div style={{ 
                  marginBottom: '12px', 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontStyle: 'italic',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                  Document generat pentru dvs.:
                </div>
                {message.files
                  .filter(f => f.generated)
                  .map((file, index) => (
                    <div 
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        borderRadius: '18px',
                        marginBottom: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Iconiță fișier */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {file.type === 'pdf' ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6b7280' }}>
                            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6b7280' }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                            <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* Informații fișier */}
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 500, 
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                        }}>
                          {file.filename}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                        }}>
                          {file.type === 'pdf' ? 'PDF' : 'IMAGINE'}
                        </div>
                      </div>
                      
                      {/* Buton download */}
                      <a
                        href={file.url}
                        download={file.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: '#374151',
                          color: 'white',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1f2937';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#374151';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Descarcă
                      </a>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Afișează documentele RAG (dacă există) */}
            {ragFilenames.length > 0 && !isStreaming && (
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #e5e7eb' 
              }}>
                <div style={{ 
                  marginBottom: '12px', 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontStyle: 'italic',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                  {ragFilenames.length === 1 
                    ? 'Document disponibil pentru dvs.:'
                    : `${ragFilenames.length} documente disponibile pentru dvs.:`
                  }
                </div>
                {ragFilenames.map((filename, index) => {
                  const isDownloading = isDownloadingRAG[filename] || false;
                  return (
                    <div 
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        borderRadius: '18px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                        transition: 'all 0.2s ease',
                        marginBottom: index < ragFilenames.length - 1 ? '8px' : '0'
                      }}
                    >
                      {/* Iconiță PDF */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6b7280' }}>
                          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      
                      {/* Informații fișier */}
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 500, 
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                        }}>
                          {filename}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                        }}>
                          PDF
                        </div>
                      </div>
                      
                      {/* Buton download */}
                      <button
                        type="button"
                        onClick={() => handleDownloadRAG(filename)}
                        disabled={isDownloading}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: isDownloading ? '#9ca3af' : '#374151',
                          color: 'white',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: isDownloading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                          boxShadow: isDownloading ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isDownloading) {
                            e.currentTarget.style.backgroundColor = '#1f2937';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isDownloading) {
                            e.currentTarget.style.backgroundColor = '#374151';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {isDownloading ? (
                          <>
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              style={{
                                animation: 'spin 1s linear infinite'
                              }}
                            >
                              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Se descarcă...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Descarcă
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Afișează butoanele de acțiune când nu mai este streaming */}
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

