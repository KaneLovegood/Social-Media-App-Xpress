"use client";

import type { ReactNode } from 'react';
import { useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ChatAppRail from '@/components/chat/ChatAppRail';
import { getStoredUser } from '@/lib/auth-client';
import { logoutProfile } from '@/modules/profile/profile.service';

interface ChatLayoutProps {
  children: ReactNode;
}

const noopSubscribe = () => () => {};

type ActiveNav = 'chat' | 'contacts' | 'profile';

function resolveActiveNav(pathname: string): ActiveNav {
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
      />

      <section className="ml-0 flex flex-1 overflow-hidden md:ml-16">{children}</section>
    </main>
  );
}
