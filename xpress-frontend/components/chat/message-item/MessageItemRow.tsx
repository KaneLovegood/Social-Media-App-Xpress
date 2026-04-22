import {
  ChatMessage,
  ReplyPreview as ReplyPreviewType,
} from "@/lib/realtime/types";
import MessageActionsMenu from "../message-action/MessageActionsMenu";
import MessageBubbleCard from "./MessageBubbleCard";

interface MessageItemRowProps {
  message: ChatMessage;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  senderNameById: Record<string, string>;
  senderAvatarById: Record<string, string>;
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
}

function getInitial(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export default function MessageItemRow({
  message,
  currentUserId,
  currentUserName,
  peerName,
  senderNameById,
  senderAvatarById,
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
}: MessageItemRowProps) {
  const isOwn = message.senderId === currentUserId;
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

  if (isSystemMessage) {
    return (
      <li className="flex justify-center">
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
    <li className={`group flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <article
        className={`flex max-w-[92%] items-start gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
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
          <p className="mb-1 text-xs font-semibold text-[#4c5f80]">
            {senderName}
          </p>

          <div className={`relative ${isOwn ? "pl-25" : "pr-25"}`}>
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
            />

            <div
              className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? "left-0" : "right-0"}`}
            >
              <MessageActionsMenu
                isOwn={isOwn}
                disabled={
                  message.isRecalled ||
                  isConversationGenerated ||
                  isSystemMessage
                }
                canRecall={canRecall && !message.isRecalled}
                onReply={() =>
                  onReply({
                    messageId: message.messageId,
                    senderId: message.senderId,
                    senderName: replySenderName,
                    content: message.content,
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
          </div>

          <footer className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {deliveryLabel ? <span>{deliveryLabel}</span> : null}
          </footer>
        </div>
      </article>
    </li>
  );
}
