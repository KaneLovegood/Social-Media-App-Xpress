import { io, Socket } from 'socket.io-client';

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, '') ??
  'http://localhost:3000';

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

export function createDeviceSessionSocket(token: string): Socket {
  const socket = io(`${WS_BASE_URL}/device-sessions`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // Keep trying forever; mobile apps may be backgrounded for hours and
    // we want them to auto-reconnect when the OS wakes the WebView.
    reconnectionAttempts: Infinity,
    forceNew: true,
  });

  socket.on('connect_error', (error) => {
    console.warn('[DeviceSession] connect_error', error.message);
  });

  return socket;
}
