import { ChevronLeft, Phone, TextAlignJustify, Video } from "lucide-react";

interface ChatHeaderProps {
  peerName: string;
  orderTitle: string;
  avatarUrl?: string;
  avatarFallback?: string;
  typingText: string;
  isPeerOnline: boolean;
  isGroup: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onOpenVoiceCall: () => void;
  onOpenVideoCall: () => void;
}

const initials = (value: string) => {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
};

export default function ChatHeader({
  peerName,
  orderTitle,
  avatarUrl,
  avatarFallback,
  typingText,
  isPeerOnline,
  isGroup,
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
            <ChevronLeft className="h-5 w-5" />
          </button>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={peerName}
              className="hidden h-10 w-10 shrink-0 rounded-full object-cover md:block"
              loading="lazy"
            />
          ) : (
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dae2ff] text-sm font-bold text-[#294486] md:flex">
              {avatarFallback ?? initials(peerName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold leading-none text-zinc-900 md:text-base md:leading-tight lg:text-lg">
              {peerName}
            </p>
            <div className="flex items-center gap-2">
              {isPeerOnline && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500"
                  aria-hidden="true"
                />
              )}
              <p className="mt-1 truncate text-sm text-[#727687] md:mt-0.5 md:text-[11px]">
                {subTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {!isGroup ? (
            <button
              type="button"
              onClick={onOpenVoiceCall}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff]"
              aria-label="Mở gọi thoại"
            >
              <Phone className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenVideoCall}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff]"
            aria-label="Mở gọi video"
          >
            <Video className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenInfo}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0068ff] hover:bg-[#eaf2ff] md:hidden"
            aria-label="Mở thông tin hội thoại"
          >
            <TextAlignJustify className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
