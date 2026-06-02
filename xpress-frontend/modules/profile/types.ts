export type ProfileStatus = 'online' | 'offline' | 'unknown';
export type ProfileAuthProvider = 'LOCAL' | 'GOOGLE';

export interface ProfileModel {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  roleLabel: string;
  statusLabel: string;
  status: ProfileStatus;
  initials: string;
  storageUsedPercent: number;
  authProvider: ProfileAuthProvider;
  passwordAuthEnabled: boolean;
  twoFactorEnabled: boolean;
}
