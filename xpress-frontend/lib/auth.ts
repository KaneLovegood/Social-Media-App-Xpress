import { persistSession } from './auth-client';
import { getDeviceInfo } from './device';

export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string;
  authProvider?: 'LOCAL' | 'GOOGLE';
  passwordAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

export type TwoFactorChallenge = {
  requiresTwoFactor: true;
  email: string;
  twoFactorToken: string;
  expiresAt: string;
};

export type AuthResult = AuthResponse | TwoFactorChallenge;

type AuthPayload = {
  email: string;
  password: string;
};

type RegisterPayload = AuthPayload & {
  name: string;
  otpToken: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
  'http://localhost:3001';

type SendOtpPayload = {
  email: string;
  purpose?: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD';
};

type VerifyOtpPayload = {
  email: string;
  code: string;
  purpose: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD';
};

type VerifyOtpResponse = {
  verified: boolean;
  otpToken: string;
  purpose: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD';
};

type ResetPasswordPayload = {
  email: string;
  otpToken: string;
  newPassword: string;
};

export async function login(payload: AuthPayload) {
  const device = await getDevicePayload();
  const result = await request<AuthResult>('/auth/login', {
    ...payload,
    ...device,
  });
  if (!isTwoFactorChallenge(result)) {
    await persistSession(result);
  }
  return result;
}

export async function register(payload: RegisterPayload) {
  const device = await getDevicePayload();
  return request<AuthResponse>('/auth/register', {
    ...payload,
    ...device,
  });
}

export async function sendEmailOtp(payload: SendOtpPayload) {
  return request<{
    success: boolean;
    purpose: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD';
    expiresAt: string;
  }>('/auth/otp/send', payload);
}

export async function verifyEmailOtp(payload: VerifyOtpPayload) {
  return request<VerifyOtpResponse>('/auth/otp/verify', payload);
}

export async function resetPassword(payload: ResetPasswordPayload) {
  return request<{ success: boolean }>('/auth/password/reset', payload);
}

/**
 * Exchange a Firebase ID token for our own JWT pair.
 *
 * The token must come from Firebase Authentication (Google provider). The
 * backend verifies it with the Firebase Admin SDK before issuing the JWT.
 */
export async function loginWithGoogle(
  idToken: string,
  options: { platform?: 'web' | 'android' | 'ios' } = {},
) {
  const device = await getDevicePayload();
  const result = await request<AuthResult>('/auth/google', {
    idToken,
    platform: options.platform ?? 'web',
    ...device,
  });
  if (!isTwoFactorChallenge(result)) {
    await persistSession(result);
  }
  return result;
}

export async function verifyTwoFactorLogin(payload: {
  twoFactorToken: string;
  code: string;
}) {
  const result = await request<AuthResponse>('/auth/2fa/login/verify', payload);
  await persistSession(result);
  return result;
}

async function request<TResponse>(
  path: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
  };
  if (!response.ok) {
    throw new Error(getErrorMessage(data.message));
  }

  return data as TResponse;
}

async function getDevicePayload(): Promise<{
  deviceId: string;
  deviceName: string;
  timezone: string;
}> {
  const timezone =
    (typeof Intl !== 'undefined' &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'UTC';
  const { deviceId, deviceName } = await getDeviceInfo();
  return {
    deviceId,
    deviceName,
    timezone,
  };
}

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return 'Đã có lỗi xảy ra, vui lòng thử lại.';
}

export function isTwoFactorChallenge(
  result: AuthResult,
): result is TwoFactorChallenge {
  return 'requiresTwoFactor' in result && result.requiresTwoFactor === true;
}
