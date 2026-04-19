"use client";

import { useMemo, useState } from "react";
import { ChatMessage } from "@/lib/realtime/types";
import { ChatRoomSummary } from "@/lib/chat-rooms";

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  rooms: ChatRoomSummary[];
  currentRoomId: string;
  onClose: () => void;
  onForward: (roomIds: string[]) => void;
}

function getRoomSubtitle(room: ChatRoomSummary): string {
  if (room.roomType === "GROUP") {
    return room.description ?? `${room.memberCount ?? 0} thành viên`;
  }

  return room.isPeerOnline ? "Đang hoạt động" : room.age;
}

function getRoomAvatarLabel(room: ChatRoomSummary): string {
  if (room.avatarUrl) {
    return room.title.slice(0, 1).toUpperCase();
  }

  return room.title.trim().slice(0, 2).toUpperCase() || "?";
}

function getForwardPreview(message: ChatMessage | null): string {
  if (!message) return "";

  if (message.messageType === "FILE") {
    return message.fileName ?? message.content ?? "Tệp đính kèm";
  }

  if (message.messageType === "IMAGE") {
    return message.content || "Ảnh";
  }

  if (message.messageType === "CALL_LOG") {
    return message.content || "Nhật ký cuộc gọi";
  }

  return message.content || "Tin nhắn trống";
}

export default function ForwardMessageModal({
  isOpen,
  message,
  rooms,
  currentRoomId,
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const filteredRooms = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return rooms;

    return rooms.filter((room) => {
      return (
        room.title.toLowerCase().includes(keyword) ||
        room.preview.toLowerCase().includes(keyword) ||
        getRoomSubtitle(room).toLowerCase().includes(keyword)
      );
    });
  }, [rooms, searchTerm]);

  const isShareDisabled = selectedRoomIds.length === 0 || !message;

  if (!isOpen || !message) {
    return null;
  }

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px]">
      <div className="flex h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chia sẻ</h2>
            <p className="text-xs text-slate-500">Chọn một hoặc nhiều cuộc hội thoại để chuyển tiếp.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đóng chia sẻ"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="rounded-xl border border-slate-300 px-4 py-3 focus-within:border-[#0068ff]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Tìm kiếm cuộc hội thoại..."
              className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-3 rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Chia sẻ tin nhắn</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
              {getForwardPreview(message)}
            </p>
          </div>

          <div className="space-y-1">
            {filteredRooms.map((room) => {
              const checked = selectedRoomIds.includes(room.id);
              const disabled = room.id === currentRoomId;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    toggleRoom(room.id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${checked ? "bg-[#e8f1ff]" : "hover:bg-slate-50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white">
                    <span
                      className={`h-3 w-3 rounded-sm ${checked ? "bg-[#0068ff]" : "bg-transparent"}`}
                    />
                  </span>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                    {getRoomAvatarLabel(room)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{room.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-500">{room.age}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {getRoomSubtitle(room)}
                    </p>
                  </div>
                </button>
              );
            })}

            {filteredRooms.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Không tìm thấy cuộc hội thoại phù hợp.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onForward(selectedRoomIds);
              onClose();
            }}
            disabled={isShareDisabled}
            className="flex-1 rounded-lg bg-[#0068ff] px-4 py-2.5 font-medium text-white transition hover:bg-[#0057d6] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Chia sẻ
          </button>
        </div>
      </div>
    </div>
  );
}