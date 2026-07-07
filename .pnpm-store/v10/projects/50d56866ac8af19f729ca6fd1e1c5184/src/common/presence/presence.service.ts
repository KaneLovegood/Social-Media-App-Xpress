import { Injectable } from '@nestjs/common';

export interface PresenceSnapshot {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

@Injectable()
export class PresenceService {
  private readonly socketsByUser = new Map<string, Set<string>>();
  private readonly lastSeenByUser = new Map<string, string>();

  connect(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId);
    if (sockets) {
      sockets.add(socketId);
      return sockets.size === 1;
    }

    this.socketsByUser.set(userId, new Set([socketId]));
    return true;
  }

  disconnect(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size > 0) return false;

    this.socketsByUser.delete(userId);
    this.lastSeenByUser.set(userId, new Date().toISOString());
    return true;
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.socketsByUser.get(userId) ?? []);
  }

  getPresence(userId: string): PresenceSnapshot {
    return {
      userId,
      isOnline: this.socketsByUser.has(userId),
      lastSeenAt: this.lastSeenByUser.get(userId) ?? null,
    };
  }
}
