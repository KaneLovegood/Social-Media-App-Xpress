'use client';

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';

import {
  forceLogout,
  getValidAccessToken,
  hydrateAuth,
  validateSession,
} from '@/lib/auth-client';
import {
  createDeviceSessionSocket,
  DEVICE_SESSION_EVENTS,
  ForceLogoutPayload,
} from '@/lib/realtime/device-session-socket';

/**
 * Wraps the entire app with single-device-session safety nets:
 *
 *  1. Hydrates auth tokens from Capacitor Preferences (mobile) or
 *     localStorage (web) so the first render has access to the session.
 *  2. Maintains a persistent Socket.IO connection to the `/device-sessions`
 *     namespace and logs the user out the moment the server emits
 *     `auth.session.force-logout`.
 *  3. Re-validates the session on every route change AND every time the
 *     native app comes back from the background (Capacitor
 *     `appStateChange.isActive === true`). This covers the case where the
 *     old device was offline while the new device logged in: the socket
 *     event was missed, but the next API call / resume-probe to
 *     `/auth/validate-session` will 401 and drop us to /login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const socketRef = useRef<Socket | null>(null);
  const lastTokenRef = useRef<string>('');
  const isHandlingForceLogoutRef = useRef(false);

  // Hydrate tokens on mount so every downstream auth helper
  // call sees the real value (important because the first call often
  // happens before React effects flush on native).
  useEffect(() => {
    void hydrateAuth();
  }, []);

  // Keep a device-session socket open whenever we have an access token.
  useEffect(() => {
    let cancelled = false;

    async function ensureSocket() {
      await hydrateAuth();
      if (cancelled) return;

      const token = await getValidAccessToken();
      if (!token) {
        teardownSocket();
        return;
      }
      if (socketRef.current && lastTokenRef.current === token) {
        return;
      }

      teardownSocket();
      lastTokenRef.current = token;
      const socket = createDeviceSessionSocket(token);
      socketRef.current = socket;

      socket.on(
        DEVICE_SESSION_EVENTS.FORCE_LOGOUT,
        (payload: ForceLogoutPayload) => {
          void handleForceLogout(payload);
        },
      );

      socket.on('disconnect', (reason) => {
        // `io server disconnect` means the server actively terminated us
        // after a FORCE_LOGOUT emit; we already handled it above. Other
        // disconnects (transport errors, backgrounding) will auto-reconnect.
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });
    }

    function teardownSocket() {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      lastTokenRef.current = '';
    }

    async function handleForceLogout(payload: ForceLogoutPayload) {
      if (isHandlingForceLogoutRef.current) return;
      isHandlingForceLogoutRef.current = true;
      teardownSocket();

      const message =
        payload.reason === 'NEW_DEVICE_LOGIN'
          ? `Tài khoản đã được đăng nhập trên thiết bị khác${payload.newDeviceName ? ` (${payload.newDeviceName})` : ''}.`
          : 'Phiên đăng nhập của bạn đã bị thu hồi.';
      toast.error(message);
      await forceLogout(message);
      router.replace('/login');
      isHandlingForceLogoutRef.current = false;
    }

    void ensureSocket();

    return () => {
      cancelled = true;
      teardownSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Revalidate the session on every route change. If the server has
  // replaced our binding (because another device logged in while we were
  // on a different route, or offline), drop to /login.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await hydrateAuth();
      if (cancelled) return;
      if (!(await getValidAccessToken())) return;
      // Skip on auth pages themselves
      if (pathname.startsWith('/login') || pathname.startsWith('/register'))
        return;

      const ok = await validateSession();
      if (!ok && !cancelled) {
        await forceLogout(
          'Phiên đăng nhập đã bị thay thế bởi thiết bị khác.',
        );
        router.replace('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Capacitor: re-validate when app resumes from background.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | null = null;

    (async () => {
      const handle = await CapacitorApp.addListener(
        'appStateChange',
        async ({ isActive }) => {
          if (!isActive) return;
          await hydrateAuth();
          if (!(await getValidAccessToken())) return;
          const ok = await validateSession();
          if (!ok) {
            toast.error(
              'Tài khoản đã được đăng nhập trên thiết bị khác, vui lòng đăng nhập lại.',
            );
            await forceLogout(
              'Tài khoản đã được đăng nhập trên thiết bị khác.',
            );
            router.replace('/login');
          }
        },
      );
      removeListener = () => {
        void handle.remove();
      };
    })();

    return () => {
      removeListener?.();
    };
  }, [router]);

  return <>{children}</>;
}
