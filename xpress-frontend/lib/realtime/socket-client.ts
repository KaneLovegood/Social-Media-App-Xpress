import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "@/lib/auth-client";
import { getRealtimeBaseUrl } from "./get-realtime-base-url";

function isJwtExpiredOrStale(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
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
    return refreshAccessToken().catch(() => "");
  }
  return token;
}

export function createChatSocket(token: string): Socket {
  const socket = io(`${getRealtimeBaseUrl()}/chat`, {
    auth: async (callback) => {
      callback({
        token: await getFreshSocketToken(token),
      });
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    forceNew: true,
  });

  socket.on("connect_error", async (error) => {
    console.error("[Chat Socket] Connection error:", error);
    if (error.message.toLowerCase().includes("unauthorized")) {
      const refreshedToken = await refreshAccessToken().catch(() => "");
      if (refreshedToken) {
        socket.auth = { token: refreshedToken };
        socket.connect();
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[Chat Socket] Disconnected:", reason);
  });

  return socket;
}

export function createFeedSocket(token: string): Socket {
  const socket = io(`${getRealtimeBaseUrl()}/feed`, {
    auth: async (callback) => {
      callback({
        token: await getFreshSocketToken(token),
      });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    forceNew: false,
  });

  socket.on('connect_error', async (error) => {
    console.error('[Feed Socket] Connection error:', error);
    if (error.message.toLowerCase().includes('unauthorized')) {
      const refreshedToken = await refreshAccessToken().catch(() => '');
      if (refreshedToken) {
        socket.auth = { token: refreshedToken };
        socket.connect();
      }
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Feed Socket] Disconnected:', reason);
  });

  return socket;
}
