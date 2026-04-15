"use client";

interface IncomingCallModalProps {
  isOpen: boolean;
  senderName: string;
  callMode: 'voice' | 'video';
  isOnline: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  isOpen,
  senderName,
  callMode,
  isOnline,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  if (!isOpen) return null;

  const callTypeLabel = callMode === 'voice' ? 'Cuộc gọi thoại' : 'Cuộc gọi video';
  const statusLabel = isOnline ? 'Online' : 'Offline';
  const statusColor = isOnline ? 'bg-emerald-500' : 'bg-red-500';
  const statusBgClass = isOnline ? 'bg-emerald-100' : 'bg-red-100';
  const statusTextClass = isOnline ? 'text-emerald-700' : 'text-red-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          {/* Avatar & Status */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dae2ff] text-2xl font-bold text-[#294486]">
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div
              className={`absolute bottom-0 right-0 h-6 w-6 rounded-full border-2 border-white ${statusColor}`}
            />
          </div>

          {/* Caller Info */}
          <div className="text-center">
            <p className="text-lg font-bold text-zinc-900">{senderName}</p>
            <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusBgClass} ${statusTextClass}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
              {statusLabel}
            </div>
          </div>

          {/* Call Type */}
          <div className="text-center">
            <p className="text-sm text-[#727687]">{callTypeLabel}</p>
          </div>

          {/* Action Buttons */}
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
