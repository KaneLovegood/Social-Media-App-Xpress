import { useCallback, useState, useEffect } from 'react';
import { ChatMessage } from '@/lib/realtime/types';
import { toast } from 'sonner';

export function useMessageActions(
  effectiveActiveRoomId: string,
  peerUserId: string,
  currentUserId: string,
) {
  const [pinnedMessagesByRoom, setPinnedMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [starredMessagesByRoom, setStarredMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [deletedMessageIdsByRoom, setDeletedMessageIdsByRoom] = useState<Record<string, string[]>>({});
  
  // Multi-select state
  const [isMultiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  
  // View details modal state
  const [messageDetailsToShow, setMessageDetailsToShow] = useState<ChatMessage | null>(null);

  // Load from local storage
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUserId) return;

    try {
      const pins = localStorage.getItem(`pinned_msgs_${currentUserId}`);
      const stars = localStorage.getItem(`starred_msgs_${currentUserId}`);
      const deletes = localStorage.getItem(`deleted_for_me_${currentUserId}`);

      if (pins) setPinnedMessagesByRoom(JSON.parse(pins));
      if (stars) setStarredMessagesByRoom(JSON.parse(stars));
      if (deletes) setDeletedMessageIdsByRoom(JSON.parse(deletes));
    } catch (e) {
      console.error('Error loading chat actions from localStorage', e);
    }
  }, [currentUserId]);

  // Helper to save to localStorage
  const saveToLocalStorage = (key: string, data: unknown) => {
    if (typeof window === 'undefined' || !currentUserId) return;
    try {
      localStorage.setItem(`${key}_${currentUserId}`, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving ${key} to localStorage`, e);
    }
  };

  const emitMessageActionEvent = useCallback(
    (action: string, metadata: Record<string, unknown>) => {
      window.dispatchEvent(
        new CustomEvent('chat-message-action', {
          detail: {
            action,
            roomId: effectiveActiveRoomId,
            peerUserId,
            ...metadata,
          },
        }),
      );
    },
    [effectiveActiveRoomId, peerUserId],
  );

  const handleCopyMessage = useCallback(
    (message: ChatMessage) => {
      if (!message.content) return;

      void navigator.clipboard
        .writeText(message.content)
        .then(() => {
          toast.success('Đã sao chép tin nhắn vào bộ nhớ tạm');
          emitMessageActionEvent('copy_message', { messageId: message.messageId });
        })
        .catch(() => {
          toast.error('Không thể sao chép tin nhắn');
        });
    },
    [emitMessageActionEvent],
  );

  const handlePinMessage = useCallback(
    (message: ChatMessage) => {
      if (!effectiveActiveRoomId) return;

      setPinnedMessagesByRoom((prev) => {
        const roomPins = prev[effectiveActiveRoomId] ?? [];
        
        // Check if already pinned
        if (roomPins.some((m) => m.messageId === message.messageId)) {
          // Unpin it
          const nextPins = roomPins.filter((m) => m.messageId !== message.messageId);
          const next = { ...prev, [effectiveActiveRoomId]: nextPins };
          saveToLocalStorage('pinned_msgs', next);
          toast.success('Đã bỏ ghim tin nhắn');
          return next;
        }

        // Limit to 3 pinned messages
        if (roomPins.length >= 3) {
          toast.warning('Chỉ có thể ghim tối đa 3 tin nhắn trong mỗi cuộc trò chuyện');
          return prev;
        }

        const nextPins = [...roomPins, message];
        const next = { ...prev, [effectiveActiveRoomId]: nextPins };
        saveToLocalStorage('pinned_msgs', next);
        toast.success('Đã ghim tin nhắn');
        emitMessageActionEvent('pin_message', { messageId: message.messageId });
        return next;
      });
    },
    [effectiveActiveRoomId, emitMessageActionEvent],
  );

  const handleUnpinMessage = useCallback(
    (roomId: string, messageId: string) => {
      setPinnedMessagesByRoom((prev) => {
        const roomPins = prev[roomId] ?? [];
        const nextPins = roomPins.filter((m) => m.messageId !== messageId);
        const next = { ...prev, [roomId]: nextPins };
        saveToLocalStorage('pinned_msgs', next);
        toast.success('Đã bỏ ghim tin nhắn');
        return next;
      });
    },
    []
  );

  const handleMarkMessage = useCallback(
    (message: ChatMessage) => {
      if (!effectiveActiveRoomId) return;

      setStarredMessagesByRoom((prev) => {
        const roomStars = prev[effectiveActiveRoomId] ?? [];
        let nextStars;
        
        if (roomStars.some((m) => m.messageId === message.messageId)) {
          nextStars = roomStars.filter((m) => m.messageId !== message.messageId);
          toast.success('Đã bỏ đánh dấu tin nhắn');
        } else {
          nextStars = [...roomStars, message];
          toast.success('Đã đánh dấu tin nhắn');
          emitMessageActionEvent('mark_message', { messageId: message.messageId });
        }

        const next = { ...prev, [effectiveActiveRoomId]: nextStars };
        saveToLocalStorage('starred_msgs', next);
        return next;
      });
    },
    [effectiveActiveRoomId, emitMessageActionEvent],
  );

  const handleUnmarkMessage = useCallback(
    (roomId: string, messageId: string) => {
      setStarredMessagesByRoom((prev) => {
        const roomStars = prev[roomId] ?? [];
        const nextStars = roomStars.filter((m) => m.messageId !== messageId);
        const next = { ...prev, [roomId]: nextStars };
        saveToLocalStorage('starred_msgs', next);
        toast.success('Đã bỏ đánh dấu tin nhắn');
        return next;
      });
    },
    []
  );

  const handleSelectManyMessage = useCallback(
    (message: ChatMessage) => {
      setMultiSelectMode(true);
      setSelectedMessageIds([message.messageId]);
      emitMessageActionEvent('select_many_messages', { fromMessageId: message.messageId });
    },
    [emitMessageActionEvent],
  );

  const toggleSelectMessage = useCallback(
    (messageId: string) => {
      setSelectedMessageIds((prev) =>
        prev.includes(messageId)
          ? prev.filter((id) => id !== messageId)
          : [...prev, messageId]
      );
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelectedMessageIds([]);
    setMultiSelectMode(false);
  }, []);

  const handleViewMessageDetails = useCallback(
    (message: ChatMessage) => {
      setMessageDetailsToShow(message);
      emitMessageActionEvent('view_message_details', {
        messageId: message.messageId,
        senderId: message.senderId,
        createdAt: message.createdAt,
      });
    },
    [emitMessageActionEvent],
  );

  const handleDeleteMessageForMe = useCallback(
    (messageId: string) => {
      if (!effectiveActiveRoomId) return;

      setDeletedMessageIdsByRoom((prev) => {
        const roomDeletes = prev[effectiveActiveRoomId] ?? [];
        if (roomDeletes.includes(messageId)) return prev;

        const nextDeletes = [...roomDeletes, messageId];
        const next = { ...prev, [effectiveActiveRoomId]: nextDeletes };
        saveToLocalStorage('deleted_for_me', next);
        toast.success('Đã xóa tin nhắn ở phía bạn');
        emitMessageActionEvent('delete_message_for_me', { messageId });
        return next;
      });
    },
    [effectiveActiveRoomId, emitMessageActionEvent]
  );

  const handleDeleteMultipleForMe = useCallback(
    (messageIds: string[]) => {
      if (!effectiveActiveRoomId || messageIds.length === 0) return;

      setDeletedMessageIdsByRoom((prev) => {
        const roomDeletes = prev[effectiveActiveRoomId] ?? [];
        const uniqueNew = messageIds.filter((id) => !roomDeletes.includes(id));
        if (uniqueNew.length === 0) return prev;

        const nextDeletes = [...roomDeletes, ...uniqueNew];
        const next = { ...prev, [effectiveActiveRoomId]: nextDeletes };
        saveToLocalStorage('deleted_for_me', next);
        toast.success(`Đã xóa ${uniqueNew.length} tin nhắn ở phía bạn`);
        return next;
      });
      clearSelection();
    },
    [effectiveActiveRoomId, clearSelection]
  );

  return {
    pinnedMessagesByRoom,
    starredMessagesByRoom,
    deletedMessageIdsByRoom,
    isMultiSelectMode,
    selectedMessageIds,
    messageDetailsToShow,
    setMultiSelectMode,
    setSelectedMessageIds,
    setMessageDetailsToShow,
    toggleSelectMessage,
    clearSelection,
    handleCopyMessage,
    handlePinMessage,
    handleUnpinMessage,
    handleMarkMessage,
    handleUnmarkMessage,
    handleSelectManyMessage,
    handleViewMessageDetails,
    handleDeleteMessageForMe,
    handleDeleteMultipleForMe,
    emitMessageActionEvent,
  };
}
