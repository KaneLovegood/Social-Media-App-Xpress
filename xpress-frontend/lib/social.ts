import { getAccessToken } from "./auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export interface SocialUser {
  userId: string;
  name: string;
  phone: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface SearchUserItem extends SocialUser {
  friendStatus: "PENDING_SENT" | "PENDING_RECEIVED" | "FRIEND" | "NONE";
  blockedByMe: boolean;
  blockedMe: boolean;
}

interface Paginated<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

function authHeaders() {
  const token = getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function toErrorMessage(message: unknown): string {
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim()) return message;
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
  };
  if (!response.ok) {
    throw new Error(toErrorMessage(data.message));
  }

  return data as T;
}

export async function searchUsersByPhone(phone: string, cursor?: string) {
  const params = new URLSearchParams({ phone, limit: "10" });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(
    `${API_BASE_URL}/social/users/search-by-phone?${params.toString()}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<Paginated<SearchUserItem>>(response);
}

export async function fetchFriends(cursor?: string) {
  const params = new URLSearchParams({ limit: "10" });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(
    `${API_BASE_URL}/social/friends?${params.toString()}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<Paginated<SocialUser>>(response);
}

export async function fetchAllFriends() {
  const items: SocialUser[] = [];
  let cursor: string | undefined;

  do {
    const page = await fetchFriends(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return items;
}

export async function fetchIncomingRequests(cursor?: string) {
  const params = new URLSearchParams({ limit: "10" });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(
    `${API_BASE_URL}/social/friends/requests/incoming?${params.toString()}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<Paginated<SocialUser>>(response);
}

export async function sendFriendRequest(targetUserId: string) {
  const response = await fetch(`${API_BASE_URL}/social/friends/requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ targetUserId }),
  });

  return parseResponse<{ success: boolean }>(response);
}

export async function acceptFriendRequest(requesterUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/social/friends/requests/${requesterUserId}/accept`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<{ success: boolean }>(response);
}

export async function rejectFriendRequest(requesterUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/social/friends/requests/${requesterUserId}/reject`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<{ success: boolean }>(response);
}

export async function unfriend(friendUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/social/friends/${friendUserId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{ success: boolean }>(response);
}

export async function blockUser(targetUserId: string) {
  const response = await fetch(`${API_BASE_URL}/social/blocks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ targetUserId }),
  });

  return parseResponse<{ success: boolean }>(response);
}

export async function unblockUser(targetUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/social/blocks/${targetUserId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{ success: boolean }>(response);
}
