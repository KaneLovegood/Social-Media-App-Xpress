"use client";

import { useEffect, useRef } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
// import "./emoji-picker-styles.css";

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPickerPopover({
  isOpen,
  onEmojiSelect,
  onClose,
}: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full mb-3 left-0 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        searchPlaceHolder="Tìm emoji..."
      />
    </div>
  );
}
