import { UserRole } from '../dto/register.dto';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

export interface User {
  userId: string;
  phone: string;
  name: string;
  role: UserRole;
  status: PresenceStatus;
  accountStatus: AccountStatus;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}
