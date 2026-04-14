import { getAccessToken } from "./auth-client";
import { ChatMessage } from "./realtime/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export type GroupRole = "ADMIN" | "MEMBER";
export type GroupCallMode = "voice" | "video";
export type GroupCallState = "ringing" | "active" | "ended";

export interface GroupSummary {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  emoji: string | null;
  memberCount: number;
  role: GroupRole;
  nickname: string | null;
  updatedAt: string;
}

export interface GroupMemberDetail {
  userId: string;
  name: string;
  role: GroupRole;
  nickname: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  joinedAt: string;
}

export interface GroupDetail {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  emoji: string | null;
  ownerUserId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  members: GroupMemberDetail[];
  pinnedMessages: Array<{
    messageId: string;
    pinnedBy: string;
    pinnedAt: string;
  }>;
  callState: {
    groupId: string;
    mode: GroupCallMode;
    state: GroupCallState;
    startedBy: string;
    startedAt: string;
    updatedAt: string;
  } | null;
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
  return "Da co loi xay ra, vui long thu lai.";
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

export async function fetchGroups(): Promise<GroupSummary[]> {
  const response = await fetch(`${API_BASE_URL}/chat/groups`, {
    method: "GET",
    headers: authHeaders(),
  });

  const groups = await parseResponse<GroupSummary[]>(response);
  return Array.from(
    new Map(groups.map((group) => [group.groupId, group])).values(),
  );
}

export async function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse<GroupDetail>(response);
}

export async function fetchGroupMessages(
  groupId: string,
): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/messages`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  return parseResponse<ChatMessage[]>(response);
}

export async function createGroup(payload: {
  name: string;
  emoji?: string;
  avatarUrl?: string;
  description?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/chat/groups`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return parseResponse<{
    groupId: string;
    name: string;
    avatarUrl: string | null;
    description: string | null;
    emoji: string | null;
    memberCount: number;
    role: GroupRole;
    createdAt: string;
  }>(response);
}

export async function addGroupMember(groupId: string, targetUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/members`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ targetUserId }),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    targetUserId: string;
    role: GroupRole;
  }>(response);
}

export async function removeGroupMember(groupId: string, targetUserId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/members/${targetUserId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    targetUserId: string;
  }>(response);
}

export async function leaveGroup(groupId: string) {
  const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/leave`, {
    method: "POST",
    headers: authHeaders(),
  });

  return parseResponse<{ success: boolean; groupId: string; userId: string }>(
    response,
  );
}

export async function disbandGroup(groupId: string) {
  const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return parseResponse<{ success: boolean; groupId: string }>(response);
}

export async function promoteGroupMember(
  groupId: string,
  targetUserId: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/promote`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ targetUserId }),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    targetUserId: string;
    role: GroupRole;
  }>(response);
}

export async function createGroupInviteLink(groupId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/invite-link`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );

  return parseResponse<{
    groupId: string;
    inviteCode: string;
    inviteLink: string;
    updatedAt: string;
  }>(response);
}

export async function joinGroupByInvite(inviteCode: string) {
  const response = await fetch(`${API_BASE_URL}/chat/groups/join-by-link`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ inviteCode }),
  });

  return parseResponse<{ success: boolean; groupId: string; role: GroupRole }>(
    response,
  );
}

export async function setGroupNickname(groupId: string, nickname?: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/nickname`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ nickname }),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    userId: string;
    nickname: string | null;
  }>(response);
}

export async function pinGroupMessage(groupId: string, messageId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/pinned-messages`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ messageId }),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    messageId: string;
    pinnedBy: string;
    pinnedAt: string;
  }>(response);
}

export async function unpinGroupMessage(groupId: string, messageId: string) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/pinned-messages/${messageId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  return parseResponse<{
    success: boolean;
    groupId: string;
    messageId: string;
  }>(response);
}

export async function updateGroupCallState(
  groupId: string,
  mode: GroupCallMode,
  state: GroupCallState,
) {
  const response = await fetch(
    `${API_BASE_URL}/chat/groups/${groupId}/call-state`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ mode, state }),
    },
  );

  return parseResponse<{
    groupId: string;
    mode: GroupCallMode;
    state: GroupCallState;
    startedBy: string;
    startedAt: string;
    updatedAt: string;
    actorUserId: string;
  }>(response);
}
