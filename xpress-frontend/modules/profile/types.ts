export type ProfileStatus = 'online' | 'offline' | 'unknown';

export interface ProfileModel {
  userId: string;
  displayName: string;
  phone: string;
  roleLabel: string;
  statusLabel: string;
  status: ProfileStatus;
  initials: string;
  storageUsedPercent: number;
}
