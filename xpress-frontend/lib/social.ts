import { authFetch } from './auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export interface SocialUser {
  userId: string;
  name: string;
  phone: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface SearchUserItem extends SocialUser {
  friendStatus: 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND' | 'NONE';
  blockedByMe: boolean;
  blockedMe: boolean;
}

interface Paginated<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE_URL}${path}`, init);
  return parseResponse<T>(response);
}

function toErrorMessage(message: unknown): string {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return 'Đã có lỗi xảy ra, vui lòng thử lại.';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { message?: unknown };
  if (!response.ok) {
    throw new Error(toErrorMessage(data.message));
  }

  return data as T;
}

export async function searchUsersByPhone(phone: string, cursor?: string) {
  const params = new URLSearchParams({ phone, limit: '10' });
  if (cursor) params.set('cursor', cursor);

  return api<Paginated<SearchUserItem>>(
    `/social/users/search-by-phone?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function fetchFriends(cursor?: string) {
  const params = new URLSearchParams({ limit: '10' });
  if (cursor) params.set('cursor', cursor);

  return api<Paginated<SocialUser>>(`/social/friends?${params.toString()}`, {
    method: 'GET',
  });
}

export async function fetchIncomingRequests(cursor?: string) {
  const params = new URLSearchParams({ limit: '10' });
  if (cursor) params.set('cursor', cursor);

  return api<Paginated<SocialUser>>(
    `/social/friends/requests/incoming?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function sendFriendRequest(targetUserId: string) {
  return api<{ success: boolean }>('/social/friends/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  });
}

export async function acceptFriendRequest(requesterUserId: string) {
  return api<{ success: boolean }>(
    `/social/friends/requests/${requesterUserId}/accept`,
    { method: 'POST' },
  );
}

export async function rejectFriendRequest(requesterUserId: string) {
  return api<{ success: boolean }>(
    `/social/friends/requests/${requesterUserId}/reject`,
    { method: 'POST' },
  );
}

export async function unfriend(friendUserId: string) {
  return api<{ success: boolean }>(`/social/friends/${friendUserId}`, {
    method: 'DELETE',
  });
}

export async function blockUser(targetUserId: string) {
  return api<{ success: boolean }>('/social/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  });
}

export async function unblockUser(targetUserId: string) {
  return api<{ success: boolean }>(`/social/blocks/${targetUserId}`, {
    method: 'DELETE',
  });
}
