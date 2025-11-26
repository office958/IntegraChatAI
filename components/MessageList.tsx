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
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.chatMessages}>
      {messages.length === 0 && !isStreaming && <WelcomeMessage />}
      {messages.map((message) => {
        // Verifică dacă acest mesaj este cel care se stream-uiește acum
        const isCurrentStreaming = isStreaming && 
          message.role === 'assistant' && 
          message.id === messages[messages.length - 1]?.id &&
          (!message.content || message.content.trim() === '');
        
        return (
          <Message 
            key={message.id} 
            message={message} 
            isStreaming={isCurrentStreaming}
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

