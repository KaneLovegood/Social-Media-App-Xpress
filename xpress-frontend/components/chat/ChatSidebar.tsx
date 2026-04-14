import Link from 'next/link';

export interface SidebarChatItem {
  id: string;
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
  onSelectRoom: (roomId: string) => void;
}

export default function ChatSidebar({ rooms, activeRoomId, onSelectRoom }: ChatSidebarProps) {
  return (
    <aside className="hidden h-full w-[24rem] md:flex">
      <div className="flex w-16 flex-col items-center bg-[#e7e8ea] py-4">
        <div className="relative mb-8 h-10 w-10 rounded-full bg-zinc-300" />
        <Link href="/chat/me" className="rounded-lg bg-linear-to-br from-[#0052cc] to-[#0068ff] p-3 text-white">
          <span className="text-xs font-bold">TM</span>
        </Link>
        <Link href="/contacts" className="mt-4 rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]">
          <span className="text-xs font-bold">DB</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f3f4f6]">
        <header className="p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-zinc-900">Messages</h1>
            <button type="button" className="rounded-full p-2 hover:bg-white">
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
            <span className="border-b-2 border-[#0068ff] pb-1 text-[#0068ff]">All</span>
            <span className="pb-1 text-zinc-500">Unread</span>
          </div>
        </header>

        <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {rooms.map((room) => {
            const active = room.id === activeRoomId;

            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${
                    active ? 'bg-white shadow-sm' : 'hover:bg-[#e7e8ea]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-900">{room.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">{room.age}</span>
                      {room.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#c1121f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {room.unreadCount > 5 ? '5+' : room.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className={`mt-1 truncate text-xs ${active ? 'text-[#0052cc]' : 'text-zinc-500'}`}>
                    {room.preview}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
