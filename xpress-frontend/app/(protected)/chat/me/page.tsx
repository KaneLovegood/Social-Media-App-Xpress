"use client";

import { useCallback, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatContainer from '@/components/chat/ChatContainer';
import { getStoredUser } from '@/lib/auth-client';

const noopSubscribe = () => () => {};

export default function ChatMePage() {
  const isHydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const router = useRouter();
  const currentUser = isHydrated ? getStoredUser() : null;
  const searchParams = useSearchParams();
  const initialRoomId = searchParams.get('roomId') ?? '';
  const initialPeerUserId = searchParams.get('peerUserId') ?? '';
  const hasInitialParams = Boolean(initialRoomId || initialPeerUserId);

  const handleRoomResolved = useCallback(() => {
    if (hasInitialParams) {
      router.replace('/chat/me');
    }
  }, [hasInitialParams, router]);

  if (!isHydrated) {
    return <main className="h-screen w-screen overflow-hidden bg-[#f3f4f6]" />;
  }

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-8">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          User session not found. Please login again.
        </p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f3f4f6]">
      <ChatContainer
        currentUserId={currentUser.userId}
        currentUserName={currentUser.name}
        initialRoomId={initialRoomId}
        initialPeerUserId={initialPeerUserId}
        onRoomResolved={handleRoomResolved}
      />
    </main>
  );
}
