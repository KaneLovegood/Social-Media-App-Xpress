import { useCallback } from 'react';
import { ChatMessage } from '@/lib/realtime/types';

export function useMessageActions(
  effectiveActiveRoomId: string,
  peerUserId: string,
) {
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
          emitMessageActionEvent('copy_message', { messageId: message.messageId });
        })
        .catch(() => {
          // Ignore clipboard permission errors.
        });
    },
    [emitMessageActionEvent],
  );

  const handlePinMessage = useCallback(
    (message: ChatMessage) => {
      emitMessageActionEvent('pin_message', { messageId: message.messageId });
    },
    [emitMessageActionEvent],
  );

  const handleMarkMessage = useCallback(
    (message: ChatMessage) => {
      emitMessageActionEvent('mark_message', { messageId: message.messageId });
    },
    [emitMessageActionEvent],
  );

  const handleSelectManyMessage = useCallback(
    (message: ChatMessage) => {
      emitMessageActionEvent('select_many_messages', { fromMessageId: message.messageId });
    },
    [emitMessageActionEvent],
  );

  const handleViewMessageDetails = useCallback(
    (message: ChatMessage) => {
      emitMessageActionEvent('view_message_details', {
        messageId: message.messageId,
        senderId: message.senderId,
        createdAt: message.createdAt,
      });
    },
    [emitMessageActionEvent],
  );

  return {
    handleCopyMessage,
    handlePinMessage,
    handleMarkMessage,
    handleSelectManyMessage,
    handleViewMessageDetails,
    emitMessageActionEvent,
  };
}
