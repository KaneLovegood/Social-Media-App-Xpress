import Link from "next/link";
import { GroupSummary } from "@/lib/groups";

export interface SidebarChatItem {
  id: string;
  title: string;
  preview: string;
  age: string;
  active?: boolean;
}

interface ChatSidebarProps {
  rooms: SidebarChatItem[];
  groups: GroupSummary[];
  activeRoomId: string;
  activeGroupId?: string;
  onSelectRoom: (roomId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}

export default function ChatSidebar({
  rooms,
  groups,
  activeRoomId,
  activeGroupId,
  onSelectRoom,
  onSelectGroup,
  onCreateGroup,
}: ChatSidebarProps) {
  return (
    <aside className="hidden h-full w-[24rem] md:flex">
      <div className="flex w-16 flex-col items-center bg-[#e7e8ea] py-4">
        <div className="relative mb-8 h-10 w-10 rounded-full bg-zinc-300" />
        <Link
          href="/chat/me"
          className="rounded-lg bg-linear-to-br from-[#0052cc] to-[#0068ff] p-3 text-white"
        >
          <span className="text-xs font-bold">TM</span>
        </Link>
        <Link
          href="/contacts"
          className="mt-4 rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]"
        >
          <span className="text-xs font-bold">DB</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f3f4f6]">
        <header className="p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-zinc-900">Messages</h1>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-white"
              onClick={onCreateGroup}
            >
              +
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-[#e1e2e4] px-3 py-2">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full border-none bg-transparent text-sm text-zinc-700 outline-none"
            />
          </div>
          <div className="mt-3 flex gap-3 text-xs font-semibold">
            <span className="border-b-2 border-[#0068ff] pb-1 text-[#0068ff]">
              All
            </span>
            <span className="pb-1 text-zinc-500">Unread</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <section className="space-y-2">
            <div className="px-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-[#727687]">
              Chats
            </div>
            <ul className="space-y-1">
              {rooms.map((room) => {
                const active = room.id === activeRoomId;

                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRoom(room.id)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        active ? "bg-white shadow-sm" : "hover:bg-[#e7e8ea]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {room.title}
                        </p>
                        <span className="text-[10px] text-zinc-500">
                          {room.age}
                        </span>
                      </div>
                      <p
                        className={`mt-1 truncate text-xs ${active ? "text-[#0052cc]" : "text-zinc-500"}`}
                      >
                        {room.preview}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-4 space-y-2">
            <div className="px-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-[#727687]">
              Groups
            </div>
            <ul className="space-y-1">
              {groups.map((group) => (
                <li key={group.groupId}>
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.groupId)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ${
                      activeGroupId === group.groupId
                        ? "bg-white shadow-sm"
                        : "hover:bg-[#e7e8ea]"
                    }`}
                    aria-pressed={activeGroupId === group.groupId}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {group.emoji ? `${group.emoji} ` : ""}
                        {group.name}
                      </p>
                      <span className="text-[10px] text-zinc-500">
                        {group.memberCount}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {group.role} {group.nickname ? `• ${group.nickname}` : ""}
                    </p>
                  </button>
                </li>
              ))}
              {groups.length === 0 ? (
                <li className="px-2 text-xs text-zinc-500">Chưa có nhóm nào</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </aside>
  );
}
