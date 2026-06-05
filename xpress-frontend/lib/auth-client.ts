import {
  hydrateSecureStorage,
  secureGetSync,
  secureRemove,
  secureSet,
} from './secure-storage';

export interface StoredUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string;
  authProvider?: 'LOCAL' | 'GOOGLE';
  passwordAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

interface SessionPayload {
  accessToken: string;
  tokenType: string;
  user: StoredUser;
}

const ACCESS_TOKEN_KEY = "xpress_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "xpress_refresh_token";
const USER_KEY = "xpress_user";
const AUTH_NOTICE_KEY = "xpress_auth_notice";
const AUTH_LOCKED_KEY = "xpress_auth_locked";
export const USER_UPDATED_EVENT = "xpress:user-updated";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
  'http://localhost:3001';
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30_000;
let refreshPromise: Promise<string> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function emitUserUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(USER_UPDATED_EVENT));
}

async function fetchWithToken(
  input: string,
  init: RequestInit,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}

export function getAccessToken(): string {
  return secureGetSync(ACCESS_TOKEN_KEY) ?? '';
}

function isJwtExpiredOrStale(token: string): boolean {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment || typeof globalThis.atob !== 'function') {
      return false;
    }

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '=',
    );
    const payload = JSON.parse(globalThis.atob(paddedBase64)) as {
      exp?: number;
    };
    if (!payload.exp) return false;

    return payload.exp * 1000 - Date.now() < ACCESS_TOKEN_REFRESH_SKEW_MS;
  } catch {
    return false;
  }
}

export function getStoredUser(): StoredUser | null {
  const raw = secureGetSync(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function hydrateAuth(): Promise<void> {
  await hydrateSecureStorage();
  await secureRemove(LEGACY_REFRESH_TOKEN_KEY);
}

export async function updateStoredUser(user: StoredUser): Promise<void> {
  if (!isBrowser()) return;
  await secureSet(USER_KEY, JSON.stringify(user));
  emitUserUpdated();
}

export async function persistSession(session: SessionPayload): Promise<void> {
  if (!isBrowser()) return;

  await Promise.all([
    secureSet(ACCESS_TOKEN_KEY, session.accessToken),
    secureRemove(LEGACY_REFRESH_TOKEN_KEY),
    secureSet(USER_KEY, JSON.stringify(session.user)),
  ]);
  window.sessionStorage.removeItem(AUTH_LOCKED_KEY);
  window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  emitUserUpdated();
}

export async function clearSession(): Promise<void> {
  if (!isBrowser()) return;

  await Promise.all([
    secureRemove(ACCESS_TOKEN_KEY),
    secureRemove(LEGACY_REFRESH_TOKEN_KEY),
    secureRemove(USER_KEY),
  ]);
  emitUserUpdated();
}

function setAuthNotice(message: string) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(AUTH_NOTICE_KEY, message);
}

function setAuthLocked() {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(AUTH_LOCKED_KEY, "1");
}

function isAuthLocked(): boolean {
  if (!isBrowser()) return false;
  return window.sessionStorage.getItem(AUTH_LOCKED_KEY) === "1";
}

export async function forceLogout(message: string): Promise<void> {
  await clearSession();
  setAuthLocked();
  setAuthNotice(message);
  if (isBrowser() && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

function forceReLogin(message: string): never {
  void forceLogout(message);
  throw new Error(message);
}

export function consumeAuthNotice(): string {
  if (!isBrowser()) return "";
  const message = window.sessionStorage.getItem(AUTH_NOTICE_KEY) ?? "";
  if (message) {
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
  return message;
}

export async function logoutSession(): Promise<void> {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({}),
  });

  if (!response.ok && response.status !== 401) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: unknown;
    };
    throw new Error(getErrorMessage(data.message));
  }

  await clearSession();
}

export async function refreshAccessToken(): Promise<string> {
  if (isAuthLocked()) {
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        return forceReLogin(
          "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
        );
      }

      const session = (await response.json()) as SessionPayload;
      await persistSession(session);
      return session.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function getValidAccessToken(): Promise<string> {
  await hydrateSecureStorage();
  if (isAuthLocked()) {
    return "";
  }

  const accessToken = getAccessToken();
  if (accessToken && !isJwtExpiredOrStale(accessToken)) return accessToken;
  return refreshAccessToken().catch(() => "");
}

export async function authFetch(
  input: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<Response> {
  await hydrateSecureStorage();
  if (isAuthLocked()) {
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  }

  let accessToken = getAccessToken();
  if (
    retryOnUnauthorized &&
    (!accessToken || isJwtExpiredOrStale(accessToken))
  ) {
    accessToken = await refreshAccessToken().catch(() => "");
  }

  let response = await fetchWithToken(input, init, accessToken);

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  try {
    const refreshedAccessToken = await refreshAccessToken();
    if (!refreshedAccessToken) {
      throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }
    response = await fetchWithToken(input, init, refreshedAccessToken);
  } catch {
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  }

  return response;
}

/**
 * Probe the backend to confirm the single-device-session binding still
 * points at this device's sessionId. Used on app-resume and route change.
 * Returns `true` when valid, `false` when the server rejected us (the
 * caller should then redirect to /login).
 */
export async function validateSession(): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return false;

  try {
    const response = await authFetch(
      `${API_BASE_URL}/auth/validate-session`,
      { method: 'GET' },
      true,
    );
    return response.ok;
  } catch {
    return false;
  }
}

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim().length > 0) return message;
  return "Đăng xuất thất bại, vui lòng thử lại.";
}
