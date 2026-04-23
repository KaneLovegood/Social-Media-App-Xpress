import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserDeviceSession,
  UserDeviceSessionDocument,
} from './schemas/user-device-session.schema';
import { DeviceSessionGateway } from './device-session.gateway';

export interface BindDeviceInput {
  userId: string;
  deviceId: string;
  sessionId: string;
  platform?: string;
  deviceName?: string;
}

export interface BindDeviceResult {
  replacedPreviousDevice: boolean;
  previousDeviceId: string | null;
}

/**
 * Single-device-session enforcement backed by MongoDB.
 *
 * Flow on login:
 *   1. bindDevice(userId, deviceId, sessionId) upserts the row.
 *   2. If the previous currentDeviceId differs from the new one we emit
 *      FORCE_LOGOUT to the old socket (if it is still connected). When the
 *      old device is backgrounded/disconnected, the socket emit is a no-op
 *      but the next API call will fail JwtStrategy.validate() because the
 *      JWT's sid no longer matches currentSessionId.
 *
 * Flow on API call (JwtStrategy):
 *   - isSessionValid(userId, sessionId) returns false when the token's sid
 *     no longer matches the currently-bound session → 401 Unauthorized.
 */
@Injectable()
export class DeviceSessionService {
  private readonly logger = new Logger(DeviceSessionService.name);

  constructor(
    @InjectModel(UserDeviceSession.name)
    private readonly sessionModel: Model<UserDeviceSessionDocument>,
    @Inject(forwardRef(() => DeviceSessionGateway))
    private readonly gateway: DeviceSessionGateway,
  ) {}

  async bindDevice(input: BindDeviceInput): Promise<BindDeviceResult> {
    const existing = await this.sessionModel.findOne({ userId: input.userId });

    const previousDeviceId = existing?.currentDeviceId ?? null;
    const previousSocketId = existing?.currentSocketId ?? null;
    const replacedPreviousDevice =
      previousDeviceId !== null && previousDeviceId !== input.deviceId;

    await this.sessionModel.updateOne(
      { userId: input.userId },
      {
        $set: {
          userId: input.userId,
          currentDeviceId: input.deviceId,
          currentSessionId: input.sessionId,
          platform: input.platform ?? null,
          deviceName: input.deviceName ?? null,
          currentSocketId: null,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true },
    );

    if (replacedPreviousDevice && previousSocketId) {
      this.gateway.forceLogout(previousSocketId, {
        reason: 'NEW_DEVICE_LOGIN',
        newDeviceId: input.deviceId,
        newDeviceName: input.deviceName,
        at: new Date().toISOString(),
      });
      this.logger.log(
        `Force-logout emitted to socket ${previousSocketId} for user ${input.userId}`,
      );
    }

    return { replacedPreviousDevice, previousDeviceId };
  }

  async isSessionValid(userId: string, sessionId: string): Promise<boolean> {
    const row = await this.sessionModel
      .findOne({ userId })
      .select({ currentSessionId: 1 })
      .lean();
    if (!row) {
      return false;
    }
    return row.currentSessionId === sessionId;
  }

  async getBinding(userId: string): Promise<UserDeviceSession | null> {
    const row = await this.sessionModel.findOne({ userId }).lean();
    return row ?? null;
  }

  async registerSocket(
    userId: string,
    sessionId: string,
    socketId: string,
  ): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { userId, currentSessionId: sessionId },
      { $set: { currentSocketId: socketId, lastSeenAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async clearSocket(userId: string, socketId: string): Promise<void> {
    await this.sessionModel.updateOne(
      { userId, currentSocketId: socketId },
      { $set: { currentSocketId: null } },
    );
  }

  async revokeSession(userId: string): Promise<void> {
    const existing = await this.sessionModel.findOne({ userId });
    if (!existing) {
      return;
    }
    if (existing.currentSocketId) {
      this.gateway.forceLogout(existing.currentSocketId, {
        reason: 'SESSION_REVOKED',
        at: new Date().toISOString(),
      });
    }
    await this.sessionModel.deleteOne({ userId });
  }
}
