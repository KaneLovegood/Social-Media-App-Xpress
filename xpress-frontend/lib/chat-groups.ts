import { getAccessToken } from "./auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export interface GroupMemberSummary {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "ADMIN" | "MEMBER";
  nickname?: string;
  isOnline: boolean;
  joinedAt: string;
  lastReadAt?: string;
}

export interface GroupRoomDetails {
  roomId: string;
  roomType: "GROUP";
  title: string;
  description?: string;
  avatarUrl?: string;
  emoji?: string;
  createdByUserId: string;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  pinnedMessageId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMemberSummary[];
  currentUserRole?: "ADMIN" | "MEMBER";
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

export async function fetchGroupRoomDetails(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function createGroupRoom(payload: {
  title: string;
  description?: string;
  avatarUrl?: string;
  emoji?: string;
  memberUserIds?: string[];
}) {
  const response = await fetch(`${API_BASE_URL}/chat/groups`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return parseResponse<GroupRoomDetails>(response);
}

export async function addGroupMember(roomId: string, userId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ userId }),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function removeGroupMember(roomId: string, memberUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberUserId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function leaveGroup(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/leave`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function promoteGroupMember(roomId: string, memberUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberUserId)}/promote`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function createGroupInviteLink(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/invite-link`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<{
    roomId: string;
    inviteCode: string;
    inviteLink: string;
  }>(response);
}

export async function joinGroupByInvite(inviteCode: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/group-invites/${encodeURIComponent(inviteCode)}/join`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function sendGroupMessage(roomId: string, content: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/messages`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    },
  );

  return parseResponse(response);
}

export async function deleteChatHistory(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{ success: boolean; deletedCount: number }>(response);
}

export async function dissolveGroup(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{
    roomId: string;
    memberUserIds: string[];
    title: string;
  }>(response);
}

export async function fetchRoomImages(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/images`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<
    Array<{
      messageId: string;
      content: string;
      messageType: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      createdAt: string;
      roomId?: string;
      roomType?: "PRIVATE" | "GROUP";
    }>
  >(response);
}

export async function fetchRoomFiles(roomId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/files`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<
    Array<{
      messageId: string;
      content: string;
      messageType: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      createdAt: string;
      roomId?: string;
      roomType?: "PRIVATE" | "GROUP";
    }>
  >(response);
}
