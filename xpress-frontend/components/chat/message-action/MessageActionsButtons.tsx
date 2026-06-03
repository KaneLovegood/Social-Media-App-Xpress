import { Quote, Ellipsis, CornerUpRight } from 'lucide-react';

interface MessageActionsButtonsProps {
  menuOpen: boolean;
  onReply: () => void;
  onForward: () => void;
  onMenuToggle: () => void;
  forceShow?: boolean;
}

export default function MessageActionsButtons({
  menuOpen,
  onReply,
  onForward,
  onMenuToggle,
  forceShow = false,
}: MessageActionsButtonsProps) {
  return (
    <div className={`flex items-center gap-1 transition ${
      menuOpen || forceShow
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-100 pointer-events-auto lg:opacity-0 lg:pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto'
    }`}>
      <button
        type="button"
        className="pointer-events-auto hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-100"
        onClick={onReply}
        aria-label="Trả lời"
      >
        <Quote className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="pointer-events-auto hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-100"
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
