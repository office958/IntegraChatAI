'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import ChatSidebar from './ChatSidebar';
import { useChatConfig } from '@/hooks/useChatConfig';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import styles from './ChatContainer.module.css';

export default function ChatContainer() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { config, loading: configLoading } = useChatConfig(chatId);
  const { messages, sendMessage, isStreaming } = useChat(chatId, sessionId);

  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Funcție pentru a actualiza chatId și sessionId din URL
    const updateFromUrl = () => {
      const pathParts = window.location.pathname.split('/').filter(p => p);
      if (pathParts.length >= 2 && pathParts[0] === 'chat') {
        const newChatId = pathParts[1];
        setChatId(newChatId);
        // Dacă există un al treilea segment, este sessionId
        if (pathParts.length >= 3) {
          setSessionId(pathParts[2]);
        } else {
          setSessionId(null);
          // Dacă nu avem sessionId, redirecționează la ultima sesiune
          redirectToLastSession(newChatId);
        }
      }
    };

    // Funcție pentru a redirecționa la ultima sesiune
    const redirectToLastSession = async (chatId: string) => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/chat/${chatId}/sessions`, {
          headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          const sessions = data.sessions || [];
          
          if (sessions.length > 0) {
            // Sortează sesiunile după updated_at (cel mai recent primul)
            const sortedSessions = sessions.sort((a: any, b: any) => {
              const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
              const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
              return dateB - dateA;
            });
            
            // Redirecționează la ultima sesiune (cea mai recentă)
            const lastSessionId = sortedSessions[0].id;
            router.replace(`/chat/${chatId}/${lastSessionId}`);
          } else {
            // Nu există sesiuni, creează una nouă
            const createResponse = await fetch(`/api/chat/${chatId}/session/create`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title: null }),
            });
            
            if (createResponse.ok) {
              const createData = await createResponse.json();
              router.replace(`/chat/${chatId}/${createData.session_id}`);
            }
          }
        }
      } catch (error) {
        console.error('Error redirecting to last session:', error);
      }
    };

    // Actualizează la mount
    updateFromUrl();

    // Ascultă schimbările de URL (pentru navigare în aplicație)
    const handlePopState = () => {
      updateFromUrl();
    };
    window.addEventListener('popstate', handlePopState);

    // Verifică dacă suntem pe mobile și închide sidebar-ul implicit
    const checkMobile = () => {
      if (window.innerWidth < 769) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('resize', checkMobile);
    };
  }, [token, router]);

  const handleSendMessage = async (message: string, pdfFiles?: File[]) => {
    await sendMessage(message, pdfFiles);
  };

  // Obține datele utilizatorului din context
  const { user } = useAuth();
  const userData = user || {
    name: 'Utilizator',
    email: 'guest@example.com',
    role: 'user',
  };

  const handleDeleteAccount = async () => {
    // Confirmare finală
    if (window.confirm('Ești sigur că vrei să ștergi contul? Această acțiune este ireversibilă și va șterge toate datele asociate.')) {
      try {
        // Aici ar trebui să fie logica de ștergere a contului
        // De exemplu: await deleteUserAccount();
        console.log('Cont șters');
        // Redirect la login sau pagina principală
        // router.push('/login');
        alert('Contul a fost șters cu succes.');
      } catch (error) {
        console.error('Eroare la ștergerea contului:', error);
        alert('A apărut o eroare la ștergerea contului. Vă rugăm să încercați din nou.');
      }
    }
  };

  if (configLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>Se încarcă conversația...</div>
      </div>
    );
  }

  // Dacă config-ul nu există (404), nu afișa nimic (redirect-ul se face în useChatConfig)
  if (!config && !configLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>Chat-ul nu există...</div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentChatId={chatId}
        currentSessionId={sessionId}
      />
      <div className={`${styles.chatContent} ${sidebarOpen ? styles.chatContentWithSidebar : ''}`}>
        <ChatHeader
          title={config?.chat_title || config?.name || 'Chat with Integra'}
          subtitle={config?.chat_subtitle || 'Asistentul tău inteligent pentru găsirea informațiilor'}
          color={config?.chat_color}
          userName={userData.name}
          userEmail={userData.email}
          userRole={userData.role}
          onDeleteAccount={handleDeleteAccount}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <div className={styles.chatContentWrapper}>
          <MessageList messages={messages} isStreaming={isStreaming} />
          <MessageInput
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}

