import { UserPlus2, Users2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface SidebarChatItem {
  id: string;
  roomType: "PRIVATE" | "GROUP";
  title: string;
  preview: string;
  age: string;
  unreadCount: number;
  isOnline: boolean;
  active?: boolean;
}

interface ChatSidebarProps {
  rooms: SidebarChatItem[];
  activeRoomId: string;
  currentUserName: string;
  onSelectRoom: (roomId: string) => void;
  onCreateGroup: () => void;
  onLogout: () => void;
}

export default function ChatSidebar({
  rooms,
  activeRoomId,
  currentUserName,
  onSelectRoom,
  onCreateGroup,
  onLogout,
}: ChatSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRooms = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return rooms;

    return rooms.filter((room) => {
      const searchable = `${room.title} ${room.preview}`.toLowerCase();
      return searchable.includes(keyword);
    });
  }, [rooms, searchTerm]);

  return (
    <aside className="flex h-full w-full md:w-[24rem]">
      <div className="flex min-w-0 flex-1 flex-col bg-[#ffffff]">
        <header className="border-b border-slate-200 bg-white p-4 text-zinc-900 md:border-none md:bg-transparent md:text-inherit">
          <div className="flex items-center justify-between">
            <h1 className="truncate text-xl font-bold md:text-zinc-900">
              {currentUserName}
            </h1>
            <div className="flex gap-1 items-center">
              <button
                type="button"
                onClick={onCreateGroup}
                className="rounded-full p-2 hover:bg-slate-100 md:hover:bg-white"
                aria-label="Tạo nhóm mới"
              >
                <Users2 className="h-4 w-4 text-zinc-700" />
              </button>
              <Link
                href="/chat/contacts"
                className="rounded-full p-2 flex items-center justify-center hover:bg-slate-100 md:hover:bg-white"
                aria-label="Danh bạ"
              >
                <UserPlus2 className="h-4 w-4 text-zinc-700" />
              </Link>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-[#e1e2e4] px-3 py-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Tìm kiếm cuộc hội thoại..."
              className="w-full border-none bg-transparent text-sm text-zinc-700 placeholder:text-zinc-500 outline-none"
            />
          </div>
          <div className="mt-3 flex gap-3 text-xs font-semibold">
            <span className="border-b-2 border-[#0068ff] pb-1 text-[#0068ff]">
              Tất cả
            </span>
            <span className="pb-1 text-zinc-500">Chưa đọc</span>
          </div>
        </header>

        <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4 pt-2">
          {filteredRooms.map((room) => {
            const active = room.id === activeRoomId;

            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${active ? "bg-[#dce0ff] shadow-sm" : "hover:bg-[#e6e9ff]"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {room.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">
                        {room.age}
                      </span>
                      {room.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#c1121f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {room.unreadCount > 5 ? "5+" : room.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`mt-1 truncate text-xs ${active ? "text-[#0052cc]" : "text-zinc-500"}`}
                  >
                    {room.roomType === "GROUP"
                      ? `Nhóm • ${room.preview}`
                      : room.preview}
                  </p>
                </button>
              </li>
            );
          })}
          {filteredRooms.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">
              Không tìm thấy cuộc hội thoại phù hợp.
            </li>
          ) : null}
        </ul>
      </div>
    </aside>
  );
}
