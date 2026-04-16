import { clearSession, getStoredUser } from '@/lib/auth-client';
import type { StoredUser } from '@/lib/auth-client';
import type { ProfileModel, ProfileStatus } from './types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  USER: 'Người dùng',
};

const STATUS_LABELS: Record<string, string> = {
  ONLINE: 'Đang hoạt động',
  OFFLINE: 'Ngoại tuyến',
};

function mapRole(role: string) {
  const normalizedRole = role.trim().toUpperCase();
  return ROLE_LABELS[normalizedRole] ?? normalizedRole;
}

function mapStatusLabel(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  return STATUS_LABELS[normalizedStatus] ?? 'Chưa cập nhật';
}

function mapStatus(status: string): ProfileStatus {
  const normalizedStatus = status.trim().toUpperCase();
  if (normalizedStatus === 'ONLINE') return 'online';
  if (normalizedStatus === 'OFFLINE') return 'offline';
  return 'unknown';
}

function getInitials(name: string) {
  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) return 'NA';
  return segments.map((segment) => segment[0]?.toUpperCase() ?? '').join('');
}

function toProfileModel(user: StoredUser | null): ProfileModel {
  if (!user) {
    return {
      userId: '',
      displayName: 'Chưa có dữ liệu người dùng',
      email: '---',
      roleLabel: '---',
      statusLabel: 'Chưa đăng nhập',
      status: 'unknown',
      initials: 'NA',
      storageUsedPercent: 0,
    };
  }

  const hasPhone = user.email.trim().length > 0;
  const hasRole = user.role.trim().length > 0;
  const hasStatus = user.status.trim().length > 0;
  const completionScore = [hasPhone, hasRole, hasStatus].filter(Boolean).length;

  return {
    userId: user.userId,
    displayName: user.name,
    email: user.email,
    roleLabel: mapRole(user.role),
    statusLabel: mapStatusLabel(user.status),
    status: mapStatus(user.status),
    initials: getInitials(user.name),
    storageUsedPercent: Math.max(20, Math.min(95, 30 + completionScore * 20)),
  };
}

export function getProfileModel() {
  return toProfileModel(getStoredUser());
}

export function logoutProfile() {
  clearSession();
}
