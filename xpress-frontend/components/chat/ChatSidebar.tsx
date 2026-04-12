export interface SidebarChatItem {
  id: string;
  title: string;
  preview: string;
  age: string;
  active?: boolean;
}

interface ChatSidebarProps {
  rooms: SidebarChatItem[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export default function ChatSidebar({ rooms, activeRoomId, onSelectRoom }: ChatSidebarProps) {
  return (
    <aside className="hidden border-r border-zinc-200/80 bg-[#e9ecef] px-5 py-6 lg:flex lg:flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b7a75] text-sm font-bold text-white">DS</div>
        <div>
          <p className="text-2xl font-bold leading-tight text-zinc-800">Delivery Support</p>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Active chats</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white px-3 py-2 shadow-inner">
        <input
          type="text"
          placeholder="Search orders..."
          className="w-full border-none bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
        />
      </div>

      <ul className="mt-6 space-y-3">
        {rooms.map((room) => {
          const active = room.id === activeRoomId;

          return (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  active ? 'bg-white shadow-[0_8px_18px_rgba(16,24,40,0.08)]' : 'hover:bg-white/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-800">{room.title}</p>
                  <span className="text-[11px] text-zinc-400">{room.age}</span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500">{room.preview}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
