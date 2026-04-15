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
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
