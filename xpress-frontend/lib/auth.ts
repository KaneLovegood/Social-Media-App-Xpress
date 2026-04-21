import { persistSession } from './auth-client';

export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: AuthUser;
};

type AuthPayload = {
  email: string;
  password: string;
};

type RegisterPayload = AuthPayload & {
  name: string;
  otpToken: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

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

type DevicePayload = {
  deviceId: string;
  deviceName: string;
  timezone: string;
};

export async function login(payload: AuthPayload) {
  const result = await request<AuthResponse>("/auth/login", {
    ...payload,
    ...getDevicePayload(),
  });
  persistSession(result);
  return result;
}

export async function register(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", payload);
}

export async function sendEmailOtp(payload: SendOtpPayload) {
  return request<{ success: boolean; purpose: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD'; expiresAt: string }>(
    '/auth/otp/send',
    payload,
  );
}

export async function verifyEmailOtp(payload: VerifyOtpPayload) {
  return request<VerifyOtpResponse>('/auth/otp/verify', payload);
}

export async function resetPassword(payload: ResetPasswordPayload) {
  return request<{ success: boolean }>('/auth/password/reset', payload);
}

export async function loginWithGoogle(idToken: string) {
  const result = await request<AuthResponse>('/auth/google', {
    idToken,
    ...getDevicePayload(),
  });
  persistSession(result);
  return result;
}

export function getGoogleClientId() {
  return GOOGLE_CLIENT_ID;
}

async function request<TResponse>(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as { message?: unknown };
  if (!response.ok) {
    throw new Error(getErrorMessage(data.message));
  }

  return data as TResponse;
}

function getDevicePayload(): DevicePayload {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown-user-agent';
  return {
    deviceId: `web-${hashString(userAgent)}`,
    deviceName: 'Web Browser',
    timezone,
  };
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim().length > 0) return message;
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}
