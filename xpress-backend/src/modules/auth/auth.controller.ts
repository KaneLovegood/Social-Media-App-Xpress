import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

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

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: this.resolveIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  getSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.listUserSessions(userId, sessionId);
  }

  @UseGuards(AuthGuard('jwt'))
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
