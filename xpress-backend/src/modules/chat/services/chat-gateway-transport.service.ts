import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CALL_EVENTS, CHAT_EVENTS } from '../constants/events';
import { ChatService } from '../chat.service';
import { IncomingCallPayload } from '../interfaces/chat-gateway.interface';

@Injectable()
export class ChatGatewayTransportService {
  private server?: Server;

  constructor(private readonly chatService: ChatService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  handleConnection(client: Socket, userId: string): Promise<void> | void {
    client.data.userId = userId;
    client.join(`user:${userId}`);

    return this.chatService.getGroupRoomIdsForUser(userId).then((roomIds) => {
      for (const roomId of roomIds) {
        client.join(this.toGroupRoomName(roomId));
      }
    });
  }

  handleDisconnect(userId: string, socketId: string): boolean {
    return this.chatService.unregisterConnection(userId, socketId);
  }

  registerConnection(userId: string, socketId: string): boolean {
    return this.chatService.registerConnection(userId, socketId);
  }

  getPresence(userId: string) {
    return this.chatService.getPresence(userId);
  }

  getSocketIds(userId: string): string[] {
    return this.chatService.getSocketIds(userId);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.ensureServer().to(`user:${userId}`).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  emitToGroup(roomId: string, event: string, payload: unknown): void {
    this.ensureServer().to(this.toGroupRoomName(roomId)).emit(event, payload);
  }

  broadcastIncomingCall(
    receiverId: string,
    payload: IncomingCallPayload,
  ): void {
    this.emitToUser(receiverId, CALL_EVENTS.INCOMING, payload);
  }

  subscribeUserToGroupRoom(userId: string, roomId: string): void {
    const roomName = this.toGroupRoomName(roomId);
    for (const socketId of this.getSocketIds(userId)) {
      this.ensureServer().to(socketId).socketsJoin(roomName);
    }
  }

  unsubscribeUserFromGroupRoom(userId: string, roomId: string): void {
    const roomName = this.toGroupRoomName(roomId);
    for (const socketId of this.getSocketIds(userId)) {
      this.ensureServer().to(socketId).socketsLeave(roomName);
    }
  }

  broadcastGroupMessage(roomId: string, message: unknown): void {
    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_MESSAGE, message);
  }

  broadcastGroupRoomUpdate(roomId: string, payload: unknown): void {
    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_ROOM_UPDATED, payload);
  }

  broadcastGroupRoomUpdateToUsers(userIds: string[], payload: unknown): void {
    this.emitToUsers(userIds, CHAT_EVENTS.GROUP_ROOM_UPDATED, payload);
  }

  broadcastGroupMemberLeft(
    roomId: string,
    userId: string,
    payload: unknown,
  ): void {
    const eventPayload = {
      roomId,
      userId,
      payload,
    };

    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_MEMBER_LEFT, eventPayload);
    this.emitToUser(userId, CHAT_EVENTS.GROUP_MEMBER_LEFT, eventPayload);
  }

  broadcastGroupDissolved(
    roomId: string,
    memberUserIds: string[],
    payload: unknown,
  ): void {
    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_DISSOLVED, payload);
    this.emitToUsers(memberUserIds, CHAT_EVENTS.GROUP_DISSOLVED, payload);
  }

  private ensureServer(): Server {
    if (!this.server) {
      throw new Error('Chat gateway server has not been initialized');
    }

    return this.server;
  }

  private toGroupRoomName(roomId: string): string {
    return `group:${roomId}`;
  }
}
