import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import { SessionEntity } from '../interfaces/session.interface';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async createSession(session: SessionEntity): Promise<void> {
    await this.itemModel.create(session);
  }

  async findSessionById(
    userId: string,
    sessionId: string,
  ): Promise<SessionEntity | null> {
    return this.itemModel
      .findOne({ PK: `USER#${userId}`, SK: `SESSION#${sessionId}` })
      .select('-_id')
      .lean<SessionEntity>()
      .exec();
  }

  async findActiveSessionByFingerprint(
    userId: string,
    deviceFingerprintHash: string,
  ): Promise<SessionEntity | null> {
    return this.itemModel
      .findOne({
        PK: `USER#${userId}`,
        SK: { $regex: '^SESSION#' },
        entityType: 'SESSION',
        deviceFingerprintHash,
        status: 'ACTIVE',
      })
      .select('-_id')
      .lean<SessionEntity>()
      .exec();
  }

  async findActiveSessions(userId: string): Promise<SessionEntity[]> {
    return this.itemModel
      .find({
        PK: `USER#${userId}`,
        SK: { $regex: '^SESSION#' },
        entityType: 'SESSION',
        status: 'ACTIVE',
      })
      .sort({ lastSeenAt: -1 })
      .select('-_id')
      .lean<SessionEntity[]>()
      .exec();
  }

  async updateSessionRefreshToken(
    userId: string,
    sessionId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: string,
    authProvider?: SessionEntity['authProvider'],
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
        {
          $set: {
            refreshTokenHash,
            refreshTokenExpiresAt,
            lastSeenAt: now,
            updatedAt: now,
            ...(authProvider == null ? {} : { authProvider }),
          },
        },
      )
      .exec();
  }

  async deactivateSession(userId: string, sessionId: string): Promise<void> {
    await this.itemModel
      .updateOne(
        { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
        {
          $set: {
            status: 'INACTIVE',
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async deactivateAllSessions(userId: string): Promise<void> {
    await this.itemModel
      .updateMany(
        {
          PK: `USER#${userId}`,
          SK: { $regex: '^SESSION#' },
          entityType: 'SESSION',
          status: 'ACTIVE',
        },
        {
          $set: {
            status: 'INACTIVE',
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }
}

