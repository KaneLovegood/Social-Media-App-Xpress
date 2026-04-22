"use client";

import Icon from "@/components/common/Icon";

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{ url: string; timestamp: string; type: string }>;
}

export default function MediaGalleryModal({
  isOpen,
  onClose,
  images,
}: MediaGalleryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[min(86vh,700px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Ảnh và Video</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="xmark" size="lg" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {images.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <Icon
                  name="image"
                  size="2xl"
                  className="mx-auto mb-4 text-slate-300"
                />
                <p className="text-sm text-slate-500">Chưa có ảnh nào</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <div
                  key={`${image.timestamp}-${image.url}`}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                >
                  {image.type === "VIDEO" ? (
                    <>
                      <video
                        src={image.url}
                        className="h-full w-full object-cover transition group-hover:scale-110"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Icon name="play" className="text-white opacity-80" />
                      </div>
                    </>
                  ) : (
                    <img
                      src={image.url}
                      alt={`Ảnh ${image.timestamp}`}
                      className="h-full w-full object-cover transition group-hover:scale-110"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                    <Icon
                      name="eye"
                      size="xl"
                      className="text-white opacity-0 transition group-hover:opacity-100"
                    />
                  </div>
                  <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-xs text-white z-10">
                    {image.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
