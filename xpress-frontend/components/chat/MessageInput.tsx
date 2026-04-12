import { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import ReplyPreview from './ReplyPreview';
import AttachmentPreviewTray from './message-input/AttachmentPreviewTray';
import ComposerInputRow from './message-input/ComposerInputRow';
import ComposerToolbar from './message-input/ComposerToolbar';
import { PendingAttachment } from './message-input/types';

interface MessageInputProps {
  replyTo?: ReplyPreviewType;
  onClearReply: () => void;
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function toPendingAttachment(file: File): PendingAttachment {
  const kind = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : 'file';

  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    kind,
  };
}

export default function MessageInput({
  replyTo,
  onClearReply,
  onSend,
  onTyping,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => content.trim().length > 0 || attachments.length > 0, [attachments.length, content]);

  useEffect(() => {
    return () => {
      attachments.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [attachments]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const maxHeightPx = 160;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resizeTextarea();
  }, [content]);

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;

    const valid: PendingAttachment[] = [];
    const tooLargeNames: string[] = [];

    files.forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        tooLargeNames.push(file.name);
        return;
      }
      valid.push(toPendingAttachment(file));
    });

    if (tooLargeNames.length > 0) {
      setAttachmentError(`File qua 10MB: ${tooLargeNames.join(', ')}`);
    } else {
      setAttachmentError('');
    }

    if (valid.length > 0) {
      setAttachments((prev) => [...prev, ...valid]);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      const next = prev.filter((item) => item.id !== id);
      return next;
    });
  };

  const clearAttachments = () => {
    setAttachments((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;

    const attachmentSummary = attachments.map((item) => `[file:${item.file.name}]`).join(' ');
    const payload = [content.trim(), attachmentSummary].filter(Boolean).join('\n');

    onSend(payload);
    setContent('');
    clearAttachments();
    setAttachmentError('');
    onTyping(false);

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;

    event.preventDefault();
    if (!canSend) return;

    const form = event.currentTarget.form;
    if (!form) return;

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }

    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pastedFiles.length === 0) return;

    event.preventDefault();
    addFiles(pastedFiles);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addFiles(files);

    // Allow selecting the same file again in next picks.
    event.target.value = '';
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addFiles(files);
    event.target.value = '';
  };

  const attachmentTitle = useMemo(() => {
    if (attachments.length === 0) return '';

    const imageCount = attachments.filter((item) => item.kind === 'image').length;
    const fileCount = attachments.length - imageCount;
    const parts: string[] = [];

    if (imageCount > 0) {
      parts.push(`${imageCount} ảnh`);
    }

    if (fileCount > 0) {
      parts.push(`${fileCount} tệp`);
    }

    return parts.join(', ');
  }, [attachments]);

  const handleContentChange = (value: string) => {
    setContent(value);
    onTyping(value.trim().length > 0);
  };

  const handleSendLike = () => {
    if (canSend) return;
    onSend(':+1:');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-[14px] border border-[#d8dce2] bg-white"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleImageInputChange}
      />

      <ReplyPreview reply={replyTo} onClear={onClearReply} mode="composer" />
      <ComposerToolbar onOpenImagePicker={openImagePicker} onOpenFilePicker={openFilePicker} />

      <AttachmentPreviewTray
        attachments={attachments}
        attachmentTitle={attachmentTitle}
        attachmentError={attachmentError}
        onClearAttachments={clearAttachments}
        onRemoveAttachment={removeAttachment}
        onOpenFilePicker={openFilePicker}
      />

      <ComposerInputRow
        content={content}
        canSend={canSend}
        textareaRef={textareaRef}
        onOpenFilePicker={openFilePicker}
        onContentChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSendLike={handleSendLike}
      />
    </form>
  );
}
