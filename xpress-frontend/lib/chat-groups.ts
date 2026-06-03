import { authFetch } from "./auth-client";

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

function toErrorMessage(message: unknown): string {
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim()) return message;
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}

async function parseResponse<T>(response: Response): Promise<T> {
  // Handle empty responses (204) and non-JSON responses gracefully
  const contentType = response.headers.get("content-type") || "";
  let data: { message?: unknown } | unknown = {};

  if (response.status === 204) {
    // No content
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return ({} as unknown) as T;
  }

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => ({}));
  } else {
    // Non-JSON response (HTML error page, plain text, etc.) — capture status text
    data = { message: response.statusText || "Server error" };
  }

  if (!response.ok) {
    const msg = (data && typeof data === "object" && "message" in data)
      ? toErrorMessage((data as { message?: unknown }).message)
      : response.statusText || "Đã có lỗi xảy ra";
    throw new Error(`${response.status} ${msg}`);
  }

  return data as T;
}

export async function fetchGroupRoomDetails(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
  const response = await authFetch(`${API_BASE_URL}/chat/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<GroupRoomDetails>(response);
}

export async function addGroupMember(roomId: string, userId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function removeGroupMember(roomId: string, memberUserId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberUserId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function leaveGroup(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/leave`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function transferGroupAdmin(
  roomId: string,
  newAdminUserId: string,
) {
  // Bước 1: Promote thành viên được chọn lên ADMIN
  const promoteResponse = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members/${encodeURIComponent(newAdminUserId)}/promote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  await parseResponse<GroupRoomDetails>(promoteResponse);

  // Bước 2: Rời nhóm — nếu server đã xử lý rời nhóm cùng lúc promote
  // (hoặc trả 403/404 vì role đã đổi), ta vẫn coi như thành công
  try {
    const leaveResponse = await authFetch(
      `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/leave`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    // Chỉ throw nếu lỗi thực sự (không phải 403/404 do role đổi)
    if (!leaveResponse.ok && leaveResponse.status !== 403 && leaveResponse.status !== 404) {
      await parseResponse<GroupRoomDetails>(leaveResponse);
    }
  } catch {
    // Promote đã thành công — bỏ qua lỗi leave để UI vẫn được refresh
  }
}

export async function promoteGroupMember(roomId: string, memberUserId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberUserId)}/promote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function createGroupInviteLink(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/invite-link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<{
    roomId: string;
    inviteCode: string;
    inviteLink: string;
  }>(response);
}

export async function joinGroupByInvite(inviteCode: string, signal?: AbortSignal) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/group-invites/${encodeURIComponent(inviteCode)}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    },
  );

  return parseResponse<GroupRoomDetails>(response);
}

export async function joinGroupByInviteWithTimeout(
  inviteCode: string,
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await joinGroupByInvite(inviteCode, controller.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Ket noi tham gia nhom qua lau. Vui long thu lai.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function toGroupInvitePath(inviteCode: string): string {
  return `/chat/join?code=${encodeURIComponent(inviteCode)}`;
}

export function normalizeGroupInviteLink(value: string, origin = ""): string {
  const inviteCode = extractGroupInviteCode(value);
  if (!inviteCode) return value;

  const path = toGroupInvitePath(inviteCode);
  return origin ? `${origin}${path}` : path;
}

export function extractGroupInviteCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code") ?? url.searchParams.get("inviteCode");
    if (code) {
      return code;
    }

    const match = url.pathname.match(/\/chat\/join\/([^/?#]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    const queryMatch = trimmed.match(/[?&](?:code|inviteCode)=([^&#]+)/i);
    if (queryMatch?.[1]) {
      return decodeURIComponent(queryMatch[1]);
    }

    const match = trimmed.match(/\/chat\/join\/([^/?#]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return trimmed;
}

export async function sendGroupMessage(roomId: string, content: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    },
  );

  return parseResponse(response);
}

export async function deleteChatHistory(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<{ success: boolean; deletedCount: number }>(response);
}

export async function dissolveGroup(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/groups/${encodeURIComponent(roomId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseResponse<{
    roomId: string;
    memberUserIds: string[];
    title: string;
  }>(response);
}

export async function fetchRoomImages(roomId: string) {
  const response = await authFetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/images`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
  const response = await authFetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/files`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
