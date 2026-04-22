import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PresenceService } from '../../common/presence/presence.service';
import { SocialService } from '../social/social.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { ChatActionDto } from './dto/chat-action.dto';
import { GroupMemberDto } from './dto/group-member.dto';
import { RecallMessageDto } from './dto/recall-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatActionResponse,
  CallAnswerDto,
  CallEndDto,
  CallIceDto,
  CallOfferDto,
} from './interfaces/chat-call.interface';
import { ChatRoomSummary } from './interfaces/chat-room-summary.interface';
import { MessageEntity } from './interfaces/message.interface';
import { ChatCallService } from './services/chat-call.service';
import { MessagesRepository } from './repositories/messages.repository';
import { ChatRoomService } from './services/chat-room.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly presenceService: PresenceService,
    private readonly socialService: SocialService,
    private readonly chatCallService: ChatCallService,
    private readonly chatRoomService: ChatRoomService,
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
      content: dto.content || '',
      messageType: dto.messageType || 'TEXT',
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
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

  async createGroupRoom(actorUserId: string, dto: CreateGroupDto) {
    return this.chatRoomService.createGroupRoom(actorUserId, dto);
  }

  async dissolveGroup(actorUserId: string, roomId: string) {
    return this.chatRoomService.dissolveGroup(actorUserId, roomId);
  }

  async getGroupRoomDetails(actorUserId: string, roomId: string) {
    return this.chatRoomService.getGroupRoomDetails(actorUserId, roomId);
  }

  async addGroupMember(
    actorUserId: string,
    roomId: string,
    dto: GroupMemberDto,
  ) {
    return this.chatRoomService.addGroupMember(actorUserId, roomId, dto);
  }

  async removeGroupMember(
    actorUserId: string,
    roomId: string,
    memberUserId: string,
  ) {
    return this.chatRoomService.removeGroupMember(
      actorUserId,
      roomId,
      memberUserId,
    );
  }

  async leaveGroup(actorUserId: string, roomId: string) {
    return this.chatRoomService.leaveGroup(actorUserId, roomId);
  }

  async promoteGroupMember(
    actorUserId: string,
    roomId: string,
    memberUserId: string,
  ) {
    return this.chatRoomService.promoteGroupMember(
      actorUserId,
      roomId,
      memberUserId,
    );
  }

  async createGroupInviteLink(actorUserId: string, roomId: string) {
    return this.chatRoomService.createGroupInviteLink(actorUserId, roomId);
  }

  async joinGroupByInvite(actorUserId: string, inviteCode: string) {
    return this.chatRoomService.joinGroupByInvite(actorUserId, inviteCode);
  }

  async sendGroupMessage(
    senderId: string,
    dto: SendGroupMessageDto,
  ): Promise<MessageEntity> {
    return this.chatRoomService.sendGroupMessage(senderId, dto);
  }

  async createGroupCallLogMessage(
    senderId: string,
    roomId: string,
    payload: {
      mode: 'voice' | 'video';
      outcome: 'self_cancelled' | 'connected_ended';
    },
  ): Promise<MessageEntity> {
    return this.chatRoomService.createGroupCallLogMessage(senderId, roomId, {
      mode: payload.mode,
      outcome: payload.outcome,
    });
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
    return this.chatRoomService.getChatRoomsForUser(userId);
  }

  async getMessagesForRoom(
    userId: string,
    roomId: string,
  ): Promise<MessageEntity[]> {
    return this.chatRoomService.getMessagesForRoom(userId, roomId);
  }

  async deleteChatHistory(
    userId: string,
    roomId: string,
  ): Promise<{ success: boolean; deletedCount: number }> {
    return this.chatRoomService.deleteChatHistory(userId, roomId);
  }

  async getRoomImages(
    userId: string,
    roomId: string,
  ): Promise<MessageEntity[]> {
    return this.chatRoomService.getRoomImages(userId, roomId);
  }

  async getRoomFiles(userId: string, roomId: string): Promise<MessageEntity[]> {
    return this.chatRoomService.getRoomFiles(userId, roomId);
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
    return this.chatRoomService.markRoomAsRead(userId, roomId);
  }

  async getGroupRoomIdsForUser(userId: string): Promise<string[]> {
    return this.chatRoomService.getGroupRoomIdsForUser(userId);
  }

  async ensureGroupMembership(userId: string, roomId: string) {
    return this.chatRoomService.ensureGroupMembership(userId, roomId);
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
    return this.chatCallService.validateCallOffer(senderId, payload);
  }

  async validateCallAnswer(senderId: string, payload: CallAnswerDto) {
    return this.chatCallService.validateCallAnswer(senderId, payload);
  }

  async validateCallIce(senderId: string, payload: CallIceDto) {
    return this.chatCallService.validateCallIce(senderId, payload);
  }

  async validateCallEnd(senderId: string, payload: CallEndDto) {
    return this.chatCallService.validateCallEnd(senderId, payload);
  }

  async handleAction(
    actorUserId: string,
    dto: ChatActionDto,
  ): Promise<ChatActionResponse> {
    return this.chatCallService.handleAction(actorUserId, dto);
  }

  private toConversationId(userA: string, userB: string): string {
    const [first, second] = [userA, userB].sort();
    return `${first}:${second}`;
  }
}
