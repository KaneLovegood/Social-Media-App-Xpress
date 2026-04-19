import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../middleware/public.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Public()
  @Post('google')
  google(@Body() dto: GoogleAuthDto, @Req() req: Request) {
    return this.authService.loginWithGoogle(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
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
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
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

  private resolveIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];

    if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
      return xForwardedFor.split(',')[0]?.trim() ?? '';
    }

    return req.ip ?? '';
  }
}
