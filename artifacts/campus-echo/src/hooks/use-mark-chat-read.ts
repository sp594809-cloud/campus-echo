import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRadarInboxQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';

/** Marks a private chat as read on the server (cross-device). */
export function useMarkChatRead(activeChat: string | null, messagesReady: boolean) {
  const { userId, getToken } = useAuth();
  const cache = useQueryClient();
  useEffect(() => {
    if (!activeChat || !messagesReady || !userId) return;
    let cancelled = false;
    void getToken().then(async (token) => {
      if (!token || cancelled) return;
      try {
        await fetch(`/api/radar/chats/${activeChat}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          window.dispatchEvent(new Event('echo-chat-read'));
          void cache.invalidateQueries({ queryKey: getGetRadarInboxQueryKey() });
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeChat, messagesReady, userId, getToken, cache]);
}
