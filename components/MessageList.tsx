'use client';

import { useEffect, useRef } from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import WelcomeMessage from './WelcomeMessage';
import { MessageType } from '@/types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: MessageType[];
  isStreaming?: boolean;
  chatId?: string | null;
  sessionId?: string | null;
}

export default function MessageList({ messages, isStreaming, chatId, sessionId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll mai agresiv când se stream-uiește pentru a urmări textul
    if (isStreaming) {
      // Folosim requestAnimationFrame pentru scroll smooth în timpul streaming-ului
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    } else {
      scrollToBottom();
    }
  }, [messages, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.chatMessages}>
      {messages.length === 0 && !isStreaming && <WelcomeMessage />}
      {messages.map((message, index) => {
        // Verifică dacă acest mesaj este cel care se stream-uiește acum
        // Trebuie să fie ultimul mesaj, de tip assistant, și streaming-ul să fie activ
        const isLastMessage = index === messages.length - 1;
        const isCurrentStreaming = isStreaming && 
          message.role === 'assistant' && 
          isLastMessage;
        
        return (
          <Message 
            key={message.id} 
            message={message} 
            isStreaming={isCurrentStreaming}
            chatId={chatId}
            sessionId={sessionId}
          />
        );
      })}
      {/* Afișează TypingIndicator dacă se stream-uiește și ultimul mesaj assistant nu are încă conținut */}
      {isStreaming && (() => {
        const lastMessage = messages[messages.length - 1];
        const shouldShowIndicator = !lastMessage || 
          lastMessage.role !== 'assistant' || 
          !lastMessage.content || 
          lastMessage.content.trim() === '';
        return shouldShowIndicator;
      })() && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}

