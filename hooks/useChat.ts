import { useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { MessageType } from '@/types';
import { extractPDFText, extractImageText } from '@/utils/pdfExtractor';
import { tryAutoFillFields } from '@/utils/autoFill';
import { useAuth } from '@/contexts/AuthContext';

export function useChat(chatId: string | null, sessionId: string | null = null) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pageContext, setPageContext] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [extractedTexts, setExtractedTexts] = useState<Map<string, string>>(new Map()); // Păstrează textele extrase per fișier
  const { user, token } = useAuth();

  // Încarcă istoricul conversației din baza de date când se schimbă chatId sau sessionId
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!chatId) {
        setMessages([]);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const endpoint = sessionId
          ? `/api/chat/${chatId}/history?session_id=${sessionId}`
          : `/api/chat/${chatId}/history`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          // Procesează mesajele și restaurează fișierele din file_info
          const historyMessages: MessageType[] = [];
          const newExtractedTexts = new Map<string, string>();
          
          (data.messages || [])
            .filter((msg: any) => msg.role !== 'system') // Filtrează mesajele de tip 'system'
            .forEach((msg: any, index: number) => {
              // Procesează file_info dacă există
              let files: Array<{ filename: string; type: 'pdf' | 'image'; url?: string; generated?: boolean }> | undefined = undefined;
              
              if (msg.file_info) {
                try {
                  // Parsează file_info dacă este string
                  const fileInfo = typeof msg.file_info === 'string' 
                    ? JSON.parse(msg.file_info) 
                    : msg.file_info;
                  
                  // Construiește array-ul de fișiere pentru mesaj
                  if (fileInfo && fileInfo.filename) {
                    const fileType = fileInfo.fileType || fileInfo.type || 
                      (fileInfo.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
                    
                    files = [{
                      filename: fileInfo.filename,
                      type: fileType === 'pdf' ? 'pdf' : 'image',
                      url: fileInfo.url || undefined,
                      generated: fileInfo.generated || false
                    }];
                    
                    // Restaurează textul extras dacă există (doar pentru fișierele încărcate de utilizator, nu cele generate)
                    if (!fileInfo.generated && fileInfo.text && fileInfo.text.trim()) {
                      newExtractedTexts.set(fileInfo.filename, fileInfo.text);
                      console.log(`📎 Restaurat fișier din istoric: ${fileInfo.filename} (${fileType}) cu ${fileInfo.text.length} caractere`);
                    } else if (fileInfo.generated) {
                      console.log(`📎 Restaurat fișier generat din istoric: ${fileInfo.filename} (${fileType}) - URL: ${fileInfo.url || 'N/A'}`);
                    } else {
                      console.log(`📎 Restaurat fișier din istoric: ${fileInfo.filename} (${fileType}) fără text extras`);
                    }
                  }
                } catch (e) {
                  console.error('⚠️ Eroare la parsarea file_info:', e, msg.file_info);
                }
              }
              
              historyMessages.push({
                id: `history-${index}-${Date.now()}`,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
                files: files
              });
            });
          
          // Actualizează extractedTexts cu fișierele restaurate
          if (newExtractedTexts.size > 0) {
            setExtractedTexts((prev) => {
              const merged = new Map(prev);
              newExtractedTexts.forEach((text, filename) => {
                merged.set(filename, text);
              });
              console.log(`✅ Restaurat ${newExtractedTexts.size} fișier(e) din istoric în extractedTexts`);
              return merged;
            });
          }
          
          setMessages(historyMessages);
        } else if (response.status === 404) {
          // Nu există istoric, începe conversație nouă
          setMessages([]);
        } else {
          console.error('Error loading conversation history:', response.statusText);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, [chatId, sessionId, token]);

  // Cere context de la pagina părinte
  const requestPageContext = useCallback(() => {
    if (typeof window !== 'undefined' && window.parent !== window.self) {
      window.parent.postMessage({ type: 'requestPageContext' }, '*');
    }
  }, []);

  // Ascultă mesaje de la pagina părinte
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pageContext') {
        setPageContext(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    requestPageContext();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [requestPageContext]);

  const sendMessage = useCallback(
    async (message: string, pdfFiles?: File[]) => {
      if (!message.trim() && (!pdfFiles || pdfFiles.length === 0)) return;

      // Adaugă mesajul utilizatorului
      const userMessage: MessageType = {
        id: Date.now().toString(),
        role: 'user',
        content: message || 'Completează formularul folosind informațiile din documentele încărcate.',
        timestamp: new Date(),
        files: pdfFiles?.map((f) => ({
          filename: f.name,
          type: f.type.startsWith('image/') ? 'image' : 'pdf',
        })),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      try {
        // Extrage textul din PDF-uri/imagini
        let pdfText = '';
        if (pdfFiles && pdfFiles.length > 0) {
          console.log(`📎 Procesare ${pdfFiles.length} fișier(e):`, pdfFiles.map(f => ({ name: f.name, type: f.type })));
          
          const extractionResults = await Promise.allSettled(
            pdfFiles.map(async (file) => {
              try {
                console.log(`🔄 Procesare fișier: ${file.name}, type: ${file.type}`);
                if (file.type.startsWith('image/')) {
                  console.log(`  → Folosește extractImageText pentru ${file.name} (cu corecție automată)`);
                  const result = await extractImageText(file, true); // Activează corecția automată
                  // Returnează textul corectat dacă există, altfel textul original
                  return result.correctedText || result.text;
                } else {
                  console.log(`  → Folosește extractPDFText pentru ${file.name}`);
                  return await extractPDFText(file);
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
                console.error(`❌ Eroare la extragerea textului din ${file.name}:`, errorMessage);
                throw new Error(`Eroare la ${file.name}: ${errorMessage}`);
              }
            })
          );
          
          // Procesează rezultatele și colectează erorile
          const texts: string[] = [];
          const errors: string[] = [];
          
          extractionResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              texts.push(result.value);
            } else {
              const fileName = pdfFiles[index].name;
              const errorMsg = result.status === 'rejected' 
                ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
                : 'Eroare necunoscută';
              errors.push(`${fileName}: ${errorMsg}`);
              console.error(`❌ Nu s-a putut extrage text din ${fileName}:`, errorMsg);
            }
          });
          
          // Dacă există erori, afișează-le utilizatorului
          if (errors.length > 0) {
            const errorMessage = errors.length === pdfFiles.length
              ? `Nu s-a putut extrage text din niciun fișier:\n${errors.join('\n')}`
              : `Atenție: Nu s-a putut extrage text din ${errors.length} fișier(e):\n${errors.join('\n')}`;
            
            const warningMessage: MessageType = {
              id: Date.now().toString() + '-warning',
              role: 'assistant',
              content: `⚠️ ${errorMessage}\n\n${texts.length > 0 ? 'Textul extras din celelalte fișiere va fi folosit.' : 'Nu se poate continua fără text extras.'}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, warningMessage]);
            
            // Dacă nu s-a extras text din niciun fișier, oprește procesarea
            if (texts.length === 0) {
              setIsStreaming(false);
              return;
            }
          }
          
          // Mapează corect numele fișierelor pentru textele extrase
          let textIndex = 0;
          const missingFieldsAll: any[] = [];
          
          pdfText = extractionResults
            .map((result, fileIndex) => {
              if (result.status === 'fulfilled' && result.value) {
                const fileName = pdfFiles[fileIndex].name;
                const text = result.value;
                
                // Salvează textul extras pentru a-l păstra între mesaje
                setExtractedTexts((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(fileName, text);
                  return newMap;
                });
                
                // Adaugă informații despre corecții și date lipsă dacă există
                let fileText = `\n--- ${fileName} ---\n${text}`;
                
                // Verifică dacă există informații despre date lipsă
                // (ar trebui să fie stocate în result.value dacă este obiect)
                // Pentru moment, doar adăugăm textul
                
                return fileText;
              }
              return null;
            })
            .filter((item): item is string => item !== null)
            .join('\n\n');
          
          // Adaugă informații despre date lipsă la sfârșit
          if (missingFieldsAll.length > 0) {
            pdfText += '\n\n=== DATE LIPSĂ ===\n';
            missingFieldsAll.forEach(field => {
              pdfText += `- ${field.field}: ${field.suggested_question || 'Lipsește'}\n`;
            });
          }
          
          // Limitează la 5000 caractere
          if (pdfText.length > 5000) {
            pdfText = pdfText.substring(0, 5000) + '\n\n[... text trunchiat pentru viteză ...]';
          }
        } else {
          // Dacă nu sunt fișiere noi, folosește textele extrase anterior
          if (extractedTexts.size > 0) {
            pdfText = Array.from(extractedTexts.entries())
              .map(([fileName, text]) => `\n--- ${fileName} ---\n${text}`)
              .join('\n\n');
            
            // Limitează la 5000 caractere
            if (pdfText.length > 5000) {
              pdfText = pdfText.substring(0, 5000) + '\n\n[... text trunchiat pentru viteză ...]';
            }
          }
        }

        // Construiește payload-ul
        const endpoint = chatId
          ? `/api/chat/${chatId}/ask`
          : '/api/ask';

        const payload: any = {
          message: message || 'Completează formularul folosind informațiile din documentele încărcate.',
        };
        
        // Adaugă session_id dacă există
        if (sessionId) {
          payload.session_id = parseInt(sessionId);
        }
        
        // Adaugă user_id din context
        payload.user_id = user?.id || 1;

        // IMPORTANT: Construiește files_info similar cu RAG - salvează toate fișierele
        // Include atât fișierele noi (pdfFiles) cât și cele restaurate din istoric (extractedTexts)
        const allFilesInfo: any[] = [];
        
        // Adaugă fișierele noi (dacă există)
        if (pdfFiles && pdfFiles.length > 0) {
          console.log(`📎 Construire files_info pentru ${pdfFiles.length} fișier(e) noi...`);
          pdfFiles.forEach((file) => {
            const filename = file.name;
            const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
            // Găsește textul extras pentru acest fișier
            const extractedText = extractedTexts.get(filename);
            
            const fileInfo: any = {
              filename: filename,
              type: fileType,
              text: extractedText || null
            };
            
            console.log(`  📄 Fișier procesat: ${fileInfo.filename}, type: ${fileInfo.type}, hasText: ${!!fileInfo.text}`);
            allFilesInfo.push(fileInfo);
          });
        }
        
        // Adaugă fișierele restaurate din istoric (care nu sunt în pdfFiles)
        if (extractedTexts.size > 0) {
          console.log(`📎 Verificare fișiere restaurate din istoric (${extractedTexts.size} fișier(e))...`);
          extractedTexts.forEach((text, filename) => {
            // Verifică dacă fișierul nu este deja în allFilesInfo
            const alreadyIncluded = allFilesInfo.some(f => f.filename === filename);
            if (!alreadyIncluded) {
              // Determină tipul fișierului din extensie
              const fileType = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
              
              const fileInfo: any = {
                filename: filename,
                type: fileType,
                text: text || null
              };
              
              console.log(`  📄 Fișier restaurat din istoric: ${fileInfo.filename}, type: ${fileInfo.type}, hasText: ${!!fileInfo.text}`);
              allFilesInfo.push(fileInfo);
            }
          });
        }
        
        // Adaugă files_info în payload dacă există fișiere
        if (allFilesInfo.length > 0) {
          payload.files_info = allFilesInfo;
          console.log(`✅✅✅ TRIMITE ${payload.files_info.length} fișier(e) cu files_info către backend ✅✅✅`);
          console.log('  - files_info:', JSON.stringify(payload.files_info, null, 2));
        } else {
          console.log('⚠️ Nu există fișiere - files_info NU va fi trimis!');
        }

        // Adaugă textul din PDF-uri dacă există
        if (pdfText && pdfText.length > 0) {
          payload.pdf_text = pdfText;
        }
        
        // Adaugă context dacă este necesar
        const needsContext = pdfText.length > 0 || /completează|complet|formular|automat|auto-fill|auto fill/i.test(message);
        if (pageContext && needsContext) {
          const optimizedContext = { ...pageContext };
          if (optimizedContext.fields_detailed && optimizedContext.fields_detailed.length > 20) {
            optimizedContext.fields_detailed = optimizedContext.fields_detailed.slice(0, 20);
          }
          if (optimizedContext.form_fields && optimizedContext.form_fields.length > 20) {
            optimizedContext.form_fields = optimizedContext.form_fields.slice(0, 20);
          }
          payload.page_context = optimizedContext;
        }

        // Trimite request și procesează stream
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let aiMessageId = Date.now().toString();

        // Creează mesajul AI inițial cu conținut gol pentru a declanșa TypingIndicator
        const aiMessage: MessageType = {
          id: aiMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        
        // Adaugă mesajul înainte de a începe streaming-ul pentru a afișa TypingIndicator
        flushSync(() => {
          setMessages((prev) => [...prev, aiMessage]);
        });


        // Funcție pentru detectarea link-urilor către PDF-uri generate
        const detectGeneratedFiles = (text: string): Array<{ filename: string; type: 'pdf' | 'image'; url: string; generated: boolean }> => {
          const pdfUrlPattern = /(?:https?:\/\/[^\s]+)?\/pdf_generated\/[^\s\)]+\.pdf/gi;
          const matches = text.match(pdfUrlPattern);
          
          if (!matches || matches.length === 0) return [];
          
          return matches.map((url) => {
            // Extrage numele fișierului din URL
            const filename = url.split('/').pop() || `document_${Date.now()}.pdf`;
            // Construiește URL complet dacă este relativ
            const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
            
            return {
              filename,
              type: 'pdf' as const,
              url: fullUrl,
              generated: true
            };
          });
        };
        
        // Procesează stream-ul token-by-token pentru animație smooth
        let pendingUpdate: number | null = null;
        let lastContent = '';
        let hasPendingContent = false;
        let detectedFiles: Array<{ filename: string; type: 'pdf' | 'image'; url: string; generated: boolean }> = [];
        
        const scheduleUpdate = () => {
          // Dacă conținutul nu s-a schimbat, nu actualizăm
          if (accumulatedText === lastContent) {
            hasPendingContent = false;
            return;
          }
          
          hasPendingContent = true;
          
          // Dacă există deja un update programat, doar marchează că avem conținut nou
          if (pendingUpdate !== null) {
            return;
          }
          
          // Folosim requestAnimationFrame pentru sincronizare cu refresh-ul ecranului
          pendingUpdate = requestAnimationFrame(() => {
            // Verifică din nou dacă conținutul s-a schimbat
            if (accumulatedText !== lastContent) {
              // Detectează fișiere generate în text
              const newDetectedFiles = detectGeneratedFiles(accumulatedText);
              if (newDetectedFiles.length > 0) {
                detectedFiles = newDetectedFiles;
              }
              
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { 
                          ...msg, 
                          content: accumulatedText,
                          files: detectedFiles.length > 0 ? detectedFiles : undefined
                        }
                      : msg
                  )
                );
              });
              lastContent = accumulatedText;
            }
            
            hasPendingContent = false;
            pendingUpdate = null;
            
            // Dacă conținutul s-a schimbat în timpul actualizării, programează următoarea imediat
            if (accumulatedText !== lastContent || hasPendingContent) {
              scheduleUpdate();
            }
          });
        };
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Anulează orice actualizare programată
            if (pendingUpdate !== null) {
              cancelAnimationFrame(pendingUpdate);
              pendingUpdate = null;
            }
            
            // Procesează ultimul chunk rămas în decoder
            try {
              const finalChunk = decoder.decode();
              if (finalChunk && finalChunk.length > 0) {
                accumulatedText += finalChunk;
              }
              // Detectează fișiere generate în textul final
              const finalDetectedFiles = detectGeneratedFiles(accumulatedText);
              if (finalDetectedFiles.length > 0) {
                detectedFiles = finalDetectedFiles;
              }
              
              // Forțează ultima actualizare
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { 
                          ...msg, 
                          content: accumulatedText,
                          files: detectedFiles.length > 0 ? detectedFiles : undefined
                        }
                      : msg
                  )
                );
              });
            } catch (e) {
              // Ignoră erori la decodarea finală
            }
            break;
          }

          // Procesează fiecare chunk imediat
          if (value && value.length > 0) {
            try {
              // Decode cu stream: true pentru a gestiona corect caracterele UTF-8
              const chunk = decoder.decode(value, { stream: true });
              
              if (chunk && chunk.length > 0) {
                accumulatedText += chunk;
                
                // Programează actualizare imediat pentru efect streaming vizibil
                scheduleUpdate();
              }
            } catch (e) {
              console.error('❌ Error decoding chunk:', e, 'Value:', value);
            }
          }
        }
        
        // Asigură-te că ultima actualizare este făcută
        if (pendingUpdate !== null) {
          cancelAnimationFrame(pendingUpdate);
          pendingUpdate = null;
        }
        // Detectează fișiere generate în textul final
        const finalDetectedFiles = detectGeneratedFiles(accumulatedText);
        if (finalDetectedFiles.length > 0) {
          detectedFiles = finalDetectedFiles;
        }
        
        if (accumulatedText && accumulatedText !== lastContent) {
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { 
                      ...msg, 
                      content: accumulatedText,
                      files: detectedFiles.length > 0 ? detectedFiles : undefined
                    }
                  : msg
              )
            );
          });
          lastContent = accumulatedText;
        }

        // Încearcă auto-fill după ce s-a terminat stream-ul
        tryAutoFillFields(accumulatedText);
      } catch (error) {
        console.error('Error sending message:', error);
        const errorMessage: MessageType = {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Îmi pare rău, momentan nu pot accesa serverul. Vă rog încercați mai târziu.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
      }
    },
    [chatId, sessionId, pageContext]
  );

  return { messages, sendMessage, isStreaming };
}

