import { ClipboardEvent, KeyboardEvent, RefObject, useEffect } from "react";
import { htmlToMarkdown, markdownToHtml } from "@/lib/chat-utils";

interface ComposerInputRowProps {
  content: string;
  canSend: boolean;
  textareaRef: RefObject<HTMLDivElement | null>;
  onOpenFilePicker: () => void;
  onContentChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
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
  // Synchronize outside content updates (like clearing input or selecting emojis)
  useEffect(() => {
    const editor = textareaRef.current;
    if (!editor) return;

    const expectedHtml = markdownToHtml(content);
    if (editor.innerHTML !== expectedHtml) {
      editor.innerHTML = expectedHtml;
    }
  }, [content, textareaRef]);

  const handleInput = () => {
    const editor = textareaRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    const markdown = htmlToMarkdown(html);
    onContentChange(markdown);
  };

  const isEmpty = !content;

  return (
    <div className="flex items-end gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onOpenFilePicker}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f2e5c] transition hover:bg-zinc-100"
        aria-label="Insert attachment"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      <div className="relative flex-1 min-h-9 max-h-40 overflow-y-auto">
        <div
          ref={textareaRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="w-full bg-transparent px-1 py-1.5 text-[15px] text-[#344f75] outline-none break-words"
          style={{ whiteSpace: "pre-wrap" }}
        />
        {isEmpty && (
          <div className="absolute left-1 top-1.5 pointer-events-none text-[15px] text-[#4c6384] select-none">
            Nhập @, tin nhắn...
          </div>
        )}
      </div>

      <button
        type={canSend ? "submit" : "button"}
        onClick={onSendLike}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f2e5c] transition hover:bg-zinc-100"
        aria-label={canSend ? "Send message" : "Send like"}
      >
        {canSend ? (
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 rotate-180" fill="currentColor">
            <path d="m4 12 15-7-3 7 3 7-15-7Z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M14 10V5.8a2 2 0 0 0-3.2-1.6L8 6.3V20h9.1a2 2 0 0 0 2-1.6l1.2-5.2a2 2 0 0 0-2-2.4H14Z" />
            <path d="M8 20H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3" />
          </svg>
        )}
      </button>
    </div>
  );
}
