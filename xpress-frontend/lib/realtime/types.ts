export interface ReplyPreview {
  messageId: string;
  senderId: string;
  senderName?: string;
  content: string;
}

export type MessageType = 'TEXT' | 'CALL_LOG';

export interface CallLogPayload {
  mode: 'voice' | 'video';
  outcome: 'self_cancelled' | 'peer_cancelled' | 'connected_ended';
  durationSeconds: number;
  actorUserId: string;
  initiatorUserId: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType?: MessageType;
  callLog?: CallLogPayload;
  replyToMessageId?: string;
  replyPreview?: ReplyPreview;
  receivedAt?: string;
  readAt?: string;
  isDeleted: boolean;
  isRecalled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageStateUpdate {
  messageId: string;
  senderId: string;
  receiverId: string;
  updatedAt?: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
  receivedAt?: string;
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
