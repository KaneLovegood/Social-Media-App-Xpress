import { RefObject } from 'react';
import { ChatMessage, ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import MessageItemRow from './MessageItemRow';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  canReply?: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  onReply: (preview: ReplyPreviewType) => void;
  onRecall: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onCopy: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onMark: (message: ChatMessage) => void;
  onSelectMany: (message: ChatMessage) => void;
  onViewDetails: (message: ChatMessage) => void;
  onRedial: (mode: 'voice' | 'video') => void;
  onImageClick?: (url: string, senderName?: string, timestamp?: string) => void;
  className?: string;
}

export default function MessageList({
  messages,
  currentUserId,
  currentUserName,
  peerName,
  listRef,
  onReply,
  onRecall,
  onDeleteForMe,
  onCopy,
  onPin,
  onMark,
  onSelectMany,
  onViewDetails,
  onRedial,
  onImageClick,
  className,
}: MessageListProps) {
  const isEmpty = messages.length === 0;

  return (
    <ul
      ref={listRef}
      data-chat-scroll="true"
      className={`flex min-h-80 flex-col gap-4 overflow-y-auto rounded-2xl bg-[#f3f4f6] px-3 py-4 lg:min-h-0 lg:px-5 lg:py-5 ${isEmpty ? 'items-center justify-center' : ''} ${className ?? ''}`}
    >
        <li className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-34 w-34 items-center justify-center rounded-full bg-[#ccd4ef]">
            <svg
              viewBox="0 0 24 24"
              className="h-12 w-12 text-[#0f61d4]"
              fill="currentColor"
            >
              <path d="m4 12 15-7-3 7 3 7-15-7Z" />
            </svg>
          </div>
          <p className="mt-6 text-[42px] font-bold leading-tight text-[#26366a]">
            Hãy gửi lời nhắn đầu tiên đến {peerName}
          </p>
        </li>

      {messages.map((message) => (
        <MessageItemRow
          key={message.messageId}
          message={message}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          peerName={peerName}
          onReply={onReply}
          onRecall={onRecall}
          onDeleteForMe={onDeleteForMe}
          onCopy={onCopy}
          onPin={onPin}
          onMark={onMark}
          onSelectMany={onSelectMany}
          onViewDetails={onViewDetails}
          onRedial={onRedial}
          onImageClick={onImageClick}
        />
      ))}
    </ul>
  );
}
