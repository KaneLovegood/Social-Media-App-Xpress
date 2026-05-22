export interface ReplyPreview {
  messageId: string;
  senderId: string;
  senderName?: string;
  content: string;
}

export type MessageType =
  | "TEXT"
  | "CALL_LOG"
  | "IMAGE"
  | "FILE"
  | "VIDEO"
  | "SYSTEM"
  | "SHARE_POST";

export interface CallLogPayload {
  mode: "voice" | "video";
  outcome: "self_cancelled" | "peer_cancelled" | "connected_ended";
  durationSeconds: number;
  actorUserId: string;
  initiatorUserId: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  roomId?: string;
  roomType?: "PRIVATE" | "GROUP";
  senderId: string;
  receiverId: string;
  content: string;
  messageType?: MessageType;
  sharedPostId?: string;
  sharedPost?: any;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  callLog?: CallLogPayload;
  replyToMessageId?: string;
  replyPreview?: ReplyPreview;
  receivedAt?: string;
  readAt?: string;
  isDeleted: boolean;
  isRecalled: boolean;
  reactions?: Record<string, string[]>;
  reactionOrder?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageStateUpdate {
  messageId: string;
  senderId: string;
  receiverId: string;
  roomId?: string;
  roomType?: "PRIVATE" | "GROUP";
  updatedAt?: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
  receivedAt?: string;
}

export interface TypingPayload {
  senderId: string;
  receiverId: string;
  isTyping: boolean;
  roomId?: string;
}

export interface PresencePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface CallOfferPayload {
  senderId: string;
  receiverId: string;
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  senderId: string;
  receiverId: string;
  answer: RTCSessionDescriptionInit;
}

export interface CallIcePayload {
  senderId: string;
  receiverId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallEndPayload {
  senderId: string;
  receiverId: string;
  reason?: string;
}

export interface GroupCallStartedPayload {
  senderId: string;
  roomId: string;
  callMode: "voice" | "video";
}

export interface GroupCallOfferPayload {
  senderId: string;
  receiverId: string;
  roomId: string;
  callMode: "voice" | "video";
  offer: RTCSessionDescriptionInit;
}

export interface GroupCallAnswerPayload {
  senderId: string;
  receiverId: string;
  roomId: string;
  callMode: "voice" | "video";
  answer: RTCSessionDescriptionInit;
}

export interface GroupCallIcePayload {
  senderId: string;
  receiverId: string;
  roomId: string;
  callMode: "voice" | "video";
  candidate: RTCIceCandidateInit;
}

export interface GroupCallEndPayload {
  senderId: string;
  roomId: string;
  callMode?: "voice" | "video";
  reason?: string;
  endForAll?: boolean;
}

export interface ReactionPayload {
  messageId: string;
  roomId?: string;
  userId: string;
  emoji: string;
}
