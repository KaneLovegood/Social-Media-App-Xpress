export interface ReplyPreview {
  messageId: string;
  senderId: string;
  content: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  replyToMessageId?: string;
  replyPreview?: ReplyPreview;
  isDeleted: boolean;
  isRecalled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageStateUpdate {
  messageId: string;
  senderId: string;
  receiverId: string;
  updatedAt: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
}

export interface TypingPayload {
  senderId: string;
  receiverId: string;
  isTyping: boolean;
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
