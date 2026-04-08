import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, verify } from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Socket } from 'socket.io';

export interface JwtUserPayload extends JwtPayload {
  userId: string;
}

@Injectable()
export class JwtUtilService {
  private cachedPublicKey: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  extractTokenFromClient(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return this.normalizeBearer(authToken);
    }

    const headerAuth = client.handshake.headers.authorization;
    if (typeof headerAuth === 'string' && headerAuth.trim().length > 0) {
      return this.normalizeBearer(headerAuth);
    }

    if (Array.isArray(headerAuth) && headerAuth.length > 0) {
      return this.normalizeBearer(headerAuth[0]);
    }

    return null;
  }

  verifyToken(token: string): JwtUserPayload {
    try {
      const decoded = verify(token, this.getPublicKey(), {
        algorithms: ['RS256'],
      });

      if (typeof decoded === 'string') {
        throw new UnauthorizedException('Invalid token payload');
      }

      const userId = decoded.userId ?? decoded.sub;

      if (typeof userId !== 'string' || userId.trim().length === 0) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return {
        ...decoded,
        userId,
      } as JwtUserPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getPublicKey(): string {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }

    const configuredPath = this.configService.get<string>('JWT_PUBLIC_KEY_PATH');
    const keyPath = configuredPath ?? 'public.key';
    const absolutePath = join(process.cwd(), keyPath);

    this.cachedPublicKey = readFileSync(absolutePath, 'utf8');
    return this.cachedPublicKey;
  }

  private normalizeBearer(rawToken: string): string {
    return rawToken.replace(/^Bearer\s+/i, '').trim();
  }
}