import { ChatRoomType } from './group-room.interface';

export interface ChatRoomSummary {
  roomId: string;
  roomType: ChatRoomType;
  title: string;
  peerUserId: string;
  peerName: string;
  avatarUrl?: string;
  description?: string;
  emoji?: string;
  memberCount?: number;
  memberRole?: 'ADMIN' | 'MEMBER';
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  isPeerOnline: boolean;
}

export interface GroupRoomMemberSummary {
  userId: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'MEMBER';
  nickname?: string;
  isOnline: boolean;
  joinedAt: string;
  lastReadAt?: string;
}

export interface GroupRoomDetails {
  roomId: string;
  roomType: 'GROUP';
  title: string;
  description?: string;
  avatarUrl?: string;
  emoji?: string;
  createdByUserId: string;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  pinnedMessageId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
  members: GroupRoomMemberSummary[];
  currentUserRole?: 'ADMIN' | 'MEMBER';
}

export interface GroupDissolveResult {
  roomId: string;
  title: string;
  memberUserIds: string[];
}
