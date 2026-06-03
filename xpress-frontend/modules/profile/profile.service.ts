import {
  authFetch,
  getStoredUser,
  logoutSession,
  updateStoredUser,
} from '@/lib/auth-client';
import type { StoredUser } from '@/lib/auth-client';
import { getPresignedUrl, uploadFileToS3 } from '@/lib/chat-upload';
import type { ProfileAuthProvider, ProfileModel, ProfileStatus } from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

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
      avatarUrl: '',
      roleLabel: '---',
      statusLabel: 'Chưa đăng nhập',
      status: 'unknown',
      initials: 'NA',
      storageUsedPercent: 0,
      authProvider: 'LOCAL',
      passwordAuthEnabled: false,
      twoFactorEnabled: false,
    };
  }

  const hasPhone = user.email.trim().length > 0;
  const hasRole = user.role.trim().length > 0;
  const hasStatus = user.status.trim().length > 0;
  const completionScore = [hasPhone, hasRole, hasStatus].filter(Boolean).length;
  const authProvider: ProfileAuthProvider =
    user.authProvider === 'GOOGLE' ? 'GOOGLE' : 'LOCAL';
  const passwordAuthEnabled =
    authProvider !== 'GOOGLE' && user.passwordAuthEnabled !== false;

  return {
    userId: user.userId,
    displayName: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl?.trim() || '',
    roleLabel: mapRole(user.role),
    statusLabel: mapStatusLabel(user.status),
    status: mapStatus(user.status),
    initials: getInitials(user.name),
    storageUsedPercent: Math.max(20, Math.min(95, 30 + completionScore * 20)),
    authProvider,
    passwordAuthEnabled,
    twoFactorEnabled: !!user.twoFactorEnabled,
  };
}

export function getProfileModel() {
  return toProfileModel(getStoredUser());
}

export async function logoutProfile() {
  await logoutSession();
}

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return 'Thao tác thất bại, vui lòng thử lại.';
}

export async function changeProfilePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
  };

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data.message));
  }
}

export async function sendTwoFactorSetupOtp(): Promise<{
  success: boolean;
  expiresAt: string;
}> {
  const response = await authFetch(`${API_BASE_URL}/auth/2fa/setup/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    expiresAt?: string;
  };

  if (!response.ok || !data.success || !data.expiresAt) {
    throw new Error(getErrorMessage(data.message));
  }

  return {
    success: true,
    expiresAt: data.expiresAt,
  };
}

export async function enableTwoFactor(code: string): Promise<ProfileModel> {
  const response = await authFetch(`${API_BASE_URL}/auth/2fa/setup/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    user?: StoredUser;
  };

  if (!response.ok || !data.success || !data.user) {
    throw new Error(getErrorMessage(data.message));
  }

  await updateStoredUser(data.user);
  return toProfileModel(data.user);
}

export async function sendTwoFactorDisableOtp(): Promise<{
  success: boolean;
  expiresAt: string;
}> {
  const response = await authFetch(`${API_BASE_URL}/auth/2fa/disable/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    expiresAt?: string;
  };

  if (!response.ok || !data.success || !data.expiresAt) {
    throw new Error(getErrorMessage(data.message));
  }

  return {
    success: true,
    expiresAt: data.expiresAt,
  };
}

export async function disableTwoFactor(code: string): Promise<ProfileModel> {
  const response = await authFetch(`${API_BASE_URL}/auth/2fa/disable/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    user?: StoredUser;
  };

  if (!response.ok || !data.success || !data.user) {
    throw new Error(getErrorMessage(data.message));
  }

  await updateStoredUser(data.user);
  return toProfileModel(data.user);
}

export async function updateProfileInfo(payload: {
  name: string;
}): Promise<ProfileModel> {
  const response = await authFetch(`${API_BASE_URL}/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    user?: StoredUser;
  };

  if (!response.ok || !data.success || !data.user) {
    throw new Error(getErrorMessage(data.message));
  }

  await updateStoredUser(data.user);
  return toProfileModel(data.user);
}

export async function updateProfileAvatar(file: File): Promise<ProfileModel> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn file ảnh hợp lệ.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Kích thước ảnh tối đa là 5MB.');
  }

  const { uploadUrl, publicUrl } = await getPresignedUrl(
    file.name,
    file.type,
    file.size,
  );

  await uploadFileToS3(uploadUrl, file);

  const response = await authFetch(`${API_BASE_URL}/auth/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ avatarUrl: publicUrl }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    success?: boolean;
    user?: StoredUser;
  };

  if (!response.ok || !data.success || !data.user) {
    throw new Error(getErrorMessage(data.message));
  }

  await updateStoredUser(data.user);
  return toProfileModel(data.user);
}
