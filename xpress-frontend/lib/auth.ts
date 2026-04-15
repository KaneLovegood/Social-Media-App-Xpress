import { persistSession } from './auth-client';

export type AuthUser = {
  userId: string;
  name: string;
  phone: string;
  role: string;
  status: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: AuthUser;
};

type AuthPayload = {
  phone: string;
  password: string;
};

type RegisterPayload = AuthPayload & {
  name: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export async function login(payload: AuthPayload) {
  const result = await request<AuthResponse>("/auth/login", payload);
  persistSession(result);
  return result;
}

export async function register(payload: RegisterPayload) {
  const result = await request<AuthResponse>("/auth/register", payload);
  persistSession(result);
  return result;
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

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim().length > 0) return message;
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}
