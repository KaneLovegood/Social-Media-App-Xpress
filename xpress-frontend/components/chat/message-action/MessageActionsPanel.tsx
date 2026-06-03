import {
  RotateCcw,
  Copy,
  Pin,
  Star,
  Info,
  ListCollapse,
  Trash2,
  Quote,
  CornerUpRight,
} from 'lucide-react';

interface MessageActionsPanelProps {
  isOwn: boolean;
  canRecall: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  onReply: () => void;
  onForward: () => void;
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

type ActionItem = {
  icon: any;
  label: string;
  action: keyof MessageActionsPanelProps;
  danger?: boolean;
  show?: (props: MessageActionsPanelProps) => boolean;
  disabled?: (props: MessageActionsPanelProps) => boolean;
};

const ACTIONS: ActionItem[] = [
  { icon: Quote, label: 'Trả lời', action: 'onReply' },
  { icon: CornerUpRight, label: 'Chuyển tiếp', action: 'onForward' },
  { icon: Copy, label: 'Copy tin nhắn', action: 'onCopy' },
  { icon: Pin, label: 'Ghim tin nhắn', action: 'onPin' },
  { icon: Star, label: 'Đánh dấu tin nhắn', action: 'onMark' },
  { icon: ListCollapse, label: 'Chọn nhiều tin nhắn', action: 'onSelectMany' },
  { icon: Info, label: 'Xem chi tiết', action: 'onViewDetails' },

  {
    icon: RotateCcw,
    label: 'Thu hồi',
    action: 'onRecall',
    danger: true,
    show: (p) => p.isOwn,
    disabled: (p) => !p.canRecall,
  },

  {
    icon: Trash2,
    label: 'Xóa chỉ ở phía tôi',
    action: 'onDeleteForMe',
    danger: true,
  },
];

export default function MessageActionsPanel(props: MessageActionsPanelProps) {
  const { onClose, style, panelRef, isPinned, isStarred } = props;

  const handleAction = (callback?: () => void) => {
    callback?.();
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
      {ACTIONS.filter((a) => (a.show ? a.show(props) : true)).map((action) => {
        const callback = props[action.action] as (() => void) | undefined;
        const isDisabled = action.disabled?.(props);

        let displayLabel = action.label;
        if (action.action === 'onPin' && isPinned) {
          displayLabel = 'Bỏ ghim tin nhắn';
        } else if (action.action === 'onMark' && isStarred) {
          displayLabel = 'Bỏ đánh dấu tin nhắn';
        }

        return (
          <button
            key={action.label}
            type="button"
            disabled={isDisabled}
            onClick={() => handleAction(callback)}
            className={`w-full px-3 py-2 flex gap-2 text-left text-sm
              ${
                action.danger
                  ? 'text-red-600 hover:bg-red-50 disabled:text-red-300'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
          >
            <action.icon className="h-4 w-4" />
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}