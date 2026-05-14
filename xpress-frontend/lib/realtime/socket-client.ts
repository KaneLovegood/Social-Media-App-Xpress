import { io, Socket } from "socket.io-client";
import { getRealtimeBaseUrl } from "./get-realtime-base-url";

export function createChatSocket(token: string): Socket {
  const socket = io(`${getRealtimeBaseUrl()}/chat`, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    forceNew: true,
  });

  socket.on("connect_error", (error) => {
    console.error("[Chat Socket] Connection error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Chat Socket] Disconnected:", reason);
  });

  return socket;
}

export function createFeedSocket(token: string): Socket {
  const socket = io(`${getRealtimeBaseUrl()}/feed`, {
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
    console.error('[Feed Socket] Connection error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Feed Socket] Disconnected:', reason);
  });

  return socket;
}
