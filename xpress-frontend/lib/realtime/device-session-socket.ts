import { io, Socket } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from '@/lib/auth-client';
import { getRealtimeBaseUrl } from './get-realtime-base-url';

export const DEVICE_SESSION_EVENTS = {
  FORCE_LOGOUT: 'auth.session.force-logout',
  BIND_ACK: 'auth.session.bind-ack',
} as const;

export interface ForceLogoutPayload {
  reason: 'NEW_DEVICE_LOGIN' | 'SESSION_REVOKED' | 'PASSWORD_CHANGED';
  newDeviceName?: string;
  newDeviceId?: string;
  at: string;
}

function isJwtExpiredOrStale(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as {
      exp?: number;
    };
    if (!payload.exp) return false;

    const expiresAt = payload.exp * 1000;
    return expiresAt - Date.now() < 30_000;
  } catch {
    return false;
  }
}

async function getFreshSocketToken(fallbackToken: string): Promise<string> {
  const token = getAccessToken() || fallbackToken;
  if (!token || isJwtExpiredOrStale(token)) {
    return refreshAccessToken().catch(() => '');
  }
  return token;
}

export function createDeviceSessionSocket(token: string): Socket {
  const socket = io(`${getRealtimeBaseUrl()}/device-sessions`, {
    auth: async (callback) => {
      callback({
        token: await getFreshSocketToken(token),
      });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // Keep trying forever; mobile apps may be backgrounded for hours and
    // we want them to auto-reconnect when the OS wakes the WebView.
    reconnectionAttempts: Infinity,
    forceNew: true,
  });

  socket.on('connect_error', async (error) => {
    console.warn('[DeviceSession] connect_error', error.message);
    if (error.message.toLowerCase().includes('unauthorized')) {
      const refreshedToken = await refreshAccessToken().catch(() => '');
      if (refreshedToken) {
        socket.auth = { token: refreshedToken };
        socket.connect();
      }
    }
  });

  return socket;
}
