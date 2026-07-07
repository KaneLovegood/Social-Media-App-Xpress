import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  decodeOffsetCursor,
  nextOffsetCursor,
} from '../../../common/mongodb/mongo-repository.utils';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import {
  BlockEntity,
  FriendEntity,
  FriendStatus,
} from '../interfaces/social.interface';

@Injectable()
export class SocialRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async getFriend(
    ownerUserId: string,
    targetUserId: string,
  ): Promise<FriendEntity | null> {
    return this.itemModel
      .findOne({
        PK: `USER#${ownerUserId}`,
        SK: `FRIEND#${targetUserId}`,
      })
      .select('-_id')
      .lean<FriendEntity>()
      .exec();
  }

  async saveFriendPair(
    actorUserId: string,
    targetUserId: string,
    actorStatus: FriendStatus,
    targetStatus: FriendStatus,
  ): Promise<void> {
    const now = new Date().toISOString();
    const actorFriend = await this.getFriend(actorUserId, targetUserId);
    const targetFriend = await this.getFriend(targetUserId, actorUserId);

    const actorItem: FriendEntity = {
      PK: `USER#${actorUserId}`,
      SK: `FRIEND#${targetUserId}`,
      entityType: 'FRIEND',
      ownerUserId: actorUserId,
      targetUserId,
      status: actorStatus,
      createdAt: actorFriend?.createdAt ?? now,
      updatedAt: now,
    };

    const targetItem: FriendEntity = {
      PK: `USER#${targetUserId}`,
      SK: `FRIEND#${actorUserId}`,
      entityType: 'FRIEND',
      ownerUserId: targetUserId,
      targetUserId: actorUserId,
      status: targetStatus,
      createdAt: targetFriend?.createdAt ?? now,
      updatedAt: now,
    };

    await Promise.all([
      this.itemModel
        .replaceOne({ PK: actorItem.PK, SK: actorItem.SK }, actorItem, {
          upsert: true,
        })
        .exec(),
      this.itemModel
        .replaceOne({ PK: targetItem.PK, SK: targetItem.SK }, targetItem, {
          upsert: true,
        })
        .exec(),
    ]);
  }

  async removeFriendPair(userAId: string, userBId: string): Promise<void> {
    await this.itemModel
      .deleteMany({
        $or: [
          { PK: `USER#${userAId}`, SK: `FRIEND#${userBId}` },
          { PK: `USER#${userBId}`, SK: `FRIEND#${userAId}` },
        ],
      })
      .exec();
  }

  async listFriendsByStatus(
    ownerUserId: string,
    status: FriendStatus,
    limit = 20,
    cursor?: string,
  ): Promise<{ items: FriendEntity[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(cursor);
    const items = await this.itemModel
      .find({
        PK: `USER#${ownerUserId}`,
        SK: { $regex: '^FRIEND#' },
        entityType: 'FRIEND',
        status,
      })
      .sort({ updatedAt: -1, targetUserId: 1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<FriendEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async listBlockedUsers(
    ownerUserId: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ items: BlockEntity[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(cursor);
    const items = await this.itemModel
      .find({
        PK: `USER#${ownerUserId}`,
        SK: { $regex: '^BLOCK#' },
        entityType: 'BLOCK',
      })
      .sort({ createdAt: -1, targetUserId: 1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<BlockEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async setBlocked(ownerUserId: string, targetUserId: string): Promise<void> {
    const block: BlockEntity = {
      PK: `USER#${ownerUserId}`,
      SK: `BLOCK#${targetUserId}`,
      entityType: 'BLOCK',
      ownerUserId,
      targetUserId,
      createdAt: new Date().toISOString(),
    };

    await this.itemModel
      .replaceOne({ PK: block.PK, SK: block.SK }, block, { upsert: true })
      .exec();
  }

  async unblock(ownerUserId: string, targetUserId: string): Promise<void> {
    await this.itemModel
      .deleteOne({
        PK: `USER#${ownerUserId}`,
        SK: `BLOCK#${targetUserId}`,
      })
      .exec();
  }

  async isBlocked(ownerUserId: string, targetUserId: string): Promise<boolean> {
    const item = await this.itemModel
      .exists({
        PK: `USER#${ownerUserId}`,
        SK: `BLOCK#${targetUserId}`,
      })
      .exec();

    return Boolean(item);
  }

  async isEitherBlocked(userAId: string, userBId: string): Promise<boolean> {
    const [a, b] = await Promise.all([
      this.isBlocked(userAId, userBId),
      this.isBlocked(userBId, userAId),
    ]);

    return a || b;
  }
}

