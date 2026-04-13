import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersRepository } from './repositories/users.repository';
import { UserEntity } from './interfaces/user.interface';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type?: 'refresh' | 'access';
  exp?: number;
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
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existed = await this.usersRepository.findByPhone(dto.phone);
    if (existed) throw new ConflictException('Số điện thoại đã tồn tại');

    const userId = randomUUID();
    const now = new Date().toISOString();
    const normalizedPhone = this.usersRepository.normalizePhone(dto.phone);
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user: UserEntity = {
      PK: `USER#${userId}`,
      SK: `PROFILE#${userId}`,
      GSI1PK: `PHONE#${normalizedPhone}`,
      GSI1SK: `USER#${userId}`,
      entityType: 'USER',
      userId,
      name: dto.name,
      phone: normalizedPhone,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.usersRepository.createUser(user);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    return this.buildAuthResponse(user);
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

    const user = await this.usersRepository.findByUserId(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const matched = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );
    if (!matched) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    return this.buildAuthResponse(user);
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

    await this.usersRepository.clearRefreshToken(payload.sub);

    return { success: true };
  }

  private async buildAuthResponse(user: UserEntity) {
    const payload: JwtPayload = {
      sub: user.userId,
      phone: user.phone,
      role: user.role,
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

    const decodedRefresh = this.jwtService.decode(refreshToken);
    const refreshTokenExpiresAt =
      decodedRefresh?.exp != null
        ? new Date(decodedRefresh.exp * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, rounds);
    await this.usersRepository.updateRefreshToken(
      user.userId,
      refreshTokenHash,
      refreshTokenExpiresAt,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user: {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }
}
