import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DeviceSessionService } from '../../device-session/device-session.service';
import { SessionRepository } from '../repositories/session.repository';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly deviceSessionService: DeviceSessionService,
  ) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sid) {
      throw new UnauthorizedException('Token session không hợp lệ');
    }

    const session = await this.sessionRepository.findSessionById(
      payload.sub,
      payload.sid,
    );

    if (!session || session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    }

    // Single-device-session cross-check against MongoDB. Even if the JWT is
    // cryptographically valid and the DynamoDB session is still ACTIVE, the
    // user might have signed in from a second device while this one was
    // backgrounded. In that case the Mongo binding now points at a different
    // sessionId and we must reject this request so the client logs out.
    const isBindingValid = await this.deviceSessionService.isSessionValid(
      payload.sub,
      payload.sid,
    );
    if (!isBindingValid) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã bị thay thế bởi thiết bị khác',
      );
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sid,
    };
  }
}
