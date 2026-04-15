"use client";

interface ShareGroupQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomTitle: string;
  inviteLink: string;
  onCopy: () => void;
}

export default function ShareGroupQrModal({
  isOpen,
  onClose,
  roomTitle,
  inviteLink,
  onCopy,
}: ShareGroupQrModalProps) {
  if (!isOpen) return null;

  const qrSource =
    inviteLink.trim().length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
          inviteLink,
        )}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Share Link Nhom
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dong popup share"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">
            Moi thanh vien vao nhom{" "}
            <span className="font-semibold text-slate-900">{roomTitle}</span>{" "}
            bang QR.
          </p>

          {qrSource ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={qrSource}
                alt="QR invite link"
                className="mx-auto h-64 w-64 rounded-lg border border-slate-200 bg-white p-2"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Chua tao duoc link moi cho nhom.
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <p className="mb-1 font-semibold text-slate-900">Invite Link</p>
            <p className="break-all">{inviteLink || "(empty)"}</p>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Dong
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!inviteLink}
            className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
