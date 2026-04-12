interface ChatHeaderProps {
  peerName: string;
  orderTitle: string;
  typingText: string;
  onOpenVoiceCall: () => void;
  onOpenVideoCall: () => void;
}

function initials(value: string) {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '');
  return chars.join('') || 'GC';
}

export default function ChatHeader({
  peerName,
  orderTitle,
  typingText,
  onOpenVoiceCall,
  onOpenVideoCall,
}: ChatHeaderProps) {
  return (
    <header className="border-b border-zinc-200/80 bg-white px-4 py-4 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b7a75] text-sm font-bold text-white">
            {initials(peerName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[28px] font-bold leading-none text-zinc-800 lg:text-[34px]">{orderTitle}</p>
            <p className="truncate text-xs text-zinc-500 lg:text-sm">
              Chatting with {peerName} • {typingText || 'Est. Arrival 12:45 PM'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenVoiceCall}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-[#d67a00] hover:bg-zinc-200"
            aria-label="Open voice call"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4.8 3.5h4.1l1.5 4.4-2.4 1.7a14.7 14.7 0 0 0 6.3 6.3l1.7-2.4 4.4 1.5v4.1l-2.3 1.1a5.2 5.2 0 0 1-5 .2A20.9 20.9 0 0 1 3.2 9a5.2 5.2 0 0 1 .2-5l1.4-.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenVideoCall}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-[#0b7a75] hover:bg-zinc-200"
            aria-label="Open video call"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="m16 10 5-3v10l-5-3" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
