"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { TextAlignJustify, Search, X, Loader2, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import ChatAppRail from '@/components/chat/ChatAppRail';
import { getStoredUser, getValidAccessToken } from '@/lib/auth-client';
import { CHAT_EVENTS, SOCIAL_EVENTS } from '@/lib/realtime/events';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { PresencePayload } from '@/lib/realtime/types';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  fetchBlockedUsers,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  rejectFriendRequest,
  restoreFriendRequest,
  SearchUserItem,
  searchUsers,
  sendFriendRequest,
  SocialUser,
  unblockUser,
  unfriend,
} from '@/lib/social';

type TabKey = 'friends' | 'requests_incoming' | 'requests_outgoing' | 'blocked';

function toInitials(name?: string): string {
  if (!name) return '';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Ngoại tuyến';
  try {
    const date = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Vừa mới hoạt động';
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Hoạt động vài giây trước';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hoạt động hôm qua';
    return `Hoạt động ${diffDays} ngày trước`;
  } catch {
    return 'Ngoại tuyến';
  }
}

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    { bg: 'bg-blue-50 text-blue-700 border-blue-100' },
    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { bg: 'bg-violet-50 text-violet-700 border-violet-100' },
    { bg: 'bg-amber-50 text-amber-700 border-amber-100' },
    { bg: 'bg-rose-50 text-rose-700 border-rose-100' },
    { bg: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  ];
  return colors[hash % colors.length];
}

export default function ContactsPage() {
  const router = useRouter();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.userId ?? '';

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [friendsCursor, setFriendsCursor] = useState<string | null>(null);
  
  const [incomingRequests, setIncomingRequests] = useState<SocialUser[]>([]);
  const [incomingRequestsCursor, setIncomingRequestsCursor] = useState<string | null>(null);
  
  const [outgoingRequests, setOutgoingRequests] = useState<SocialUser[]>([]);
  const [outgoingRequestsCursor, setOutgoingRequestsCursor] = useState<string | null>(null);
  
  const [blockedUsers, setBlockedUsers] = useState<SocialUser[]>([]);
  const [blockedUsersCursor, setBlockedUsersCursor] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [unfriendTarget, setUnfriendTarget] = useState<SocialUser | null>(null);
  const [activeDropdownUserId, setActiveDropdownUserId] = useState<string | null>(null);

  const loadInitial = async () => {
    try {
      const [friendsPage, incomingPage, outgoingPage, blockedPage] = await Promise.all([
        fetchFriends(),
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
        fetchBlockedUsers(),
      ]);
      setFriends(friendsPage.items);
      setFriendsCursor(friendsPage.nextCursor);
      setIncomingRequests(incomingPage.items);
      setIncomingRequestsCursor(incomingPage.nextCursor);
      setOutgoingRequests(outgoingPage.items);
      setOutgoingRequestsCursor(outgoingPage.nextCursor);
      setBlockedUsers(blockedPage.items);
      setBlockedUsersCursor(blockedPage.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh bạ');
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  // Debounced Instant Search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      setSearchCursor(null);
      return;
    }

    setSearchLoading(true);
    const handler = setTimeout(async () => {
      try {
        const page = await searchUsers(trimmed);
        setSearchResults(page.items);
        setSearchCursor(page.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Tìm kiếm thất bại');
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Click outside to close active action dropdowns
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownUserId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Sync badge count when incoming requests state changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('contacts-badge-change', { detail: incomingRequests.length })
    );
  }, [incomingRequests.length]);

  useEffect(() => {
    let cancelled = false;
    let socketCleanup: (() => void) | undefined;

    void getValidAccessToken().then((token) => {
      if (!token || cancelled) return;

      const socket = createChatSocket(token);

      const onPresence = (payload: PresencePayload) => {
        const update = (prev: SocialUser[]) =>
          prev.map((item) =>
            item.userId === payload.userId
              ? { ...item, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt }
              : item,
          );
        setFriends(update);
        setIncomingRequests(update);
        setOutgoingRequests(update);
        setSearchResults((prev: SearchUserItem[]) =>
          prev.map((item) =>
            item.userId === payload.userId
              ? { ...item, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt }
              : item,
          ),
        );
      };

      const onRequestReceived = (payload: any) => {
        setIncomingRequests((prev) => {
          if (prev.some((item) => item.userId === payload.userId)) return prev;
          return [payload, ...prev];
        });
        setOutgoingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setSearchResults((prev) =>
          prev.map((item) =>
            item.userId === payload.userId ? { ...item, friendStatus: 'PENDING_RECEIVED' } : item,
          ),
        );
        toast.info(`${payload.name} đã gửi lời mời kết bạn.`);
      };

      const onRequestAccepted = (payload: any) => {
        setIncomingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setOutgoingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setFriends((prev) => {
          if (prev.some((item) => item.userId === payload.userId)) return prev;
          return [payload, ...prev];
        });
        setSearchResults((prev) =>
          prev.map((item) =>
            item.userId === payload.userId ? { ...item, friendStatus: 'FRIEND' } : item,
          ),
        );
        toast.success(`${payload.name} đã chấp nhận lời mời kết bạn.`);
      };

      const onRequestCancelled = (payload: { userId: string }) => {
        setIncomingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setSearchResults((prev) =>
          prev.map((item) =>
            item.userId === payload.userId ? { ...item, friendStatus: 'NONE' } : item,
          ),
        );
      };

      const onUnfriended = (payload: { userId: string }) => {
        setFriends((prev) => prev.filter((item) => item.userId !== payload.userId));
        setIncomingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setOutgoingRequests((prev) => prev.filter((item) => item.userId !== payload.userId));
        setSearchResults((prev) =>
          prev.map((item) =>
            item.userId === payload.userId ? { ...item, friendStatus: 'NONE' } : item,
          ),
        );
      };

      socket.on(CHAT_EVENTS.PRESENCE, onPresence);
      socket.on(SOCIAL_EVENTS.REQUEST_RECEIVED, onRequestReceived);
      socket.on(SOCIAL_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
      socket.on(SOCIAL_EVENTS.REQUEST_CANCELLED, onRequestCancelled);
      socket.on(SOCIAL_EVENTS.UNFRIENDED, onUnfriended);

      socketCleanup = () => {
        socket.off(CHAT_EVENTS.PRESENCE, onPresence);
        socket.off(SOCIAL_EVENTS.REQUEST_RECEIVED, onRequestReceived);
        socket.off(SOCIAL_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
        socket.off(SOCIAL_EVENTS.REQUEST_CANCELLED, onRequestCancelled);
        socket.off(SOCIAL_EVENTS.UNFRIENDED, onUnfriended);
        socket.disconnect();
      };
    });

    return () => {
      cancelled = true;
      socketCleanup?.();
    };
  }, []);

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [friends]);

  const friendIds = useMemo(() => new Set(friends.map((item) => item.userId)), [friends]);

  const runAction = async (task: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await task();
      await loadInitial();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    await runAction(async () => {
      await sendFriendRequest(targetUserId);
      setSearchResults((prev) =>
        prev.map((item) =>
          item.userId === targetUserId ? { ...item, friendStatus: 'PENDING_SENT' } : item,
        ),
      );
    });
  };

  const handleCancelRequest = async (targetUserId: string) => {
    await runAction(async () => {
      await cancelFriendRequest(targetUserId);
      setSearchResults((prev) =>
        prev.map((item) =>
          item.userId === targetUserId ? { ...item, friendStatus: 'NONE' } : item,
        ),
      );
      setOutgoingRequests((prev) => prev.filter((item) => item.userId !== targetUserId));
      
      toast.info('Đã hủy lời mời kết bạn.', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            void handleSendRequest(targetUserId);
          },
        },
        duration: 3000,
      });
    });
  };

  const handleAcceptRequest = async (requesterUserId: string) => {
    await runAction(async () => {
      await acceptFriendRequest(requesterUserId);
      goToPrivateChat(requesterUserId);
    });
  };

  const handleRejectRequest = async (requesterUserId: string) => {
    await runAction(async () => {
      await rejectFriendRequest(requesterUserId);
      setIncomingRequests((prev) => prev.filter((item) => item.userId !== requesterUserId));
      setSearchResults((prev) =>
        prev.map((item) =>
          item.userId === requesterUserId ? { ...item, friendStatus: 'NONE' } : item,
        ),
      );

      toast.info('Đã từ chối lời mời kết bạn.', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            void runAction(async () => {
              await restoreFriendRequest(requesterUserId);
            });
          },
        },
        duration: 3000,
      });
    });
  };

  const handleBlock = async (targetUserId: string) => {
    await runAction(async () => {
      await blockUser(targetUserId);
    });
  };

  const handleUnblock = async (targetUserId: string) => {
    await runAction(async () => {
      await unblockUser(targetUserId);
    });
  };

  const goToPrivateChat = (peerUserId: string) => {
    if (!currentUserId) {
      router.push(`/chat/me?peerUserId=${encodeURIComponent(peerUserId)}`);
      return;
    }

    const roomId = toPrivateRoomId(currentUserId, peerUserId);
    router.push(`/chat/me?roomId=${encodeURIComponent(roomId)}`);
  };

  const renderSearchResults = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) return null;

    if (searchResults.length === 0) {
      if (searchLoading) return null;
      return (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 mt-4 mx-2">
          <svg className="w-10 h-10 text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <p className="text-xs font-bold text-zinc-700">Không tìm thấy kết quả phù hợp</p>
          <p className="text-[10px] text-zinc-500 max-w-[180px] mt-1">Không có tài khoản nào phù hợp.</p>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#727687]">
          Kết quả tìm kiếm
        </p>
        <ul className="mt-2 space-y-2 max-h-[300px] overflow-y-auto px-1">
          {searchResults.map((user) => {
            const isFriend = user.friendStatus === 'FRIEND' || friendIds.has(user.userId);
            const isSelf = user.userId === currentUserId;

            return (
              <li key={user.userId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-white p-3 shadow-sm hover:border-zinc-200 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${getAvatarColor(user.name).bg}`}>
                    {toInitials(user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-zinc-950">
                      {user.name} {isSelf && <span className="text-[10px] font-normal text-zinc-400">(Bạn)</span>}
                    </p>
                    <p className="text-[10px] text-[#727687] truncate">{user.email}</p>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex flex-shrink-0 gap-1.5 items-center justify-end">
                    {!isFriend && user.friendStatus === 'NONE' && !user.blockedByMe && !user.blockedMe && (
                      <button
                        type="button"
                        onClick={() => void handleSendRequest(user.userId)}
                        className="rounded-md bg-[#0052cc] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0040a3] transition-colors flex items-center gap-0.5"
                      >
                        <span className="text-xs font-bold">+</span> Kết bạn
                      </button>
                    )}

                    {user.friendStatus === 'PENDING_SENT' && (
                      <button
                        type="button"
                        onClick={() => void handleCancelRequest(user.userId)}
                        className="rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200 transition-colors"
                      >
                        Hủy yêu cầu
                      </button>
                    )}

                    {user.friendStatus === 'PENDING_RECEIVED' && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleAcceptRequest(user.userId)}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectRequest(user.userId)}
                          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}

                    {isFriend && (
                      <button
                        type="button"
                        onClick={() => goToPrivateChat(user.userId)}
                        className="rounded-md border border-[#0052cc] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0052cc] hover:bg-[#0052cc]/5 transition-colors"
                      >
                        Nhắn tin
                      </button>
                    )}

                    {!user.blockedByMe ? (
                      <button
                        type="button"
                        onClick={() => void handleBlock(user.userId)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
                      >
                        Chặn
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleUnblock(user.userId)}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Bỏ chặn
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {searchCursor && (
          <button
            type="button"
            onClick={() =>
              void (async () => {
                const page = await searchUsers(trimmed, searchCursor);
                setSearchResults((prev) => [...prev, ...page.items]);
                setSearchCursor(page.nextCursor);
              })()
            }
            className="mt-2 w-full text-center py-1.5 text-[10px] font-semibold text-[#0052cc] hover:underline"
          >
            Xem thêm kết quả
          </button>
        )}
      </div>
    );
  };

  return (
    <main className="flex h-full w-full overflow-hidden bg-[#f8f9fb] text-[#191c1e]">
      <section className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden w-80 flex-col bg-[#ffffff] border-r border-[#c2c6d8]/20 lg:flex">
          <header className="flex h-16 items-center px-6">
            <h1 className="text-xl font-bold text-zinc-900">Danh bạ</h1>
          </header>

          <div className="px-4 pb-4 flex-1 overflow-y-auto">
            {/* Search Box */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-zinc-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm kiếm theo số điện thoại, email hoặc username..."
                className="h-10 w-full rounded-lg bg-zinc-100/80 border border-zinc-200/50 pl-9 pr-9 text-xs outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#0052cc]/15 focus:border-[#0052cc]"
              />
              {searchLoading ? (
                <span className="absolute right-3 text-[#0052cc]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
              <p className="mt-2 px-2 text-[10px] text-[#727687]">
                Nhập ít nhất 3 ký tự để tìm kiếm.
              </p>
            )}

            {renderSearchResults()}

            {/* Sub-tabs List */}
            <div className="mt-6 space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  activeTab === 'friends'
                    ? 'bg-[#dae2ff] text-[#0052cc]'
                    : 'text-[#424655] hover:bg-[#e1e2e4]/60'
                }`}
              >
                <span>Tất cả bạn bè</span>
                <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-[10px]">
                  {friends.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('requests_incoming')}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  activeTab === 'requests_incoming'
                    ? 'bg-[#dae2ff] text-[#0052cc]'
                    : 'text-[#424655] hover:bg-[#e1e2e4]/60'
                }`}
              >
                <span>Lời mời đã nhận</span>
                {incomingRequests.length > 0 && (
                  <span className="bg-[#0052cc] text-white rounded-full px-2 py-0.5 text-[10px] animate-pulse">
                    {incomingRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('blocked')}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  activeTab === 'blocked'
                    ? 'bg-[#dae2ff] text-[#0052cc]'
                    : 'text-[#424655] hover:bg-[#e1e2e4]/60'
                }`}
              >
                <span>Danh sách chặn</span>
                <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-[10px]">
                  {blockedUsers.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-[#c2c6d8]/40 bg-[#f8f9fb] px-4 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileRailOpen(true)}
                className="rounded-full p-2 text-zinc-700 hover:bg-slate-100 md:hidden"
                aria-label="Mở thanh điều hướng"
              >
                <TextAlignJustify className="h-5 w-5" />
              </button>
              <h2 className="text-base font-bold text-zinc-800">
                {activeTab === 'friends' && 'Tất cả bạn bè'}
                {activeTab === 'requests_incoming' && 'Lời mời kết bạn đã nhận'}
                {activeTab === 'requests_outgoing' && 'Lời mời kết bạn đã gửi'}
                {activeTab === 'blocked' && 'Danh sách người dùng đã chặn'}
              </h2>
            </div>

            {/* Quick switcher buttons on header */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'friends' ? 'bg-[#0052cc] text-white' : 'bg-[#e1e2e4] text-zinc-700 hover:bg-zinc-300/60'
                }`}
              >
                Bạn bè
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requests_incoming')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold relative transition-colors ${
                  activeTab === 'requests_incoming' ? 'bg-[#0052cc] text-white' : 'bg-[#e1e2e4] text-zinc-700 hover:bg-zinc-300/60'
                }`}
              >
                Lời mời
                {incomingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            </div>
          </header>

          {/* Mobile Search input */}
          <div className="border-b border-[#c2c6d8]/40 bg-[#f8f9fb] px-4 py-3 lg:hidden">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-zinc-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm kiếm theo số điện thoại, email hoặc username..."
                className="h-10 w-full rounded-lg bg-zinc-100/80 border border-zinc-200/50 pl-9 pr-9 text-xs outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#0052cc]/15 focus:border-[#0052cc]"
              />
              {searchLoading ? (
                <span className="absolute right-3 text-[#0052cc]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {renderSearchResults()}
            
            {/* Mobile Tab Swappers */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  activeTab === 'friends' ? 'bg-[#dae2ff] text-[#0052cc]' : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                Bạn bè ({friends.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requests_incoming')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  activeTab === 'requests_incoming' ? 'bg-[#dae2ff] text-[#0052cc]' : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                Nhận ({incomingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requests_outgoing')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  activeTab === 'requests_outgoing' ? 'bg-[#dae2ff] text-[#0052cc]' : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                Gửi ({outgoingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('blocked')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  activeTab === 'blocked' ? 'bg-[#dae2ff] text-[#0052cc]' : 'bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                Chặn ({blockedUsers.length})
              </button>
            </div>
          </div>

          {/* Grid list view */}
          <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {activeTab === 'friends' && (
              <>
                {sortedFriends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 bg-white rounded-xl border border-zinc-100 max-w-md mx-auto mt-10">
                    <p className="text-sm font-semibold">Danh sách bạn bè trống</p>
                    <p className="text-xs text-zinc-400 mt-1">Tìm kiếm và kết bạn với mọi người để bắt đầu cuộc trò chuyện.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {sortedFriends.map((user) => (
                      <article key={user.userId} className="flex items-center justify-between rounded-xl bg-white p-4 border border-zinc-100 hover:border-zinc-200/80 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${getAvatarColor(user.name).bg}`}>
                              {toInitials(user.name)}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                                user.isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                            <p className="text-xs text-[#727687]">{user.isOnline ? 'Đang hoạt động' : formatLastSeen(user.lastSeenAt)}</p>
                          </div>
                        </div>

                        {/* Friend Action Dropdown Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownUserId(activeDropdownUserId === user.userId ? null : user.userId);
                            }}
                            className="rounded-full p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                          >
                            <MoreVertical className="h-4.5 w-4.5" />
                          </button>
                          
                          {activeDropdownUserId === user.userId && (
                            <div className="absolute right-0 mt-1.5 w-44 z-30 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDropdownUserId(null);
                                  goToPrivateChat(user.userId);
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                              >
                                Nhắn tin
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDropdownUserId(null);
                                  setUnfriendTarget(user);
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Hủy kết bạn
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDropdownUserId(null);
                                  void handleBlock(user.userId);
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                              >
                                Chặn người dùng
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {friendsCursor && (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const page = await fetchFriends(friendsCursor);
                        setFriends((prev) => [...prev, ...page.items]);
                        setFriendsCursor(page.nextCursor);
                      })()
                    }
                    className="mt-6 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm"
                  >
                    Xem thêm bạn bè
                  </button>
                )}
              </>
            )}

            {activeTab === 'requests_incoming' && (
              <>
                {incomingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 bg-white rounded-xl border border-zinc-100 max-w-md mx-auto mt-10">
                    <p className="text-sm font-semibold">Không có lời mời kết bạn</p>
                    <p className="text-xs text-zinc-400 mt-1">Khi người khác gửi lời mời cho bạn, họ sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {incomingRequests.map((user) => (
                      <article key={user.userId} className="flex flex-col gap-3 rounded-xl bg-white p-4 border border-zinc-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${getAvatarColor(user.name).bg}`}>
                            {toInitials(user.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                            <p className="text-xs text-[#727687] truncate">{user.email}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => void handleAcceptRequest(user.userId)}
                            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                          >
                            Chấp nhận
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRejectRequest(user.userId)}
                            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBlock(user.userId)}
                            className="rounded-lg border border-red-150 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                          >
                            Chặn
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {incomingRequestsCursor && (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const page = await fetchIncomingRequests(incomingRequestsCursor);
                        setIncomingRequests((prev) => [...prev, ...page.items]);
                        setIncomingRequestsCursor(page.nextCursor);
                      })()
                    }
                    className="mt-6 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700"
                  >
                    Xem thêm lời mời
                  </button>
                )}
              </>
            )}

            {activeTab === 'requests_outgoing' && (
              <>
                {outgoingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 bg-white rounded-xl border border-zinc-100 max-w-md mx-auto mt-10">
                    <p className="text-sm font-semibold">Chưa gửi lời mời nào</p>
                    <p className="text-xs text-zinc-400 mt-1">Khi bạn gửi lời mời cho người khác, chúng sẽ được lưu ở đây.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {outgoingRequests.map((user) => (
                      <article key={user.userId} className="flex items-center justify-between rounded-xl bg-white p-4 border border-zinc-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${getAvatarColor(user.name).bg}`}>
                            {toInitials(user.name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                            <p className="text-xs text-[#727687]">{user.email}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleCancelRequest(user.userId)}
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                          Hủy lời mời
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {outgoingRequestsCursor && (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const page = await fetchOutgoingRequests(outgoingRequestsCursor);
                        setOutgoingRequests((prev) => [...prev, ...page.items]);
                        setOutgoingRequestsCursor(page.nextCursor);
                      })()
                    }
                    className="mt-6 rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700"
                  >
                    Xem thêm lời mời đã gửi
                  </button>
                )}
              </>
            )}

            {activeTab === 'blocked' && (
              <>
                {blockedUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 bg-white rounded-xl border border-zinc-100 max-w-md mx-auto mt-10">
                    <p className="text-sm font-semibold">Danh sách chặn trống</p>
                    <p className="text-xs text-zinc-400 mt-1">Khi bạn chặn ai đó, họ sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {blockedUsers.map((user) => (
                      <article key={user.userId} className="flex items-center justify-between rounded-xl bg-white p-4 border border-zinc-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 flex-shrink-0 rounded-full bg-red-50 text-red-700 flex items-center justify-center font-bold text-sm">
                            {toInitials(user.name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                            <p className="text-xs text-[#727687]">{user.email}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleUnblock(user.userId)}
                          className="rounded-lg border border-emerald-250 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          Bỏ chặn
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {blockedUsersCursor && (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const page = await fetchBlockedUsers(blockedUsersCursor);
                        setBlockedUsers((prev) => [...prev, ...page.items]);
                        setBlockedUsersCursor(page.nextCursor);
                      })()
                    }
                    className="mt-6 rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700"
                  >
                    Xem thêm danh sách chặn
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p className="fixed bottom-4 right-4 z-50 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg">
          {error}
        </p>
      )}

      {loading && (
        <div className="fixed bottom-4 left-4 z-50 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-[#0052cc]" />
          <span>Đang xử lý...</span>
        </div>
      )}

      {isMobileRailOpen && (
        <>
          <button
            type="button"
            aria-label="Đóng thanh điều hướng"
            className="fixed inset-0 z-40 bg-slate-900/35 md:hidden"
            onClick={() => setIsMobileRailOpen(false)}
          />
          <ChatAppRail
            activeNav="contacts"
            avatarUrl={currentUser?.avatarUrl || undefined}
            initials={toInitials(currentUser?.name) || undefined}
            mobileOpen
            onRequestClose={() => setIsMobileRailOpen(false)}
          />
        </>
      )}

      {unfriendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-6 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                Hủy kết bạn
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Bạn có chắc chắn muốn hủy kết bạn với <strong>{unfriendTarget.name}</strong>?
              </p>
            </div>

            <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setUnfriendTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = unfriendTarget;
                  setUnfriendTarget(null);
                  void runAction(async () => {
                    await unfriend(target.userId);
                  });
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
