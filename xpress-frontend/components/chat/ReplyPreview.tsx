import { ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';

interface ReplyPreviewProps {
  reply?: ReplyPreviewType;
  onClear?: () => void;
  mode?: 'composer' | 'message';
}

export default function ReplyPreview({
  reply,
  onClear,
  mode = 'message',
}: ReplyPreviewProps) {
  if (!reply) return null;

  return (
    <div
      className={
        mode === 'composer'
          ? 'mb-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm'
          : 'mb-1 rounded-lg border border-zinc-200/80 bg-white/80 px-2 py-1 text-xs'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-amber-900">Reply to {reply.senderId}</p>
          <p className="truncate text-zinc-600">{reply.content}</p>
        </div>
        {mode === 'composer' && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
