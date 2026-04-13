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
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;

      this.chatService.registerConnection(payload.sub, client.id);
    } catch (error) {
      this.logger.warn(`Socket auth failed: ${String(error)}`);
      client.emit(CHAT_EVENTS.ERROR, { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    this.chatService.unregisterConnection(userId, client.id);
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
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingDto,
  ): void {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = this.chatService.validateTyping(
      userId,
      payload.receiverId,
      payload.isTyping,
    );

    this.emitToUser(receiverId, CHAT_EVENTS.TYPING, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.OFFER)
  onCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallOfferDto,
  ): void {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = this.chatService.validateCallOffer(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.OFFER, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.ANSWER)
  onCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallAnswerDto,
  ): void {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = this.chatService.validateCallAnswer(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.ANSWER, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.ICE)
  onCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallIceDto,
  ): void {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = this.chatService.validateCallIce(
      userId,
      payload,
    );

    this.emitToUser(receiverId, CALL_EVENTS.ICE, eventPayload);
  }

  @SubscribeMessage(CALL_EVENTS.END)
  onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallEndDto,
  ): void {
    const userId = this.getUserId(client);
    const { receiverId, eventPayload } = this.chatService.validateCallEnd(
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

  private emitToUser(userId: string, event: string, payload: unknown): void {
    const sockets = this.chatService.getSocketIds(userId);
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, payload);
    }
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
}
