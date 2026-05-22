import React from "react";
import { ChatMessage } from "@/lib/realtime/types";
import { useRouter } from "next/navigation";

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

export default function MessageBubbleCard({ message }: Props) {
  const router = useRouter();

  if (message.messageType === 'SHARE_POST') {
    const sharedPost = message.sharedPost;

    return (
      <div className="rounded-lg bg-white px-3 py-2 shadow-sm min-w-[240px] max-w-[320px]">
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

  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
      <div className="whitespace-pre-wrap text-sm text-[#111827]">{message.content}</div>
    </div>
  );
}
