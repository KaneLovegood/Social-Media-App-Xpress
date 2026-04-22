import { useCallback, useEffect, useState } from 'react';
import { getClearHistoryStorageKey } from '@/lib/chat-utils';

export function useClearedHistory(currentUserId: string) {
  const [clearedRoomAtById, setClearedRoomAtById] = useState<Record<string, string>>({});
  const [isClearHistoryHydrated, setIsClearHistoryHydrated] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsClearHistoryHydrated(true);
      return;
    }

    const raw = window.localStorage.getItem(getClearHistoryStorageKey(currentUserId));
    if (!raw) {
      setClearedRoomAtById({});
      setIsClearHistoryHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      setClearedRoomAtById(parsed ?? {});
    } catch {
      setClearedRoomAtById({});
    }

    setIsClearHistoryHydrated(true);
  }, [currentUserId]);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !isClearHistoryHydrated) {
      return;
    }

    window.localStorage.setItem(
      getClearHistoryStorageKey(currentUserId),
      JSON.stringify(clearedRoomAtById),
    );
  }, [clearedRoomAtById, currentUserId, isClearHistoryHydrated]);

  const markRoomCleared = useCallback((roomId: string) => {
    setClearedRoomAtById((prev) => ({
      ...prev,
      [roomId]: new Date().toISOString(),
    }));
  }, []);

  return {
    clearedRoomAtById,
    setClearedRoomAtById,
    isClearHistoryHydrated,
    markRoomCleared,
  };
}
