export type SessionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface SessionEntity {
  PK: string; // USER#{userId}
  SK: string; // SESSION#{sessionId}
  entityType: 'SESSION';

  userId: string;
  sessionId: string;
  status: SessionStatus;

  refreshTokenHash: string;
  refreshTokenExpiresAt: string;

  deviceFingerprintHash: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  timezone?: string;

  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}
