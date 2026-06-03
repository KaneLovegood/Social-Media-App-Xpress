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
import CameraCapture from "./message-input/CameraCapture";
import { useCameraScan } from "@/hooks/use-camera-scan";
import { fetchFriends, SocialUser } from "@/lib/social";
import { toast } from "sonner";
import { htmlToMarkdown } from "@/lib/chat-utils";

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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { startCamera, stopCamera, stream, switchCamera } = useCameraScan();
  const [isCameraActive, setIsCameraActive] = useState(false);

  // 5 Action states
  const [isFormatBarOpen, setIsFormatBarOpen] = useState(false);
  const [isLightningOpen, setIsLightningOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<SocialUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [searchFriendQuery, setSearchFriendQuery] = useState("");

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
    // No-op for contenteditable rich text composer
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
      'video/mp4',
      'video/x-m4v',
      'video/webm',
      'video/ogg',
      'video/quicktime',
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

  const handleTakePhotoClick = async () => {
    const s = await startCamera();
    if (s) {
      setIsCameraActive(true);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.png`, { type: "image/png" });
        addFiles([file]);
        stopCamera();
        setIsCameraActive(false);
      }
    }, "image/png");
  };

  const cancelCamera = () => {
    stopCamera();
    setIsCameraActive(false);
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
          
          let messageType: MessageType = "FILE";
          if (file.type.startsWith("image/")) {
            messageType = "IMAGE";
          } else if (file.type.startsWith("video/")) {
            messageType = "VIDEO";
          }
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    if (!canSend) return;

    const form = event.currentTarget.closest("form");
    if (!form) return;

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }

    form.dispatchEvent(
      new Event("submit", { cancelable: true, bubbles: true }),
    );
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pastedFiles.length > 0) {
      event.preventDefault();
      addFiles(pastedFiles);
      return;
    }

    // Intercept pastes to insert as plain text and strip styled HTML
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
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
    const videoCount = attachments.filter(
      (item) => item.kind === "video",
    ).length;
    const fileCount = attachments.length - imageCount - videoCount;
    const parts: string[] = [];

    if (imageCount > 0) {
      parts.push(`${imageCount} ảnh`);
    }

    if (videoCount > 0) {
      parts.push(`${videoCount} video`);
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

  const handleOpenCardModal = async () => {
    setIsCardModalOpen(true);
    setIsLoadingFriends(true);
    try {
      const res = await fetchFriends();
      setFriendsList(res.items);
    } catch (err) {
      console.error("Failed to fetch friends:", err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleScreenCapture = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const video = document.createElement("video");
      video.srcObject = displayStream;
      video.autoplay = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
                addFiles([file]);
                toast.success("Chụp ảnh màn hình thành công!");
              }
              displayStream.getTracks().forEach(track => track.stop());
            }, "image/png");
          }
        }, 500);
      };
    } catch (err) {
      console.warn("Screen capture failed or cancelled:", err);
    }
  };

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const editor = textareaRef.current;
    if (!editor) return;

    editor.focus();

    if (prefix === "**") {
      document.execCommand("bold", false);
    } else if (prefix === "*") {
      document.execCommand("italic", false);
    } else if (prefix === "~~") {
      document.execCommand("strikeThrough", false);
    } else if (prefix === "<u>") {
      document.execCommand("underline", false);
    } else if (prefix === "`") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        const codeNode = document.createElement("code");
        codeNode.className = "bg-slate-100 rounded px-1 py-0.5 text-red-600 font-mono text-xs";
        codeNode.textContent = selectedText || "code";
        range.deleteContents();
        range.insertNode(codeNode);
        
        const newRange = document.createRange();
        newRange.setStartAfter(codeNode);
        newRange.setEndAfter(codeNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else if (prefix === "> ") {
      document.execCommand("formatBlock", false, "blockquote");
    }

    const html = editor.innerHTML;
    setContent(htmlToMarkdown(html));
  };

  const toggleChangeCase = () => {
    const editor = textareaRef.current;
    if (!editor) return;
    editor.focus();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        let nextText = "";
        if (selectedText === selectedText.toUpperCase() && selectedText !== selectedText.toLowerCase()) {
          // Full uppercase -> lowercase
          nextText = selectedText.toLowerCase();
        } else if (selectedText === selectedText.toLowerCase()) {
          // Lowercase -> capitalized
          nextText = selectedText.split(/(\s+)/).map(word => {
            if (!word.trim()) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }).join("");
        } else {
          // Capitalized -> uppercase
          nextText = selectedText.toUpperCase();
        }
        
        range.deleteContents();
        range.insertNode(document.createTextNode(nextText));
        
        const html = editor.innerHTML;
        setContent(htmlToMarkdown(html));
      }
    }
  };

  const applyColor = (color: string) => {
    const editor = textareaRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("foreColor", false, color);
    const html = editor.innerHTML;
    setContent(htmlToMarkdown(html));
  };

  const QUICK_REPLIES = [
    "Dạ vâng, tôi xin lỗi vì sự bất tiện.",
    "Ok, tôi đã nhận được thông tin.",
    "Tôi đang xử lý, vui lòng đợi trong giây lát.",
    "Chào bạn! Tôi có thể giúp gì cho bạn?",
    "Cảm ơn bạn nhiều nhé!",
    "Chúc bạn một ngày tốt lành!",
  ];

  const filteredFriends = useMemo(() => {
    const query = searchFriendQuery.trim().toLowerCase();
    if (!query) return friendsList;
    return friendsList.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.email.toLowerCase().includes(query)
    );
  }, [friendsList, searchFriendQuery]);

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative overflow-visible border transition-colors ${
        isDragging ? "border-blue-500 bg-blue-50/50" : "border-[#d8dce2] bg-white"
      }`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-blue-500/10 transition-all">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-white px-6 py-4 shadow-xl shadow-blue-500/20">
            <svg
              className="h-8 w-8 text-blue-500 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-[15px] font-medium text-blue-600">Thả tệp vào đây</span>
          </div>
        </div>
      )}
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
        accept="image/*,video/*"
        className="hidden"
        onChange={handleImageInputChange}
      />

      <ReplyPreview reply={replyTo} onClear={onClearReply} mode="composer" />
      <ComposerToolbar
        onOpenCamera={() => setIsCameraOpen(true)}
        onOpenImagePicker={openImagePicker}
        onOpenFilePicker={openFilePicker}
        onEmojiSelect={handleEmojiSelect}
        onOpenCard={handleOpenCardModal}
        onOpenCrop={handleScreenCapture}
        onOpenFormat={() => setIsFormatBarOpen(!isFormatBarOpen)}
        onOpenLightning={() => setIsLightningOpen(!isLightningOpen)}
        onOpenNote={() => setIsNoteModalOpen(true)}
      />
      {isCameraOpen && (
        <CameraCapture
          onCapture={(file) => addFiles([file])}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {isCameraActive && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4">
          <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl">
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el) el.srcObject = stream;
              }}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-6 flex justify-center items-center gap-6">
              <button
                type="button"
                onClick={switchCamera}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white shadow-lg transition active:scale-90"
                title="Xoay camera"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 13a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 11a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleCapture}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg transition active:scale-90"
              >
                <div className="h-10 w-10 rounded-full border-2 border-black" />
              </button>
              <button
                type="button"
                onClick={cancelCamera}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-white/60">Đang sử dụng camera...</p>
        </div>
      )}

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

      {isFormatBarOpen && (
        <div className="flex gap-2.5 px-4 py-1.5 bg-slate-50 border-t border-b border-slate-200 text-[#0d2b5a] flex-wrap items-center">
          <button
            type="button"
            onClick={() => applyFormatting("**")}
            className="font-bold hover:bg-zinc-200 px-2 py-0.5 rounded text-sm transition cursor-pointer"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("*")}
            className="italic hover:bg-zinc-200 px-2 py-0.5 rounded text-sm transition cursor-pointer"
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("<u>", "</u>")}
            className="underline hover:bg-zinc-200 px-2 py-0.5 rounded text-sm transition cursor-pointer font-semibold"
            title="Underline"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("~~")}
            className="line-through hover:bg-zinc-200 px-2 py-0.5 rounded text-sm transition cursor-pointer"
            title="Strikethrough"
          >
            S
          </button>

          <button
            type="button"
            onClick={toggleChangeCase}
            className="hover:bg-zinc-200 px-2 py-0.5 rounded text-sm transition cursor-pointer font-semibold"
            title="Đổi chữ hoa/thường (Aa)"
          >
            Aa
          </button>

          <div className="h-5 w-px bg-slate-200 self-center mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-1.5">
            {["#111827", "#0052cc", "#ef4444", "#10b981", "#f97316", "#8b5cf6", "#ec4899"].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyColor(color)}
                className="w-4 h-4 rounded-full border border-slate-350 hover:scale-110 active:scale-95 transition cursor-pointer"
                style={{ backgroundColor: color }}
                title={`Màu ${color}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsFormatBarOpen(false)}
            className="ml-auto text-slate-400 hover:text-slate-600 px-2 rounded text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {isLightningOpen && (
        <div className="absolute bottom-full left-3 z-50 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 px-1">
            <span className="text-xs font-bold text-slate-600">Mẫu trả lời nhanh</span>
            <button
              type="button"
              onClick={() => setIsLightningOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
            >
              Đóng
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto mt-1 space-y-1">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => {
                  setContent(reply);
                  setIsLightningOpen(false);
                  textareaRef.current?.focus();
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-50 text-slate-700 transition truncate cursor-pointer"
                title={reply}
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-rise-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Tạo ghi chú nhanh</h3>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tiêu đề ghi chú</label>
                <input
                  type="text"
                  placeholder="Nhập tiêu đề..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nội dung ghi chú</label>
                <textarea
                  rows={6}
                  placeholder="Nhập nội dung chi tiết..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden resize-none"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 px-4 py-2 text-xs font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!noteText.trim()) {
                    toast.error("Nội dung ghi chú không được để trống!");
                    return;
                  }
                  const title = noteTitle.trim() || "Ghi-chu";
                  const blob = new Blob([noteText], { type: "text/plain;charset=utf-8" });
                  const file = new File([blob], `${title}-${Date.now()}.txt`, { type: "text/plain" });
                  addFiles([file]);
                  setIsNoteModalOpen(false);
                  setNoteTitle("");
                  setNoteText("");
                  toast.success("Đã đính kèm ghi chú thành công!");
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Tạo & Đính kèm
              </button>
            </div>
          </div>
        </div>
      )}

      {isCardModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-rise-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Chia sẻ danh thiếp</h3>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm bạn bè..."
                  value={searchFriendQuery}
                  onChange={(e) => setSearchFriendQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden"
                />
                <div className="absolute left-3 top-2.5 text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              {isLoadingFriends ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              ) : filteredFriends.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Không tìm thấy bạn bè nào</p>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.userId}
                    onClick={() => {
                      onSend(`[Danh thiếp] Tên: ${friend.name} | Email: ${friend.email} | UserId: ${friend.userId}`);
                      setIsCardModalOpen(false);
                      toast.success(`Đã chia sẻ danh thiếp của ${friend.name}`);
                    }}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600 text-sm">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{friend.name}</p>
                      <p className="truncate text-[10px] text-slate-400 mt-0.5">{friend.email}</p>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline px-2.5 py-1.5 bg-blue-50 rounded-md cursor-pointer"
                    >
                      Chia sẻ
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
