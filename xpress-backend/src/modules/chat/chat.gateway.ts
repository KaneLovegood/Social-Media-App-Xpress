import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CALL_EVENTS, CHAT_EVENTS } from './constants/events';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { RecallMessageDto } from './dto/recall-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface IncomingCallPayload {
  senderId: string;
  senderName: string;
  callMode: 'voice' | 'video';
  sessionId: string;
  isOnline: boolean;
}

interface JwtPayload {
  sub: string;
}

interface TypingDto {
  receiverId: string;
  isTyping: boolean;
}

interface ReceiveDto {
  messageId: string;
}

interface ReadRoomDto {
  roomId: string;
}

interface CallOfferDto {
  receiverId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallAnswerDto {
  receiverId: string;
  answer: RTCSessionDescriptionInit;
}

interface CallIceDto {
  receiverId: string;
  candidate: RTCIceCandidateInit;
}

interface CallEndDto {
  receiverId: string;
  reason?: string;
}

interface GroupCallStartDto {
  roomId: string;
  callMode: 'voice' | 'video';
}

interface GroupCallSignalDto {
  roomId: string;
  receiverId: string;
  callMode: 'voice' | 'video';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface GroupCallEndDto {
  roomId: string;
  reason?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;

      const userRoom = `user:${payload.sub}`;
      client.join(userRoom);

      const groupRoomIds = await this.chatService.getGroupRoomIdsForUser(
        payload.sub,
      );
      for (const roomId of groupRoomIds) {
        client.join(this.toGroupRoomName(roomId));
      }

      const becameOnline = this.chatService.registerConnection(
        payload.sub,
        client.id,
      );
      if (becameOnline) {
        this.server.emit(
          CHAT_EVENTS.PRESENCE,
          this.chatService.getPresence(payload.sub),
        );
      }
    } catch (error) {
      this.logger.warn(`Socket auth failed: ${String(error)}`);
      client.emit(CHAT_EVENTS.ERROR, { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const becameOffline = this.chatService.unregisterConnection(
      userId,
      client.id,
    );
    if (becameOffline) {
      this.server.emit(
        CHAT_EVENTS.PRESENCE,
        this.chatService.getPresence(userId),
      );
    }
  }

  @SubscribeMessage(CHAT_EVENTS.SEND)
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.sendMessage(userId, dto);

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.MESSAGE,
      message,
    );
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_SEND)
  async onGroupSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendGroupMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.sendGroupMessage(userId, dto);

    this.emitToGroup(dto.roomId, CHAT_EVENTS.GROUP_MESSAGE, message);
  }

  @SubscribeMessage(CHAT_EVENTS.REPLY)
  async onReply(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReplyMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.replyMessage(userId, dto);

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.MESSAGE,
      message,
    );
  }

  @SubscribeMessage(CHAT_EVENTS.DELETE)
  async onDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: DeleteMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.deleteMessage(userId, dto);

    const payload = {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      roomId: message.roomId ?? message.conversationId,
      roomType: message.roomType,
      isDeleted: true,
      updatedAt: message.updatedAt,
    };

    if (message.roomType === 'GROUP') {
      this.emitToGroup(
        message.roomId ?? message.conversationId,
        CHAT_EVENTS.DELETED,
        payload,
      );
      return;
    }

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.DELETED,
      payload,
    );
  }

  @SubscribeMessage(CHAT_EVENTS.RECALL)
  async onRecall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RecallMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.recallMessage(userId, dto);

    const payload = {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      roomId: message.roomId ?? message.conversationId,
      roomType: message.roomType,
      isRecalled: true,
      updatedAt: message.updatedAt,
    };

    if (message.roomType === 'GROUP') {
      this.emitToGroup(
        message.roomId ?? message.conversationId,
        CHAT_EVENTS.RECALLED,
        payload,
      );
      return;
    }

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.RECALLED,
      payload,
    );
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING)
  async onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = await this.chatService.validateTyping(
      userId,
      payload.receiverId,
      payload.isTyping,
    );

    this.emitToUser(receiverId, CHAT_EVENTS.TYPING, eventPayload);
  }

  @SubscribeMessage(CHAT_EVENTS.RECEIVE)
  async onReceive(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReceiveDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.markMessageReceived(
      userId,
      payload.messageId,
    );

    if (!message?.receivedAt) {
      return;
    }

    if (message.roomType === 'GROUP') {
      return;
    }

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.RECEIVED,
      {
        messageId: message.messageId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        receivedAt: message.receivedAt,
        updatedAt: message.updatedAt,
      },
    );
  }

  @SubscribeMessage(CHAT_EVENTS.READ)
  async onReadRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReadRoomDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.markRoomAsRead(userId, payload.roomId);
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_READ)
  async onGroupReadRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReadRoomDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.markRoomAsRead(userId, payload.roomId);
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_TYPING)
  async onGroupTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);

    this.emitToGroup(payload.roomId, CHAT_EVENTS.GROUP_TYPING, {
      roomId: payload.roomId,
      senderId: userId,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_CALL_START)
  async onGroupCallStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallStartDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);

    this.emitToGroup(payload.roomId, CHAT_EVENTS.GROUP_CALL_STARTED, {
      senderId: userId,
      roomId: payload.roomId,
      callMode: payload.callMode,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_CALL_OFFER)
  async onGroupCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallSignalDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);
    await this.chatService.ensureGroupMembership(
      payload.receiverId,
      payload.roomId,
    );

    this.emitToUser(payload.receiverId, CHAT_EVENTS.GROUP_CALL_OFFER, {
      senderId: userId,
      receiverId: payload.receiverId,
      roomId: payload.roomId,
      callMode: payload.callMode,
      offer: payload.offer,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_CALL_ANSWER)
  async onGroupCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallSignalDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);
    await this.chatService.ensureGroupMembership(
      payload.receiverId,
      payload.roomId,
    );

    this.emitToUser(payload.receiverId, CHAT_EVENTS.GROUP_CALL_ANSWER, {
      senderId: userId,
      receiverId: payload.receiverId,
      roomId: payload.roomId,
      callMode: payload.callMode,
      answer: payload.answer,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_CALL_ICE)
  async onGroupCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallSignalDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);
    await this.chatService.ensureGroupMembership(
      payload.receiverId,
      payload.roomId,
    );

    this.emitToUser(payload.receiverId, CHAT_EVENTS.GROUP_CALL_ICE, {
      senderId: userId,
      receiverId: payload.receiverId,
      roomId: payload.roomId,
      callMode: payload.callMode,
      candidate: payload.candidate,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.GROUP_CALL_END)
  async onGroupCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallEndDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.chatService.ensureGroupMembership(userId, payload.roomId);

    this.emitToGroup(payload.roomId, CHAT_EVENTS.GROUP_CALL_END, {
      senderId: userId,
      roomId: payload.roomId,
      reason: payload.reason,
    });
  }

  @SubscribeMessage(CALL_EVENTS.OFFER)
  async onCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallOfferDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } =
      await this.chatService.validateCallOffer(userId, payload);

    this.emitToUser(receiverId, CALL_EVENTS.OFFER, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.ANSWER)
  async onCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallAnswerDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } =
      await this.chatService.validateCallAnswer(userId, payload);

    this.emitToUser(receiverId, CALL_EVENTS.ANSWER, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.ICE)
  async onCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallIceDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = await this.chatService.validateCallIce(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.ICE, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.END)
  async onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallEndDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = await this.chatService.validateCallEnd(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.END, eventPayload);
  }

  private emitToUsers(
    userIds: string[],
    event: string,
    payload: unknown,
  ): void {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  broadcastChatMessage(message: {
    senderId: string;
    receiverId: string;
  }): void {
    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.MESSAGE,
      message,
    );
  }

  private emitToUser(userId: string, event: string, payload: unknown): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit(event, payload);
  }

  private getUserId(client: Socket): string {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized socket');
    }

    return userId;
  }

  private extractToken(client: Socket): string {
    const rawToken = client.handshake.auth?.token;
    if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new UnauthorizedException('Socket token is required');
    }

    const normalized = rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length)
      : rawToken;

    if (!normalized) {
      throw new BadRequestException('Socket token is invalid');
    }

    return normalized;
  }

  broadcastIncomingCall(
    receiverId: string,
    payload: IncomingCallPayload,
  ): void {
    this.emitToUser(receiverId, CALL_EVENTS.INCOMING, payload);
  }

  subscribeUserToGroupRoom(userId: string, roomId: string): void {
    const socketIds = this.chatService.getSocketIds(userId);
    const roomName = this.toGroupRoomName(roomId);
    for (const socketId of socketIds) {
      this.server.to(socketId).socketsJoin(roomName);
    }
  }

  unsubscribeUserFromGroupRoom(userId: string, roomId: string): void {
    const socketIds = this.chatService.getSocketIds(userId);
    const roomName = this.toGroupRoomName(roomId);
    for (const socketId of socketIds) {
      this.server.to(socketId).socketsLeave(roomName);
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
    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_MEMBER_LEFT, {
      roomId,
      userId,
      payload,
    });
  }

  broadcastGroupDissolved(
    roomId: string,
    memberUserIds: string[],
    payload: unknown,
  ): void {
    this.emitToGroup(roomId, CHAT_EVENTS.GROUP_DISSOLVED, payload);
    this.emitToUsers(memberUserIds, CHAT_EVENTS.GROUP_DISSOLVED, payload);
  }

  private emitToGroup(roomId: string, event: string, payload: unknown): void {
    this.server.to(this.toGroupRoomName(roomId)).emit(event, payload);
  }

  private toGroupRoomName(roomId: string): string {
    return `group:${roomId}`;
  }
}
