import { RefObject } from 'react';
import { ChatMessage, ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  listRef: RefObject<HTMLUListElement | null>;
  onReply: (preview: ReplyPreviewType) => void;
  onDelete: (messageId: string) => void;
  onRecall: (messageId: string) => void;
  className?: string;
}

export default function MessageList({
  messages,
  currentUserId,
  listRef,
  onReply,
  onDelete,
  onRecall,
  className,
}: MessageListProps) {
  const isEmpty = messages.length === 0;

  return (
    <ul
      ref={listRef}
      className={`flex min-h-80 flex-col gap-3 overflow-y-auto rounded-[24px] bg-[#eef0f3] px-3 py-4 lg:min-h-0 lg:px-5 lg:py-5 ${isEmpty ? 'items-center justify-center' : ''} ${className ?? ''}`}
    >
      {isEmpty ? (
        <li className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-34 w-34 items-center justify-center rounded-full bg-[#ccd4ef]">
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0f61d4]" fill="currentColor">
              <path d="m4 12 15-7-3 7 3 7-15-7Z" />
            </svg>
          </div>
          <p className="mt-6 text-[42px] font-bold leading-tight text-[#26366a]">
            Hay gui loi chao den...
          </p>
        </li>
      ) : null}

      {messages.map((message) => (
        <MessageItem
          key={message.messageId}
          message={message}
          currentUserId={currentUserId}
          onReply={onReply}
          onDelete={onDelete}
          onRecall={onRecall}
        />
      ))}
    </ul>
  );
}
