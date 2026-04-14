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

interface IncomingCallPayload {
  senderId: string;
  senderName: string;
  callMode: 'voice' | 'video';
  sessionId: string;
  isOnline: boolean;
}
import { DeleteMessageDto } from './dto/delete-message.dto';
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
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;

      const userRoom = `user:${payload.sub}`;
      client.join(userRoom);

      const becameOnline = this.chatService.registerConnection(payload.sub, client.id);
      if (becameOnline) {
        this.server.emit(CHAT_EVENTS.PRESENCE, this.chatService.getPresence(payload.sub));
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

    const becameOffline = this.chatService.unregisterConnection(userId, client.id);
    if (becameOffline) {
      this.server.emit(CHAT_EVENTS.PRESENCE, this.chatService.getPresence(userId));
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

  @SubscribeMessage(CALL_EVENTS.OFFER)
  async onCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallOfferDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = await this.chatService.validateCallOffer(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.OFFER, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.ANSWER)
  async onCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallAnswerDto,
  ): Promise<void> {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = await this.chatService.validateCallAnswer(
      userId,
      payload,
    );

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

  broadcastIncomingCall(receiverId: string, payload: IncomingCallPayload): void {
    this.emitToUser(receiverId, CALL_EVENTS.INCOMING, payload);
  }
}
