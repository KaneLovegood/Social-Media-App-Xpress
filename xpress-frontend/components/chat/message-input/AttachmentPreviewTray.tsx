import Image from 'next/image';
import { PendingAttachment } from './types';

interface AttachmentPreviewTrayProps {
  attachments: PendingAttachment[];
  attachmentTitle: string;
  attachmentError: string;
  onClearAttachments: () => void;
  onRemoveAttachment: (id: string) => void;
  onOpenFilePicker: () => void;
}

export default function AttachmentPreviewTray({
  attachments,
  attachmentTitle,
  attachmentError,
  onClearAttachments,
  onRemoveAttachment,
  onOpenFilePicker,
}: AttachmentPreviewTrayProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[#d8dce2] px-3 pb-3 pt-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-[#0f2e5c]">{attachmentTitle || 'Đính kèm file'}</p>
        <button
          type="button"
          onClick={onClearAttachments}
          className="text-[15px] font-medium text-[#2f5f9f] hover:text-[#1f4678]"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-1">
        {attachments.map((item) => (
          <div key={item.id} className="relative h-30 w-30 shrink-0 overflow-hidden rounded-[10px] border border-[#d4d9e1] bg-[#eff2f7]">
            {item.kind === 'image' ? (
              <Image
                src={item.previewUrl}
                alt={item.file.name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : item.kind === 'video' ? (
              <video src={item.previewUrl} className="h-full w-full object-cover" muted />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#36537c]" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5" />
                </svg>
                <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-[#36537c]">{item.file.name}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => onRemoveAttachment(item.id)}
              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label="Remove attachment"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onOpenFilePicker}
          className="inline-flex h-30 w-30 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[#c8cfda] bg-[#e8ebf0] text-[#5b6f91]"
          aria-label="Add attachment"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      {attachmentError ? (
        <p className="mt-2 text-xs font-medium text-[#c0392b]">{attachmentError}</p>
      ) : null}
    </div>
  );
}
