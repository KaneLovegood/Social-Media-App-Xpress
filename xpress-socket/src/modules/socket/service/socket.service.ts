import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
export class SocketService {
	private readonly logger = new Logger(SocketService.name);
	private readonly userSockets = new Map<string, Set<string>>();
	private readonly onlineUsers = new Set<string>();
	private server: Server | null = null;

	setServer(server: Server): void {
		this.server = server;
	}

	addSocket(userId: string, socketId: string): void {
		const sockets = this.userSockets.get(userId) ?? new Set<string>();
		sockets.add(socketId);

		this.userSockets.set(userId, sockets);
		this.onlineUsers.add(userId);

		this.logger.log(
			`Socket added. userId=${userId}, socketId=${socketId}, total=${sockets.size}`,
		);
	}

	removeSocket(userId: string, socketId: string): void {
		const sockets = this.userSockets.get(userId);
		if (!sockets) {
			return;
		}

		sockets.delete(socketId);

		if (sockets.size === 0) {
			this.userSockets.delete(userId);
			this.onlineUsers.delete(userId);
			this.logger.log(`User offline. userId=${userId}`);
			return;
		}

		this.userSockets.set(userId, sockets);
		this.logger.log(
			`Socket removed. userId=${userId}, socketId=${socketId}, remain=${sockets.size}`,
		);
	}

	sendToUser(userId: string, event: string, data: unknown): void {
		if (!this.server) {
			throw new WsException('Socket server not initialized');
		}

		this.server.to(userId).emit(event, data);
	}

	broadcastToRoom(roomId: string, event: string, data: unknown): void {
		if (!this.server) {
			throw new WsException('Socket server not initialized');
		}

		this.server.to(roomId).emit(event, data);
	}

	isOnline(userId: string): boolean {
		return this.onlineUsers.has(userId);
	}
}
