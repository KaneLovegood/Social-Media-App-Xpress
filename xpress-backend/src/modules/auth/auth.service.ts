import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionGateway } from './auth-session.gateway';
import { EmailOtpService } from './email-otp.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import {
  EmailOtpEntity,
  EmailOtpPurpose,
} from './interfaces/email-otp.interface';
import { SessionEntity } from './interfaces/session.interface';
import { EmailOtpRepository } from './repositories/email-otp.repository';
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

interface OtpTokenPayload {
  type: 'otp';
  email: string;
  purpose: EmailOtpPurpose;
}

interface SessionClientContext {
  ipAddress?: string;
  userAgent?: string;
}

interface LogoutContext {
  authorizationHeader?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiresIn = '10m';
  private readonly otpTokenExpiresIn = '10m';
  private readonly emailOtpExpiresInMs = 10 * 60 * 1000;
  private readonly emailOtpMaxAttempts = 5;
  private readonly refreshTokenExpiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
  private readonly refreshTokenSecret =
    process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? '';
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailOtpRepository: EmailOtpRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly authSessionGateway: AuthSessionGateway,
    private readonly emailOtpService: EmailOtpService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, context: SessionClientContext = {}) {
    const normalizedEmail = this.usersRepository.normalizeEmail(dto.email);
    const otpToken = `${dto.otpToken}`;
    await this.assertVerifiedOtpToken(normalizedEmail, otpToken, 'REGISTER');

    const existed = await this.usersRepository.findByEmail(dto.email);
    if (existed) throw new ConflictException('Email đã tồn tại');

    const userId = randomUUID();
    const now = new Date().toISOString();
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

    const deviceId =
      dto.deviceId && dto.deviceId.trim().length > 0
        ? dto.deviceId.trim()
        : `register-${randomUUID()}`;
    const deviceName =
      dto.deviceName && dto.deviceName.trim().length > 0
        ? dto.deviceName.trim()
        : 'Thiết bị đăng ký';
    const timezone =
      dto.timezone && dto.timezone.trim().length > 0
        ? dto.timezone.trim()
        : 'UTC';

    return this.buildAuthResponse(user, {
      deviceId,
      deviceName,
      timezone,
      ipAddress: context.ipAddress ?? '',
      userAgent: context.userAgent ?? '',
    });
  }

  async login(dto: LoginDto, context: SessionClientContext = {}) {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    await this.assertLoginAllowedForDevice(user.userId, dto.deviceId);

    return this.buildAuthResponse(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      timezone: dto.timezone,
      ipAddress: context.ipAddress ?? '',
      userAgent: context.userAgent ?? '',
    });
  }

  async sendEmailOtp(dto: SendEmailOtpDto) {
    const purpose: EmailOtpPurpose = dto.purpose ?? 'REGISTER';
    const normalizedEmail = this.usersRepository.normalizeEmail(dto.email);

    if (purpose === 'REGISTER') {
      const existed = await this.usersRepository.findByEmail(normalizedEmail);
      if (existed) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    if (purpose === 'LOGIN' || purpose === 'CHANGE_PASSWORD') {
      const existed = await this.usersRepository.findByEmail(normalizedEmail);
      if (!existed) {
        throw new BadRequestException('Email chưa được đăng ký');
      }
    }

    const code = this.generateOtpCode();
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const codeHash = await bcrypt.hash(code, rounds);
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.emailOtpExpiresInMs,
    ).toISOString();

    const otp: EmailOtpEntity = {
      PK: `OTP#${normalizedEmail}`,
      SK: `OTP#${purpose}`,
      entityType: 'EMAIL_OTP',
      email: normalizedEmail,
      purpose,
      codeHash,
      expiresAt,
      attempts: 0,
      maxAttempts: this.emailOtpMaxAttempts,
      createdAt: now,
      updatedAt: now,
    };

    await this.emailOtpRepository.upsertOtp(otp);
    const channel = await this.emailOtpService.sendOtpEmail(
      normalizedEmail,
      code,
      purpose,
    );

    return {
      success: true,
      purpose,
      expiresAt,
      channel,
    };
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto) {
    const normalizedEmail = this.usersRepository.normalizeEmail(dto.email);
    const otp = await this.emailOtpRepository.findOtp(
      normalizedEmail,
      dto.purpose,
    );
    if (!otp) {
      throw new BadRequestException('OTP không tồn tại hoặc đã hết hạn');
    }

    if (Date.parse(otp.expiresAt) <= Date.now()) {
      await this.emailOtpRepository.deleteOtp(normalizedEmail, dto.purpose);
      throw new BadRequestException('OTP đã hết hạn');
    }

    if (otp.attempts >= otp.maxAttempts) {
      await this.emailOtpRepository.deleteOtp(normalizedEmail, dto.purpose);
      throw new BadRequestException('OTP đã vượt quá số lần thử');
    }

    const matched = await bcrypt.compare(dto.code, otp.codeHash);
    if (!matched) {
      await this.emailOtpRepository.incrementAttempts(
        normalizedEmail,
        dto.purpose,
      );
      throw new BadRequestException('OTP không chính xác');
    }

    await this.emailOtpRepository.deleteOtp(normalizedEmail, dto.purpose);
    const otpToken = await this.jwtService.signAsync<OtpTokenPayload>(
      {
        type: 'otp',
        email: normalizedEmail,
        purpose: dto.purpose,
      },
      {
        expiresIn: this.otpTokenExpiresIn,
      },
    );

    return {
      verified: true,
      otpToken,
      purpose: dto.purpose,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedEmail = this.usersRepository.normalizeEmail(dto.email);
    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException('Email chưa được đăng ký');
    }

    let payload: OtpTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<OtpTokenPayload>(
        dto.otpToken,
      );
    } catch {
      throw new BadRequestException('OTP token không hợp lệ hoặc đã hết hạn');
    }

    if (
      payload.type !== 'otp' ||
      payload.email !== normalizedEmail ||
      payload.purpose !== 'CHANGE_PASSWORD'
    ) {
      throw new BadRequestException('OTP token không hợp lệ');
    }

    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.usersRepository.updatePasswordHash(user.userId, passwordHash);
    await this.sessionRepository.deactivateAllSessions(user.userId);

    return {
      success: true,
    };
  }

  async loginWithGoogle(
    dto: GoogleAuthDto,
    context: SessionClientContext = {},
  ) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new UnauthorizedException('Google auth chưa được cấu hình');
    }

    let ticket: LoginTicket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ');
    }

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Google token không chứa email');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    const normalizedEmail = this.usersRepository.normalizeEmail(payload.email);
    let user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user) {
      const userId = randomUUID();
      const now = new Date().toISOString();
      const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
      const passwordHash = await bcrypt.hash(randomUUID(), rounds);

      user = {
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
        GSI1PK: `EMAIL#${normalizedEmail}`,
        GSI1SK: `USER#${userId}`,
        entityType: 'USER',
        userId,
        name: payload.name?.trim() || normalizedEmail.split('@')[0] || 'User',
        email: normalizedEmail,
        passwordHash,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        avatarUrl: payload.picture,
        createdAt: now,
        updatedAt: now,
      };

      await this.usersRepository.createUser(user);
      this.logger.log(`Created new user from Google auth: ${user.userId}`);
    }
    await this.assertLoginAllowedForDevice(user.userId, dto.deviceId);

    return this.buildAuthResponse(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName ?? 'Google Sign-in',
      timezone: dto.timezone,
      ipAddress: context.ipAddress ?? '',
      userAgent: context.userAgent ?? '',
    });
  }

  async updateAvatar(userId: string, dto: UpdateAvatarDto) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const avatarUrl = dto.avatarUrl.trim();
    await this.usersRepository.updateAvatarUrl(userId, avatarUrl);

    return {
      success: true,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl,
      },
    };
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

  async logout(dto: LogoutDto, context: LogoutContext = {}) {
    const fromRefreshToken = await this.resolveLogoutSessionFromRefreshToken(
      dto.refreshToken,
    );
    const fromAccessToken =
      fromRefreshToken == null
        ? await this.resolveLogoutSessionFromAccessToken(
            context.authorizationHeader,
          )
        : null;

    const session = fromRefreshToken ?? fromAccessToken;
    if (!session) {
      throw new UnauthorizedException('Token đăng xuất không hợp lệ');
    }

    await this.sessionRepository.deactivateAllSessions(session.userId);
    this.authSessionGateway.notifySessionRevoked(session.userId, {
      sessionId: session.sessionId,
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
      decodedRefreshUnknown !== null &&
      typeof decodedRefreshUnknown === 'object'
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
        avatarUrl: user.avatarUrl ?? '',
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

  private async assertLoginAllowedForDevice(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    const deviceFingerprintHash = this.hashDeviceFingerprint(deviceId);
    const activeSessions =
      await this.sessionRepository.findActiveSessions(userId);

    if (activeSessions.length === 0) {
      return;
    }

    const activeSessionOnCurrentDevice =
      await this.sessionRepository.findActiveSessionByFingerprint(
        userId,
        deviceFingerprintHash,
      );

    if (!activeSessionOnCurrentDevice) {
      const allRegisterPlaceholders = activeSessions.every(
        (session) => session.deviceName === 'Thiết bị đăng ký',
      );

      if (allRegisterPlaceholders) {
        await Promise.all(
          activeSessions.map((session) =>
            this.sessionRepository.deactivateSession(userId, session.sessionId),
          ),
        );
        return;
      }

      throw new ForbiddenException(
        'Tài khoản đang được đăng nhập ở nơi khác. Vui lòng đăng xuất trước khi đăng nhập lại.',
      );
    }

    const staleSessions = activeSessions.filter(
      (session) => session.sessionId !== activeSessionOnCurrentDevice.sessionId,
    );
    if (staleSessions.length > 0) {
      await Promise.all(
        staleSessions.map((session) =>
          this.sessionRepository.deactivateSession(userId, session.sessionId),
        ),
      );
    }
  }

  private async resolveLogoutSessionFromRefreshToken(
    refreshToken?: string,
  ): Promise<{ userId: string; sessionId: string } | null> {
    if (!refreshToken || !this.refreshTokenSecret) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.refreshTokenSecret,
        },
      );

      if (payload.type !== 'refresh' || !payload.sid || !payload.sub) {
        return null;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
      };
    } catch {
      return null;
    }
  }

  private async resolveLogoutSessionFromAccessToken(
    authorizationHeader?: string,
  ): Promise<{ userId: string; sessionId: string } | null> {
    const token = this.extractBearerToken(authorizationHeader);
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.type === 'refresh' || !payload.sid || !payload.sub) {
        return null;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
      };
    } catch {
      return null;
    }
  }

  private extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const trimmed = authorizationHeader.trim();
    if (!trimmed.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = trimmed.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  private async assertVerifiedOtpToken(
    email: string,
    otpToken: string,
    expectedPurpose: EmailOtpPurpose,
  ): Promise<void> {
    let payload: OtpTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<OtpTokenPayload>(otpToken);
    } catch {
      throw new UnauthorizedException('OTP token không hợp lệ');
    }

    if (payload.type !== 'otp') {
      throw new UnauthorizedException('OTP token không đúng loại');
    }
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('OTP token không đúng mục đích');
    }
    if (payload.email !== email) {
      throw new UnauthorizedException('OTP token không khớp email');
    }
  }

  private generateOtpCode(): string {
    return String(randomInt(0, 10000)).padStart(4, '0');
  }

  private hashDeviceFingerprint(deviceId: string): string {
    return createHash('sha256').update(deviceId.trim()).digest('hex');
  }
}
