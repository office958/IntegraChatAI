import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChatConfig } from '@/types';

export function useChatConfig(chatId: string | null) {
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!chatId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        setLoading(true);
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/chat/${chatId}/config`, {
          headers,
        });
        
        if (response.status === 404) {
          // Chat-ul nu există, redirect
          router.push('/');
          return;
        }
        
        if (!response.ok) {
          if (response.status === 401) {
            // Nu ești autentificat
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          throw new Error('Failed to load chat config');
        }
        
        const data = await response.json();
        setConfig(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error loading chat config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [chatId, token, router]);

  return { config, loading, error };
}

