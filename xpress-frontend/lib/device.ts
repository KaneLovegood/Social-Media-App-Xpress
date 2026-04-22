import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

const DEVICE_ID_KEY = 'xpress_device_id';

/**
 * Returns a stable per-device identifier that survives app restarts and
 * browser refreshes. Strategy:
 *
 *  - Native (Capacitor iOS / Android): use `Device.getId().identifier`. This
 *    is the OS-provided vendor / ANDROID_ID that only changes on factory
 *    reset or app reinstall. Cached in Capacitor Preferences for speed.
 *  - Web: use a UUID persisted in localStorage. Browser fingerprints are
 *    unreliable across extensions / private mode, so we own the UUID.
 *
 * The id is prefixed with the platform so the backend can tell apart
 * "android-<uuid>" vs "web-<uuid>" when auditing sessions.
 */
export async function getDeviceId(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
    if (value && value.length > 0) {
      return value;
    }

    const { identifier } = await Device.getId();
    const platform = Capacitor.getPlatform();
    const deviceId = `${platform}-${identifier}`;
    await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
    return deviceId;
  }

  if (typeof window === 'undefined') {
    return `ssr-${generateUuid()}`;
  }

  const cached = window.localStorage.getItem(DEVICE_ID_KEY);
  if (cached && cached.length > 0) {
    return cached;
  }

  const fresh = `web-${generateUuid()}`;
  window.localStorage.setItem(DEVICE_ID_KEY, fresh);
  return fresh;
}

export async function getDeviceInfo(): Promise<{
  deviceId: string;
  deviceName: string;
  platform: 'web' | 'android' | 'ios';
}> {
  const deviceId = await getDeviceId();

  if (Capacitor.isNativePlatform()) {
    const info = await Device.getInfo();
    const platform = (Capacitor.getPlatform() as 'android' | 'ios') ?? 'android';
    const deviceName =
      info.name?.trim() ||
      `${info.manufacturer ?? ''} ${info.model ?? ''}`.trim() ||
      (platform === 'android' ? 'Android App' : 'iOS App');
    return { deviceId, deviceName, platform };
  }

  return {
    deviceId,
    deviceName: resolveWebDeviceName(),
    platform: 'web',
  };
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function resolveWebDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  if (/chrome/i.test(ua) && !/edge|edg\//i.test(ua)) return 'Chrome Browser';
  if (/edg\//i.test(ua)) return 'Edge Browser';
  if (/firefox/i.test(ua)) return 'Firefox Browser';
  if (/safari/i.test(ua)) return 'Safari Browser';
  return 'Web Browser';
}

function generateUuid(): string {
  const cryptoRef =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  const randomSegment = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${randomSegment()}${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}${randomSegment()}${randomSegment()}`;
}
