export type FriendStatus = 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND';

export interface FriendEntity {
  PK: string;
  SK: string;
  entityType: 'FRIEND';
  ownerUserId: string;
  targetUserId: string;
  status: FriendStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BlockEntity {
  PK: string;
  SK: string;
  entityType: 'BLOCK';
  ownerUserId: string;
  targetUserId: string;
  createdAt: string;
}
