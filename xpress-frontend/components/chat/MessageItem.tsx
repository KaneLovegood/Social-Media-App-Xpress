import { ChatMessage, ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import ReplyPreview from './ReplyPreview';

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  onReply: (preview: ReplyPreviewType) => void;
  onDelete: (messageId: string) => void;
  onRecall: (messageId: string) => void;
}

export default function MessageItem({
  message,
  currentUserId,
  onReply,
  onDelete,
  onRecall,
}: MessageItemProps) {
  const isOwn = message.senderId === currentUserId;
  const canRecall = isOwn;

  return (
    <li className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <article className={`flex max-w-[85%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[14px] shadow-sm ${
            isOwn
              ? 'rounded-br-md bg-gradient-to-br from-[#0052cc] to-[#0068ff] text-white'
              : 'rounded-tl-md bg-white text-[#191c1e]'
          }`}
        >
          {message.replyPreview ? <ReplyPreview reply={message.replyPreview} /> : null}

          {message.isDeleted ? (
            <p className={`italic ${isOwn ? 'text-orange-100' : 'text-zinc-500'}`}>Message deleted</p>
          ) : message.isRecalled ? (
            <p className={`italic ${isOwn ? 'text-orange-100' : 'text-zinc-500'}`}>Message recalled</p>
          ) : (
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        <footer className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="hidden items-center gap-2 opacity-0 transition group-hover:opacity-100 md:flex">
            <button
              type="button"
              className="font-medium hover:text-zinc-700"
              onClick={() =>
                onReply({
                  messageId: message.messageId,
                  senderId: message.senderId,
                  content: message.content,
                })
              }
              disabled={message.isDeleted || message.isRecalled}
            >
              Reply
            </button>
            {isOwn ? (
              <>
                <button
                  type="button"
                  className="font-medium hover:text-zinc-700"
                  onClick={() => onDelete(message.messageId)}
                  disabled={message.isDeleted || message.isRecalled}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="font-medium hover:text-zinc-700"
                  onClick={() => onRecall(message.messageId)}
                  disabled={!canRecall || message.isDeleted || message.isRecalled}
                >
                  Recall
                </button>
              </>
            ) : null}
          </div>
        </footer>
      </article>
    </li>
  );
}
