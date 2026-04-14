export interface ReplyPreview {
  messageId: string;
  senderId: string;
  content: string;
}

export interface MessageEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'MESSAGE' | 'GROUP_MESSAGE';
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
  deletedAt?: string;
  recalledAt?: string;
}
