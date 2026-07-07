import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
import { GroupRoomsRepository } from './repositories/group-rooms.repository';
import { NewsFeedService } from '../news-feed/news-feed.service';
import {
  ChatRoomService,
  GroupRoomMutationResult,
} from './services/chat-room.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly presenceService: PresenceService,
    @Inject(forwardRef(() => SocialService))
    private readonly socialService: SocialService,
    private readonly chatCallService: ChatCallService,
    private readonly chatRoomService: ChatRoomService,
    private readonly groupRoomsRepository: GroupRoomsRepository,
    private readonly newsFeedService: NewsFeedService,
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
  ): Promise<GroupRoomMutationResult> {
    return this.chatRoomService.addGroupMember(actorUserId, roomId, dto);
  }

  async removeGroupMember(
    actorUserId: string,
    roomId: string,
    memberUserId: string,
  ): Promise<GroupRoomMutationResult> {
    return this.chatRoomService.removeGroupMember(
      actorUserId,
      roomId,
      memberUserId,
    );
  }

  async leaveGroup(
    actorUserId: string,
    roomId: string,
  ): Promise<GroupRoomMutationResult> {
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

  async joinGroupByInvite(
    actorUserId: string,
    inviteCode: string,
  ): Promise<GroupRoomMutationResult> {
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

  async createGroupCallLeaveSystemMessage(
    senderId: string,
    roomId: string,
    payload: {
      mode: 'voice' | 'video';
      actorName?: string;
    },
  ): Promise<MessageEntity> {
    return this.chatRoomService.createGroupCallLeaveSystemMessage(
      senderId,
      roomId,
      payload,
    );
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

  async decorateMessage(
    userId: string,
    message: MessageEntity,
  ): Promise<MessageEntity> {
    if (message.messageType === 'SHARE_POST' && message.sharedPostId) {
      try {
        const post = await this.newsFeedService.layChiTietBaiViet(
          userId,
          message.sharedPostId,
        );
        message.sharedPost = post;
      } catch (error) {
        message.sharedPost = null;
      }
    }
    return message;
  }

  async decorateMessages(
    userId: string,
    messages: MessageEntity[],
  ): Promise<MessageEntity[]> {
    return Promise.all(
      messages.map((msg) => this.decorateMessage(userId, msg)),
    );
  }

  async getMessagesForRoom(
    userId: string,
    roomId: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.chatRoomService.getMessagesForRoom(
      userId,
      roomId,
    );
    return this.decorateMessages(userId, messages);
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

  async sharePost(
    senderId: string,
    dto: { postId: string; roomIds: string[]; noiDung?: string },
  ): Promise<MessageEntity[]> {
    const originalPost = await this.newsFeedService.layChiTietBaiViet(
      senderId,
      dto.postId,
    );

    if (originalPost.cheDoRiengTu === 'friends') {
      const authorId = originalPost.maNguoiDung;
      const friendsOfAuthor =
        await this.socialService.listAllFriendUsers(authorId);
      const friendsOfAuthorSet = new Set(friendsOfAuthor.map((f) => f.userId));
      friendsOfAuthorSet.add(authorId);

      for (const roomId of dto.roomIds) {
        let memberIds: string[] = [];
        if (roomId.includes(':')) {
          memberIds = roomId.split(':');
        } else {
          const members = await this.groupRoomsRepository.listMembers(roomId);
          memberIds = members.map((m) => m.userId);
        }

        for (const memberId of memberIds) {
          if (memberId !== senderId && !friendsOfAuthorSet.has(memberId)) {
            throw new ForbiddenException(
              'Thành viên trong phòng chat không phải là bạn bè của tác giả bài viết gốc',
            );
          }
        }
      }
    }

    const messages: MessageEntity[] = [];

    for (const roomId of dto.roomIds) {
      const now = new Date().toISOString();
      const messageId = randomUUID();
      const isPrivate = roomId.includes(':');
      const receiverId = isPrivate
        ? roomId.split(':').find((id) => id !== senderId)!
        : roomId;

      const item: MessageEntity = {
        PK: `MESSAGE#${messageId}`,
        SK: `MESSAGE#${messageId}`,
        GSI1PK: `CONVERSATION#${roomId}`,
        GSI1SK: `${now}#${messageId}`,
        entityType: 'MESSAGE',
        messageId,
        conversationId: roomId,
        roomId,
        roomType: isPrivate ? 'PRIVATE' : 'GROUP',
        senderId,
        receiverId,
        content: dto.noiDung || '',
        messageType: 'SHARE_POST',
        sharedPostId: dto.postId,
        isDeleted: false,
        isRecalled: false,
        createdAt: now,
        updatedAt: now,
      };

      await this.messagesRepository.createMessage(item);

      if (!isPrivate) {
        await this.groupRoomsRepository.updateRoomMeta(roomId, {
          lastMessageAt: now,
          lastMessagePreview: dto.noiDung || 'Đã chia sẻ một bài viết',
        });
      }

      await this.newsFeedService.tangLuotChiaSe(dto.postId);

      const decorated = await this.decorateMessage(senderId, item);
      messages.push(decorated);
    }

    return messages;
  }
}
