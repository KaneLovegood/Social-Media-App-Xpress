"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getStoredUser, getValidAccessToken } from '@/lib/auth-client';
import { CHAT_EVENTS } from '@/lib/realtime/events';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { PresencePayload } from '@/lib/realtime/types';
import {
  acceptFriendRequest,
  blockUser,
  fetchFriends,
  fetchIncomingRequests,
  rejectFriendRequest,
  SearchUserItem,
  searchUsersByPhone,
  sendFriendRequest,
  SocialUser,
  unblockUser,
  unfriend,
} from '@/lib/social';

type TabKey = 'friends' | 'requests';

function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

function PresenceBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
      }`}
    >
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [friendsCursor, setFriendsCursor] = useState<string | null>(null);
  const [requests, setRequests] = useState<SocialUser[]>([]);
  const [requestsCursor, setRequestsCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedPhone = phoneQuery.replace(/\s+/g, '').trim();
  const canSearch = normalizedPhone.length >= 4;

  const loadInitial = async () => {
    const [friendsPage, requestsPage] = await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
    ]);
    setFriends(friendsPage.items);
    setFriendsCursor(friendsPage.nextCursor);
    setRequests(requestsPage.items);
    setRequestsCursor(requestsPage.nextCursor);
  };

  useEffect(() => {
    void loadInitial().catch((e) => {
      setError(e instanceof Error ? e.message : 'Không tải được danh bạ');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socketCleanup: (() => void) | undefined;

    void getValidAccessToken().then((token) => {
      if (!token || cancelled) return;

      const socket = createChatSocket(token);
      const onPresence = (payload: PresencePayload) => {
        setFriends((prev) =>
          prev.map((item) =>
            item.userId === payload.userId
              ? { ...item, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt }
              : item,
          ),
        );
        setRequests((prev) =>
          prev.map((item) =>
            item.userId === payload.userId
              ? { ...item, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt }
              : item,
          ),
        );
        setSearchResults((prev) =>
          prev.map((item) =>
            item.userId === payload.userId
              ? { ...item, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt }
              : item,
          ),
        );
      };

      socket.on(CHAT_EVENTS.PRESENCE, onPresence);
      socketCleanup = () => {
        socket.off(CHAT_EVENTS.PRESENCE, onPresence);
        socket.disconnect();
      };
    });

    return () => {
      cancelled = true;
      socketCleanup?.();
    };
  }, []);

  const friendIds = useMemo(() => new Set(friends.map((item) => item.userId)), [friends]);
  const currentUserId = getStoredUser()?.userId ?? '';

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) return;

    setLoading(true);
    setError('');
    try {
      const page = await searchUsersByPhone(normalizedPhone);
      setSearchResults(page.items);
      setSearchCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tìm kiếm thất bại');
    } finally {
      setLoading(false);
    }
  };

  const reloadLists = async () => {
    const [friendsPage, requestsPage] = await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
    ]);
    setFriends(friendsPage.items);
    setFriendsCursor(friendsPage.nextCursor);
    setRequests(requestsPage.items);
    setRequestsCursor(requestsPage.nextCursor);
  };

  const runAction = async (task: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await task();
      await reloadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const goToPrivateChat = (peerUserId: string) => {
    if (!currentUserId) {
      router.push(`/chat/me?peerUserId=${encodeURIComponent(peerUserId)}`);
      return;
    }

    const roomId = toPrivateRoomId(currentUserId, peerUserId);
    router.push(`/chat/me?roomId=${encodeURIComponent(roomId)}`);
  };

  return (
    <main className="flex h-full w-full overflow-hidden bg-[#f8f9fb] text-[#191c1e]">
      <section className="flex flex-1 overflow-hidden">
        <div className="hidden w-80 flex-col bg-[#ffffff] lg:flex">
          <header className="flex h-16 items-center px-6">
            <h1 className="text-xl font-semibold">Danh bạ</h1>
          </header>

          <div className="px-4 pb-4">
            <form className="relative" onSubmit={onSearch}>
              <input
                value={phoneQuery}
                onChange={(event) => setPhoneQuery(event.target.value)}
                placeholder="Tìm theo số điện thoại"
                className="h-10 w-full rounded-lg border-none bg-[#e1e2e4] px-3 text-sm outline-none"
              />
            </form>

            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  activeTab === 'requests'
                    ? 'bg-[#dae2ff] text-[#0052cc]'
                    : 'text-[#424655] hover:bg-[#e1e2e4]'
                }`}
              >
                <span>Lời mời kết bạn</span>
                <span className="ml-auto rounded-full bg-[#0052cc] px-1.5 py-0.5 text-[10px] text-white">
                  {requests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`w-full rounded-lg px-3 py-3 text-left text-sm font-medium ${
                  activeTab === 'friends'
                    ? 'bg-[#dae2ff] text-[#0052cc]'
                    : 'text-[#424655] hover:bg-[#e1e2e4]'
                }`}
              >
                Tất cả bạn bè
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="mt-5">
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[#727687]">
                  Kết quả tìm kiếm
                </p>
                <ul className="mt-2 space-y-2">
                  {searchResults.map((user) => {
                    const isFriend = user.friendStatus === 'FRIEND' || friendIds.has(user.userId);
                    return (
                      <li key={user.userId} className="rounded-lg bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{user.name}</p>
                            <p className="text-xs text-[#727687]">{user.phone}</p>
                          </div>
                          <PresenceBadge isOnline={user.isOnline} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!isFriend && !user.blockedByMe && !user.blockedMe ? (
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(async () => {
                                  await sendFriendRequest(user.userId);
                                })
                              }
                              className="rounded-md bg-[#0052cc] px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Kết bạn
                            </button>
                          ) : null}
                          {isFriend ? (
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(async () => {
                                  await unfriend(user.userId);
                                })
                              }
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold"
                            >
                              Hủy kết bạn
                            </button>
                          ) : null}
                          {!user.blockedByMe ? (
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(async () => {
                                  await blockUser(user.userId);
                                })
                              }
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                            >
                              Chặn
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(async () => {
                                  await unblockUser(user.userId);
                                })
                              }
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            >
                              Bỏ chặn
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {searchCursor ? (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const page = await searchUsersByPhone(normalizedPhone, searchCursor);
                        setSearchResults((prev) => [...prev, ...page.items]);
                        setSearchCursor(page.nextCursor);
                      })()
                    }
                    className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs font-semibold"
                  >
                    Xem thêm kết quả
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-[#c2c6d8]/40 bg-[#f8f9fb] px-4 lg:px-8">
            <h2 className="text-lg font-bold">{activeTab === 'friends' ? 'Tất cả bạn bè' : 'Yêu cầu kết bạn'}</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  activeTab === 'friends' ? 'bg-[#0052cc] text-white' : 'bg-[#e1e2e4] text-zinc-700'
                }`}
              >
                Bạn bè
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  activeTab === 'requests' ? 'bg-[#0052cc] text-white' : 'bg-[#e1e2e4] text-zinc-700'
                }`}
              >
                Lời mời
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {(activeTab === 'friends' ? friends : requests).map((user) => (
                <article key={user.userId} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                      <p className="text-xs text-[#727687]">{user.phone}</p>
                    </div>
                    <PresenceBadge isOnline={user.isOnline} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTab === 'requests' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(async () => {
                              await acceptFriendRequest(user.userId);
                              goToPrivateChat(user.userId);
                            })
                          }
                          className="rounded-full bg-[#dae2ff] px-3 py-1.5 text-xs font-semibold text-[#0052cc]"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(async () => {
                              await rejectFriendRequest(user.userId);
                            })
                          }
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                        >
                          Từ chối
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => goToPrivateChat(user.userId)}
                          className="rounded-full bg-[#dae2ff] px-3 py-1.5 text-xs font-semibold text-[#0052cc]"
                        >
                          Chat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(async () => {
                              await unfriend(user.userId);
                            })
                          }
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                        >
                          Hủy kết bạn
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {activeTab === 'friends' && friendsCursor ? (
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const page = await fetchFriends(friendsCursor);
                    setFriends((prev) => [...prev, ...page.items]);
                    setFriendsCursor(page.nextCursor);
                  })()
                }
                className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold"
              >
                Xem thêm bạn bè
              </button>
            ) : null}

            {activeTab === 'requests' && requestsCursor ? (
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const page = await fetchIncomingRequests(requestsCursor);
                    setRequests((prev) => [...prev, ...page.items]);
                    setRequestsCursor(page.nextCursor);
                  })()
                }
                className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold"
              >
                Xem thêm lời mời
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="fixed bottom-4 right-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="fixed bottom-4 left-4 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600">
          Dang xu ly...
        </p>
      ) : null}
    </main>
  );
}
