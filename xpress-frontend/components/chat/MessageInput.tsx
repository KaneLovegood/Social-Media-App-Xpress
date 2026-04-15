import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ReplyPreview as ReplyPreviewType, MessageType } from "@/lib/realtime/types";
import { getPresignedUrl, uploadFileToS3 } from "@/lib/chat-upload";
import ReplyPreview from "./message-item/ReplyPreview";
import AttachmentPreviewTray from "./message-input/AttachmentPreviewTray";
import ComposerInputRow from "./message-input/ComposerInputRow";
import ComposerToolbar from "./message-input/ComposerToolbar";
import { PendingAttachment } from "./message-input/types";

export interface SendMessageOptions {
  messageType?: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

interface MessageInputProps {
  replyTo?: ReplyPreviewType;
  onClearReply: () => void;
  onSend: (content: string, options?: SendMessageOptions) => void;
  onTyping: (isTyping: boolean) => void;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function toPendingAttachment(file: File): PendingAttachment {
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : "file";

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
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(
    () => content.trim().length > 0 || attachments.length > 0,
    [attachments.length, content],
  );

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
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeightPx ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeTextarea();
  }, [content]);

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;

    const valid: PendingAttachment[] = [];
    const tooLargeNames: string[] = [];
    const invalidTypeNames: string[] = [];

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        invalidTypeNames.push(file.name);
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        tooLargeNames.push(file.name);
        return;
      }
      valid.push(toPendingAttachment(file));
    });

    const errorMessages: string[] = [];
    if (invalidTypeNames.length > 0) {
      errorMessages.push(`Định dạng không hỗ trợ: ${invalidTypeNames.join(", ")}`);
    }
    if (tooLargeNames.length > 0) {
      errorMessages.push(`Vượt quá 10MB: ${tooLargeNames.join(", ")}`);
    }
    
    setAttachmentError(errorMessages.join(" | "));

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend || isUploading) return;

    if (attachments.length > 0) {
      setIsUploading(true);
      try {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          const file = attachment.file;
          const { uploadUrl, publicUrl } = await getPresignedUrl(
            file.name,
            file.type,
            file.size
          );
          await uploadFileToS3(uploadUrl, file, (percent) => {
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === attachment.id ? { ...item, progress: percent } : item
              )
            );
          });
          
          const messageType: MessageType = file.type.startsWith("image/") ? "IMAGE" : "FILE";
          // Attach text to only the first sent file
          const sentContent = i === 0 ? content.trim() : "";
          
          onSend(sentContent, {
            messageType,
            fileUrl: publicUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
        }
      } catch (error) {
        console.error("Failed to upload attachments", error);
        setAttachmentError("Có lỗi xảy ra khi tải file lên, vui lòng thử lại.");
        setIsUploading(false);
        return; // Dừng lại nếu lỗi
      } finally {
        setIsUploading(false);
      }
    } else if (content.trim()) {
      onSend(content.trim());
    }

    setContent("");
    clearAttachments();
    setAttachmentError("");
    onTyping(false);

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    if (!canSend) return;

    const form = event.currentTarget.form;
    if (!form) return;

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }

    form.dispatchEvent(
      new Event("submit", { cancelable: true, bubbles: true }),
    );
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
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
    event.target.value = "";
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addFiles(files);
    event.target.value = "";
  };

  const attachmentTitle = useMemo(() => {
    if (attachments.length === 0) return "";

    const imageCount = attachments.filter(
      (item) => item.kind === "image",
    ).length;
    const fileCount = attachments.length - imageCount;
    const parts: string[] = [];

    if (imageCount > 0) {
      parts.push(`${imageCount} ảnh`);
    }

    if (fileCount > 0) {
      parts.push(`${fileCount} tệp`);
    }

    return parts.join(", ");
  }, [attachments]);

  const handleContentChange = (value: string) => {
    setContent(value);
    onTyping(value.trim().length > 0);
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji);
  };

  const handleSendLike = () => {
    if (canSend) return;
    onSend("👍");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-visible rounded-[14px] border border-[#d8dce2] bg-white"
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
      <ComposerToolbar
        onOpenImagePicker={openImagePicker}
        onOpenFilePicker={openFilePicker}
        onEmojiSelect={handleEmojiSelect}
      />

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
        canSend={canSend && !isUploading}
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
