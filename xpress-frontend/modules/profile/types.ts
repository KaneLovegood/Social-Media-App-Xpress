export type ProfileStatus = 'online' | 'offline' | 'unknown';

export interface ProfileModel {
  userId: string;
  displayName: string;
  email: string;
  roleLabel: string;
  statusLabel: string;
  status: ProfileStatus;
  initials: string;
  storageUsedPercent: number;
}
