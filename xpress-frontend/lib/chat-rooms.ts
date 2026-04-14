import { getAccessToken } from './auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

interface ChatRoomApiResponse {
  roomId: string;
  title: string;
  peerUserId: string;
  peerName: string;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  isPeerOnline: boolean;
}

export interface ChatRoomSummary {
  id: string;
  title: string;
  peerUserId: string;
  peerName: string;
  preview: string;
  age: string;
  unreadCount: number;
  isPeerOnline: boolean;
}

function toAgeLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp).getTime();
  if (Number.isNaN(at)) return 'vài giây trước';

  const deltaMs = Math.max(0, Date.now() - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return 'vài giây trước';
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)} phút trước`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)} giờ trước`;
  return `${Math.floor(deltaMs / day)} ngày trước`;
}

export async function fetchChatRooms(): Promise<ChatRoomSummary[]> {
  const token = getAccessToken();
  if (!token) return [];

  const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat rooms');
  }

  const rooms = (await response.json()) as ChatRoomApiResponse[];
  return rooms.map((room) => ({
    id: room.roomId,
    title: room.title,
    peerUserId: room.peerUserId,
    peerName: room.peerName,
    preview: room.preview,
    age: toAgeLabel(room.lastMessageAt),
    unreadCount: room.unreadCount ?? 0,
    isPeerOnline: Boolean(room.isPeerOnline),
  }));
}
