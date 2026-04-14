export type GroupRole = 'ADMIN' | 'MEMBER';

export interface GroupEntity {
  PK: string;
  SK: string;
  entityType: 'GROUP';
  groupId: string;
  name: string;
  avatarUrl?: string;
  description?: string;
  emoji?: string;
  ownerUserId: string;
  version: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'GROUP_MEMBER';
  groupId: string;
  userId: string;
  role: GroupRole;
  nickname?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface GroupInvitePointerEntity {
  PK: string;
  SK: string;
  entityType: 'GROUP_INVITE_POINTER';
  groupId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupInviteCodeEntity {
  PK: string;
  SK: string;
  entityType: 'GROUP_INVITE_CODE';
  groupId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
}

export interface GroupPinEntity {
  PK: string;
  SK: string;
  entityType: 'GROUP_PIN';
  groupId: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
}
