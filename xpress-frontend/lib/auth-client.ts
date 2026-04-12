export interface StoredUser {
  userId: string;
  name: string;
  phone: string;
  role: string;
  status: string;
}

const ACCESS_TOKEN_KEY = 'xpress_access_token';
const USER_KEY = 'xpress_user';

export function getAccessToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
