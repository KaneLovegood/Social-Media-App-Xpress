import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DeviceSessionService } from './device-session.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    sessionId: string;
  };
}

@Controller('auth')
export class DeviceSessionController {
  constructor(private readonly deviceSessionService: DeviceSessionService) {}

  /**
   * Called by the client on app-resume (and on every route change in the
   * AuthProvider). JwtGuard already rejects stale tokens via JwtStrategy,
   * but this endpoint gives the client a dedicated low-cost probe that
   * returns the current binding so the UI can render correctly.
   */
  @Get('validate-session')
  async validate(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const binding = await this.deviceSessionService.getBinding(userId);
    if (!binding || binding.currentSessionId !== sessionId) {
      throw new UnauthorizedException('Session has been replaced');
    }

    return {
      valid: true,
      userId,
      sessionId,
      currentDeviceId: binding.currentDeviceId,
      platform: binding.platform,
      deviceName: binding.deviceName,
    };
  }
}
