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
import { GroupService } from './group.service';
import { ChatService } from './chat.service';
import { CALL_EVENTS, CHAT_EVENTS, GROUP_EVENTS } from './constants/events';

interface IncomingCallPayload {
  senderId: string;
  senderName: string;
  callMode: 'voice' | 'video';
  sessionId: string;
  isOnline: boolean;
}
import { DeleteMessageDto } from './dto/delete-message.dto';
import {
  GroupDeleteMessageDto,
  GroupRecallMessageDto,
  GroupReplyMessageDto,
  GroupSendMessageDto,
  GroupTypingDto,
} from './dto/group-message.dto';
import { GroupCallStateDto } from './dto/group-call-state.dto';
import { RecallMessageDto } from './dto/recall-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface JwtPayload {
  sub: string;
}

interface TypingDto {
  receiverId: string;
  isTyping: boolean;
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

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly groupService: GroupService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;

      const userRoom = `user:${payload.sub}`;
      client.join(userRoom);

      const groupIds = await this.groupService.listGroupIdsForUser(payload.sub);
      for (const groupId of groupIds) {
        client.join(this.toGroupRoom(groupId));
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

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.DELETED,
      {
        messageId: message.messageId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        isDeleted: true,
        updatedAt: message.updatedAt,
      },
    );
  }

  @SubscribeMessage(CHAT_EVENTS.RECALL)
  async onRecall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RecallMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.chatService.recallMessage(userId, dto);

    this.emitToUsers(
      [message.senderId, message.receiverId],
      CHAT_EVENTS.RECALLED,
      {
        messageId: message.messageId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        isRecalled: true,
        updatedAt: message.updatedAt,
      },
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

  @SubscribeMessage(GROUP_EVENTS.CALL_STATE)
  async onGroupCallState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GroupCallStateDto & { groupId: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    const result = await this.groupService.updateCallState(userId, payload);

    this.emitToGroup(payload.groupId, GROUP_EVENTS.CALL_STATE, result);
  }

  @SubscribeMessage(GROUP_EVENTS.JOIN)
  async onGroupJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.groupService.ensureMember(payload.groupId, userId);
    client.join(this.toGroupRoom(payload.groupId));
  }

  @SubscribeMessage(GROUP_EVENTS.SEND)
  async onGroupSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GroupSendMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.groupService.sendGroupMessage(userId, dto);

    this.emitToGroup(dto.groupId, GROUP_EVENTS.MESSAGE, message);
  }

  @SubscribeMessage(GROUP_EVENTS.REPLY)
  async onGroupReply(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GroupReplyMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.groupService.replyGroupMessage(userId, dto);

    this.emitToGroup(dto.groupId, GROUP_EVENTS.MESSAGE, message);
  }

  @SubscribeMessage(GROUP_EVENTS.DELETE)
  async onGroupDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GroupDeleteMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.groupService.deleteGroupMessage(userId, dto);

    this.emitToGroup(dto.groupId, GROUP_EVENTS.DELETED, {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      isDeleted: true,
      updatedAt: message.updatedAt,
      groupId: dto.groupId,
    });
  }

  @SubscribeMessage(GROUP_EVENTS.RECALL)
  async onGroupRecall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GroupRecallMessageDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.groupService.recallGroupMessage(userId, dto);

    this.emitToGroup(dto.groupId, GROUP_EVENTS.RECALLED, {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      isRecalled: true,
      updatedAt: message.updatedAt,
      groupId: dto.groupId,
    });
  }

  @SubscribeMessage(GROUP_EVENTS.TYPING)
  async onGroupTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GroupTypingDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { groupId, eventPayload } =
      await this.groupService.validateGroupTyping(userId, dto);

    this.emitToGroup(groupId, GROUP_EVENTS.TYPING, eventPayload);
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

  private emitToUser(userId: string, event: string, payload: unknown): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit(event, payload);
  }

  private emitToGroup(groupId: string, event: string, payload: unknown): void {
    this.server.to(this.toGroupRoom(groupId)).emit(event, payload);
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

  emitGroupEvent(groupId: string, event: string, payload: unknown): void {
    this.emitToGroup(groupId, event, payload);
  }

  emitGroupUpdated(groupId: string, payload: unknown): void {
    this.emitToGroup(groupId, GROUP_EVENTS.UPDATED, payload);
  }

  emitGroupUpdatedToUsers(userIds: string[], payload: unknown): void {
    this.emitToUsers(userIds, GROUP_EVENTS.UPDATED, payload);
  }

  private toGroupRoom(groupId: string): string {
    return `group:${groupId}`;
  }
}
