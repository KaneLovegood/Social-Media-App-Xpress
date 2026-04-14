"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SocialUser } from "@/lib/social";

interface CreateGroupModalProps {
  isOpen: boolean;
  currentPeerUserId?: string;
  currentPeerName?: string;
  friends: SocialUser[];
  loadingFriends: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    avatarUrl?: string;
    description?: string;
    memberIds: string[];
  }) => Promise<void>;
}

export default function CreateGroupModal({
  isOpen,
  currentPeerUserId,
  currentPeerName,
  friends,
  loadingFriends,
  onClose,
  onSubmit,
}: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(currentPeerUserId ? [currentPeerUserId] : []);
    setQuery("");
    setName("");
    setAvatarPreview("");
    setError("");
  }, [currentPeerUserId, isOpen]);

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return friends;

    return friends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(normalized) ||
        friend.phone.toLowerCase().includes(normalized) ||
        friend.userId.toLowerCase().includes(normalized)
      );
    });
  }, [friends, query]);

  if (!isOpen) return null;

  const toggleFriend = (userId: string) => {
    if (userId === currentPeerUserId) return;

    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((item) => item !== userId)
        : [...prev, userId],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      await onSubmit({
        name: name.trim(),
        avatarUrl: avatarPreview || undefined,
        memberIds: selectedIds,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Tạo nhóm thất bại",
      );
    }
  };

  const selectedCountLabel = `${String(selectedIds.length).padStart(2, "0")} / 100`;

  const onPickAvatar = () => {
    avatarInputRef.current?.click();
  };

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAvatarPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 px-4 py-5 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-260 min-h-175 flex-col overflow-hidden rounded-[40px] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
        <div className="flex items-start justify-between px-9 pb-4 pt-7">
          <div>
            <p className="text-[32px] font-black leading-none text-[#1f2937]">
              Tạo nhóm mới
            </p>
            <p className="mt-2 text-[14px] text-[#7a8194]">
              Kết nối những người bạn yêu quý
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f8]"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={submit}
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.18fr_0.82fr]"
        >
          <div className="min-h-0 overflow-y-auto px-9 pb-9 pt-3 lg:pr-5">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={onPickAvatar}
                  className="group relative flex h-22 w-22 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-dashed border-[#ccd3e4] bg-[#eef1f7] text-[#9aa3b6] shadow-sm"
                  aria-label="Chọn ảnh nhóm"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[32px]">📷</span>
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1064d8] text-[16px] font-black leading-none text-white shadow-lg">
                    +
                  </span>
                </button>

                <div className="min-w-0 flex-1 pt-7">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Đặt tên nhóm..."
                    className="w-full border-0 border-b border-[#e6ebf2] bg-transparent pb-2.5 text-[22px] font-black tracking-[-0.02em] text-[#1f2937] outline-none placeholder:text-[#c8cfdb]"
                    required
                  />
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarChange}
                />
              </div>

              <div className="rounded-2xl bg-white px-0 pt-1">
                {error ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <label className="flex items-center gap-3 rounded-[22px] bg-[#f7f9fe] px-5 py-4.5 ring-1 ring-[#edf1f7]">
                  <span className="text-[#9aa3b6]">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm kiếm theo tên hoặc SĐT"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#aab3c3]"
                  />
                </label>

                <div className="mt-7">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#a5adbd]">
                    Gợi ý bạn bè
                  </p>

                  <div className="max-h-[50vh] overflow-y-auto pr-1">
                    {loadingFriends ? (
                      <p className="text-sm text-[#75809a]">
                        Đang tải danh sách bạn bè...
                      </p>
                    ) : filteredFriends.length === 0 ? (
                      <p className="text-sm text-[#75809a]">
                        Chưa có bạn bè phù hợp.
                      </p>
                    ) : (
                      <ul className="space-y-3.5">
                        {filteredFriends.map((friend) => {
                          const selected = selectedIds.includes(friend.userId);
                          const locked = friend.userId === currentPeerUserId;
                          const statusText = locked
                            ? "Bạn của bạn"
                            : friend.isOnline
                              ? "Vừa mới truy cập"
                              : friend.lastSeenAt
                                ? "Offline"
                                : "Chưa hoạt động";

                          return (
                            <li key={friend.userId}>
                              <button
                                type="button"
                                onClick={() => toggleFriend(friend.userId)}
                                className={`flex w-full items-center gap-4 rounded-[22px] border px-4 py-3.5 text-left transition ${
                                  selected
                                    ? "border-[#d7e6ff] bg-[#f4f8ff] shadow-[0_0_0_1px_rgba(16,100,216,0.08)]"
                                    : "border-transparent bg-transparent hover:border-[#e6ebf5] hover:bg-[#fbfcfe]"
                                }`}
                              >
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#d9e1ef]">
                                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#1d7ef7] to-[#0f5ed0] text-[15px] font-black text-white">
                                    {friend.name.slice(0, 1).toUpperCase()}
                                  </div>
                                  {friend.isOnline ? (
                                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                  ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[16px] font-semibold text-[#1f2937]">
                                    {friend.name}
                                  </p>
                                  <p className="mt-1 truncate text-[12px] text-[#9098aa]">
                                    {statusText}
                                  </p>
                                </div>

                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border text-[12px] font-black ${
                                    selected
                                      ? "border-[#1064d8] bg-[#1064d8] text-white"
                                      : "border-[#d5dbe7] bg-white text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col border-t border-[#eef1f7] bg-[#f8f9fc] px-7 pb-7 pt-8 lg:border-l lg:border-t-0 lg:px-8">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold text-[#1f2937]">
                Đã chọn
              </p>
              <span className="rounded-full bg-[#eaf1ff] px-3 py-1.5 text-[12px] font-semibold text-[#1064d8]">
                {selectedCountLabel}
              </span>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              {selectedIds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d8deea] bg-white px-4 py-7 text-sm text-[#8790a2]">
                  Chưa chọn ai.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedIds.map((userId) => {
                    const friend = friends.find(
                      (item) => item.userId === userId,
                    );
                    const displayName = friend?.name ?? userId;

                    return (
                      <div
                        key={userId}
                        className="flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-[#eef2f8]"
                      >
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#1d7ef7] to-[#0f5ed0] text-[15px] font-black text-white">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[#1f2937]">
                            {displayName}
                          </p>
                          <p className="truncate text-[12px] text-[#8b93a4]">
                            {friend?.phone ?? userId}
                          </p>
                        </div>
                        {userId !== currentPeerUserId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIds((prev) =>
                                prev.filter((item) => item !== userId),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[#b4bbc8] transition hover:bg-[#f3f5f9] hover:text-[#7b8394]"
                            aria-label={`Bỏ chọn ${displayName}`}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-[#eef1f7] pt-5">
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#1064d8] px-4 py-4 text-[16px] font-semibold text-white shadow-[0_14px_28px_rgba(16,100,216,0.25)] transition hover:bg-[#0f5ed0]"
              >
                Tạo nhóm ngay
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full text-center text-[13px] font-medium text-[#70788b] transition hover:text-[#1f2937]"
              >
                Hủy bỏ
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
