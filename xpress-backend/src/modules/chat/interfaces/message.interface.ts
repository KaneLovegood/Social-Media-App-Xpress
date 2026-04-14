export interface ReplyPreview {
  messageId: string;
  senderId: string;
  senderName?: string;
  content: string;
}

export type MessageType = 'TEXT' | 'CALL_LOG';

export type CallLogOutcome =
  | 'self_cancelled'
  | 'peer_cancelled'
  | 'connected_ended';

export interface CallLogPayload {
  mode: 'voice' | 'video';
  outcome: CallLogOutcome;
  durationSeconds: number;
  actorUserId: string;
  initiatorUserId: string;
}

export interface MessageEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'MESSAGE';
  messageId: string;
  conversationId: string;
  roomId?: string;
  roomType?: 'PRIVATE' | 'GROUP';
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
  deletedAt?: string;
  recalledAt?: string;
}
