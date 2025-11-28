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
          const historyMessages: MessageType[] = (data.messages || [])
            .filter((msg: any) => msg.role !== 'system') // Filtrează mesajele de tip 'system' înainte de a le converti
            .map((msg: any, index: number) => ({
              id: `history-${index}-${Date.now()}`,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
            }));
          
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
          const texts = await Promise.all(
            pdfFiles.map(async (file) => {
              if (file.type.startsWith('image/')) {
                return await extractImageText(file);
              } else {
                return await extractPDFText(file);
              }
            })
          );
          pdfText = texts
            .filter((t) => t)
            .map((t, i) => `\n--- ${pdfFiles[i].name} ---\n${t}`)
            .join('\n\n');
          
          // Limitează la 5000 caractere
          if (pdfText.length > 5000) {
            pdfText = pdfText.substring(0, 5000) + '\n\n[... text trunchiat pentru viteză ...]';
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

        if (pdfText) {
          payload.pdf_text = pdfText;
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
        let firstChunk = true;

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

        // Procesează stream-ul și actualizează imediat la fiecare chunk
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Procesează ultimul chunk rămas în decoder
            try {
              const finalChunk = decoder.decode();
              if (finalChunk && finalChunk.length > 0) {
                accumulatedText += finalChunk;
                // Forțează ultima actualizare
                flushSync(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  );
                });
              }
            } catch (e) {
              // Ignoră erori la decodarea finală
            }
            break;
          }

          // Decode chunk-ul cu stream: true pentru a gestiona caractere UTF-8 multi-byte
          if (value && value.length > 0) {
            try {
              // Decode fără stream: true pentru caractere individuale
              const chunk = decoder.decode(value, { stream: false });
              // Adaugă chunk-ul dacă există (chiar și string-uri goale pot fi importante)
              // NU ignorăm niciun chunk - toate sunt importante!
              if (chunk !== null && chunk !== undefined && chunk.length > 0) {
                if (firstChunk) {
                  console.log('🔵 PRIMUL CHUNK primit [' + chunk.length + ' chars]:', chunk.substring(0, 200));
                  firstChunk = false;
                }
                accumulatedText += chunk;
                
                // Actualizează mesajul imediat pentru efectul de streaming
                // Folosim flushSync pentru actualizare sincronă și vizibilă
                flushSync(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  );
                });
              }
            } catch (e) {
              console.error('❌ Error decoding chunk:', e, 'Value:', value);
            }
          }
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

