"use client";

import { useState } from 'react';
import { ChatMessage, ReplyPreview } from '@/lib/realtime/types';
import ChatHeader from './ChatHeader';
import MessageInput, { SendMessageOptions } from './MessageInput';
import MessageList from './MessageList';
import ImageViewerModal from './modal/ImageViewerModal';

interface ChatContentProps {
  peerName: string;
  orderTitle: string;
  typingText: string;
  isPeerOnline: boolean;
  activeMessages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  listRef: React.RefObject<HTMLUListElement | null>;
  replyTo: ReplyPreview | undefined;
  onOpenVoiceCall: () => void;
  onOpenVideoCall: () => void;
  onClearReply: () => void;
  onSend: (content: string, options?: SendMessageOptions) => void;
  onTyping: (isTyping: boolean) => void;
  onReply: (preview: ReplyPreview) => void;
  onRecall: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onCopy: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onMark: (message: ChatMessage) => void;
  onSelectMany: (message: ChatMessage) => void;
  onViewDetails: (message: ChatMessage) => void;
  onRedial: (mode: 'voice' | 'video') => void;
}

export default function ChatContent({
  peerName,
  orderTitle,
  typingText,
  isPeerOnline,
  activeMessages,
  currentUserId,
  currentUserName,
  listRef,
  replyTo,
  onOpenVoiceCall,
  onOpenVideoCall,
  onClearReply,
  onSend,
  onTyping,
  onReply,
  onRecall,
  onDeleteForMe,
  onCopy,
  onPin,
  onMark,
  onSelectMany,
  onViewDetails,
  onRedial,
}: ChatContentProps) {
  const [viewerImage, setViewerImage] = useState<{ url: string; senderName?: string; timestamp?: string } | null>(null);

  return (
    <>
      <ChatHeader
        peerName={peerName}
        orderTitle={orderTitle}
        typingText={typingText}
        isPeerOnline={isPeerOnline}
        onOpenVoiceCall={onOpenVoiceCall}
        onOpenVideoCall={onOpenVideoCall}
      />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
        <MessageList
          messages={activeMessages}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          peerName={peerName}
          listRef={listRef}
          onReply={onReply}
          onRecall={onRecall}
          onDeleteForMe={onDeleteForMe}
          onCopy={onCopy}
          onPin={onPin}
          onMark={onMark}
          onSelectMany={onSelectMany}
          onViewDetails={onViewDetails}
          onRedial={onRedial}
          onImageClick={(url, senderName, timestamp) => setViewerImage({ url, senderName, timestamp })}
          className="flex-1"
        />
        <div className="mt-2 lg:mt-3">
          <MessageInput
            replyTo={replyTo}
            onClearReply={onClearReply}
            onSend={onSend}
            onTyping={onTyping}
          />
        </div>
      </div>

      <ImageViewerModal
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
        imageUrl={viewerImage?.url || ''}
        senderName={viewerImage?.senderName}
        timestamp={viewerImage?.timestamp}
      />
    </>
  );
}
