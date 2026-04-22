import * as bcrypt from 'bcrypt';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthSessionGateway } from './auth-session.gateway';
import { AuthService } from './auth.service';
import { EmailOtpService } from './email-otp.service';
import { EmailOtpRepository } from './repositories/email-otp.repository';
import { SessionRepository } from './repositories/session.repository';
import { UsersRepository } from './repositories/users.repository';

jest.mock('bcrypt', () => ({
  __esModule: true,
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;

  const usersRepository = {
    normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
    findByEmail: jest.fn(),
    updatePasswordHash: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;

  const emailOtpRepository = {
    upsertOtp: jest.fn(),
    findOtp: jest.fn(),
    deleteOtp: jest.fn(),
    incrementAttempts: jest.fn(),
  } as unknown as EmailOtpRepository & {
    upsertOtp: jest.Mock;
    findOtp: jest.Mock;
    deleteOtp: jest.Mock;
    incrementAttempts: jest.Mock;
  };
  const sessionRepository = {
    deactivateAllSessions: jest.fn(),
    findActiveSessions: jest.fn(),
    findActiveSessionByFingerprint: jest.fn(),
    deactivateSession: jest.fn(),
  } as unknown as jest.Mocked<SessionRepository>;
  const authSessionGateway = {
    notifySessionRevoked: jest.fn(),
    notifyNewLogin: jest.fn(),
  } as unknown as AuthSessionGateway;
  const emailOtpService = {
    sendOtpEmail: jest.fn(),
  } as unknown as EmailOtpService & {
    sendOtpEmail: jest.Mock;
  };
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;
  const deviceSessionService = {
    bindDevice: jest.fn().mockResolvedValue({
      replacedPreviousDevice: false,
      previousDeviceId: null,
    }),
    isSessionValid: jest.fn().mockResolvedValue(true),
    getBinding: jest.fn(),
    registerSocket: jest.fn(),
    clearSocket: jest.fn(),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  } as unknown as {
    bindDevice: jest.Mock;
    isSessionValid: jest.Mock;
    getBinding: jest.Mock;
    registerSocket: jest.Mock;
    clearSocket: jest.Mock;
    revokeSession: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    authService = new AuthService(
      usersRepository,
      emailOtpRepository,
      sessionRepository,
      authSessionGateway,
      emailOtpService,
      jwtService,
      deviceSessionService as never,
    );
  });

  it('sends change-password OTP only for registered users', async () => {
    (usersRepository.findByEmail as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    (emailOtpRepository.upsertOtp as jest.Mock).mockResolvedValue(undefined);
    (emailOtpService.sendOtpEmail as jest.Mock).mockResolvedValue('console');

    await authService.sendEmailOtp({
      email: 'Test@Example.com',
      purpose: 'CHANGE_PASSWORD',
    });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );
    expect(emailOtpRepository.upsertOtp).toHaveBeenCalled();
    expect(emailOtpService.sendOtpEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String),
      'CHANGE_PASSWORD',
    );
  });

  it('rejects password reset when otp token does not match the email or purpose', async () => {
    (usersRepository.findByEmail as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'otp',
      email: 'other@example.com',
      purpose: 'CHANGE_PASSWORD',
    });

    await expect(
      authService.resetPassword({
        email: 'test@example.com',
        otpToken: 'token',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
    expect(sessionRepository.deactivateAllSessions).not.toHaveBeenCalled();
  });

  it('updates password and revokes sessions after a valid password reset', async () => {
    (usersRepository.findByEmail as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'otp',
      email: 'test@example.com',
      purpose: 'CHANGE_PASSWORD',
    });
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    await expect(
      authService.resetPassword({
        email: 'test@example.com',
        otpToken: 'token',
        newPassword: 'NewPassword123',
      }),
    ).resolves.toEqual({ success: true });

    expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      'new-hash',
    );
    expect(sessionRepository.deactivateAllSessions).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('blocks login when user still has an active session', async () => {
    (usersRepository.findByEmail as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      name: 'Test',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (sessionRepository.findActiveSessions as jest.Mock).mockResolvedValue([
      {
        sessionId: 'session-1',
        status: 'ACTIVE',
      },
    ]);
    (sessionRepository.findActiveSessionByFingerprint as jest.Mock).mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'test@example.com',
        password: 'Password123',
        deviceId: 'web-123',
        deviceName: 'Chrome',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(sessionRepository.findActiveSessions).toHaveBeenCalledWith('user-1');
  });

  it('allows login on the same device when active session exists', async () => {
    (usersRepository.findByEmail as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      name: 'Test',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (sessionRepository.findActiveSessions as jest.Mock).mockResolvedValue([
      {
        sessionId: 'session-1',
        status: 'ACTIVE',
      },
    ]);
    (sessionRepository.findActiveSessionByFingerprint as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      status: 'ACTIVE',
    });

    const buildAuthResponseSpy = jest
      .spyOn(authService as any, 'buildAuthResponse')
      .mockResolvedValue({ success: true });

    await expect(
      authService.login({
        email: 'test@example.com',
        password: 'Password123',
        deviceId: 'web-123',
        deviceName: 'Chrome',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).resolves.toEqual({ success: true });

    expect(buildAuthResponseSpy).toHaveBeenCalled();
  });

  it('deactivates all sessions when logout succeeds', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      type: 'refresh',
    });

    await expect(
      authService.logout({
        refreshToken: 'valid-refresh-token',
      }),
    ).resolves.toEqual({ success: true });

    expect(sessionRepository.deactivateAllSessions).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('deactivates all sessions on logout using access token when refresh token is invalid', async () => {
    (jwtService.verifyAsync as jest.Mock)
      .mockRejectedValueOnce(new Error('invalid refresh'))
      .mockResolvedValueOnce({
        sub: 'user-1',
        sid: 'session-1',
        role: 'CUSTOMER',
        email: 'test@example.com',
      });

    await expect(
      authService.logout(
        {
          refreshToken: 'invalid-refresh-token',
        },
        {
          authorizationHeader: 'Bearer valid-access-token',
        },
      ),
    ).resolves.toEqual({ success: true });

    expect(sessionRepository.deactivateAllSessions).toHaveBeenCalledWith(
      'user-1',
    );
  });
});