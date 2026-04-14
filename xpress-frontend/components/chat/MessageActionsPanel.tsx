import { RotateCcw, Copy, Pin, Star, Info, ListCollapse, Trash2 } from 'lucide-react';

interface MessageActionsPanelProps {
  isOwn: boolean;
  canRecall: boolean;
  onCopy: () => void;
  onPin: () => void;
  onMark: () => void;
  onSelectMany: () => void;
  onViewDetails: () => void;
  onRecall: () => void;
  onDeleteForMe: () => void;
  onClose: () => void;
  style: {
    top: number;
    left: number;
    maxHeight: number;
  };
  panelRef: React.RefObject<HTMLDivElement | null>;
}

export default function MessageActionsPanel({
  isOwn,
  canRecall,
  onCopy,
  onPin,
  onMark,
  onSelectMany,
  onViewDetails,
  onRecall,
  onDeleteForMe,
  onClose,
  style,
  panelRef,
}: MessageActionsPanelProps) {
  const handleAction = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl"
      style={{
        top: style.top,
        left: style.left,
        maxHeight: style.maxHeight,
        overflowY: 'auto',
        zIndex: 9999,
      }}
    >
      <button
        type="button"
        className="w-full px-3 py-2 text-left flex gap-2 text-sm text-zinc-700 hover:bg-zinc-100"
        onClick={() => handleAction(onCopy)}
      >
        <Copy className="h-4 w-4" />
        Copy tin nhắn
      </button>
      <button
        type="button"
        className="w-full px-3 py-2 text-left flex gap-2 text-sm text-zinc-700 hover:bg-zinc-100"
        onClick={() => handleAction(onPin)}
      >
        <Pin className="h-4 w-4 rotate-45" />
        Ghim tin nhắn
      </button>
      <button
        type="button"
        className="w-full px-3 py-2 text-left text-sm flex gap-2 text-zinc-700 hover:bg-zinc-100"
        onClick={() => handleAction(onMark)}
      >
        <Star className="h-4 w-4" />
        Đánh dấu tin nhắn
      </button>
      <button
        type="button"
        className="w-full px-3 py-2 text-left text-sm flex gap-2 text-zinc-700 hover:bg-zinc-100"
        onClick={() => handleAction(onSelectMany)}
      >
        <ListCollapse className="h-4 w-4" />
        Chọn nhiều tin nhắn
      </button>
      <button
        type="button"
        className="w-full px-3 py-2 text-left text-sm flex gap-2 text-zinc-700 hover:bg-zinc-100"
        onClick={() => handleAction(onViewDetails)}
      >
        <Info className="h-4 w-4" />
        Xem chi tiết
      </button>
      {isOwn ? (
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm flex gap-2 text-red-600 hover:bg-red-50 disabled:text-red-300"
          onClick={() => handleAction(onRecall)}
          disabled={!canRecall}
        >
          <RotateCcw className="h-4 w-4" />
          Thu hồi
        </button>
      ) : null}
      <button
        type="button"
        className="w-full px-3 py-2 flex gap-2 text-sm text-red-600 hover:bg-zinc-100"
        onClick={() => handleAction(onDeleteForMe)}
      >
        <Trash2 className="h-4 w-4" />
        <span>Xóa chỉ ở phía tôi</span>
      </button>
    </div>
  );
}
