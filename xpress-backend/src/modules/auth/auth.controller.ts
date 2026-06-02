import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../middleware/public.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

interface AuthResponseWithRefreshToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  session: {
    sessionId: string;
    deviceName: string;
  };
  user: {
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    avatarUrl: string;
  };
}

type PublicAuthResponse = Omit<AuthResponseWithRefreshToken, 'refreshToken'>;

@Controller('auth')
export class AuthController {
  private readonly refreshTokenCookieName =
    process.env.REFRESH_TOKEN_COOKIE_NAME ?? 'xpress_refresh_token';
  private readonly refreshTokenCookieMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResponse = await this.authService.register(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
    return this.withRefreshCookie(req, res, authResponse);
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResponse = await this.authService.login(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
    return this.withRefreshCookie(req, res, authResponse);
  }

  @Public()
  @Post('google')
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResponse = await this.authService.loginWithGoogle(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
    return this.withRefreshCookie(req, res, authResponse);
  }

  @Public()
  @Post('otp/send')
  sendOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto);
  }

  @Public()
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bodyRefreshToken = dto.refreshToken?.trim();
    const refreshToken =
      bodyRefreshToken || this.readCookie(req, this.refreshTokenCookieName);
    if (!refreshToken) {
      this.clearRefreshCookie(req, res);
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    try {
      const authResponse = await this.authService.refresh({ refreshToken });
      return this.withRefreshCookie(req, res, authResponse);
    } catch (error) {
      this.clearRefreshCookie(req, res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.authService.logout(
        {
          ...dto,
          refreshToken:
            dto.refreshToken?.trim() ||
            this.readCookie(req, this.refreshTokenCookieName),
        },
        {
          authorizationHeader:
            typeof req.headers.authorization === 'string'
              ? req.headers.authorization
              : undefined,
        },
      );
    } finally {
      this.clearRefreshCookie(req, res);
    }
  }

  @Get('sessions')
  getSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.listUserSessions(userId, sessionId);
  }

  @Delete('sessions/:sessionId')
  revokeSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user?.userId;
    const currentSessionId = req.user?.sessionId;
    if (!userId || !currentSessionId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.revokeSession(userId, sessionId, currentSessionId);
  }

  @Patch('avatar')
  updateAvatar(@Req() req: AuthenticatedRequest, @Body() dto: UpdateAvatarDto) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.updateAvatar(userId, dto);
  }

  private resolveIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];

    if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
      return xForwardedFor.split(',')[0]?.trim() ?? '';
    }

    return req.ip ?? '';
  }

  private withRefreshCookie(
    req: Request,
    res: Response,
    authResponse: AuthResponseWithRefreshToken,
  ): PublicAuthResponse {
    const { refreshToken, ...responseBody } = authResponse;
    res.cookie(
      this.refreshTokenCookieName,
      refreshToken,
      this.refreshCookieOptions(req),
    );
    return responseBody;
  }

  private clearRefreshCookie(req: Request, res: Response): void {
    const options = this.refreshCookieOptions(req);
    delete options.maxAge;
    res.clearCookie(this.refreshTokenCookieName, options);
  }

  private refreshCookieOptions(req: Request): CookieOptions {
    const secure = this.shouldUseSecureCookie(req);
    const configuredSameSite =
      process.env.REFRESH_TOKEN_COOKIE_SAMESITE?.toLowerCase();
    const sameSite =
      configuredSameSite === 'strict' ||
      configuredSameSite === 'lax' ||
      configuredSameSite === 'none'
        ? configuredSameSite
        : secure
          ? 'none'
          : 'lax';
    const domain = process.env.REFRESH_TOKEN_COOKIE_DOMAIN?.trim();

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/auth',
      maxAge: this.refreshTokenCookieMaxAgeMs,
      ...(domain ? { domain } : {}),
    };
  }

  private shouldUseSecureCookie(req: Request): boolean {
    const configuredSecure = process.env.REFRESH_TOKEN_COOKIE_SECURE;
    if (configuredSecure != null) {
      return configuredSecure.toLowerCase() === 'true';
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const firstForwardedProto =
      typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0]?.trim()
        : undefined;

    return (
      process.env.NODE_ENV === 'production' ||
      req.secure ||
      firstForwardedProto === 'https'
    );
  }

  private readCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    for (const part of cookieHeader.split(';')) {
      const [rawKey, ...rawValueParts] = part.trim().split('=');
      if (rawKey !== name) continue;

      const rawValue = rawValueParts.join('=');
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }

    return undefined;
  }
}
