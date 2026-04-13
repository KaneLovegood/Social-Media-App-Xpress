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
  const subtitle = typingText || 'Active now';
  const showTitle = Boolean(orderTitle && orderTitle !== peerName);

  return (
    <header className="border-b border-[#c2c6d8]/40 bg-[#f8f9fb]/95 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dae2ff] text-sm font-bold text-[#294486]">
            {initials(peerName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight text-zinc-900 lg:text-lg">{peerName}</p>
            <p className="truncate text-[11px] text-[#727687]">
              {showTitle ? `${subtitle} • ${orderTitle}` : subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenVoiceCall}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#e1e2e4]"
            aria-label="Open voice call"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4.8 3.5h4.1l1.5 4.4-2.4 1.7a14.7 14.7 0 0 0 6.3 6.3l1.7-2.4 4.4 1.5v4.1l-2.3 1.1a5.2 5.2 0 0 1-5 .2A20.9 20.9 0 0 1 3.2 9a5.2 5.2 0 0 1 .2-5l1.4-.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenVideoCall}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#e1e2e4]"
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
