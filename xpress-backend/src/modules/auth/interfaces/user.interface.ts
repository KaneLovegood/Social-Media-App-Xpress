export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';

export interface UserEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;

  entityType: 'USER';
  userId: string;
  name: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  refreshTokenHash?: string;
  refreshTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}
