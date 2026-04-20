'use client';

import React, { useRef, useEffect } from 'react';
import ChatContent from './ChatContent';
import { useAiChat } from '@/hooks/useAiChat';
import { SendMessageOptions } from './MessageInput';
import { ChatMessage } from '@/lib/realtime/types';

interface AiChatBoxProps {
  currentUserId: string;
  currentUserName: string;
  onBackToList?: () => void;
}

export default function AiChatBox({ currentUserId, currentUserName, onBackToList }: AiChatBoxProps) {
  const { messages, isLoading, isInitialized, handleSend } = useAiChat(currentUserId);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleMessageSend = (content: string, options?: SendMessageOptions) => {
    handleSend(
      content,
      options?.fileUrl,
      options?.messageType,
      options?.fileName,
      options?.fileSize,
      options?.mimeType
    );
  };

  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ChatContent
      peerName="Logistics AI Assistant"
      orderTitle="Hỗ trợ thông minh Logistics"
      typingText={isLoading ? "AI Assistant đang gõ máy..." : ""}
      isPeerOnline={true}
      activeMessages={messages}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      listRef={listRef}
      replyTo={undefined}
      onBackToList={onBackToList || (() => {})}
      onOpenInfo={() => {}}
      onOpenVoiceCall={() => alert("AI Assistant hiện chưa hỗ trợ gọi thoại.")}
      onOpenVideoCall={() => alert("AI Assistant hiện chưa hỗ trợ gọi video.")}
      onClearReply={() => {}}
      onSend={handleMessageSend}
      onTyping={() => {}}
      onReply={() => {}}
      onForward={() => alert("Tính năng chuyển tiếp hiện bị tắt trong chế độ AI.")}
      onRecall={() => alert("Không thể thu hồi tin nhắn với AI.")}
      onDeleteForMe={() => alert("Chưa hỗ trợ xóa cục bộ tin nhắn AI.")}
      onCopy={(msg: ChatMessage) => navigator.clipboard.writeText(msg.content)}
      onPin={() => {}}
      onMark={() => {}}
      onSelectMany={() => {}}
      onViewDetails={() => {}}
      onRedial={() => {}}
    />
  );
}
