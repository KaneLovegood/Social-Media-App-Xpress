import { Quote, Ellipsis, CornerUpRight } from 'lucide-react';

interface MessageActionsButtonsProps {
  menuOpen: boolean;
  onReply: () => void;
  onForward: () => void;
  onMenuToggle: () => void;
}

export default function MessageActionsButtons({
  menuOpen,
  onReply,
  onForward,
  onMenuToggle,
}: MessageActionsButtonsProps) {
  return (
    <div className={`pointer-events-none flex items-center gap-1 transition ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      <button
        type="button"
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-100"
        onClick={onReply}
        aria-label="Trả lời"
      >
        <Quote className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-100"
        onClick={onForward}
        aria-label="Chuyển tiếp"
      >
        <CornerUpRight className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-base leading-none text-zinc-700 hover:bg-zinc-100"
        onClick={onMenuToggle}
        aria-expanded={menuOpen}
        aria-label="Mở menu tin nhắn"
      >
        <Ellipsis className="h-4 w-4" />
      </button>
    </div>
  );
}
