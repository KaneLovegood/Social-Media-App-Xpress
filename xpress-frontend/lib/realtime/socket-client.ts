import { io, Socket } from 'socket.io-client';

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export function createChatSocket(token: string): Socket {
  const socket = io(`${WS_BASE_URL}/chat`, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    forceNew: false,
  });

  socket.on('connect_error', (error) => {
    console.error('[Chat Socket] Connection error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Chat Socket] Disconnected:', reason);
  });

  return socket;
}
