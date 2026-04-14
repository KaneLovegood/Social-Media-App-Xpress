export type ChatRoomType = 'PRIVATE' | 'GROUP';
export type GroupMemberRole = 'ADMIN' | 'MEMBER';

export interface ChatGroupRoomEntity {
  PK: string;
  SK: string;
  entityType: 'CHAT_GROUP_ROOM';
  roomId: string;
  roomType: 'GROUP';
  title: string;
  description?: string;
  avatarUrl?: string;
  emoji?: string;
  createdByUserId: string;
  inviteCode: string;
  memberCount: number;
  pinnedMessageId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatGroupMemberEntity {
  PK: string;
  SK: string;
  entityType: 'CHAT_GROUP_MEMBER';
  roomId: string;
  userId: string;
  role: GroupMemberRole;
  nickname?: string;
  joinedAt: string;
  updatedAt: string;
  lastReadAt?: string;
}
