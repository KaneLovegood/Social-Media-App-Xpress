"use client";

import { useState } from "react";
import { ChatMessage, ReplyPreview } from "@/lib/realtime/types";
import ChatHeader from "./ChatHeader";
import MessageInput, { SendMessageOptions } from "./MessageInput";
import MessageList from "./MessageList";
import ImageViewerModal from "./modal/ImageViewerModal";
import Icon from "@/components/common/Icon";

interface ChatContentProps {
  peerName: string;
  orderTitle: string;
  typingText: string;
  isPeerOnline: boolean;
  isGroup: boolean;
  activeMessages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  senderNameById: Record<string, string>;
  senderAvatarById: Record<string, string>;
  listRef: React.RefObject<HTMLUListElement | null>;
  replyTo: ReplyPreview | undefined;
  onBackToList: () => void;
  onOpenInfo: () => void;
  onOpenVoiceCall: () => void;
  onOpenVideoCall: () => void;
  onClearReply: () => void;
  onSend: (content: string, options?: SendMessageOptions) => void;
  onTyping: (isTyping: boolean) => void;
  typingSenderId?: string;
  onReply: (preview: ReplyPreview) => void;
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

  // Multi-select and Pinned Messages Props
  pinnedMessages?: ChatMessage[];
  onUnpinMessage?: (roomId: string, messageId: string) => void;
  isMultiSelectMode?: boolean;
  selectedMessageIds?: string[];
  onToggleSelectMessage?: (messageId: string) => void;
  onClearSelection?: () => void;
  onDeleteMultipleForMe?: (messageIds: string[]) => void;
  onForwardMultiple?: (messages: ChatMessage[]) => void;
  starredMessages?: ChatMessage[];
}

export default function ChatContent({
  peerName,
  orderTitle,
  typingText,
  isPeerOnline,
  isGroup,
  activeMessages,
  currentUserId,
  currentUserName,
  senderNameById,
  senderAvatarById,
  listRef,
  replyTo,
  onBackToList,
  onOpenInfo,
  onOpenVoiceCall,
  onOpenVideoCall,
  onClearReply,
  onSend,
  onTyping,
  typingSenderId,
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

  pinnedMessages = [],
  onUnpinMessage,
  isMultiSelectMode = false,
  selectedMessageIds = [],
  onToggleSelectMessage,
  onClearSelection,
  onDeleteMultipleForMe,
  onForwardMultiple,
  starredMessages = [],
}: ChatContentProps) {
  const [viewerImage, setViewerImage] = useState<{
    url: string;
    senderName?: string;
    timestamp?: string;
  } | null>(null);

  const [pinIndex, setPinIndex] = useState(0);

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Premium highlight effect
      element.classList.add("bg-amber-100/50", "border", "border-amber-200", "rounded-2xl", "shadow-sm");
      setTimeout(() => {
        element.classList.remove("bg-amber-100/50", "border", "border-amber-200", "rounded-2xl", "shadow-sm");
      }, 2500);
    }
  };

  const handleNextPin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPinIndex((prev) => (prev + 1) % pinnedMessages.length);
  };

  const handlePrevPin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPinIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
  };

  const activePin = pinnedMessages[pinIndex];

  return (
    <>
      <ChatHeader
        peerName={peerName}
        orderTitle={orderTitle}
        typingText={typingText}
        isPeerOnline={isPeerOnline}
        isGroup={isGroup}
        onBack={onBackToList}
        onOpenInfo={onOpenInfo}
        onOpenVoiceCall={onOpenVoiceCall}
        onOpenVideoCall={onOpenVideoCall}
      />

      {/* Pinned Messages Glassmorphism Top Banner */}
      {pinnedMessages.length > 0 && activePin && (
        <div
          onClick={() => handleScrollToMessage(activePin.messageId)}
          className="bg-white/85 backdrop-blur-md border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-xs transition-all hover:bg-sky-50/50 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-sky-600 flex shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 rotate-45">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                Tin nhắn đã ghim
                {pinnedMessages.length > 1 && (
                  <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {pinIndex + 1}/{pinnedMessages.length}
                  </span>
                )}
              </p>
              <p className="text-slate-600 truncate mt-0.5 max-w-[90%]">
                {activePin.content || "[Hình ảnh/Tệp/Video]"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pinnedMessages.length > 1 && (
              <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shrink-0">
                <button
                  onClick={handlePrevPin}
                  className="px-1.5 py-1 hover:bg-slate-50 border-r border-slate-200 text-slate-500 flex items-center justify-center"
                  title="Trước"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={handleNextPin}
                  className="px-1.5 py-1 hover:bg-slate-50 text-slate-500 flex items-center justify-center"
                  title="Kế tiếp"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnpinMessage?.(activePin.conversationId || activePin.roomId || "", activePin.messageId);
                // Adjust index if needed
                if (pinIndex >= pinnedMessages.length - 1 && pinIndex > 0) {
                  setPinIndex(pinIndex - 1);
                }
              }}
              className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              title="Bỏ ghim"
            >
              <Icon name="xmark" size="sm" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col relative">
        <MessageList
          messages={activeMessages}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          peerName={peerName}
          typingText={typingText}
          typingSenderId={typingSenderId}
          isGroup={isGroup}
          senderNameById={senderNameById}
          senderAvatarById={senderAvatarById}
          listRef={listRef}
          onReply={onReply}
          onForward={onForward}
          onRecall={onRecall}
          onDeleteForMe={onDeleteForMe}
          onCopy={onCopy}
          onPin={onPin}
          onMark={onMark}
          onSelectMany={onSelectMany}
          onViewDetails={onViewDetails}
          onRedial={onRedial}
          onImageClick={(url, senderName, timestamp) =>
            setViewerImage({ url, senderName, timestamp })
          }
          className="flex-1"

          // Multi-select & Star props passed to list
          isMultiSelectMode={isMultiSelectMode}
          selectedMessageIds={selectedMessageIds}
          onToggleSelectMessage={onToggleSelectMessage}
          pinnedMessages={pinnedMessages}
          starredMessages={starredMessages}
        />

        {/* Conditional footer rendering: normal input vs multi-select toolbar */}
        {isMultiSelectMode ? (
          <div className="bg-white border-t border-slate-200 px-4 py-4 flex items-center justify-between shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Đã chọn <strong className="text-sky-600 text-base">{selectedMessageIds.length}</strong> tin nhắn
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const selectedMsgs = activeMessages.filter(m => selectedMessageIds.includes(m.messageId));
                  onForwardMultiple?.(selectedMsgs);
                }}
                disabled={selectedMessageIds.length === 0}
                className="flex items-center gap-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Chuyển tiếp
              </button>
              <button
                onClick={() => {
                  onDeleteMultipleForMe?.(selectedMessageIds);
                }}
                disabled={selectedMessageIds.length === 0}
                className="flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Icon name="trash" size="sm" />
                Xóa chỉ ở phía tôi
              </button>
              <button
                onClick={onClearSelection}
                className="border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-600 bg-white"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <MessageInput
            replyTo={replyTo}
            onClearReply={onClearReply}
            onSend={onSend}
            onTyping={onTyping}
          />
        )}
      </div>

      <ImageViewerModal
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
        imageUrl={viewerImage?.url || ""}
        senderName={viewerImage?.senderName}
        timestamp={viewerImage?.timestamp}
      />
    </>
  );
}
