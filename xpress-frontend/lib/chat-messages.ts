import { authFetch } from './auth-client';
import { ChatMessage } from './realtime/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export async function fetchChatRoomMessages(roomId: string): Promise<ChatMessage[]> {
  const response = await authFetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
    method: 'GET',
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch chat room messages');
  }

  return (await response.json()) as ChatMessage[];
}
