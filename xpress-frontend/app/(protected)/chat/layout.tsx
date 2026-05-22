"use client";

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ChatAppRail from '@/components/chat/ChatAppRail';
import { getStoredUser, getValidAccessToken } from '@/lib/auth-client';
import { logoutProfile } from '@/modules/profile/profile.service';
import { fetchIncomingRequests } from '@/lib/social';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { SOCIAL_EVENTS } from '@/lib/realtime/events';

interface ChatLayoutProps {
  children: ReactNode;
}

const noopSubscribe = () => () => {};

type ActiveNav = 'newsfeed' | 'chat' | 'contacts' | 'profile';

function resolveActiveNav(pathname: string): ActiveNav {
  if (pathname.startsWith('/chat/news-feed')) {
    return 'newsfeed';
  }

  if (pathname.startsWith('/chat/contacts')) {
    return 'contacts';
  }

  if (pathname.startsWith('/chat/profile')) {
    return 'profile';
  }

  return 'chat';
}

function toInitials(name?: string): string {
  if (!name) return '';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const currentUser = useMemo(() => (isHydrated ? getStoredUser() : null), [isHydrated]);
  const activeNav = resolveActiveNav(pathname || '/chat/me');
  const initials = toInitials(currentUser?.name);

  const [contactsBadgeCount, setContactsBadgeCount] = useState(0);

  useEffect(() => {
    if (!isHydrated || !currentUser) return;

    let cancelled = false;
    let socketCleanup: (() => void) | undefined;

    // Fetch initial badge count
    void fetchIncomingRequests().then((page) => {
      if (cancelled) return;
      setContactsBadgeCount(page.items.length);
    }).catch(() => {});

    // Listen to custom window events for changes within contacts page
    const handleBadgeChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setContactsBadgeCount(customEvent.detail);
    };
    window.addEventListener('contacts-badge-change', handleBadgeChange);

    // Listen to real-time events via socket
    void getValidAccessToken().then((token) => {
      if (!token || cancelled) return;

      const socket = createChatSocket(token);

      const onRequestReceived = () => {
        setContactsBadgeCount((prev) => prev + 1);
      };

      const onRequestAccepted = () => {
        setContactsBadgeCount((prev) => Math.max(0, prev - 1));
      };

      const onRequestCancelled = () => {
        setContactsBadgeCount((prev) => Math.max(0, prev - 1));
      };

      socket.on(SOCIAL_EVENTS.REQUEST_RECEIVED, onRequestReceived);
      socket.on(SOCIAL_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
      socket.on(SOCIAL_EVENTS.REQUEST_CANCELLED, onRequestCancelled);

      socketCleanup = () => {
        socket.off(SOCIAL_EVENTS.REQUEST_RECEIVED, onRequestReceived);
        socket.off(SOCIAL_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
        socket.off(SOCIAL_EVENTS.REQUEST_CANCELLED, onRequestCancelled);
        socket.disconnect();
      };
    });

    return () => {
      cancelled = true;
      window.removeEventListener('contacts-badge-change', handleBadgeChange);
      socketCleanup?.();
    };
  }, [isHydrated, currentUser]);

  const handleLogout = async () => {
    try {
      await logoutProfile();
      router.replace('/login');
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Đăng xuất thất bại, vui lòng thử lại.',
      );
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#f8f9fb] text-[#191c1e]">
      <ChatAppRail
        activeNav={activeNav}
        fixed
        avatarUrl={currentUser?.avatarUrl || undefined}
        initials={initials || undefined}
        onLogout={handleLogout}
        contactsBadgeCount={contactsBadgeCount}
      />

      <section className="ml-0 flex flex-1 overflow-hidden md:ml-16">{children}</section>
    </main>
  );
}
