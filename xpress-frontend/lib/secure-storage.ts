import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Persistent key/value storage that "just works" across Capacitor (native)
 * and the browser.
 *
 *  - Native: @capacitor/preferences, which is backed by
 *      - iOS:     UserDefaults (app-sandboxed, survives restarts)
 *      - Android: SharedPreferences (same)
 *    This is required because plain `localStorage` inside a WebView is
 *    wiped when Android reclaims memory for a backgrounded app.
 *  - Web:    window.localStorage.
 *
 * We also maintain an in-memory cache so callers can read synchronously
 * during SSR / initial render; the async API writes through to the
 * underlying store.
 */
const memoryCache = new Map<string, string>();
let hydrationPromise: Promise<void> | null = null;

const HYDRATION_KEYS = [
  'xpress_access_token',
  'xpress_refresh_token',
  'xpress_user',
  'xpress_device_id',
];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function useNative(): boolean {
  return isBrowser() && Capacitor.isNativePlatform();
}

export async function hydrateSecureStorage(): Promise<void> {
  if (!isBrowser()) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    if (useNative()) {
      await Promise.all(
        HYDRATION_KEYS.map(async (key) => {
          const { value } = await Preferences.get({ key });
          if (value !== null && value !== undefined) {
            memoryCache.set(key, value);
            // Mirror into localStorage so any synchronous legacy code path
            // (e.g. Next.js SSR-hydration cookie reads) still works.
            try {
              window.localStorage.setItem(key, value);
            } catch {
              /* storage quota / private mode — ignore */
            }
          }
        }),
      );
    } else {
      HYDRATION_KEYS.forEach((key) => {
        try {
          const value = window.localStorage.getItem(key);
          if (value !== null) memoryCache.set(key, value);
        } catch {
          /* ignore */
        }
      });
    }
  })();

  return hydrationPromise;
}

export function secureGetSync(key: string): string | null {
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;
  if (!isBrowser()) return null;
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) memoryCache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export async function secureGet(key: string): Promise<string | null> {
  await hydrateSecureStorage();
  return secureGetSync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  memoryCache.set(key, value);
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }

  if (useNative()) {
    await Preferences.set({ key, value });
  }
}

export async function secureRemove(key: string): Promise<void> {
  memoryCache.delete(key);
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  if (useNative()) {
    await Preferences.remove({ key });
  }
}
