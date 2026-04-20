export interface StoredUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: StoredUser;
}

const ACCESS_TOKEN_KEY = 'xpress_access_token';
const REFRESH_TOKEN_KEY = 'xpress_refresh_token';
const USER_KEY = 'xpress_user';
const TOKEN_COOKIE = 'xpress_access_token';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
let refreshPromise: Promise<string> | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

function readStorage(key: string): string {
  if (!isBrowser()) return '';
  return window.localStorage.getItem(key) ?? '';
}

function writeAccessCookie(token: string) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=2592000; samesite=lax`;
}

function clearAccessCookie() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

async function fetchWithToken(
  input: string,
  init: RequestInit,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetch(input, { ...init, headers });
}

export function getAccessToken(): string {
  return readStorage(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string {
  return readStorage(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = readStorage(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function persistSession(session: SessionPayload) {
  if (!isBrowser()) return;

  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  writeAccessCookie(session.accessToken);
}

export function clearSession() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  clearAccessCookie();
}

export async function logoutSession(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();

  if (!refreshToken && !accessToken) {
    clearSession();
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: unknown;
    };
    throw new Error(getErrorMessage(data.message));
  }

  clearSession();
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return '';
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearSession();
        throw new Error('Phiên đăng nhập đã hết hạn');
      }

      const session = (await response.json()) as SessionPayload;
      persistSession(session);
      return session.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function getValidAccessToken(): Promise<string> {
  const accessToken = getAccessToken();
  if (accessToken) return accessToken;
  return refreshAccessToken().catch(() => '');
}

export async function authFetch(
  input: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<Response> {
  const accessToken = getAccessToken();
  let response = await fetchWithToken(input, init, accessToken);

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  try {
    const refreshedAccessToken = await refreshAccessToken();
    if (!refreshedAccessToken) return response;
    response = await fetchWithToken(input, init, refreshedAccessToken);
  } catch {
    return response;
  }

  return response;
}

function getErrorMessage(message: unknown) {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return 'Đăng xuất thất bại, vui lòng thử lại.';
}
