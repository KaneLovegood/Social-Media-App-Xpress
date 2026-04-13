import { ClipboardEvent, KeyboardEvent, RefObject } from 'react';

interface ComposerInputRowProps {
  content: string;
  canSend: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onOpenFilePicker: () => void;
  onContentChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSendLike: () => void;
}

export default function ComposerInputRow({
  content,
  canSend,
  textareaRef,
  onOpenFilePicker,
  onContentChange,
  onKeyDown,
  onPaste,
  onSendLike,
}: ComposerInputRowProps) {
  return (
    <div className="flex items-end gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onOpenFilePicker}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f2e5c] transition hover:bg-zinc-100"
        aria-label="Insert attachment"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={1}
        placeholder="Nhap @, tin nhan..."
        className="min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] text-[#344f75] outline-none placeholder:text-[#4c6384]"
      />

      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f2e5c] transition hover:bg-zinc-100"
        aria-label="Emoji"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="8" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
          <path d="M8.5 14.5c.8 1 1.9 1.5 3.5 1.5s2.7-.5 3.5-1.5" />
        </svg>
      </button>

      <button
        type={canSend ? 'submit' : 'button'}
        onClick={onSendLike}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#e08a00] transition hover:bg-[#fff4e1]"
        aria-label={canSend ? 'Send message' : 'Send like'}
      >
        {canSend ? (
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
            <path d="m4 12 15-7-3 7 3 7-15-7Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 10V5.8a2 2 0 0 0-3.2-1.6L8 6.3V20h9.1a2 2 0 0 0 2-1.6l1.2-5.2a2 2 0 0 0-2-2.4H14Z" />
            <path d="M8 20H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3" />
          </svg>
        )}
      </button>
    </div>
  );
}
