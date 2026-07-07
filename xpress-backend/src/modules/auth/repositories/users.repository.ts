import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  decodeOffsetCursor,
  escapeRegex,
  nextOffsetCursor,
} from '../../../common/mongodb/mongo-repository.utils';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import { UserEntity } from '../interfaces/user.interface';

interface PaginatedUsers {
  items: UserEntity[];
  nextCursor: string | null;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const normalizedEmail = this.normalizeEmail(email);

    return this.itemModel
      .findOne({
        entityType: 'USER',
        GSI1PK: `EMAIL#${normalizedEmail}`,
      })
      .select('-_id')
      .lean<UserEntity>()
      .exec();
  }

  async createUser(user: UserEntity): Promise<void> {
    await this.itemModel.create(user);
  }

  async findByUserId(userId: string): Promise<UserEntity | null> {
    return this.itemModel
      .findOne({
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
      })
      .select('-_id')
      .lean<UserEntity>()
      .exec();
  }

  async searchByEmail(
    actorUserId: string,
    emailQuery: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedUsers> {
    const offset = decodeOffsetCursor(cursor);
    const normalized = this.normalizeEmail(emailQuery);
    const items = await this.itemModel
      .find({
        entityType: 'USER',
        userId: { $ne: actorUserId },
        email: { $regex: escapeRegex(normalized), $options: 'i' },
      })
      .sort({ createdAt: -1, userId: 1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<UserEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async searchUsers(
    actorUserId: string,
    searchQuery: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedUsers> {
    const offset = decodeOffsetCursor(cursor);
    const trimmedQuery = searchQuery.trim();
    const escapedQuery = escapeRegex(trimmedQuery);

    const items = await this.itemModel
      .find({
        entityType: 'USER',
        userId: { $ne: actorUserId },
        $or: [
          { name: { $regex: escapedQuery, $options: 'i' } },
          { email: { $regex: escapedQuery, $options: 'i' } },
          { userId: trimmedQuery },
        ],
      })
      .sort({ createdAt: -1, userId: 1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<UserEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async updateRefreshToken(
    userId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: string,
  ): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $set: {
            refreshTokenHash,
            refreshTokenExpiresAt,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $unset: {
            refreshTokenHash: '',
            refreshTokenExpiresAt: '',
          },
          $set: {
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $set: {
            passwordHash,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $set: {
            avatarUrl,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async updateProfile(
    userId: string,
    profile: { name: string },
  ): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $set: {
            name: profile.name,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async updateTwoFactorEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `PROFILE#${userId}` },
        {
          $set: {
            twoFactorEnabled: enabled,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  normalizeEmail(email: string): string {
    return email.replace(/\s+/g, '').trim().toLowerCase();
  }
}

