import React from "react";
import { ChatMessage } from "@/lib/realtime/types";

interface Props {
  message: ChatMessage;
  isOwn?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  peerName?: string;
  senderName?: string;
  senderNameById?: Record<string, string>;
  onRedial?: (mode: "voice" | "video") => void;
  onImageClick?: (url: string, senderName?: string, timestamp?: string) => void;
}

export default function MessageBubbleCard({ message }: Props) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
      <div className="whitespace-pre-wrap text-sm text-[#111827]">{message.content}</div>
    </div>
  );
}
