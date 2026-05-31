import { ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import Icon from '@/components/common/Icon';

interface ReplyPreviewProps {
  reply?: ReplyPreviewType;
  onClear?: () => void;
  onClick?: () => void;
  mode?: 'composer' | 'message';
}

function getReplyTypeLabel(reply: ReplyPreviewType): string {
  switch (reply.messageType) {
    case 'IMAGE':
      return 'Ảnh';
    case 'VIDEO':
      return 'Video';
    case 'FILE':
      return 'Tệp tin';
    default:
      return 'Tin nhắn';
  }
}

export default function ReplyPreview({
  reply,
  onClear,
  onClick,
  mode = 'message',
}: ReplyPreviewProps) {
  if (!reply) return null;

  const isInteractive = Boolean(onClick && mode === 'message');
  const typeLabel = getReplyTypeLabel(reply);
  const previewText = reply.content?.trim() || reply.fileName || typeLabel;
  const hasImagePreview = reply.messageType === 'IMAGE' && reply.fileUrl;
  const hasVideoPreview = reply.messageType === 'VIDEO' && reply.fileUrl;
  const hasFilePreview = reply.messageType === 'FILE' && reply.fileUrl;
  const fileLabel = reply.fileName?.trim() || reply.content?.trim() || 'Tệp tin đính kèm';

  const previewBody = (
    <div className="flex min-w-0 items-center gap-2.5">
      {hasImagePreview ? (
        <img
          src={reply.fileUrl}
          alt={reply.fileName || 'Ảnh đính kèm'}
          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
        />
      ) : hasVideoPreview ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 ring-1 ring-sky-200/80">
          <Icon name="video" size="sm" />
        </div>
      ) : hasFilePreview ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80">
          <Icon name="file" size="sm" />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
          <Icon name="message" size="sm" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-medium text-amber-900">
          Trả lời {reply.senderName ?? reply.senderId}
        </p>
        {hasImagePreview ? (
          <p className="truncate text-zinc-600">{reply.content?.trim() || 'Ảnh'}</p>
        ) : hasFilePreview ? (
          <p className="truncate text-zinc-600">{fileLabel}</p>
        ) : (
          <p className="truncate text-zinc-600">{previewText}</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        mode === 'composer'
          ? 'mb-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm'
          : `mb-1 rounded-lg border border-zinc-200/80 bg-white/80 px-2 py-1 text-xs ${isInteractive ? 'cursor-pointer transition-colors hover:bg-slate-50' : ''}`
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        {previewBody}
        {mode === 'composer' && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            Xóa
          </button>
        ) : null}
      </div>
    </div>
  );
}
