"use client";

import { useState } from "react";
import EmojiPickerPopover from "./EmojiPickerPopover";

interface ComposerToolbarProps {
  onOpenImagePicker: () => void;
  onOpenFilePicker: () => void;
  onTakePhoto: () => void;
  onEmojiSelect: (emoji: string) => void;
}

const toolbarItems = [
  "emoji",
  "image",
  "attach",
  "camera",
  "card",
  "crop",
  "format",
  "lightning",
  "note",
  "more",
] as const;

function ToolbarIcon({ item }: { item: (typeof toolbarItems)[number] }) {
  if (item === "emoji") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="9" cy="10.5" r="1" fill="currentColor" />
        <circle cx="15" cy="10.5" r="1" fill="currentColor" />
        <path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
      </svg>
    );
  }

  if (item === "image") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.2" fill="currentColor" />
        <path d="m21 15-4.5-4.5L7 20" />
      </svg>
    );
  }

  if (item === "attach") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m10 13 5.6-5.6a3 3 0 1 1 4.2 4.2L12 19.4a5 5 0 1 1-7.1-7.1l8.3-8.3" />
      </svg>
    );
  }

  if (item === "card") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 11h10" />
        <path d="M7 15h4" />
      </svg>
    );
  }

  if (item === "crop") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M8 4v12a4 4 0 0 0 4 4h8" />
        <path d="M4 8h12a4 4 0 0 1 4 4v8" />
      </svg>
    );
  }

  if (item === "format") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 19 6-14 6 14" />
        <path d="M8.5 13h7" />
      </svg>
    );
  }

  if (item === "lightning") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m13 3-7 9h5l-1 9 7-10h-5l1-8Z" />
      </svg>
    );
  }

  if (item === "note") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (item === "camera") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
      <circle cx="7" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="17" cy="12" r="1.5" />
    </svg>
  );
}

export default function ComposerToolbar({
  onOpenImagePicker,
  onOpenFilePicker,
  onTakePhoto,
  onEmojiSelect,
}: ComposerToolbarProps) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleEmojiSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsEmojiPickerOpen(false);
  };

  return (
    <>
      <div className="relative overflow-visible flex items-center gap-1 border-b border-[#d8dce2] px-3 py-2 text-[#0d2b5a]">
        {toolbarItems.map((item) => (
          <div key={item} className="relative">
            <button
              type="button"
              onClick={() => {
                if (item === "emoji") {
                  setIsEmojiPickerOpen(!isEmojiPickerOpen);
                } else if (item === "image") {
                  onOpenImagePicker();
                } else if (item === "attach") {
                  onOpenFilePicker();
                } else if (item === "camera") {
                  onTakePhoto();
                }
              }}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-zinc-100"
              aria-label={item}
            >
              <ToolbarIcon item={item} />
            </button>
            {item === "emoji" && isEmojiPickerOpen && (
              <EmojiPickerPopover
                isOpen={isEmojiPickerOpen}
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setIsEmojiPickerOpen(false)}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
