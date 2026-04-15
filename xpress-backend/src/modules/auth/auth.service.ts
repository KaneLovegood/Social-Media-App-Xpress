import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionGateway } from './auth-session.gateway';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionEntity } from './interfaces/session.interface';
import { UsersRepository } from './repositories/users.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserEntity } from './interfaces/user.interface';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
  type?: 'refresh' | 'access';
  exp?: number;
}

interface SessionClientContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn = '10m';
  private readonly refreshTokenExpiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
  private readonly refreshTokenSecret =
    process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? '';

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly authSessionGateway: AuthSessionGateway,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, context: SessionClientContext = {}) {
    const existed = await this.usersRepository.findByEmail(dto.email);
    if (existed) throw new ConflictException('Email đã tồn tại');

    const userId = randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = this.usersRepository.normalizeEmail(dto.email);
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user: UserEntity = {
      PK: `USER#${userId}`,
      SK: `PROFILE#${userId}`,
      GSI1PK: `EMAIL#${normalizedEmail}`,
      GSI1SK: `USER#${userId}`,
      entityType: 'USER',
      userId,
      name: dto.name,
      email: normalizedEmail,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.usersRepository.createUser(user);

    return this.buildAuthResponse(user, {
      deviceId: `register-${randomUUID()}`,
      deviceName: 'Thiết bị đăng ký',
      timezone: 'UTC',
      ipAddress: context.ipAddress ?? '',
      userAgent: context.userAgent ?? '',
    });
  }

  async login(dto: LoginDto, context: SessionClientContext = {}) {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    return this.buildAuthResponse(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      timezone: dto.timezone,
      ipAddress: context.ipAddress ?? '',
      userAgent: context.userAgent ?? '',
    });
  }

  async refresh(dto: RefreshTokenDto) {
    if (!this.refreshTokenSecret) {
      throw new UnauthorizedException('Refresh token chưa được cấu hình');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.refreshTokenSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token không đúng loại');
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Token session không hợp lệ');
    }

    const user = await this.usersRepository.findByUserId(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const session = await this.sessionRepository.findSessionById(
      payload.sub,
      payload.sid,
    );
    if (!session || session.status !== 'ACTIVE' || !session.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const matched = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );
    if (!matched) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    return this.buildAuthResponseFromSession(user, session);
  }

  async logout(dto: RefreshTokenDto) {
    if (!this.refreshTokenSecret) {
      throw new UnauthorizedException('Refresh token chưa được cấu hình');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.refreshTokenSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Token session không hợp lệ');
    }

    await this.sessionRepository.deactivateSession(payload.sub, payload.sid);
    this.authSessionGateway.notifySessionRevoked(payload.sub, {
      sessionId: payload.sid,
      revokedAt: new Date().toISOString(),
    });

    return { success: true };
  }

  async listUserSessions(userId: string, currentSessionId: string) {
    const sessions = await this.sessionRepository.findActiveSessions(userId);
    const sortedSessions = [...sessions].sort((a, b) =>
      b.lastSeenAt.localeCompare(a.lastSeenAt),
    );

    return {
      items: sortedSessions.map((session) => ({
        sessionId: session.sessionId,
        deviceName: session.deviceName ?? 'Thiết bị không xác định',
        ipAddress: session.ipAddress ?? '',
        userAgent: session.userAgent ?? '',
        timezone: session.timezone ?? '',
        lastSeenAt: session.lastSeenAt,
        createdAt: session.createdAt,
        isCurrent: session.sessionId === currentSessionId,
      })),
    };
  }

  async revokeSession(
    userId: string,
    targetSessionId: string,
    currentSessionId: string,
  ) {
    const targetSession = await this.sessionRepository.findSessionById(
      userId,
      targetSessionId,
    );
    if (!targetSession || targetSession.status !== 'ACTIVE') {
      throw new ForbiddenException('Phiên đăng nhập không tồn tại');
    }

    await this.sessionRepository.deactivateSession(userId, targetSessionId);
    this.authSessionGateway.notifySessionRevoked(userId, {
      sessionId: targetSessionId,
      revokedAt: new Date().toISOString(),
    });

    return {
      success: true,
      revokedSessionId: targetSessionId,
      isCurrentSession: targetSessionId === currentSessionId,
    };
  }

  private async buildAuthResponse(
    user: UserEntity,
    sessionContext: {
      deviceId: string;
      deviceName?: string;
      timezone?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const deviceFingerprintHash = this.hashDeviceFingerprint(
      sessionContext.deviceId,
    );
    const activeSessions = await this.sessionRepository.findActiveSessions(
      user.userId,
    );
    const existingSession =
      await this.sessionRepository.findActiveSessionByFingerprint(
        user.userId,
        deviceFingerprintHash,
      );

    const now = new Date().toISOString();
    const sessionId = existingSession?.sessionId ?? randomUUID();
    const session: SessionEntity = existingSession ?? {
      PK: `USER#${user.userId}`,
      SK: `SESSION#${sessionId}`,
      entityType: 'SESSION',
      userId: user.userId,
      sessionId,
      status: 'ACTIVE',
      refreshTokenHash: '',
      refreshTokenExpiresAt: now,
      deviceFingerprintHash,
      deviceName: sessionContext.deviceName,
      userAgent: sessionContext.userAgent,
      ipAddress: sessionContext.ipAddress,
      timezone: sessionContext.timezone,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };

    const response = await this.buildAuthResponseFromSession(user, session);

    const isNewDeviceLogin = !existingSession;
    if (isNewDeviceLogin && activeSessions.length > 0) {
      this.authSessionGateway.notifyNewLogin(user.userId, {
        sessionId,
        deviceName: sessionContext.deviceName,
        ipAddress: sessionContext.ipAddress,
        loggedInAt: now,
      });
    }

    return response;
  }

  private async buildAuthResponseFromSession(
    user: UserEntity,
    session: SessionEntity,
  ) {
    const payload: JwtPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
      sid: session.sessionId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    if (!this.refreshTokenSecret) {
      throw new UnauthorizedException('Refresh token chưa được cấu hình');
    }

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiresIn as never,
      },
    );

    const decodedRefreshUnknown: unknown = this.jwtService.decode(refreshToken);
    const decodedRefresh =
      decodedRefreshUnknown !== null && typeof decodedRefreshUnknown === 'object'
        ? (decodedRefreshUnknown as { exp?: number })
        : null;
    const refreshTokenExpiresAt =
      decodedRefresh?.exp != null
        ? new Date(decodedRefresh.exp * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, rounds);
    await this.upsertSession({
      ...session,
      refreshTokenHash,
      refreshTokenExpiresAt,
      status: 'ACTIVE',
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      session: {
        sessionId: session.sessionId,
        deviceName: session.deviceName ?? 'Thiết bị không xác định',
      },
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  private async upsertSession(session: SessionEntity): Promise<void> {
    const existed = await this.sessionRepository.findSessionById(
      session.userId,
      session.sessionId,
    );
    if (!existed) {
      await this.sessionRepository.createSession(session);
      return;
    }

    await this.sessionRepository.updateSessionRefreshToken(
      session.userId,
      session.sessionId,
      session.refreshTokenHash,
      session.refreshTokenExpiresAt,
    );
  }

  private hashDeviceFingerprint(deviceId: string): string {
    return createHash('sha256').update(deviceId.trim()).digest('hex');
  }
}
