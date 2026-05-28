import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersRepository } from '../../auth/repositories/users.repository';
import { PresenceService } from '../../../common/presence/presence.service';
import { ChatFriendUser, SocialService } from '../../social/social.service';
import { CreateGroupDto } from '../dto/create-group.dto';
import { GroupMemberDto } from '../dto/group-member.dto';
import { SendGroupMessageDto } from '../dto/send-group-message.dto';
import {
  ChatGroupMemberEntity,
  ChatGroupRoomEntity,
} from '../interfaces/group-room.interface';
import {
  ChatRoomSummary,
  GroupDissolveResult,
  GroupRoomDetails,
  GroupRoomMemberSummary,
} from '../interfaces/chat-room-summary.interface';
import { CallLogOutcome, MessageEntity } from '../interfaces/message.interface';
import { GroupRoomsRepository } from '../repositories/group-rooms.repository';
import { MessagesRepository } from '../repositories/messages.repository';

export interface GroupRoomMutationResult {
  roomDetails: GroupRoomDetails;
  systemMessage?: MessageEntity;
}

@Injectable()
export class ChatRoomService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly groupRoomsRepository: GroupRoomsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly presenceService: PresenceService,
    @Inject(forwardRef(() => SocialService))
    private readonly socialService: SocialService,
  ) {}

  async createGroupRoom(
    actorUserId: string,
    dto: CreateGroupDto,
  ): Promise<GroupRoomDetails> {
    const initialMemberIds = Array.from(
      new Set([actorUserId, ...(dto.memberUserIds ?? [])]),
    ).filter((userId) => userId !== actorUserId);

    const totalMembers = 1 + initialMemberIds.length;
    if (totalMembers < 3) {
      throw new BadRequestException(
        'Nhom can it nhat 3 nguoi (bao gom ban va 2 thanh vien khac)',
      );
    }

    const room = await this.groupRoomsRepository.createGroupRoom({
      title: dto.title,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      emoji: dto.emoji,
      createdByUserId: actorUserId,
    });

    for (const memberUserId of initialMemberIds) {
      const exists = await this.usersRepository.findByUserId(memberUserId);
      if (!exists) {
        throw new NotFoundException(`Nguoi dung ${memberUserId} khong ton tai`);
      }

      await this.groupRoomsRepository.addMember(
        room.roomId,
        memberUserId,
        'MEMBER',
      );
    }

    return this.buildGroupRoomDetails(actorUserId, room.roomId);
  }

  async dissolveGroup(
    actorUserId: string,
    roomId: string,
  ): Promise<GroupDissolveResult> {
    await this.assertGroupAdmin(actorUserId, roomId);
    const room = await this.getGroupRoom(roomId);

    const members = await this.groupRoomsRepository.deleteGroupRoom(roomId);
    return {
      roomId,
      title: room.title,
      memberUserIds: members,
    };
  }

  async getGroupRoomDetails(
    actorUserId: string,
    roomId: string,
  ): Promise<GroupRoomDetails> {
    await this.assertGroupMembership(actorUserId, roomId);
    const room = await this.getGroupRoom(roomId);
    return this.buildGroupRoomDetails(actorUserId, room.roomId);
  }

  async addGroupMember(
    actorUserId: string,
    roomId: string,
    dto: GroupMemberDto,
  ): Promise<GroupRoomMutationResult> {
    await this.assertGroupMembership(actorUserId, roomId);
    const user = await this.usersRepository.findByUserId(dto.userId);
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai');
    }

    const existingMember = await this.groupRoomsRepository.findMember(
      roomId,
      dto.userId,
    );
    if (existingMember) {
      return {
        roomDetails: await this.buildGroupRoomDetails(actorUserId, roomId),
      };
    }

    await this.groupRoomsRepository.addMember(roomId, dto.userId, 'MEMBER');

    const actor = await this.usersRepository.findByUserId(actorUserId);
    const systemMessage = await this.createGroupSystemMessage(
      actorUserId,
      roomId,
      `${actor?.name ?? 'Một thành viên'} đã thêm ${user.name} vào nhóm`,
    );

    return {
      roomDetails: await this.buildGroupRoomDetails(actorUserId, roomId),
      systemMessage,
    };
  }

  async removeGroupMember(
    actorUserId: string,
    roomId: string,
    memberUserId: string,
  ): Promise<GroupRoomMutationResult> {
    await this.assertGroupAdmin(actorUserId, roomId);
    if (memberUserId === actorUserId) {
      throw new BadRequestException(
        'Admin khong the tu xoa chinh minh bang action nay',
      );
    }

    const currentMember = await this.groupRoomsRepository.findMember(
      roomId,
      memberUserId,
    );
    if (!currentMember) {
      throw new NotFoundException('Thanh vien khong ton tai trong nhom');
    }

    const memberUser = await this.usersRepository.findByUserId(memberUserId);
    const actor = await this.usersRepository.findByUserId(actorUserId);

    await this.groupRoomsRepository.removeMember(roomId, memberUserId);

    const systemMessage = await this.createGroupSystemMessage(
      actorUserId,
      roomId,
      `${actor?.name ?? 'Một thành viên'} đã xóa ${memberUser?.name ?? 'một thành viên'} khỏi nhóm`,
    );

    return {
      roomDetails: await this.buildGroupRoomDetails(actorUserId, roomId),
      systemMessage,
    };
  }

  async leaveGroup(
    actorUserId: string,
    roomId: string,
  ): Promise<GroupRoomMutationResult> {
    await this.assertGroupMembership(actorUserId, roomId);
    const actor = await this.usersRepository.findByUserId(actorUserId);

    await this.groupRoomsRepository.removeMember(roomId, actorUserId);
    const allMembers = await this.groupRoomsRepository.listMembers(roomId);
    if (allMembers.length === 0) {
      throw new Error('Cannot fetch group details after leaving');
    }

    const systemMessage = await this.createGroupSystemMessage(
      actorUserId,
      roomId,
      `${actor?.name ?? 'Một thành viên'} đã rời nhóm`,
    );

    return {
      roomDetails: await this.buildGroupRoomDetails(
        allMembers[0].userId,
        roomId,
      ),
      systemMessage,
    };
  }

  async promoteGroupMember(
    actorUserId: string,
    roomId: string,
    memberUserId: string,
  ): Promise<GroupRoomDetails> {
    await this.assertGroupAdmin(actorUserId, roomId);
    if (actorUserId === memberUserId) {
      throw new BadRequestException('Khong the chuyen quyen cho chinh minh');
    }

    await this.assertGroupMembership(memberUserId, roomId);
    await this.groupRoomsRepository.transferAdminRole(
      roomId,
      actorUserId,
      memberUserId,
    );
    return this.buildGroupRoomDetails(actorUserId, roomId);
  }

  async createGroupInviteLink(
    actorUserId: string,
    roomId: string,
  ): Promise<{ roomId: string; inviteCode: string; inviteLink: string }> {
    await this.assertGroupMembership(actorUserId, roomId);
    const room = await this.getGroupRoom(roomId);
    return {
      roomId,
      inviteCode: room.inviteCode,
      inviteLink: `/chat/join/${room.inviteCode}`,
    };
  }

  async joinGroupByInvite(
    actorUserId: string,
    inviteCode: string,
  ): Promise<GroupRoomMutationResult> {
    const room =
      await this.groupRoomsRepository.findRoomByInviteCode(inviteCode);
    if (!room) {
      throw new NotFoundException('Ma moi khong hop le');
    }

    const userExists = await this.usersRepository.findByUserId(actorUserId);
    if (!userExists) {
      throw new NotFoundException('Nguoi dung khong ton tai');
    }

    const existingMember = await this.groupRoomsRepository.findMember(
      room.roomId,
      actorUserId,
    );
    if (existingMember) {
      return {
        roomDetails: await this.buildGroupRoomDetails(actorUserId, room.roomId),
      };
    }

    await this.groupRoomsRepository.addMember(
      room.roomId,
      actorUserId,
      'MEMBER',
    );

    const systemMessage = await this.createGroupSystemMessage(
      actorUserId,
      room.roomId,
      `${userExists.name} đã tham gia nhóm`,
    );

    return {
      roomDetails: await this.buildGroupRoomDetails(actorUserId, room.roomId),
      systemMessage,
    };
  }

  async sendGroupMessage(
    senderId: string,
    dto: SendGroupMessageDto,
  ): Promise<MessageEntity> {
    await this.assertGroupMembership(senderId, dto.roomId);

    const room = await this.getGroupRoom(dto.roomId);
    let replyPreview: MessageEntity['replyPreview'];
    let replyToMessageId: string | undefined;

    if (dto.replyToMessageId) {
      const original = await this.messagesRepository.findByMessageId(
        dto.replyToMessageId,
      );

      if (!original) {
        throw new NotFoundException('Tin nhan goc khong ton tai');
      }

      const originalRoomId = original.roomId ?? original.conversationId;
      if (originalRoomId !== room.roomId || original.roomType !== 'GROUP') {
        throw new BadRequestException('Khong the reply tin nhan khac nhom');
      }

      replyToMessageId = original.messageId;
      replyPreview = this.messagesRepository.buildReplyPreview(original);
    }

    const now = new Date().toISOString();
    const messageId = randomUUID();

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${room.roomId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId: room.roomId,
      roomId: room.roomId,
      roomType: 'GROUP',
      senderId,
      receiverId: room.roomId,
      content: dto.content || '',
      messageType: dto.messageType || 'TEXT',
      replyToMessageId,
      replyPreview,
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
    await this.groupRoomsRepository.updateRoomMeta(room.roomId, {
      lastMessageAt: now,
      lastMessagePreview: dto.content,
    });

    return item;
  }

  async createGroupCallLogMessage(
    senderId: string,
    roomId: string,
    payload: {
      mode: 'voice' | 'video';
      outcome: CallLogOutcome;
    },
  ): Promise<MessageEntity> {
    await this.assertGroupMembership(senderId, roomId);

    const room = await this.getGroupRoom(roomId);
    const actor = await this.usersRepository.findByUserId(senderId);
    const now = new Date().toISOString();
    const messageId = randomUUID();
    const content = this.toGroupCallLogContent(
      payload.mode,
      payload.outcome,
      actor?.name,
    );

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${room.roomId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId: room.roomId,
      roomId: room.roomId,
      roomType: 'GROUP',
      senderId,
      receiverId: room.roomId,
      content,
      messageType: 'CALL_LOG',
      callLog: {
        mode: payload.mode,
        outcome: payload.outcome,
        durationSeconds: 0,
        actorUserId: senderId,
        initiatorUserId: senderId,
      },
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    await this.groupRoomsRepository.updateRoomMeta(room.roomId, {
      lastMessageAt: now,
      lastMessagePreview: content,
    });

    return item;
  }

  async createGroupCallLeaveSystemMessage(
    senderId: string,
    roomId: string,
    payload: {
      mode: 'voice' | 'video';
    },
  ): Promise<MessageEntity> {
    await this.assertGroupMembership(senderId, roomId);

    const room = await this.getGroupRoom(roomId);
    const actor = await this.usersRepository.findByUserId(senderId);
    const now = new Date().toISOString();
    const messageId = randomUUID();
    const content = `${actor?.name ?? 'Một thành viên'} đã rời khỏi cuộc gọi nhóm ${
      payload.mode === 'video' ? 'video' : 'thoại'
    }`;

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${room.roomId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId: room.roomId,
      roomId: room.roomId,
      roomType: 'GROUP',
      senderId,
      receiverId: room.roomId,
      content,
      messageType: 'SYSTEM',
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    await this.groupRoomsRepository.updateRoomMeta(room.roomId, {
      lastMessageAt: now,
      lastMessagePreview: content,
    });

    return item;
  }

  async getChatRoomsForUser(userId: string): Promise<ChatRoomSummary[]> {
    const [messages, friends, groupMemberships] = await Promise.all([
      this.messagesRepository.findMessagesByUser(userId),
      this.socialService.listAllFriendUsers(userId),
      this.groupRoomsRepository.listRoomsForUser(userId),
    ]);
    const rooms = new Map<string, ChatRoomSummary>();

    this.seedPrivateRoomsFromFriends(userId, friends, rooms);
    await this.seedGroupRooms(userId, groupMemberships, rooms);

    for (const message of messages) {
      const isPrivateConversation =
        message.roomType === 'PRIVATE' || message.conversationId.includes(':');
      if (!isPrivateConversation || message.roomType === 'GROUP') {
        continue;
      }

      const peerUserId =
        message.senderId === userId ? message.receiverId : message.senderId;
      const roomId = this.toConversationId(userId, peerUserId);
      const existed = rooms.get(roomId);
      const peerName = existed?.peerName ?? this.toPeerName(peerUserId);
      const isPeerOnline =
        existed?.isPeerOnline ??
        this.presenceService.getPresence(peerUserId).isOnline;

      const unreadDelta =
        message.receiverId === userId && !message.readAt && !message.isDeleted
          ? 1
          : 0;

      if (!existed || message.createdAt > existed.lastMessageAt) {
        rooms.set(roomId, {
          roomId,
          roomType: 'PRIVATE',
          title: existed?.title ?? peerName,
          peerUserId,
          peerName,
          avatarUrl: existed?.avatarUrl,
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
    await this.assertRoomMembership(userId, roomId);
    return this.messagesRepository.findMessagesByConversationId(roomId);
  }

  async deleteChatHistory(
    userId: string,
    roomId: string,
  ): Promise<{ success: boolean; deletedCount: number }> {
    await this.assertRoomMembership(userId, roomId);

    const messages =
      await this.messagesRepository.findMessagesByConversationId(roomId);
    const deletedCount = messages.length;

    for (const message of messages) {
      if (!message.isDeleted) {
        await this.messagesRepository.softDeleteMessage(message.messageId);
      }
    }

    return {
      success: true,
      deletedCount,
    };
  }

  async getRoomImages(
    userId: string,
    roomId: string,
  ): Promise<MessageEntity[]> {
    await this.assertRoomMembership(userId, roomId);
    return this.messagesRepository.findImagesByConversationId(roomId);
  }

  async getRoomFiles(userId: string, roomId: string): Promise<MessageEntity[]> {
    await this.assertRoomMembership(userId, roomId);
    return this.messagesRepository.findFilesByConversationId(roomId);
  }

  async markRoomAsRead(userId: string, roomId: string): Promise<string[]> {
    if (roomId.includes(':')) {
      await this.assertRoomMembership(userId, roomId);
      return this.messagesRepository.markConversationAsRead(roomId, userId);
    }

    await this.assertGroupMembership(userId, roomId);
    await this.groupRoomsRepository.markMemberRead(roomId, userId);
    return [];
  }

  async getGroupRoomIdsForUser(userId: string): Promise<string[]> {
    const memberships =
      await this.groupRoomsRepository.listRoomsForUser(userId);
    return memberships.map((item) => item.room.roomId);
  }

  async ensureGroupMembership(
    userId: string,
    roomId: string,
  ): Promise<ChatGroupMemberEntity> {
    return this.assertGroupMembership(userId, roomId);
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
        roomType: 'PRIVATE',
        title: friend.name,
        peerUserId: friend.userId,
        peerName: friend.name,
        avatarUrl: friend.avatarUrl,
        preview: 'Bat dau tro chuyen',
        lastMessageAt: friend.connectedAt,
        unreadCount: 0,
        isPeerOnline: this.presenceService.getPresence(friend.userId).isOnline,
      });
    }
  }

  private async seedGroupRooms(
    userId: string,
    memberships: Array<{
      room: ChatGroupRoomEntity;
      role: 'ADMIN' | 'MEMBER';
      joinedAt: string;
      lastReadAt?: string;
    }>,
    rooms: Map<string, ChatRoomSummary>,
  ): Promise<void> {
    for (const membership of memberships) {
      const room = membership.room;
      const latestMessage = room.lastMessageAt
        ? await this.messagesRepository.findLatestMessageByConversationId(
            room.roomId,
          )
        : null;
      const unreadCount = await this.getGroupUnreadCount(
        userId,
        room.roomId,
        membership.lastReadAt ?? membership.joinedAt,
      );

      rooms.set(room.roomId, {
        roomId: room.roomId,
        roomType: 'GROUP',
        title: room.title,
        peerUserId: room.roomId,
        peerName: room.title,
        avatarUrl: room.avatarUrl,
        description: room.description,
        emoji: room.emoji,
        memberCount: room.memberCount,
        memberRole: membership.role,
        preview:
          room.lastMessagePreview ??
          latestMessage?.content ??
          'Bắt đầu cuộc trò chuyện',
        lastMessageAt: room.lastMessageAt ?? room.createdAt,
        unreadCount,
        isPeerOnline: false,
      });
    }
  }

  private async getGroupUnreadCount(
    userId: string,
    roomId: string,
    sinceIso: string,
  ): Promise<number> {
    const messages =
      await this.messagesRepository.findMessagesByConversationId(roomId);
    return messages.filter((message) => {
      if (message.senderId === userId || message.isDeleted) {
        return false;
      }

      return message.createdAt > sinceIso;
    }).length;
  }

  private async assertRoomMembership(
    userId: string,
    roomId: string,
  ): Promise<void> {
    if (roomId.includes(':')) {
      const [firstUserId, secondUserId, ...rest] = roomId.split(':');
      if (rest.length > 0 || !firstUserId || !secondUserId) {
        throw new BadRequestException('Phong chat khong hop le');
      }

      if (userId !== firstUserId && userId !== secondUserId) {
        throw new ForbiddenException('Ban khong co quyen xem phong chat nay');
      }

      return;
    }

    await this.assertGroupMembership(userId, roomId);
  }

  private async assertGroupMembership(
    userId: string,
    roomId: string,
  ): Promise<ChatGroupMemberEntity> {
    const member = await this.groupRoomsRepository.findMember(roomId, userId);
    if (!member) {
      throw new ForbiddenException('Ban khong co quyen xem phong nhom nay');
    }

    return member;
  }

  private async assertGroupAdmin(
    userId: string,
    roomId: string,
  ): Promise<ChatGroupMemberEntity> {
    const member = await this.assertGroupMembership(userId, roomId);
    if (member.role !== 'ADMIN') {
      throw new ForbiddenException('Chi admin moi co quyen thao tac');
    }

    return member;
  }

  private async getGroupRoom(roomId: string): Promise<ChatGroupRoomEntity> {
    const room = await this.groupRoomsRepository.findRoomById(roomId);
    if (!room) {
      throw new NotFoundException('Nhom khong ton tai');
    }

    return room;
  }

  private async buildGroupRoomDetails(
    actorUserId: string,
    roomId: string,
  ): Promise<GroupRoomDetails> {
    const room = await this.getGroupRoom(roomId);
    const members = await this.groupRoomsRepository.listMembers(roomId);
    const loadedUsers = await Promise.all(
      members.map((member) => this.usersRepository.findByUserId(member.userId)),
    );

    const memberSummaries = members
      .map((member, index): GroupRoomMemberSummary | null => {
        const user = loadedUsers[index];
        if (!user) return null;

        return {
          userId: user.userId,
          name: user.name,
          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
          role: member.role,
          ...(member.nickname ? { nickname: member.nickname } : {}),
          isOnline: this.presenceService.getPresence(user.userId).isOnline,
          joinedAt: member.joinedAt,
          ...(member.lastReadAt ? { lastReadAt: member.lastReadAt } : {}),
        };
      })
      .filter((item): item is GroupRoomMemberSummary => item !== null)
      .sort((first, second) => {
        if (first.role !== second.role) {
          return first.role === 'ADMIN' ? -1 : 1;
        }

        return first.joinedAt.localeCompare(second.joinedAt);
      });

    const currentUserMember = members.find(
      (member) => member.userId === actorUserId,
    );
    const currentUserRole = currentUserMember?.role;

    return {
      roomId: room.roomId,
      roomType: 'GROUP',
      title: room.title,
      description: room.description,
      avatarUrl: room.avatarUrl,
      emoji: room.emoji,
      createdByUserId: room.createdByUserId,
      inviteCode: room.inviteCode,
      inviteLink: `/chat/join/${room.inviteCode}`,
      memberCount: room.memberCount,
      pinnedMessageId: room.pinnedMessageId,
      lastMessageAt: room.lastMessageAt,
      lastMessagePreview: room.lastMessagePreview,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      members: memberSummaries,
      ...(currentUserRole ? { currentUserRole } : {}),
    };
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

  private toGroupCallLogContent(
    mode: 'voice' | 'video',
    outcome: CallLogOutcome,
    actorName?: string,
  ): string {
    const modeText = mode === 'video' ? 'video' : 'thoại';

    if (outcome === 'left') {
      return `${actorName ?? 'Một thành viên'} đã rời khỏi cuộc gọi nhóm ${modeText}`;
    }

    if (outcome === 'connected_ended') {
      return `Cuộc gọi nhóm ${modeText} kết thúc`;
    }

    return `Cuộc gọi nhóm ${modeText} bị hủy`;
  }

  private async createGroupSystemMessage(
    senderId: string,
    roomId: string,
    content: string,
  ): Promise<MessageEntity> {
    const now = new Date().toISOString();
    const messageId = randomUUID();

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${roomId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId: roomId,
      roomId,
      roomType: 'GROUP',
      senderId,
      receiverId: roomId,
      content,
      messageType: 'SYSTEM',
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    await this.groupRoomsRepository.updateRoomMeta(roomId, {
      lastMessageAt: now,
      lastMessagePreview: content,
    });

    return item;
  }

  private toPeerName(peerUserId: string): string {
    const segments = peerUserId.split(/[._-]+/).filter(Boolean);
    if (segments.length === 0) return 'User';

    return segments
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
