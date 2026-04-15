interface ChatHeaderProps {
  peerName: string;
  orderTitle: string;
  typingText: string;
  isPeerOnline: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onOpenVoiceCall: () => void;
  onOpenVideoCall: () => void;
}

function initials(value: string) {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
}

export default function ChatHeader({
  peerName,
  orderTitle,
  typingText,
  isPeerOnline,
  onBack,
  onOpenInfo,
  onOpenVoiceCall,
  onOpenVideoCall,
}: ChatHeaderProps) {
  const showTitle = Boolean(orderTitle && orderTitle !== peerName);
  const statusText =
    typingText || (isPeerOnline ? "Đang hoạt động" : "Ngoại tuyến");
  const subTitle =
    showTitle && !typingText ? `${statusText} • ${orderTitle}` : statusText;

  return (
    <header className="border-b border-[#c2c6d8]/40 bg-white px-3 py-2 shadow-sm backdrop-blur md:px-4 md:py-3 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#0052cc] hover:bg-[#eaf2ff] md:hidden"
            aria-label="Quay lại danh sách hội thoại"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dae2ff] text-sm font-bold text-[#294486] md:flex">
            {initials(peerName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold leading-none text-zinc-900 md:text-base md:leading-tight lg:text-lg">
              {peerName}
            </p>
            <p className="mt-1 truncate text-sm text-[#727687] md:mt-0.5 md:text-[11px]">
              {subTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            type="button"
            onClick={onOpenVoiceCall}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff]"
            aria-label="Mở gọi thoại"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
            >
              <path d="M4.8 3.5h4.1l1.5 4.4-2.4 1.7a14.7 14.7 0 0 0 6.3 6.3l1.7-2.4 4.4 1.5v4.1l-2.3 1.1a5.2 5.2 0 0 1-5 .2A20.9 20.9 0 0 1 3.2 9a5.2 5.2 0 0 1 .2-5l1.4-.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenVideoCall}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff]"
            aria-label="Mở gọi video"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="m16 10 5-3v10l-5-3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenInfo}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff] md:hidden"
            aria-label="Mở thông tin hội thoại"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
