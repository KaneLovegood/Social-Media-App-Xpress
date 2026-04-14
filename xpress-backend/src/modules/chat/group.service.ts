import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PresenceService } from '../../common/presence/presence.service';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CreateGroupDto } from './dto/create-group.dto';
import {
  GroupDeleteMessageDto,
  GroupRecallMessageDto,
  GroupReplyMessageDto,
  GroupSendMessageDto,
  GroupTypingDto,
} from './dto/group-message.dto';
import {
  JoinGroupByInviteDto,
  ManageGroupMemberDto,
  PinGroupMessageDto,
  SetGroupNicknameDto,
} from './dto/manage-group-member.dto';
import {
  GroupEntity,
  GroupInviteCodeEntity,
  GroupInvitePointerEntity,
  GroupMemberEntity,
  GroupPinEntity,
} from './interfaces/group.interface';
import { MessageEntity } from './interfaces/message.interface';
import { GroupsRepository } from './repositories/groups.repository';
import { MessagesRepository } from './repositories/messages.repository';

interface GroupCallState {
  groupId: string;
  mode: 'voice' | 'video';
  state: 'ringing' | 'active' | 'ended';
  startedBy: string;
  startedAt: string;
  updatedAt: string;
}

interface UpdateGroupCallDto {
  groupId: string;
  mode: 'voice' | 'video';
  state: 'ringing' | 'active' | 'ended';
}

@Injectable()
export class GroupService {
  private readonly callStatesByGroup = new Map<string, GroupCallState>();

  constructor(
    private readonly groupsRepository: GroupsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly presenceService: PresenceService,
  ) {}

  async sendGroupMessage(actorUserId: string, dto: GroupSendMessageDto) {
    await this.ensureMember(dto.groupId, actorUserId);

    const now = new Date().toISOString();
    const messageId = randomUUID();
    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `GROUP_CONVERSATION#${dto.groupId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'GROUP_MESSAGE',
      messageId,
      conversationId: dto.groupId,
      senderId: actorUserId,
      receiverId: dto.groupId,
      content: dto.content,
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    return item;
  }

  async replyGroupMessage(actorUserId: string, dto: GroupReplyMessageDto) {
    await this.ensureMember(dto.groupId, actorUserId);

    const original = await this.messagesRepository.findByMessageId(
      dto.replyToMessageId,
    );
    if (!original || original.entityType !== 'GROUP_MESSAGE') {
      throw new NotFoundException('Tin nhan goc khong ton tai');
    }

    if (original.conversationId !== dto.groupId) {
      throw new BadRequestException('Khong the reply tin nhan khac nhom');
    }

    const now = new Date().toISOString();
    const messageId = randomUUID();
    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `GROUP_CONVERSATION#${dto.groupId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'GROUP_MESSAGE',
      messageId,
      conversationId: dto.groupId,
      senderId: actorUserId,
      receiverId: dto.groupId,
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

  async deleteGroupMessage(actorUserId: string, dto: GroupDeleteMessageDto) {
    await this.ensureMember(dto.groupId, actorUserId);

    const message = await this.messagesRepository.findByMessageId(
      dto.messageId,
    );
    if (!message || message.entityType !== 'GROUP_MESSAGE') {
      throw new NotFoundException('Tin nhan khong ton tai');
    }

    if (message.conversationId !== dto.groupId) {
      throw new BadRequestException('Tin nhan khong thuoc group nay');
    }

    if (message.senderId !== actorUserId) {
      throw new ForbiddenException('Ban chi co the xoa tin nhan cua minh');
    }

    await this.messagesRepository.softDeleteMessage(dto.messageId);
    return {
      ...message,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async recallGroupMessage(actorUserId: string, dto: GroupRecallMessageDto) {
    await this.ensureMember(dto.groupId, actorUserId);

    const message = await this.messagesRepository.findByMessageId(
      dto.messageId,
    );
    if (!message || message.entityType !== 'GROUP_MESSAGE') {
      throw new NotFoundException('Tin nhan khong ton tai');
    }

    if (message.conversationId !== dto.groupId) {
      throw new BadRequestException('Tin nhan khong thuoc group nay');
    }

    if (message.senderId !== actorUserId) {
      throw new ForbiddenException('Ban chi co the thu hoi tin nhan cua minh');
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

  async validateGroupTyping(actorUserId: string, dto: GroupTypingDto) {
    await this.ensureMember(dto.groupId, actorUserId);

    return {
      groupId: dto.groupId,
      eventPayload: {
        senderId: actorUserId,
        groupId: dto.groupId,
        isTyping: dto.isTyping,
      },
    };
  }

  async listGroupMessages(actorUserId: string, groupId: string) {
    await this.ensureMember(groupId, actorUserId);
    return this.messagesRepository.findMessagesByGroupId(groupId);
  }

  async createGroup(actorUserId: string, dto: CreateGroupDto) {
    const groupId = randomUUID();
    const now = new Date().toISOString();

    const group: GroupEntity = {
      PK: `GROUP#${groupId}`,
      SK: `GROUP#${groupId}`,
      entityType: 'GROUP',
      groupId,
      name: dto.name.trim(),
      avatarUrl: dto.avatarUrl,
      description: dto.description,
      emoji: dto.emoji,
      ownerUserId: actorUserId,
      version: 1,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const ownerMember: GroupMemberEntity = {
      PK: `GROUP#${groupId}`,
      SK: `MEMBER#${actorUserId}`,
      GSI1PK: `USER_GROUP#${actorUserId}`,
      GSI1SK: `${now}#GROUP#${groupId}`,
      entityType: 'GROUP_MEMBER',
      groupId,
      userId: actorUserId,
      role: 'ADMIN',
      joinedAt: now,
      updatedAt: now,
    };

    await this.groupsRepository.createGroup(group, ownerMember);

    return {
      groupId,
      name: group.name,
      avatarUrl: group.avatarUrl ?? null,
      description: group.description ?? null,
      emoji: group.emoji ?? null,
      memberCount: group.memberCount,
      role: ownerMember.role,
      createdAt: group.createdAt,
    };
  }

  async listGroups(actorUserId: string) {
    const memberships =
      await this.groupsRepository.listGroupsByUserId(actorUserId);
    if (memberships.length === 0) {
      return [];
    }

    const uniqueMemberships = Array.from(
      new Map(
        memberships.map((membership) => [membership.groupId, membership]),
      ).values(),
    );

    const groups = await Promise.all(
      uniqueMemberships.map((membership) =>
        this.groupsRepository.findGroupById(membership.groupId),
      ),
    );

    return uniqueMemberships
      .map((membership, index) => {
        const group = groups[index];
        if (!group) {
          return null;
        }

        return {
          groupId: group.groupId,
          name: group.name,
          avatarUrl: group.avatarUrl ?? null,
          description: group.description ?? null,
          emoji: group.emoji ?? null,
          memberCount: group.memberCount,
          role: membership.role,
          nickname: membership.nickname ?? null,
          updatedAt: group.updatedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getGroupDetail(actorUserId: string, groupId: string) {
    await this.ensureMember(groupId, actorUserId);

    const [group, members, pins] = await Promise.all([
      this.mustFindGroup(groupId),
      this.groupsRepository.listMembers(groupId),
      this.groupsRepository.listPins(groupId),
    ]);

    const users = await Promise.all(
      members.map((member) => this.usersRepository.findByUserId(member.userId)),
    );

    return {
      groupId: group.groupId,
      name: group.name,
      avatarUrl: group.avatarUrl ?? null,
      description: group.description ?? null,
      emoji: group.emoji ?? null,
      ownerUserId: group.ownerUserId,
      memberCount: group.memberCount,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: members.map((member, index) => {
        const user = users[index];
        const presence = this.presenceService.getPresence(member.userId);
        return {
          userId: member.userId,
          name: user?.name ?? member.userId,
          role: member.role,
          nickname: member.nickname ?? null,
          isOnline: presence.isOnline,
          lastSeenAt: presence.lastSeenAt,
          joinedAt: member.joinedAt,
        };
      }),
      pinnedMessages: pins.map((pin) => ({
        messageId: pin.messageId,
        pinnedBy: pin.pinnedBy,
        pinnedAt: pin.pinnedAt,
      })),
      callState: this.callStatesByGroup.get(group.groupId) ?? null,
    };
  }

  async addMember(
    actorUserId: string,
    groupId: string,
    dto: ManageGroupMemberDto,
  ) {
    await this.ensureAdmin(groupId, actorUserId);
    await this.ensureUserExists(dto.targetUserId);

    const existing = await this.groupsRepository.findMember(
      groupId,
      dto.targetUserId,
    );
    if (existing) {
      throw new BadRequestException('Nguoi dung da o trong nhom');
    }

    const group = await this.mustFindGroup(groupId);
    const now = new Date().toISOString();
    const member: GroupMemberEntity = {
      PK: `GROUP#${groupId}`,
      SK: `MEMBER#${dto.targetUserId}`,
      GSI1PK: `USER_GROUP#${dto.targetUserId}`,
      GSI1SK: `${now}#GROUP#${groupId}`,
      entityType: 'GROUP_MEMBER',
      groupId,
      userId: dto.targetUserId,
      role: 'MEMBER',
      joinedAt: now,
      updatedAt: now,
    };

    await this.groupsRepository.addMember(group, member);

    return {
      success: true,
      groupId,
      targetUserId: dto.targetUserId,
      role: member.role,
    };
  }

  async removeMember(
    actorUserId: string,
    groupId: string,
    dto: ManageGroupMemberDto,
  ) {
    await this.ensureAdmin(groupId, actorUserId);

    const target = await this.groupsRepository.findMember(
      groupId,
      dto.targetUserId,
    );
    if (!target) {
      throw new NotFoundException('Khong tim thay thanh vien trong nhom');
    }

    await this.ensureNotRemovingLastAdmin(groupId, dto.targetUserId);

    const group = await this.mustFindGroup(groupId);
    await this.groupsRepository.removeMember(group, dto.targetUserId);

    return {
      success: true,
      groupId,
      targetUserId: dto.targetUserId,
    };
  }

  async leaveGroup(actorUserId: string, groupId: string) {
    const membership = await this.ensureMember(groupId, actorUserId);
    if (membership.role === 'ADMIN') {
      await this.ensureNotRemovingLastAdmin(groupId, actorUserId);
    }

    const group = await this.mustFindGroup(groupId);
    await this.groupsRepository.removeMember(group, actorUserId);

    return {
      success: true,
      groupId,
      userId: actorUserId,
    };
  }

  async disbandGroup(actorUserId: string, groupId: string) {
    const group = await this.mustFindGroup(groupId);
    if (group.ownerUserId !== actorUserId) {
      throw new ForbiddenException('Chi chu nhom moi co the giai tan nhom');
    }

    const [members, pins, invitePointer] = await Promise.all([
      this.groupsRepository.listMembers(groupId),
      this.groupsRepository.listPins(groupId),
      this.groupsRepository.findInvitePointer(groupId),
    ]);

    await Promise.all([
      ...members.map((member) =>
        this.groupsRepository.deleteMemberRecord(groupId, member.userId),
      ),
      ...pins.map((pin) =>
        this.groupsRepository.unpinMessage(groupId, pin.messageId),
      ),
      invitePointer
        ? this.groupsRepository.deleteInviteCode(invitePointer.inviteCode)
        : Promise.resolve(),
      this.groupsRepository.deleteInvitePointer(groupId),
      this.groupsRepository.deleteGroupRecord(groupId),
    ]);

    this.callStatesByGroup.delete(groupId);

    return {
      success: true,
      groupId,
    };
  }

  async promoteMember(
    actorUserId: string,
    groupId: string,
    dto: ManageGroupMemberDto,
  ) {
    await this.ensureAdmin(groupId, actorUserId);

    const membership = await this.groupsRepository.findMember(
      groupId,
      dto.targetUserId,
    );
    if (!membership) {
      throw new NotFoundException('Khong tim thay thanh vien trong nhom');
    }

    if (membership.role === 'ADMIN') {
      return {
        success: true,
        groupId,
        targetUserId: dto.targetUserId,
        role: membership.role,
      };
    }

    await this.groupsRepository.updateMemberRole(
      groupId,
      dto.targetUserId,
      'ADMIN',
    );

    return {
      success: true,
      groupId,
      targetUserId: dto.targetUserId,
      role: 'ADMIN' as const,
    };
  }

  async createInviteLink(actorUserId: string, groupId: string) {
    await this.ensureAdmin(groupId, actorUserId);
    await this.mustFindGroup(groupId);

    const existingPointer =
      await this.groupsRepository.findInvitePointer(groupId);
    const now = new Date().toISOString();
    const inviteCode = this.createInviteCode();

    const pointer: GroupInvitePointerEntity = {
      PK: `GROUP#${groupId}`,
      SK: 'INVITE#ACTIVE',
      entityType: 'GROUP_INVITE_POINTER',
      groupId,
      inviteCode,
      createdBy: actorUserId,
      createdAt: existingPointer?.createdAt ?? now,
      updatedAt: now,
    };

    const codeEntity: GroupInviteCodeEntity = {
      PK: `INVITE#${inviteCode}`,
      SK: `INVITE#${inviteCode}`,
      entityType: 'GROUP_INVITE_CODE',
      groupId,
      inviteCode,
      createdBy: actorUserId,
      createdAt: now,
    };

    await this.groupsRepository.saveInvite(
      pointer,
      codeEntity,
      existingPointer?.inviteCode,
    );

    const baseUrl =
      process.env.GROUP_INVITE_BASE_URL ?? 'https://xpress.local/groups/join';

    return {
      groupId,
      inviteCode,
      inviteLink: `${baseUrl}/${inviteCode}`,
      updatedAt: now,
    };
  }

  async joinByInvite(actorUserId: string, dto: JoinGroupByInviteDto) {
    const inviteCode = dto.inviteCode.trim();
    const invite = await this.groupsRepository.findInviteByCode(inviteCode);

    if (!invite) {
      throw new NotFoundException('Invite code khong hop le');
    }

    const existing = await this.groupsRepository.findMember(
      invite.groupId,
      actorUserId,
    );
    if (existing) {
      return {
        success: true,
        groupId: invite.groupId,
        role: existing.role,
      };
    }

    const group = await this.mustFindGroup(invite.groupId);
    const now = new Date().toISOString();
    const member: GroupMemberEntity = {
      PK: `GROUP#${invite.groupId}`,
      SK: `MEMBER#${actorUserId}`,
      GSI1PK: `USER_GROUP#${actorUserId}`,
      GSI1SK: `${now}#GROUP#${invite.groupId}`,
      entityType: 'GROUP_MEMBER',
      groupId: invite.groupId,
      userId: actorUserId,
      role: 'MEMBER',
      joinedAt: now,
      updatedAt: now,
    };

    await this.groupsRepository.addMember(group, member);

    return {
      success: true,
      groupId: invite.groupId,
      role: member.role,
    };
  }

  async setNickname(
    actorUserId: string,
    groupId: string,
    dto: SetGroupNicknameDto,
  ) {
    await this.ensureMember(groupId, actorUserId);
    await this.groupsRepository.updateMemberNickname(
      groupId,
      actorUserId,
      dto.nickname?.trim() || undefined,
    );

    return {
      success: true,
      groupId,
      userId: actorUserId,
      nickname: dto.nickname?.trim() || null,
    };
  }

  async pinMessage(
    actorUserId: string,
    groupId: string,
    dto: PinGroupMessageDto,
  ) {
    await this.ensureAdmin(groupId, actorUserId);

    const item: GroupPinEntity = {
      PK: `GROUP#${groupId}`,
      SK: `PIN#${dto.messageId}`,
      entityType: 'GROUP_PIN',
      groupId,
      messageId: dto.messageId,
      pinnedBy: actorUserId,
      pinnedAt: new Date().toISOString(),
    };

    await this.groupsRepository.pinMessage(item);

    return {
      success: true,
      groupId,
      messageId: dto.messageId,
      pinnedBy: actorUserId,
      pinnedAt: item.pinnedAt,
    };
  }

  async unpinMessage(actorUserId: string, groupId: string, messageId: string) {
    await this.ensureAdmin(groupId, actorUserId);
    await this.groupsRepository.unpinMessage(groupId, messageId);

    return {
      success: true,
      groupId,
      messageId,
    };
  }

  async updateCallState(actorUserId: string, payload: UpdateGroupCallDto) {
    await this.ensureMember(payload.groupId, actorUserId);

    const now = new Date().toISOString();
    const existing = this.callStatesByGroup.get(payload.groupId);

    const next: GroupCallState = {
      groupId: payload.groupId,
      mode: payload.mode,
      state: payload.state,
      startedBy: existing?.startedBy ?? actorUserId,
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
    };

    if (payload.state === 'ended') {
      this.callStatesByGroup.delete(payload.groupId);
    } else {
      this.callStatesByGroup.set(payload.groupId, next);
    }

    return {
      ...next,
      actorUserId,
    };
  }

  async ensureMember(groupId: string, actorUserId: string) {
    const membership = await this.groupsRepository.findMember(
      groupId,
      actorUserId,
    );
    if (!membership) {
      throw new ForbiddenException('Ban khong thuoc group nay');
    }

    return membership;
  }

  async listGroupIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.groupsRepository.listGroupsByUserId(userId);
    return memberships.map((item) => item.groupId);
  }

  private async ensureAdmin(
    groupId: string,
    actorUserId: string,
  ): Promise<void> {
    const membership = await this.ensureMember(groupId, actorUserId);
    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Chi admin moi duoc phep thuc hien hanh dong nay',
      );
    }
  }

  private async ensureNotRemovingLastAdmin(
    groupId: string,
    targetUserId: string,
  ): Promise<void> {
    const members = await this.groupsRepository.listMembers(groupId);
    const admins = members.filter((member) => member.role === 'ADMIN');

    const isRemovingAdmin = admins.some(
      (admin) => admin.userId === targetUserId,
    );
    if (isRemovingAdmin && admins.length <= 1) {
      throw new BadRequestException(
        'Khong the xoa hoac roi group khi chi con 1 admin',
      );
    }
  }

  private async mustFindGroup(groupId: string): Promise<GroupEntity> {
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group khong ton tai');
    }

    return group;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai');
    }
  }

  private createInviteCode(): string {
    return randomBytes(8).toString('base64url');
  }
}
