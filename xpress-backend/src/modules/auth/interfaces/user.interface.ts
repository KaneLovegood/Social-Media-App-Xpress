export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface UserEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;

  entityType: 'USER';
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  authProvider?: AuthProvider;
  passwordAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}
