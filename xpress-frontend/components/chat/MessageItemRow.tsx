import { ChatMessage, ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import MessageActionsMenu from './MessageActionsMenu';
import MessageBubbleCard from './MessageBubbleCard';

interface MessageItemRowProps {
  message: ChatMessage;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
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
}

function getInitial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export default function MessageItemRow({
  message,
  currentUserId,
  currentUserName,
  peerName,
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
}: MessageItemRowProps) {
  const isOwn = message.senderId === currentUserId;
  const canRecall = isOwn;
  const isConversationGenerated = message.messageType === 'CALL_LOG';
  const senderName = isOwn ? currentUserName : peerName;
  const replySenderName = isOwn ? currentUserName : peerName;

  const deliveryLabel = isOwn
    ? message.receivedAt
      ? 'Đã nhận'
      : 'Đã gửi'
    : '';

  return (
    <li className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <article className={`flex max-w-[92%] items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7dfec] text-sm font-semibold text-[#2f4268]">
          {getInitial(senderName)}
        </div>

        <div className={`flex min-w-0 flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          <p className="mb-1 text-xs font-semibold text-[#4c5f80]">{senderName}</p>

          <div className={`relative ${isOwn ? 'pl-16' : 'pr-16'}`}>
            <MessageBubbleCard
              message={message}
              isOwn={isOwn}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              peerName={peerName}
              onRedial={onRedial}
              onImageClick={onImageClick}
            />

            <div className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? 'left-0' : 'right-0'}`}>
              <MessageActionsMenu
                isOwn={isOwn}
                disabled={message.isRecalled || isConversationGenerated}
                canRecall={canRecall && !message.isRecalled}
                onReply={() =>
                  onReply({
                    messageId: message.messageId,
                    senderId: message.senderId,
                    senderName: replySenderName,
                    content: message.content,
                  })
                }
                onCopy={() => onCopy(message)}
                onPin={() => onPin(message)}
                onMark={() => onMark(message)}
                onSelectMany={() => onSelectMany(message)}
                onViewDetails={() => onViewDetails(message)}
                onRecall={() => onRecall(message.messageId)}
                onDeleteForMe={() => onDeleteForMe(message.messageId)}
              />
            </div>
          </div>

          <footer className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {deliveryLabel ? <span>{deliveryLabel}</span> : null}
          </footer>
        </div>
      </article>
    </li>
  );
}
