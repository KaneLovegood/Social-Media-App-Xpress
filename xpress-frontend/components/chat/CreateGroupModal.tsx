"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchFriends, SocialUser } from "@/lib/social";
import { createGroupRoom } from "@/lib/chat-groups";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const [title, setTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    void fetchFriends()
      .then((result) => {
        if (!mounted) return;
        setFriends(result.items);
      })
      .catch(() => {
        if (!mounted) return;
        setFriends([]);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !isSubmitting,
    [isSubmitting, title],
  );

  const filteredFriends = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return friends;

    return friends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(keyword) ||
        friend.phone.toLowerCase().includes(keyword)
      );
    });
  }, [friends, searchKeyword]);

  const selectedFriends = useMemo(() => {
    const selectedSet = new Set(selectedMemberIds);
    return friends.filter((friend) => selectedSet.has(friend.userId));
  }, [friends, selectedMemberIds]);

  if (!isOpen) return null;

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((item) => item !== userId)
        : [...prev, userId],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const result = await createGroupRoom({
        title: title.trim(),
        memberUserIds: selectedMemberIds,
      });

      onCreated(result.roomId);
      onClose();
      setTitle("");
      setSearchKeyword("");
      setSelectedMemberIds([]);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể tạo nhóm",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f354380] px-4 py-6 backdrop-blur-[2px]">
      <form
        onSubmit={handleSubmit}
        className="flex h-[min(86vh,680px)] w-full max-w-245 flex-col overflow-hidden rounded-[20px] border border-[#d8deea] bg-[#f4f6fb] shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-center justify-between border-b border-[#e3e8f2] bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1f2b46]">
              Tạo nhóm mới
            </h2>
            <p className="text-xs text-[#7e8aa8]">
              Khởi tạo nhóm với bạn bè của bạn
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8a95ae] transition hover:bg-[#f1f4fb] hover:text-[#2f3e66]"
            aria-label="Đóng popup tạo nhóm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[1.3fr_1fr]">
          <div className="flex min-h-0 flex-col border-r border-[#e3e8f2] bg-white">
            <div className="border-b border-[#edf1f7] px-6 pb-4 pt-5">
              <div className="flex items-center gap-3 rounded-[14px] border border-[#e6ebf5] bg-[#f7f9fd] px-3 py-2.5">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7ecf7] text-[#6f7fa3]"
                  aria-label="Tải ảnh nhóm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="4" y="6" width="16" height="12" rx="2" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m20 15-4.5-4.5L8 18" />
                  </svg>
                </button>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Đặt tên nhóm..."
                  className="w-full border-none bg-transparent text-[15px] font-medium text-[#253353] outline-none placeholder:text-[#9aa7c3]"
                />
              </div>

              <div className="mt-3 rounded-xl border border-[#e8edf7] bg-[#f8faff] px-3 py-2.5">
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Tìm kiếm tên hoặc số điện thoại"
                  className="w-full border-none bg-transparent text-sm text-[#33466f] outline-none placeholder:text-[#a1adc7]"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[#8d99b6]">
                Trò chuyện gần đây
              </p>
              <div className="space-y-1">
                {filteredFriends.map((friend) => {
                  const selected = selectedMemberIds.includes(friend.userId);
                  return (
                    <button
                      key={friend.userId}
                      type="button"
                      onClick={() => toggleMember(friend.userId)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected ? "bg-[#ecf2ff]" : "hover:bg-[#f5f8ff]"}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#101b32] text-xs font-semibold text-white">
                        {friend.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1f2d4d]">
                          {friend.name}
                        </p>
                        <p className="truncate text-xs text-[#90a0c2]">
                          {friend.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${selected ? "border-[#2a7fff] bg-[#2a7fff] text-white" : "border-[#d6deee] bg-white text-transparent"}`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
                {filteredFriends.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-[#93a2bf]">
                    Không tìm thấy người dùng phù hợp
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-[#f7f9ff]">
            <div className="flex items-center justify-between border-b border-[#e8edf8] px-5 py-4">
              <p className="text-[15px] font-semibold text-[#2a3859]">
                Đã chọn
              </p>
              <span className="rounded-full bg-[#e5efff] px-2.5 py-1 text-xs font-semibold text-[#2a76eb]">
                {selectedMemberIds.length}/100
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                {selectedFriends.map((friend) => (
                  <div
                    key={friend.userId}
                    className="flex items-center gap-2 rounded-xl border border-[#e3e9f5] bg-white px-2.5 py-2"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#101b32] text-[10px] font-semibold text-white">
                      {friend.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#2b3a5f]">
                      {friend.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleMember(friend.userId)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#9ba9c4] transition hover:bg-[#f1f5ff] hover:text-[#4b5f88]"
                      aria-label={`Bỏ chọn ${friend.name}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 6 18 18" />
                        <path d="M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {selectedFriends.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#d7e0f2] bg-white px-3 py-8 text-center text-sm text-[#98a7c3]">
                    Chưa chọn thành viên nào
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#e8edf8] px-5 py-4">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-[11px] bg-[#1f76ff] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(31,118,255,0.28)] transition hover:bg-[#0f69f7] disabled:cursor-not-allowed disabled:bg-[#9ec0f8]"
              >
                {isSubmitting ? "Đang tạo..." : "Tạo nhóm ngay"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2.5 w-full rounded-[11px] px-4 py-2.5 text-sm font-medium text-[#8a96b0] transition hover:bg-white"
              >
                Hủy bỏ
              </button>

              {error ? (
                <p className="mt-3 rounded-lg bg-[#fff1f2] px-3 py-2 text-xs text-[#be123c]">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[#e3e8f2] bg-white px-6 py-2 text-[11px] text-[#9aa5bf]">
          Mẹo: bạn có thể tìm kiếm theo tên hoặc số điện thoại để thêm thành
          viên nhanh hơn.
        </div>
      </form>
    </div>
  );
}
