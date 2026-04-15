"use client";

interface IncomingGroupCallModalProps {
  isOpen: boolean;
  roomTitle: string;
  callerName: string;
  callMode: "voice" | "video";
  participantCount: number;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingGroupCallModal({
  isOpen,
  roomTitle,
  callerName,
  callMode,
  participantCount,
  onAccept,
  onDecline,
}: IncomingGroupCallModalProps) {
  if (!isOpen) return null;

  const callTypeLabel =
    callMode === "voice" ? "Cuộc gọi nhóm thoại" : "Cuộc gọi nhóm video";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dae2ff] text-2xl font-bold text-[#294486]">
            {roomTitle.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="text-lg font-bold text-zinc-900">{roomTitle}</p>
            <p className="mt-1 text-sm text-[#727687]">
              {callerName} đang mời bạn vào
            </p>
            <p className="mt-2 text-sm font-semibold text-[#294486]">
              {callTypeLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {participantCount} thành viên trong nhóm
            </p>
          </div>

          <div className="mt-4 flex w-full gap-3">
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Từ chối
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-lg bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Chấp nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
