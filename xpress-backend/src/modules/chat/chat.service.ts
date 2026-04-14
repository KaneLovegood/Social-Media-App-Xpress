import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PresenceService } from '../../common/presence/presence.service';
import { ChatFriendUser, SocialService } from '../social/social.service';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { ChatActionDto, ChatActionName } from './dto/chat-action.dto';
import { RecallMessageDto } from './dto/recall-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CallLogPayload, MessageEntity } from './interfaces/message.interface';
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
  initiatorUserId: string;
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
  unreadCount: number;
  isPeerOnline: boolean;
}

interface ChatActionResponse {
  success: true;
  action: ChatActionName;
  actorUserId: string;
  peerUserId: string;
  at: string;
  metadata: Record<string, unknown>;
  data: CallSession;
  callSummaryMessage?: MessageEntity;
}

@Injectable()
export class ChatService {
  private readonly callSessionByKey = new Map<string, CallSession>();
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly presenceService: PresenceService,
    private readonly socialService: SocialService,
  ) {}

  registerConnection(userId: string, socketId: string): boolean {
    return this.presenceService.connect(userId, socketId);
  }

  unregisterConnection(userId: string, socketId: string): boolean {
    return this.presenceService.disconnect(userId, socketId);
  }

  getSocketIds(userId: string): string[] {
    return this.presenceService.getSocketIds(userId);
  }

  getPresence(userId: string) {
    return this.presenceService.getPresence(userId);
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<MessageEntity> {
    await this.socialService.assertNotBlocked(senderId, dto.receiverId);

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
      messageType: 'TEXT',
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
    await this.socialService.assertNotBlocked(senderId, dto.receiverId);

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
      messageType: 'TEXT',
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
    const [messages, friends] = await Promise.all([
      this.messagesRepository.findMessagesByUser(userId),
      this.socialService.listAllFriendUsers(userId),
    ]);
    const rooms = new Map<string, ChatRoomSummary>();

    this.seedPrivateRoomsFromFriends(userId, friends, rooms);

    for (const message of messages) {
      const peerUserId =
        message.senderId === userId ? message.receiverId : message.senderId;
      const roomId = this.toConversationId(userId, peerUserId);
      const existed = rooms.get(roomId);
      const peerName = existed?.peerName ?? this.toPeerName(peerUserId);
      const isPeerOnline = existed?.isPeerOnline ?? this.getPresence(peerUserId).isOnline;

      const unreadDelta =
        message.receiverId === userId && !message.readAt && !message.isDeleted ? 1 : 0;

      if (!existed || message.createdAt > existed.lastMessageAt) {
        rooms.set(roomId, {
          roomId,
          title: existed?.title ?? peerName,
          peerUserId,
          peerName,
          preview: this.toRoomPreview(message),
          lastMessageAt: message.createdAt,
          unreadCount: (existed?.unreadCount ?? 0) + unreadDelta,
          isPeerOnline,
        });
        continue;
      }

      rooms.set(roomId, {
        ...existed,
        unreadCount: existed.unreadCount + unreadDelta,
        isPeerOnline,
      });
    }

    return Array.from(rooms.values()).sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt),
    );
  }

  async getMessagesForRoom(
    userId: string,
    roomId: string,
  ): Promise<MessageEntity[]> {
    this.assertRoomMembership(userId, roomId);

    return this.messagesRepository.findMessagesByConversationId(roomId);
  }

  private seedPrivateRoomsFromFriends(
    userId: string,
    friends: ChatFriendUser[],
    rooms: Map<string, ChatRoomSummary>,
  ): void {
    for (const friend of friends) {
      const roomId = this.toConversationId(userId, friend.userId);
      if (rooms.has(roomId)) {
        continue;
      }

      rooms.set(roomId, {
        roomId,
        title: friend.name,
        peerUserId: friend.userId,
        peerName: friend.name,
        preview: 'Bat dau tro chuyen',
        lastMessageAt: friend.connectedAt,
        unreadCount: 0,
        isPeerOnline: this.getPresence(friend.userId).isOnline,
      });
    }
  }

  async markMessageReceived(
    receiverUserId: string,
    messageId: string,
  ): Promise<MessageEntity | null> {
    const message = await this.messagesRepository.markMessageReceived(
      messageId,
      receiverUserId,
    );

    if (!message) {
      throw new NotFoundException('Tin nhan khong ton tai');
    }

    return message;
  }

  async markRoomAsRead(userId: string, roomId: string): Promise<string[]> {
    this.assertRoomMembership(userId, roomId);
    return this.messagesRepository.markConversationAsRead(roomId, userId);
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

  async validateTyping(
    senderId: string,
    receiverId: string,
    isTyping: boolean,
  ) {
    if (!receiverId) {
      throw new BadRequestException('receiverId la bat buoc');
    }

    await this.socialService.assertNotBlocked(senderId, receiverId);

    return {
      receiverId,
      eventPayload: {
        senderId,
        receiverId,
        isTyping,
      },
    };
  }

  async validateCallOffer(senderId: string, payload: CallOfferDto) {
    if (!payload.offer) {
      throw new BadRequestException('offer la bat buoc');
    }

    await this.socialService.assertNotBlocked(senderId, payload.receiverId);

    return this.mapSignal(senderId, payload);
  }

  async validateCallAnswer(senderId: string, payload: CallAnswerDto) {
    if (!payload.answer) {
      throw new BadRequestException('answer la bat buoc');
    }

    await this.socialService.assertNotBlocked(senderId, payload.receiverId);

    return this.mapSignal(senderId, payload);
  }

  async validateCallIce(senderId: string, payload: CallIceDto) {
    if (!payload.candidate) {
      throw new BadRequestException('candidate la bat buoc');
    }

    await this.socialService.assertNotBlocked(senderId, payload.receiverId);

    return this.mapSignal(senderId, payload);
  }

  async validateCallEnd(senderId: string, payload: CallEndDto) {
    await this.socialService.assertNotBlocked(senderId, payload.receiverId);
    return this.mapSignal(senderId, payload);
  }

  async handleAction(
    actorUserId: string,
    dto: ChatActionDto,
  ): Promise<ChatActionResponse> {
    const at = new Date().toISOString();
    const actionKey = this.toActionKey(actorUserId, dto.peerUserId);
    const basePayload = {
      action: dto.action,
      actorUserId,
      peerUserId: dto.peerUserId,
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

    const callSummaryMessage = await this.createCallSummaryMessageIfNeeded(
      dto.action,
      actorUserId,
      dto.peerUserId,
      data,
      at,
    );

    this.logger.log(
      `[chat-action] actor=${actorUserId} action=${dto.action} peer=${dto.peerUserId}`,
    );

    return {
      success: true,
      ...basePayload,
      data,
      callSummaryMessage,
    };
  }

  private processAction(
    action: ChatActionName,
    actorUserId: string,
    dto: ChatActionDto,
    actionKey: string,
    at: string,
  ): CallSession {
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
      orderId: actionKey,
      initiatorUserId: actorUserId,
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
    };
    this.callSessionByKey.set(actionKey, next);
    return next;
  }

  private async createCallSummaryMessageIfNeeded(
    action: ChatActionName,
    actorUserId: string,
    peerUserId: string,
    data: CallSession,
    at: string,
  ): Promise<MessageEntity | undefined> {
    if (action !== 'decline_call' && action !== 'end_call') {
      return undefined;
    }

    const outcome = this.toCallOutcome(action, actorUserId, data);
    const conversationId = this.toConversationId(actorUserId, peerUserId);
    const messageId = randomUUID();
    const payload: CallLogPayload = {
      mode: data.mode,
      outcome,
      durationSeconds: this.toCallDurationSeconds(data, at),
      actorUserId,
      initiatorUserId: data.initiatorUserId,
    };

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${conversationId}`,
      GSI1SK: `${at}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId,
      senderId: actorUserId,
      receiverId: peerUserId,
      content: this.toCallLogContent(payload),
      messageType: 'CALL_LOG',
      callLog: payload,
      isDeleted: false,
      isRecalled: false,
      createdAt: at,
      updatedAt: at,
    };

    await this.messagesRepository.createMessage(item);
    return item;
  }

  private toCallOutcome(
    action: ChatActionName,
    actorUserId: string,
    session: CallSession,
  ): CallLogPayload['outcome'] {
    if (action === 'decline_call') {
      return actorUserId === session.peerUserId
        ? 'peer_cancelled'
        : 'self_cancelled';
    }

    return session.acceptedAt ? 'connected_ended' : 'self_cancelled';
  }

  private toCallDurationSeconds(session: CallSession, at: string): number {
    if (!session.acceptedAt) {
      return 0;
    }

    const startAtMs = new Date(session.acceptedAt).getTime();
    const endAtMs = new Date(at).getTime();
    if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) {
      return 0;
    }

    return Math.max(0, Math.floor((endAtMs - startAtMs) / 1000));
  }

  private toCallLogContent(payload: CallLogPayload): string {
    const modeText = payload.mode === 'video' ? 'video' : 'thoai';

    if (payload.outcome === 'connected_ended') {
      return `Cuoc goi ${modeText} ket thuc`;
    }

    if (payload.outcome === 'peer_cancelled') {
      return 'Nguoi nhan tu choi';
    }

    return 'Ban da huy';
  }

  private toActionKey(actorUserId: string, peerUserId: string): string {
    return this.toConversationId(actorUserId, peerUserId);
  }

  private toConversationId(userA: string, userB: string): string {
    const [first, second] = [userA, userB].sort();
    return `${first}:${second}`;
  }

  private toRoomPreview(message: MessageEntity): string {
    if (message.messageType !== 'CALL_LOG' || !message.callLog) {
      return message.content;
    }

    if (message.callLog.outcome === 'connected_ended') {
      return message.callLog.mode === 'video'
        ? 'Cuộc gọi video'
        : 'Cuộc gọi thoại';
    }

    if (message.callLog.outcome === 'peer_cancelled') {
      return 'Người nhận từ chối';
    }

    return 'Bạn đã hủy';
  }

  private assertRoomMembership(userId: string, roomId: string): void {
    const [firstUserId, secondUserId, ...rest] = roomId.split(':');
    if (rest.length > 0 || !firstUserId || !secondUserId) {
      throw new BadRequestException('Phong chat khong hop le');
    }

    if (userId !== firstUserId && userId !== secondUserId) {
      throw new ForbiddenException('Ban khong co quyen xem phong chat nay');
    }
  }

  private toPeerName(peerUserId: string): string {
    const segments = peerUserId.split(/[._-]+/).filter(Boolean);
    if (segments.length === 0) return 'User';

    return segments
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private toRoomTitle(roomId: string): string {
    const segments = roomId.split(':');
    return segments.length === 2 ? segments[1] : 'Chat';
  }
}
