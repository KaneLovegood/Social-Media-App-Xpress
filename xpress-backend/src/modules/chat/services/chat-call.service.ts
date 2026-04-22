import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SocialService } from '../../social/social.service';
import { ChatActionDto, ChatActionName } from '../dto/chat-action.dto';
import { MessagesRepository } from '../repositories/messages.repository';
import {
  CallAnswerDto,
  CallEndDto,
  CallIceDto,
  CallMode,
  CallOfferDto,
  CallSession,
  CallSignalBase,
  ChatActionResponse,
} from '../interfaces/chat-call.interface';
import { CallLogPayload, MessageEntity } from '../interfaces/message.interface';

@Injectable()
export class ChatCallService {
  private readonly callSessionByKey = new Map<string, CallSession>();
  private readonly logger = new Logger(ChatCallService.name);

  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly socialService: SocialService,
  ) {}

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
}
