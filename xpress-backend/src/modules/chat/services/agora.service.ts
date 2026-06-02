import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Injectable()
export class AgoraService {
  private readonly appId: string;
  private readonly appCertificate: string;

  constructor() {
    this.appId = process.env.AGORA_APP_ID || '';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || '';

    if (!this.appId || !this.appCertificate) {
      console.warn(
        'AGORA_APP_ID or AGORA_APP_CERTIFICATE is not set in environment variables',
      );
    }
  }

  generateRtcToken(
    channelName: string,
    uid: number | string,
    role: number = RtcRole.PUBLISHER,
    expirationTimeInSeconds: number = 3600,
  ) {
    if (!this.appId || !this.appCertificate) {
      throw new InternalServerErrorException(
        'Agora credentials are not configured',
      );
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    let token: string;
    if (typeof uid === 'number') {
      token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs,
      );
    } else {
      token = RtcTokenBuilder.buildTokenWithUserAccount(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs,
      );
    }

    return {
      token,
      appId: this.appId,
      channelName,
      uid,
    };
  }
}
