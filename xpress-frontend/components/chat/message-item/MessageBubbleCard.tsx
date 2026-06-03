import React from "react";
import { ChatMessage } from "@/lib/realtime/types";
import { useRouter } from "next/navigation";
import ReplyPreview from "./ReplyPreview";
import Icon from "@/components/common/Icon";

interface Props {
  message: ChatMessage;
  isOwn?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  peerName?: string;
  senderName?: string;
  senderNameById?: Record<string, string>;
  onRedial?: (mode: "voice" | "video") => void;
  onImageClick?: (url: string, senderName?: string, timestamp?: string) => void;
  onReplyPreviewClick?: (messageId: string) => void;
}

function dinhDangThoiGian(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Avatar({ tenNguoiDung, anhDaiDien }: { tenNguoiDung: string; anhDaiDien?: string }) {
  const initials = React.useMemo(() => {
    const parts = (tenNguoiDung || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }, [tenNguoiDung]);

  if (anhDaiDien) {
    return (
      <img
        src={anhDaiDien}
        alt={tenNguoiDung}
        className="h-8 w-8 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dae2ff] font-semibold text-[#0a4cc8] text-xs">
      {initials}
    </div>
  );
}

function toDurationLabel(seconds?: number): string {
  if (!seconds || seconds === 0) return "0 giây";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m} phút ${s} giây`;
  }
  return `${s} giây`;
}

export default function MessageBubbleCard({
  message,
  senderNameById,
  onImageClick,
  onReplyPreviewClick,
  senderName = "User",
}: Props) {
  const router = useRouter();

  const replyPreviewWithResolvedName = React.useMemo(() => {
    if (!message.replyPreview || message.isRecalled) return undefined;
    const senderId = message.replyPreview.senderId;
    const resolvedName = senderNameById?.[senderId];
    return {
      ...message.replyPreview,
      senderName: resolvedName ?? message.replyPreview.senderName ?? senderId,
    };
  }, [message.replyPreview, senderNameById, message.isRecalled]);

  // 1. Recalled Messages
  if (message.isRecalled) {
    return (
      <div className="rounded-lg bg-zinc-100 px-3 py-2 shadow-xs border border-zinc-200/50 min-w-30">
        <div className="text-xs italic text-zinc-400 select-none flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 text-zinc-300">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          Tin nhắn đã được thu hồi
        </div>
      </div>
    );
  }

  // 2. Share Post Messages
  if (message.messageType === 'SHARE_POST') {
    const sharedPost = message.sharedPost;

    return (
      <div className="rounded-lg bg-white px-3 py-2 shadow-sm min-w-60 max-w-[320px]">
        {message.content && (
          <div className="whitespace-pre-wrap text-sm text-[#111827] mb-2 font-medium">
            {message.content}
          </div>
        )}
        {!sharedPost ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 font-semibold text-center">
            Nội dung không tồn tại
          </div>
        ) : (
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Avatar
                tenNguoiDung={sharedPost.tacGia?.tenNguoiDung ?? 'Người dùng'}
                anhDaiDien={sharedPost.tacGia?.anhDaiDien}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-[#1e293b]">
                  {sharedPost.tacGia?.tenNguoiDung ?? 'Người dùng'}
                </div>
                <div className="text-[10px] text-[#64748b]">
                  {dinhDangThoiGian(sharedPost.thoiGianTao)}
                </div>
              </div>
            </div>

            {sharedPost.noiDung && (
              <p className="text-xs text-[#334155] line-clamp-3 mb-2 whitespace-pre-wrap leading-relaxed">
                {sharedPost.noiDung}
              </p>
            )}

            {sharedPost.danhSachAnh && sharedPost.danhSachAnh.length > 0 && (
              <div className="mb-2 max-h-32 overflow-hidden rounded-lg">
                <img
                  src={sharedPost.danhSachAnh[0]}
                  alt="Thumbnail"
                  className="w-full h-24 object-cover"
                />
              </div>
            )}

            {(!sharedPost.danhSachAnh || sharedPost.danhSachAnh.length === 0) &&
              sharedPost.danhSachVideo &&
              sharedPost.danhSachVideo.length > 0 && (
                <div className="mb-2 max-h-32 overflow-hidden rounded-lg bg-black flex justify-center items-center">
                  <video
                    src={sharedPost.danhSachVideo[0]}
                    className="max-h-24 w-full object-contain"
                    muted
                    playsInline
                  />
                </div>
              )}

            <button
              type="button"
              onClick={() => router.push(`/chat/news-feed?postId=${sharedPost.maBaiViet}`)}
              className="w-full mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-[#1d59df] py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#184ec6]"
            >
              Xem bài viết
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. Image Messages
  if (message.messageType === 'IMAGE' && message.fileUrl) {
    return (
      <div
        className="overflow-hidden rounded-xl max-w-70 shadow-sm bg-slate-50 border border-slate-100 cursor-pointer"
        onClick={() => onImageClick?.(message.fileUrl!, senderName, dinhDangThoiGian(message.createdAt))}
      >
        <img
          src={message.fileUrl}
          alt="Hình ảnh đính kèm"
          className="max-h-60 w-full object-cover hover:opacity-95 transition-opacity duration-200"
          loading="lazy"
        />
      </div>
    );
  }

  // 4. Video Messages
  if (message.messageType === 'VIDEO' && message.fileUrl) {
    return (
      <div className="overflow-hidden rounded-xl max-w-70 shadow-sm bg-black border border-zinc-800">
        <video
          src={message.fileUrl}
          controls
          className="max-h-60 w-full object-contain"
          playsInline
        />
      </div>
    );
  }

  // 5. File Messages
  if (message.messageType === 'FILE' && message.fileUrl) {
    const sizeInKb = message.fileSize ? Math.round(message.fileSize / 1024) : 0;
    const formattedSize =
      sizeInKb > 1024
        ? `${(sizeInKb / 1024).toFixed(2)} MB`
        : sizeInKb > 0
          ? `${sizeInKb} KB`
          : "Không rõ dung lượng";

    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-3 shadow-xs max-w-70 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate font-bold text-slate-800" title={message.fileName || "Tệp tin"}>
            {message.fileName || "Tệp tin đính kèm"}
          </p>
          <p className="text-slate-400 mt-0.5">{formattedSize}</p>
        </div>
      </a>
    );
  }

  // 6. Call Log Messages
  if (message.messageType === 'CALL_LOG') {
    const log = message.callLog;
    const isVideo = log?.mode === 'video';
    const isCompleted = log?.outcome === 'connected_ended';

    // Styles & colors based on call type
    const cardBgClass = isCompleted
      ? "bg-emerald-50/80 border-emerald-100/80 text-emerald-800"
      : "bg-rose-50/80 border-rose-100/80 text-rose-800";

    const iconColorClass = isCompleted ? "text-emerald-600" : "text-rose-600";
    const iconName = isVideo
      ? isCompleted
        ? "video"
        : "video-slash"
      : isCompleted
        ? "phone"
        : "phone-slash";

    const titleText = isVideo ? "Cuộc gọi video" : "Cuộc gọi thoại";
    
    // Outcome localized labels
    let statusText = "Cuộc gọi nhỡ";
    if (isCompleted) {
      statusText = `Cuộc gọi thành công (${toDurationLabel(log?.durationSeconds)})`;
    } else if (log?.outcome === 'peer_cancelled') {
      statusText = "Cuộc gọi bị từ chối";
    } else if (log?.outcome === 'self_cancelled') {
      statusText = "Cuộc gọi nhỡ";
    }

    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-xs max-w-70 min-w-52.5 ${cardBgClass}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-xs ${iconColorClass}`}>
          <Icon name={iconName} size="base" />
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-bold text-slate-800">{titleText}</p>
          <p className="text-slate-500 mt-0.5 font-medium">{statusText}</p>
        </div>
      </div>
    );
  }

  // Parse Contact Card: [Danh thiếp] Tên: <Tên> | Email: <Email> | UserId: <UserId>
  if (message.content && message.content.startsWith("[Danh thiếp]")) {
    const parts = message.content.replace("[Danh thiếp]", "").split("|");
    const namePart = parts.find(p => p.includes("Tên:"))?.replace("Tên:", "").trim() || "";
    const emailPart = parts.find(p => p.includes("Email:"))?.replace("Email:", "").trim() || "";
    const uidPart = parts.find(p => p.includes("UserId:"))?.replace("UserId:", "").trim() || "";

    return (
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 shadow-sm min-w-56 max-w-[280px]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-md text-sm">
            {namePart ? namePart.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">{namePart}</p>
            <p className="truncate text-xs text-slate-500 mt-0.5">{emailPart}</p>
          </div>
        </div>
        <div className="mt-3.5 border-t border-slate-200/60 pt-3 flex justify-between items-center text-[11px] font-semibold text-blue-600">
          <span>Danh thiếp liên hệ</span>
          <button 
            type="button" 
            onClick={() => router.push(`/chat/contacts?userId=${uidPart}`)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 shadow-xs transition"
          >
            Nhắn tin
          </button>
        </div>
      </div>
    );
  }

  // Default: Text messages
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm min-w-30">
      {replyPreviewWithResolvedName && (
        <ReplyPreview
          reply={replyPreviewWithResolvedName}
          mode="message"
          onClick={
            onReplyPreviewClick
              ? () => onReplyPreviewClick(replyPreviewWithResolvedName.messageId)
              : undefined
          }
        />
      )}
      <div className="whitespace-pre-wrap text-sm text-[#111827]">{message.content}</div>
    </div>
  );
}
