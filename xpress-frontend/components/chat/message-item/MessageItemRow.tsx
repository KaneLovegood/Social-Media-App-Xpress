import {
  ChatMessage,
  ReplyPreview as ReplyPreviewType,
} from "@/lib/realtime/types";
import { useState, useEffect } from "react";
import MessageActionsMenu from "../message-action/MessageActionsMenu";
import MessageBubbleCard from "./MessageBubbleCard";

interface MessageItemRowProps {
  message: ChatMessage;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  senderNameById: Record<string, string>;
  senderAvatarById: Record<string, string>;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
  isPinned?: boolean;
  isStarred?: boolean;
  onReply: (preview: ReplyPreviewType) => void;
  onForward: (message: ChatMessage) => void;
  onRecall: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onCopy: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onMark: (message: ChatMessage) => void;
  onSelectMany: (message: ChatMessage) => void;
  onViewDetails: (message: ChatMessage) => void;
  onRedial: (mode: "voice" | "video") => void;
  onImageClick?: (url: string, senderName?: string, timestamp?: string) => void;
  onReplyPreviewClick?: (messageId: string) => void;
}

function getInitial(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function SmilePlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M19 5v4" />
      <path d="M17 7h4" />
    </svg>
  );
}

export default function MessageItemRow({
  message,
  currentUserId,
  currentUserName,
  peerName,
  senderNameById,
  senderAvatarById,
  isMultiSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isPinned = false,
  isStarred = false,
  onReply,
  onForward,
  onRecall,
  onDeleteForMe,
  onCopy,
  onPin,
  onMark,
  onSelectMany,
  onViewDetails,
  onRedial,
  onImageClick,
  onReplyPreviewClick,
}: MessageItemRowProps) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [localReaction, setLocalReaction] = useState("");
  const [showMobileActions, setShowMobileActions] = useState(false);
  const isOwn = message.senderId === currentUserId;

  useEffect(() => {
    if (!showMobileActions) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const bubbleEl = document.getElementById(`msg-bubble-${message.messageId}`);
      const actionsEl = document.getElementById(`msg-actions-${message.messageId}`);
      if (
        bubbleEl && !bubbleEl.contains(target) &&
        actionsEl && !actionsEl.contains(target)
      ) {
        setShowMobileActions(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showMobileActions, message.messageId]);

  const handleBubbleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer')) {
      return;
    }
    setShowMobileActions((prev) => !prev);
  };

  const isSystemMessage = message.messageType === "SYSTEM";
  const canRecall = isOwn;
  const isConversationGenerated = message.messageType === "CALL_LOG";
  const senderName =
    senderNameById[message.senderId] ?? (isOwn ? currentUserName : peerName);
  const senderAvatarUrl = senderAvatarById[message.senderId] ?? "";
  const resolveSenderName = (senderId: string) => {
    if (senderId === currentUserId) {
      return currentUserName;
    }

    return senderNameById[senderId] ?? peerName;
  };
  const replySenderName = resolveSenderName(message.senderId);

  const deliveryLabel = isOwn
    ? message.receivedAt
      ? "Đã nhận"
      : "Đã gửi"
    : "";

  const handleRowClick = () => {
    if (isMultiSelectMode && onToggleSelect && !isSystemMessage) {
      onToggleSelect(message.messageId);
    }
  };

  if (isSystemMessage) {
    return (
      <li id={`msg-${message.messageId}`} className="flex justify-center">
        <div className="flex max-w-[88%] items-center gap-2 rounded-full bg-[#e8ebef] px-3 py-2 text-sm font-medium text-[#5f6b7f]">
          {senderAvatarUrl ? (
            <img
              src={senderAvatarUrl}
              alt={senderName}
              className="h-6 w-6 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#cfd6e2] text-[11px] font-semibold text-[#364765]">
              {getInitial(senderName)}
            </div>
          )}
          <span>{message.content}</span>
        </div>
      </li>
    );
  }

  return (
    <li
      id={`msg-${message.messageId}`}
      onClick={handleRowClick}
      className={`group flex transition-all ${
        isMultiSelectMode
          ? "cursor-pointer select-none rounded-2xl p-1.5 hover:bg-slate-200/50"
          : ""
      } ${isOwn ? "justify-end" : "justify-start"} ${
        isSelected ? "bg-sky-50/70 border border-sky-100 rounded-2xl shadow-xs" : ""
      }`}
    >
      <article
        className={`flex max-w-[92%] items-start gap-2 ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Multi-select Checkbox */}
        {isMultiSelectMode && (
          <div className="flex self-center px-1 shrink-0">
            <div
              className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                isSelected
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              {isSelected && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="h-3 w-3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>
        )}

        {senderAvatarUrl ? (
          <img
            src={senderAvatarUrl}
            alt={senderName}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7dfec] text-sm font-semibold text-[#2f4268]">
            {getInitial(senderName)}
          </div>
        )}

        <div
          className={`flex min-w-0 flex-col ${isOwn ? "items-end" : "items-start"}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-[#4c5f80]">
              {senderName}
            </p>
            {isPinned && (
              <span className="text-amber-600" title="Tin nhắn đã ghim">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 rotate-45">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                </svg>
              </span>
            )}
          </div>

          <div className={`relative ${isOwn ? "pl-10 lg:pl-12" : "pr-10 lg:pr-12"}`}>
            <div
              id={`msg-bubble-${message.messageId}`}
              onClick={handleBubbleClick}
              className="cursor-pointer"
            >
              <MessageBubbleCard
                message={message}
                isOwn={isOwn}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                peerName={peerName}
                senderName={senderName}
                senderNameById={senderNameById}
                onRedial={onRedial}
                onImageClick={onImageClick}
                onReplyPreviewClick={onReplyPreviewClick}
              />
            </div>

            {!isOwn && !isMultiSelectMode && !message.isRecalled ? (
              <div className="absolute -bottom-4 left-2 z-10">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setReactionPickerOpen((prev) => !prev)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
                    aria-label="Thả cảm xúc"
                  >
                    {localReaction ? (
                      <span className="text-sm leading-none">{localReaction}</span>
                    ) : (
                      <SmilePlusIcon />
                    )}
                  </button>
                  {reactionPickerOpen ? (
                    <div className="absolute bottom-8 left-0 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setLocalReaction((prev) =>
                              prev === emoji ? "" : emoji,
                            );
                            setReactionPickerOpen(false);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-base transition hover:bg-slate-100"
                          aria-label={`Thả cảm xúc ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isMultiSelectMode && (
              <div
                id={`msg-actions-${message.messageId}`}
                className={`absolute bottom-2 lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto ${
                  isOwn ? "left-0" : "right-0"
                }`}
              >
                <MessageActionsMenu
                  isOwn={isOwn}
                  disabled={
                    message.isRecalled ||
                    isConversationGenerated ||
                    isSystemMessage
                  }
                  canRecall={canRecall && !message.isRecalled}
                  isPinned={isPinned}
                  isStarred={isStarred}
                  forceShow={showMobileActions}
                  onCloseMobileActions={() => setShowMobileActions(false)}
                  onReply={() =>
                    onReply({
                      messageId: message.messageId,
                      senderId: message.senderId,
                      senderName: replySenderName,
                      messageType: message.messageType,
                      content:
                        message.content ||
                        message.fileName ||
                        (message.messageType === "IMAGE"
                          ? "Ảnh"
                          : message.messageType === "VIDEO"
                            ? "Video"
                            : message.messageType === "FILE"
                              ? "Tệp tin"
                              : "Tin nhắn"),
                      fileUrl: message.fileUrl,
                      fileName: message.fileName,
                      fileSize: message.fileSize,
                      mimeType: message.mimeType,
                    })
                  }
                  onForward={() => onForward(message)}
                  onCopy={() => onCopy(message)}
                  onPin={() => onPin(message)}
                  onMark={() => onMark(message)}
                  onSelectMany={() => onSelectMany(message)}
                  onViewDetails={() => onViewDetails(message)}
                  onRecall={() => onRecall(message.messageId)}
                  onDeleteForMe={() => onDeleteForMe(message.messageId)}
                />
              </div>
            )}
          </div>

          <footer className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {isStarred && (
              <span className="flex items-center gap-0.5 text-amber-500 font-medium" title="Tin nhắn đã đánh dấu">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                  <path d="M12 .587l3.668 7.431 8.2 1.191-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.209l8.2-1.191L12 .587z" />
                </svg>
                Đã đánh dấu
              </span>
            )}
            {deliveryLabel ? <span>{deliveryLabel}</span> : null}
          </footer>
        </div>
      </article>
    </li>
  );
}
