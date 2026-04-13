import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { ChatActionDto, ChatActionName } from './dto/chat-action.dto';
import { RecallMessageDto } from './dto/recall-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageEntity } from './interfaces/message.interface';
import { MessagesRepository } from './repositories/messages.repository';

interface CallSignalBase {
  receiverId: string;
}

interface CallOfferDto extends CallSignalBase {
  offer: RTCSessionDescriptionInit;
}

interface CallAnswerDto extends CallSignalBase {
  answer: RTCSessionDescriptionInit;
}

interface CallIceDto extends CallSignalBase {
  candidate: RTCIceCandidateInit;
}

interface CallEndDto extends CallSignalBase {
  reason?: string;
}

type CallMode = 'voice' | 'video';
type CallState = 'ringing' | 'active' | 'declined' | 'ended';

interface CallSession {
  sessionId: string;
  actionKey: string;
  orderId: string;
  peerUserId: string;
  actorUserId: string;
  mode: CallMode;
  state: CallState;
  startedAt: string;
  updatedAt: string;
  acceptedAt?: string;
  endedAt?: string;
}

interface OrderSummary {
  orderId: string;
  status: 'in_progress' | 'completed';
  etaMinutes: number;
  totalUsd: number;
  items: Array<{ name: string; quantity: number; priceUsd: number }>;
  address: string;
}

interface ChatRoomSummary {
  roomId: string;
  title: string;
  peerUserId: string;
  peerName: string;
  preview: string;
  lastMessageAt: string;
}

@Injectable()
export class ChatService {
  private readonly socketByUser = new Map<string, Set<string>>();
  private readonly callSessionByKey = new Map<string, CallSession>();
  private readonly supportTicketByOrder = new Map<string, string>();
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly messagesRepository: MessagesRepository) {}

  registerConnection(userId: string, socketId: string): void {
    const existing = this.socketByUser.get(userId);
    if (existing) {
      existing.add(socketId);
      return;
    }

    this.socketByUser.set(userId, new Set([socketId]));
  }

  unregisterConnection(userId: string, socketId: string): void {
    const existing = this.socketByUser.get(userId);
    if (!existing) return;

    existing.delete(socketId);
    if (existing.size === 0) {
      this.socketByUser.delete(userId);
    }
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.socketByUser.get(userId) ?? []);
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<MessageEntity> {
    const now = new Date().toISOString();
    const messageId = randomUUID();
    const conversationId = this.toConversationId(senderId, dto.receiverId);

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${conversationId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId,
      senderId,
      receiverId: dto.receiverId,
      content: dto.content,
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    return item;
  }

  async replyMessage(
    senderId: string,
    dto: ReplyMessageDto,
  ): Promise<MessageEntity> {
    const original = await this.messagesRepository.findByMessageId(
      dto.replyToMessageId,
    );
    if (!original) {
      throw new NotFoundException('Tin nhan goc khong ton tai');
    }

    const sameConversation =
      this.toConversationId(original.senderId, original.receiverId) ===
      this.toConversationId(senderId, dto.receiverId);

    if (!sameConversation) {
      throw new BadRequestException(
        'Khong the reply tin nhan khac cuoc tro chuyen',
      );
    }

    const now = new Date().toISOString();
    const messageId = randomUUID();
    const conversationId = this.toConversationId(senderId, dto.receiverId);

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${conversationId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId,
      senderId,
      receiverId: dto.receiverId,
      content: dto.content,
      replyToMessageId: original.messageId,
      replyPreview: this.messagesRepository.buildReplyPreview(original),
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    return item;
  }

  async deleteMessage(
    senderId: string,
    dto: DeleteMessageDto,
  ): Promise<MessageEntity> {
    const message = await this.messagesRepository.findByMessageId(
      dto.messageId,
    );
    if (!message) {
      throw new NotFoundException('Tin nhan khong ton tai');
    }

    if (message.senderId !== senderId) {
      throw new ForbiddenException('Ban chi co the xoa tin nhan cua minh');
    }

    await this.messagesRepository.softDeleteMessage(dto.messageId);
    return {
      ...message,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async recallMessage(
    senderId: string,
    dto: RecallMessageDto,
  ): Promise<MessageEntity> {
    const message = await this.messagesRepository.findByMessageId(
      dto.messageId,
    );
    if (!message) {
      throw new NotFoundException('Tin nhan khong ton tai');
    }

    if (message.senderId !== senderId) {
      throw new ForbiddenException('Ban chi co the thu hoi tin nhan cua minh');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Tin nhan da bi xoa');
    }

    const createdAt = new Date(message.createdAt).getTime();
    if (Number.isNaN(createdAt)) {
      throw new BadRequestException(
        'Khong xac dinh duoc thoi gian tao tin nhan',
      );
    }

    const within24Hours = Date.now() - createdAt <= 24 * 60 * 60 * 1000;
    if (!within24Hours) {
      throw new BadRequestException(
        'Chi duoc thu hoi tin nhan trong vong 24 gio',
      );
    }

    await this.messagesRepository.recallMessage(dto.messageId);
    return {
      ...message,
      content: 'Message recalled',
      isRecalled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async getChatRoomsForUser(userId: string): Promise<ChatRoomSummary[]> {
    const messages = await this.messagesRepository.findMessagesByUser(userId);
    const rooms = new Map<string, ChatRoomSummary>();

    for (const message of messages) {
      const peerUserId =
        message.senderId === userId ? message.receiverId : message.senderId;
      const roomId = this.toConversationId(userId, peerUserId);
      const existed = rooms.get(roomId);

      if (!existed || message.createdAt > existed.lastMessageAt) {
        rooms.set(roomId, {
          roomId,
          title: this.toRoomTitle(roomId),
          peerUserId,
          peerName: this.toPeerName(peerUserId),
          preview: message.content,
          lastMessageAt: message.createdAt,
        });
      }
    }

    return Array.from(rooms.values()).sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt),
    );
  }

  mapSignal<TPayload extends CallSignalBase>(
    senderId: string,
    payload: TPayload,
  ) {
    return {
      receiverId: payload.receiverId,
      eventPayload: {
        ...payload,
        senderId,
      },
    };
  }

  validateTyping(senderId: string, receiverId: string, isTyping: boolean) {
    if (!receiverId) {
      throw new BadRequestException('receiverId la bat buoc');
    }

    return {
      receiverId,
      eventPayload: {
        senderId,
        receiverId,
        isTyping,
      },
    };
  }

  validateCallOffer(senderId: string, payload: CallOfferDto) {
    if (!payload.offer) {
      throw new BadRequestException('offer la bat buoc');
    }

    return this.mapSignal(senderId, payload);
  }

  validateCallAnswer(senderId: string, payload: CallAnswerDto) {
    if (!payload.answer) {
      throw new BadRequestException('answer la bat buoc');
    }

    return this.mapSignal(senderId, payload);
  }

  validateCallIce(senderId: string, payload: CallIceDto) {
    if (!payload.candidate) {
      throw new BadRequestException('candidate la bat buoc');
    }

    return this.mapSignal(senderId, payload);
  }

  validateCallEnd(senderId: string, payload: CallEndDto) {
    return this.mapSignal(senderId, payload);
  }

  handleAction(actorUserId: string, dto: ChatActionDto) {
    const at = new Date().toISOString();
    const actionKey = this.toActionKey(
      actorUserId,
      dto.peerUserId,
      dto.orderId,
    );
    const basePayload = {
      action: dto.action,
      actorUserId,
      peerUserId: dto.peerUserId,
      orderId: dto.orderId,
      at,
      metadata: dto.metadata ?? {},
    };

    const data = this.processAction(
      dto.action,
      actorUserId,
      dto,
      actionKey,
      at,
    );

    this.logger.log(
      `[chat-action] actor=${actorUserId} action=${dto.action} orderId=${dto.orderId} peer=${dto.peerUserId}`,
    );

    return {
      success: true,
      ...basePayload,
      data,
    };
  }

  private processAction(
    action: ChatActionName,
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ) {
    switch (action) {
      case 'open_voice_call':
        return this.openCallSession('voice', actorUserId, dto, actionKey, at);
      case 'open_video_call':
        return this.openCallSession('video', actorUserId, dto, actionKey, at);
      case 'accept_call':
        return this.acceptCallSession(actorUserId, dto, actionKey, at);
      case 'decline_call':
        return this.declineCallSession(actorUserId, dto, actionKey, at);
      case 'end_call':
        return this.endCallSession(actorUserId, dto, actionKey, at);
      case 'call_driver':
        return {
          channel: 'driver_phone',
          status: 'queued',
          requestedAt: at,
          note: 'Driver callback has been requested.',
        };
      case 'view_order':
        return this.buildOrderSummary(dto.orderId);
      case 'view_receipt':
        return this.buildReceipt(dto.orderId, at);
      case 'contact_support':
        return this.createSupportTicket(actorUserId, dto.orderId, at);
      default:
        throw new BadRequestException('Unsupported action');
    }
  }

  private openCallSession(
    mode: CallMode,
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ) {
    const existing = this.callSessionByKey.get(actionKey);
    if (
      existing &&
      (existing.state === 'ringing' || existing.state === 'active')
    ) {
      throw new BadRequestException('Call session is already in progress');
    }

    const session: CallSession = {
      sessionId: randomUUID(),
      actionKey,
      orderId: dto.orderId,
      peerUserId: dto.peerUserId,
      actorUserId,
      mode,
      state: 'ringing',
      startedAt: at,
      updatedAt: at,
    };

    this.callSessionByKey.set(actionKey, session);
    return session;
  }

  private acceptCallSession(
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ) {
    const existing = this.callSessionByKey.get(actionKey);
    if (!existing || existing.state !== 'ringing') {
      throw new BadRequestException('No ringing call session found to accept');
    }

    const next: CallSession = {
      ...existing,
      actorUserId,
      state: 'active',
      acceptedAt: at,
      updatedAt: at,
      orderId: dto.orderId,
      peerUserId: dto.peerUserId,
    };
    this.callSessionByKey.set(actionKey, next);
    return next;
  }

  private declineCallSession(
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ) {
    const existing = this.callSessionByKey.get(actionKey);
    if (!existing) {
      throw new BadRequestException('No call session found to decline');
    }

    const next: CallSession = {
      ...existing,
      actorUserId,
      state: 'declined',
      endedAt: at,
      updatedAt: at,
      orderId: dto.orderId,
      peerUserId: dto.peerUserId,
    };
    this.callSessionByKey.set(actionKey, next);
    return next;
  }

  private endCallSession(
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ) {
    const existing = this.callSessionByKey.get(actionKey);
    if (
      !existing ||
      (existing.state !== 'ringing' && existing.state !== 'active')
    ) {
      throw new BadRequestException('No active call session found to end');
    }

    const next: CallSession = {
      ...existing,
      actorUserId,
      state: 'ended',
      endedAt: at,
      updatedAt: at,
      orderId: dto.orderId,
      peerUserId: dto.peerUserId,
    };
    this.callSessionByKey.set(actionKey, next);
    return next;
  }

  private buildOrderSummary(orderId: string): OrderSummary {
    return {
      orderId,
      status: 'in_progress',
      etaMinutes: 12,
      totalUsd: 23.5,
      items: [
        { name: 'Pepperoni Pizza', quantity: 1, priceUsd: 18.5 },
        { name: 'Cola', quantity: 2, priceUsd: 2.5 },
      ],
      address: '882 Maple Street, Apt 4B, Oakwood Heights, NY 10012',
    };
  }

  private buildReceipt(orderId: string, at: string) {
    return {
      orderId,
      issuedAt: at,
      currency: 'USD',
      subtotal: 23.5,
      deliveryFee: 0,
      tax: 0,
      total: 23.5,
    };
  }

  private createSupportTicket(
    actorUserId: string,
    orderId: string,
    at: string,
  ) {
    const existing = this.supportTicketByOrder.get(orderId);
    const ticketId =
      existing ?? `SUP-${randomUUID().slice(0, 8).toUpperCase()}`;

    this.supportTicketByOrder.set(orderId, ticketId);

    return {
      ticketId,
      orderId,
      actorUserId,
      status: 'open',
      createdAt: at,
      message: 'Support ticket has been created.',
    };
  }

  private toActionKey(
    actorUserId: string,
    peerUserId: string,
    orderId: string,
  ): string {
    return `${this.toConversationId(actorUserId, peerUserId)}:${orderId}`;
  }

  private toConversationId(userA: string, userB: string): string {
    const [first, second] = [userA, userB].sort();
    return `${first}:${second}`;
  }

  private toPeerName(peerUserId: string): string {
    const segments = peerUserId.split(/[._-]+/).filter(Boolean);
    if (segments.length === 0) return 'Delivery Partner';

    return segments
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private toRoomTitle(roomId: string): string {
    const compact = roomId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const shortId = compact.slice(-4) || '0000';
    return `Order #${shortId}`;
  }
}
