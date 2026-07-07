import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import {
  ChatGroupMemberEntity,
  ChatGroupRoomEntity,
  GroupMemberRole,
} from '../interfaces/group-room.interface';

export interface GroupMemberWithRoom extends ChatGroupMemberEntity {
  room: ChatGroupRoomEntity;
}

@Injectable()
export class GroupRoomsRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async createGroupRoom(input: {
    title: string;
    description?: string;
    avatarUrl?: string;
    emoji?: string;
    createdByUserId: string;
  }): Promise<ChatGroupRoomEntity> {
    const now = new Date().toISOString();
    const roomId = randomUUID();
    const inviteCode = randomUUID().replace(/-/g, '').slice(0, 12);

    const room: ChatGroupRoomEntity = {
      PK: `ROOM#${roomId}`,
      SK: `META#${roomId}`,
      entityType: 'CHAT_GROUP_ROOM',
      roomId,
      roomType: 'GROUP',
      title: input.title,
      description: input.description,
      avatarUrl: input.avatarUrl,
      emoji: input.emoji,
      createdByUserId: input.createdByUserId,
      inviteCode,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const creator: ChatGroupMemberEntity = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${input.createdByUserId}`,
      entityType: 'CHAT_GROUP_MEMBER',
      roomId,
      userId: input.createdByUserId,
      role: 'ADMIN',
      joinedAt: now,
      updatedAt: now,
      lastReadAt: now,
    };

    await this.itemModel.insertMany([room, creator], { ordered: true });

    return room;
  }

  async findRoomById(roomId: string): Promise<ChatGroupRoomEntity | null> {
    return this.itemModel
      .findOne({
        PK: `ROOM#${roomId}`,
        SK: `META#${roomId}`,
      })
      .select('-_id')
      .lean<ChatGroupRoomEntity>()
      .exec();
  }

  async findRoomByInviteCode(
    inviteCode: string,
  ): Promise<ChatGroupRoomEntity | null> {
    return this.itemModel
      .findOne({
        entityType: 'CHAT_GROUP_ROOM',
        inviteCode,
      })
      .select('-_id')
      .lean<ChatGroupRoomEntity>()
      .exec();
  }

  async ensureInviteCode(roomId: string): Promise<ChatGroupRoomEntity> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (room.inviteCode) {
      return room;
    }

    const inviteCode = randomUUID().replace(/-/g, '').slice(0, 12);
    const updated = await this.itemModel
      .findOneAndUpdate(
        {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
        {
          $set: {
            inviteCode,
            updatedAt: new Date().toISOString(),
          },
        },
        { new: true, projection: { _id: 0 } },
      )
      .lean<ChatGroupRoomEntity>()
      .exec();

    return updated ?? { ...room, inviteCode };
  }

  async updateRoomMeta(
    roomId: string,
    updates: Partial<
      Pick<
        ChatGroupRoomEntity,
        | 'title'
        | 'description'
        | 'avatarUrl'
        | 'emoji'
        | 'lastMessageAt'
        | 'lastMessagePreview'
        | 'pinnedMessageId'
      >
    >,
  ): Promise<ChatGroupRoomEntity | null> {
    const set: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    for (const key of [
      'title',
      'description',
      'avatarUrl',
      'emoji',
      'lastMessageAt',
      'lastMessagePreview',
      'pinnedMessageId',
    ] as const) {
      if (updates[key] !== undefined) {
        set[key] = updates[key];
      }
    }

    if (Object.keys(set).length === 1) {
      return this.findRoomById(roomId);
    }

    return this.itemModel
      .findOneAndUpdate(
        {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
        { $set: set },
        { new: true, projection: { _id: 0 } },
      )
      .lean<ChatGroupRoomEntity>()
      .exec();
  }

  async listRoomsForUser(userId: string): Promise<GroupMemberWithRoom[]> {
    const members = await this.itemModel
      .find({
        entityType: 'CHAT_GROUP_MEMBER',
        userId,
      })
      .sort({ updatedAt: -1 })
      .select('-_id')
      .lean<ChatGroupMemberEntity[]>()
      .exec();

    const loaded = await Promise.all(
      members.map(async (member) => {
        const room = await this.findRoomById(member.roomId);
        if (!room) return null;
        return { ...member, room };
      }),
    );

    return loaded.filter((item): item is GroupMemberWithRoom => item != null);
  }

  async listMembers(roomId: string): Promise<ChatGroupMemberEntity[]> {
    return this.itemModel
      .find({
        PK: `ROOM#${roomId}`,
        SK: { $regex: '^MEMBER#' },
        entityType: 'CHAT_GROUP_MEMBER',
      })
      .sort({ joinedAt: 1 })
      .select('-_id')
      .lean<ChatGroupMemberEntity[]>()
      .exec();
  }

  async findMember(
    roomId: string,
    userId: string,
  ): Promise<ChatGroupMemberEntity | null> {
    return this.itemModel
      .findOne({
        PK: `ROOM#${roomId}`,
        SK: `MEMBER#${userId}`,
      })
      .select('-_id')
      .lean<ChatGroupMemberEntity>()
      .exec();
  }

  async addMember(
    roomId: string,
    userId: string,
    role: GroupMemberRole = 'MEMBER',
  ): Promise<ChatGroupMemberEntity> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const existing = await this.findMember(roomId, userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const member: ChatGroupMemberEntity = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${userId}`,
      entityType: 'CHAT_GROUP_MEMBER',
      roomId,
      userId,
      role,
      joinedAt: now,
      updatedAt: now,
      lastReadAt: now,
    };

    try {
      await this.itemModel.create(member);
    } catch (error) {
      const duplicate =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === 11000;
      if (duplicate) {
        const current = await this.findMember(roomId, userId);
        if (current) return current;
      }
      throw error;
    }

    await this.itemModel
      .updateOne(
        {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
        {
          $inc: { memberCount: 1 },
          $set: { updatedAt: now },
        },
      )
      .exec();

    return member;
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.itemModel
      .deleteOne({
        PK: `ROOM#${roomId}`,
        SK: `MEMBER#${userId}`,
      })
      .exec();

    if (result.deletedCount > 0) {
      await this.itemModel
        .updateOne(
          {
            PK: `ROOM#${roomId}`,
            SK: `META#${roomId}`,
          },
          {
            $inc: { memberCount: -1 },
            $set: { updatedAt: now },
          },
        )
        .exec();
    }
  }

  async promoteMember(
    roomId: string,
    userId: string,
  ): Promise<ChatGroupMemberEntity> {
    const current = await this.findMember(roomId, userId);
    if (!current) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const updated = await this.itemModel
      .findOneAndUpdate(
        {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        {
          $set: {
            role: 'ADMIN',
            updatedAt: new Date().toISOString(),
          },
        },
        { new: true, projection: { _id: 0 } },
      )
      .lean<ChatGroupMemberEntity>()
      .exec();

    return updated ?? current;
  }

  async transferAdminRole(
    roomId: string,
    fromUserId: string,
    toUserId: string,
  ): Promise<void> {
    const [fromMember, toMember] = await Promise.all([
      this.findMember(roomId, fromUserId),
      this.findMember(roomId, toUserId),
    ]);

    if (!fromMember || !toMember) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    await Promise.all([
      this.itemModel
        .updateOne(
          { PK: `ROOM#${roomId}`, SK: `MEMBER#${fromUserId}` },
          { $set: { role: 'MEMBER', updatedAt: now } },
        )
        .exec(),
      this.itemModel
        .updateOne(
          { PK: `ROOM#${roomId}`, SK: `MEMBER#${toUserId}` },
          { $set: { role: 'ADMIN', updatedAt: now } },
        )
        .exec(),
      this.itemModel
        .updateOne(
          { PK: `ROOM#${roomId}`, SK: `META#${roomId}` },
          { $set: { updatedAt: now } },
        )
        .exec(),
    ]);
  }

  async setMemberNickname(
    roomId: string,
    userId: string,
    nickname: string | null,
  ): Promise<ChatGroupMemberEntity | null> {
    const now = new Date().toISOString();
    const update =
      nickname === null
        ? { $unset: { nickname: '' }, $set: { updatedAt: now } }
        : { $set: { nickname, updatedAt: now } };

    return this.itemModel
      .findOneAndUpdate(
        {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        update,
        { new: true, projection: { _id: 0 } },
      )
      .lean<ChatGroupMemberEntity>()
      .exec();
  }

  async markMemberRead(roomId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.itemModel
      .updateOne(
        {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        {
          $set: {
            lastReadAt: now,
            updatedAt: now,
          },
        },
      )
      .exec();
  }

  async deleteGroupRoom(roomId: string): Promise<string[]> {
    const members = await this.listMembers(roomId);
    const memberUserIds = members.map((member) => member.userId);

    await this.itemModel
      .deleteMany({
        PK: `ROOM#${roomId}`,
        $or: [{ SK: `META#${roomId}` }, { SK: { $regex: '^MEMBER#' } }],
      })
      .exec();

    return memberUserIds;
  }
}

