"use client";

import Icon from "@/components/common/Icon";
import { ChatMessage } from "@/lib/realtime/types";

interface MessageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  senderName: string;
  senderAvatarUrl?: string;
}

export default function MessageDetailsModal({
  isOpen,
  onClose,
  message,
  senderName,
  senderAvatarUrl,
}: MessageDetailsModalProps) {
  if (!isOpen || !message) return null;

  const content = message.content || "";
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Format creation time
  const createdAtDate = new Date(message.createdAt);
  const formattedTime = !isNaN(createdAtDate.getTime())
    ? createdAtDate.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      " - " +
      createdAtDate.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Không rõ";

  // Translate message type
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "TEXT":
        return "Văn bản";
      case "IMAGE":
        return "Hình ảnh";
      case "VIDEO":
        return "Video";
      case "FILE":
        return "Tệp tin";
      case "CALL_LOG":
        return "Lịch sử cuộc gọi";
      case "SYSTEM":
        return "Hệ thống";
      case "SHARE_POST":
        return "Bài viết chia sẻ";
      default:
        return "Khác";
    }
  };

  const getStatusLabel = () => {
    if (message.isRecalled) return "Đã thu hồi";
    if (message.isDeleted) return "Đã xóa";
    if (message.readAt) return "Đã đọc";
    if (message.receivedAt) return "Đã nhận";
    return "Đã gửi";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 transition-all duration-300">
      <div className="relative w-full max-w-md scale-100 rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Icon name="info-circle" size="base" className="text-sky-600" />
            Chi tiết tin nhắn
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <Icon name="xmark" size="lg" />
          </button>
        </div>

        {/* Content */}
        <div className="scrollbar-auto-hide max-h-[70vh] overflow-y-auto px-6 py-6 space-y-5">
          {/* Sender card */}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
            {senderAvatarUrl ? (
              <img
                src={senderAvatarUrl}
                alt={senderName}
                className="h-10 w-10 rounded-full object-cover shadow-xs"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7dfec] text-sm font-semibold text-[#2f4268]">
                {(senderName || "?").trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-800">{senderName}</p>
              <p className="text-xs text-slate-400">Người gửi</p>
            </div>
          </div>

          {/* Message content */}
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Nội dung tin nhắn</span>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
              {message.isRecalled ? (
                <span className="italic text-slate-400">Tin nhắn đã được thu hồi</span>
              ) : message.isDeleted ? (
                <span className="italic text-slate-400">Tin nhắn đã bị xóa</span>
              ) : (
                content || <span className="italic text-slate-400">[Không có nội dung văn bản]</span>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin bổ sung</span>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-slate-400 block mb-0.5">Loại tin nhắn</span>
                <span className="font-semibold text-slate-700">{getTypeLabel(message.messageType || "TEXT")}</span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-slate-400 block mb-0.5">Trạng thái</span>
                <span
                  className={`font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-[10px] ${
                    message.isRecalled
                      ? "bg-amber-100 text-amber-700"
                      : message.isDeleted
                        ? "bg-rose-100 text-rose-700"
                        : message.readAt
                          ? "bg-green-100 text-green-700"
                          : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {getStatusLabel()}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Thời gian gửi</span>
                <span className="font-semibold text-slate-700">{formattedTime}</span>
              </div>
              
              {!message.isRecalled && !message.isDeleted && message.messageType === "TEXT" && (
                <>
                  <hr className="border-slate-100" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Số ký tự</span>
                    <span className="font-semibold text-slate-700">{charCount} ký tự</span>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Số từ</span>
                    <span className="font-semibold text-slate-700">{wordCount} từ</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
