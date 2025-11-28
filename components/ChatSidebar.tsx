'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './ChatSidebar.module.css';
import ConfirmModal from './ConfirmModal';

interface ChatHistoryItem {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentChatId: string | null;
  currentSessionId?: string | null;
}

export default function ChatSidebar({ isOpen, onToggle, currentChatId, currentSessionId }: ChatSidebarProps) {
  const [chatSessions, setChatSessions] = useState<ChatHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, token } = useAuth();
  
  // user_id din context
  const userId = user?.id || 1;

  // Încarcă sesiunile de chat ale utilizatorului pentru chatbot-ul curent
  useEffect(() => {
    const loadChatSessions = async () => {
      if (!currentChatId || !userId) {
        setChatSessions([]);
        return;
      }

      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/chat/${currentChatId}/sessions`, {
          headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          const sessions = data.sessions || [];
          
          // Convertește sesiunile în format ChatHistoryItem
          const sessionHistory: ChatHistoryItem[] = sessions.map((session: any) => ({
            id: `${currentChatId}/${session.id}`,
            title: session.title || `Chat ${session.id}`,
            lastMessage: undefined,
            timestamp: session.updated_at 
              ? new Date(session.updated_at) 
              : session.created_at 
                ? new Date(session.created_at)
                : new Date()
          }));
          
          setChatSessions(sessionHistory);
        } else if (response.status === 404) {
          // Chat-ul nu există
          console.error('Chat-ul nu există');
          setChatSessions([]);
        } else {
          console.error('Error loading chat sessions:', response.statusText);
        }
      } catch (error) {
        console.error('Error loading chat sessions:', error);
      }
    };

    loadChatSessions();
    
    // Reîncarcă sesiunile la fiecare 30 de secunde
    // Dacă există o sesiune activă, reîncarcă mai des (la 5 secunde) pentru a detecta schimbările de titlu
    const intervalTime = currentSessionId ? 5000 : 30000;
    const interval = setInterval(loadChatSessions, intervalTime);
    return () => clearInterval(interval);
  }, [currentChatId, currentSessionId, userId, token]);

  // Închide meniul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenChatId(null);
      }
    };

    if (menuOpenChatId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenChatId]);

  // Filtrează sesiunile după search query
  const filteredSessions = chatSessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = async () => {
    // Dacă avem un chatbot selectat, creează o sesiune nouă pentru acel chatbot
    if (currentChatId) {
      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/chat/${currentChatId}/session/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            title: null // Va fi generat automat
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const newSessionId = data.session_id;
          // Navighează la noua sesiune
          router.push(`/chat/${currentChatId}/${newSessionId}`);
        } else if (response.status === 404) {
          alert('Chat-ul nu există!');
          router.push('/');
        } else {
          console.error('Error creating session:', response.statusText);
          // Fallback: navighează la chatbot fără sesiune
          router.push(`/chat/${currentChatId}`);
        }
      } catch (error) {
        console.error('Error creating session:', error);
        // Fallback: navighează la chatbot fără sesiune
        router.push(`/chat/${currentChatId}`);
      }
    } else {
      // Dacă nu avem chatbot selectat, navighează la admin
      router.push('/admin');
    }
  };

  const handleChatClick = (chatId: string) => {
    // Dacă chatId conține "/", este o sesiune (format: "chatId/sessionId")
    if (chatId.includes('/')) {
      // Este o sesiune - navighează direct la ea
      router.push(`/chat/${chatId}`);
    } else {
      // Este un chatbot - navighează la el (fără sesiune specifică)
      // Sidebar-ul va afișa sesiunile pentru acest chatbot
      router.push(`/chat/${chatId}`);
    }
    // Închide sidebar-ul pe mobile
    if (window.innerWidth < 768) {
      onToggle();
    }
  };

  const handleRename = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
    setMenuOpenChatId(null);
  };

  const handleSaveRename = async (sessionId: string, sessionIdOnly: string) => {
    if (!editTitle.trim() || !currentChatId) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/chat/${currentChatId}/session/${sessionIdOnly}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (response.ok) {
        // Reîncarcă sesiunile
        const loadChatSessions = async () => {
          if (!currentChatId || !userId) return;

          try {
            const headers: HeadersInit = {};
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/chat/${currentChatId}/sessions`, {
              headers,
            });
            
            if (response.ok) {
              const data = await response.json();
              const sessions = data.sessions || [];
              
              const sessionHistory: ChatHistoryItem[] = sessions.map((session: any) => ({
                id: `${currentChatId}/${session.id}`,
                title: session.title || `Chat ${session.id}`,
                lastMessage: undefined,
                timestamp: session.updated_at 
                  ? new Date(session.updated_at) 
                  : session.created_at 
                    ? new Date(session.created_at)
                    : new Date()
              }));
              
              setChatSessions(sessionHistory);
            }
          } catch (error) {
            console.error('Error reloading sessions:', error);
          }
        };

        loadChatSessions();
        setEditingSessionId(null);
        setEditTitle('');
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Eroare necunoscută' }));
        alert(`Eroare la redenumire: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error renaming session:', error);
      alert('Eroare la redenumirea conversației');
    }
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditTitle('');
  };

  const handleDelete = async (sessionId: string, sessionIdOnly: string) => {
    // replaced by confirm modal flow
    promptDelete(sessionId, sessionIdOnly);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSessionIdOnly, setConfirmSessionIdOnly] = useState<string | null>(null);
  const [confirmSessionLabel, setConfirmSessionLabel] = useState<string | null>(null);

  const promptDelete = (sessionId: string, sessionIdOnly: string) => {
    setConfirmSessionIdOnly(sessionIdOnly);
    setConfirmSessionLabel(sessionId);
    setConfirmOpen(true);
    setMenuOpenChatId(null);
  };

  const confirmDelete = async () => {
    if (!currentChatId || !confirmSessionIdOnly) {
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/chat/${currentChatId}/session/${confirmSessionIdOnly}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        // Reîncarcă sesiunile
        const loadChatSessions = async () => {
          if (!currentChatId || !userId) return;

          try {
            const headers: HeadersInit = {};
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/chat/${currentChatId}/sessions`, {
              headers,
            });
            
            if (response.ok) {
              const data = await response.json();
              const sessions = data.sessions || [];
              
              const sessionHistory: ChatHistoryItem[] = sessions.map((session: any) => ({
                id: `${currentChatId}/${session.id}`,
                title: session.title || `Chat ${session.id}`,
                lastMessage: undefined,
                timestamp: session.updated_at 
                  ? new Date(session.updated_at) 
                  : session.created_at 
                    ? new Date(session.created_at)
                    : new Date()
              }));
              
              setChatSessions(sessionHistory);
            }
          } catch (error) {
            console.error('Error reloading sessions:', error);
          }
        };

        loadChatSessions();

        // Dacă ștergem sesiunea curentă, navigăm la chatbot
        if (currentSessionId === confirmSessionIdOnly) {
          router.push(`/chat/${currentChatId}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Eroare necunoscută' }));
        // show modal with error or fallback to alert for now
        alert(`Eroare la ștergere: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Eroare la ștergerea conversației');
    } finally {
      setConfirmSessionIdOnly(null);
      setConfirmSessionLabel(null);
    }
  };


  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        title="Șterge conversația"
        message={
          'Ești sigur că vrei să ștergi această conversație? Această acțiune este ireversibilă și va șterge toate mesajele.'
        }
        confirmText="Șterge"
        cancelText="Anulează"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      {/* Overlay pentru mobile */}
      {isOpen && (
        <div className={styles.overlay} onClick={onToggle} />
      )}

      {/* Sidebar */}
      <div className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        {/* Header cu buton chat nou și toggle */}
        <div className={styles.sidebarHeader}>
          <button
            onClick={handleNewChat}
            className={styles.newChatButton}
            title="Chat nou"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Chat nou</span>
          </button>
          <button
            onClick={onToggle}
            className={styles.toggleButton}
            title={isOpen ? "Închide sidebar" : "Deschide sidebar"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {isOpen ? (
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            placeholder="Caută în chat-uri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Chat History List */}
        <div className={styles.chatList}>
          {/* Dacă avem un chatbot selectat, afișează sesiunile sale */}
          {currentChatId ? (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>CONVERSAȚIILE TALE</span>
              </div>
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => {
                  // Extrage sessionId din format "chatId/sessionId"
                  const sessionIdOnly = session.id.split('/')[1];
                  const isActive = currentSessionId === sessionIdOnly;
                  
                  return (
                    <div
                      key={session.id}
                      className={`${styles.chatItemWrapper} ${isActive ? styles.chatItemActive : ''}`}
                      onMouseEnter={() => setHoveredChatId(session.id)}
                      onMouseLeave={() => {
                        setHoveredChatId(null);
                        if (menuOpenChatId !== session.id) {
                          setMenuOpenChatId(null);
                        }
                      }}
                    >
                      {editingSessionId === session.id ? (
                        <div className={styles.chatItemEdit}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveRename(session.id, sessionIdOnly);
                              } else if (e.key === 'Escape') {
                                handleCancelRename();
                              }
                            }}
                            onBlur={() => handleSaveRename(session.id, sessionIdOnly)}
                            className={styles.chatItemEditInput}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <>
                          {hoveredChatId === session.id && (
                            <div className={styles.chatItemMenu} ref={menuRef}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenChatId(menuOpenChatId === session.id ? null : session.id);
                                }}
                                className={styles.chatItemMenuButton}
                                title="Opțiuni"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                                  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                                </svg>
                              </button>
                              {menuOpenChatId === session.id && (
                                <div className={styles.chatItemMenuDropdown}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRename(session.id, session.title || `Chat ${sessionIdOnly}`);
                                    }}
                                    className={styles.chatItemMenuOption}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Redenumește</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(session.id, sessionIdOnly);
                                    }}
                                    className={`${styles.chatItemMenuOption} ${styles.chatItemMenuOptionDanger}`}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Șterge</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleChatClick(session.id)}
                            className={styles.chatItem}
                          >
                            <div className={styles.chatItemContent}>
                              <div className={styles.chatItemTitle}>{session.title || `Chat ${sessionIdOnly}`}</div>
                              {session.lastMessage && (
                                <div className={styles.chatItemPreview}>{session.lastMessage}</div>
                              )}
                              <div className={styles.chatItemTime}>
                                {session.timestamp.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                              </div>
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>Nu ai sesiuni de chat pentru acest chatbot</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Toggle button când sidebar-ul este închis */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={styles.sidebarToggleFloating}
          title="Deschide sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </>
  );
}

