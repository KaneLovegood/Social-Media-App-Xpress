import { authFetch } from './auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

type ChatActionName =
  | 'open_voice_call'
  | 'open_video_call'
  | 'accept_call'
  | 'decline_call'
  | 'end_call'
  | 'call_driver'
  | 'view_order'
  | 'view_receipt'
  | 'contact_support';

interface ChatActionPayload {
  peerUserId: string;
  metadata?: Record<string, unknown>;
}

export async function sendChatAction(action: ChatActionName, payload: ChatActionPayload) {
  try {
    await authFetch(`${API_BASE_URL}/chat/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        peerUserId: payload.peerUserId,
        metadata: payload.metadata,
      }),
    });
  } catch {
    // UI action should not break if telemetry/action endpoint is unavailable.
  }
}
