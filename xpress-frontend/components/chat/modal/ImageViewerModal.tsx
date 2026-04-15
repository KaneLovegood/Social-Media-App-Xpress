"use client";

import { useState, useCallback } from "react";
import Icon from "@/components/common/Icon";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  senderName?: string;
  timestamp?: string;
}

export default function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  senderName,
  timestamp,
}: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);

  const handleClose = useCallback(() => {
    setScale(1);
    onClose();
  }, [onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300">
      {/* Header operations */}
      <div className="absolute left-0 top-0 right-0 p-4 flex items-center justify-between z-10 bg-linear-to-b from-black/60 to-transparent">
        <div className="flex flex-col">
          {senderName && <span className="text-white font-semibold text-[15px]">{senderName}</span>}
          {timestamp && <span className="text-white/70 text-xs">{timestamp}</span>}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              window.open(imageUrl, '_blank');
            }}
            className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Mở trong tab mới"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Đóng"
          >
            <Icon name="xmark" size="xl" />
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div 
        className="relative w-full h-full p-8 md:p-12 flex items-center justify-center overflow-hidden"
        onClick={handleClose}
      >
        <div 
          className="relative max-w-full max-h-full transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Using img because cross-origin domain may fail with next/image unless configured */}
          <img
            src={imageUrl}
            alt="Full screen viewer"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded drop-shadow-2xl select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Zoom controls bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-2 rounded-full border border-white/10">
        <button
          type="button"
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          className="p-2 text-white hover:bg-white/20 rounded-full transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <span className="text-white text-xs font-medium min-w-[3ch] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          className="p-2 text-white hover:bg-white/20 rounded-full transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
      </div>
    </div>
  );
}