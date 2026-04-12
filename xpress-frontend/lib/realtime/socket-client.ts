import { io, Socket } from 'socket.io-client';

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export function createChatSocket(token: string): Socket {
  return io(`${WS_BASE_URL}/chat`, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
  });
}
