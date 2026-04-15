"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/common/Icon";
import { SocialUser, fetchFriends } from "@/lib/social";
import { addGroupMember } from "@/lib/chat-groups";

interface AddGroupMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  existingMemberIds: string[];
  onMemberAdded?: () => void;
}

export default function AddGroupMemberModal({
  isOpen,
  onClose,
  groupId,
  existingMemberIds,
  onMemberAdded,
}: AddGroupMemberModalProps) {
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);
    void fetchFriends()
      .then((result) => {
        if (!mounted) return;
        // Filter out friends who are already members
        const availableFriends = result.items.filter(
          (f) => !existingMemberIds.includes(f.userId),
        );
        setFriends(availableFriends);
      })
      .catch(() => {
        if (!mounted) return;
        setFriends([]);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, existingMemberIds]);

  const filteredFriends = friends.filter((f) => {
    const keyword = searchKeyword.toLowerCase();
    return (
      f.name.toLowerCase().includes(keyword) ||
      f.email.toLowerCase().includes(keyword)
    );
  });

  const handleToggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAddMembers = async () => {
    if (selectedIds.length === 0) return;

    setIsLoading(true);
    setError("");

    try {
      for (const userId of selectedIds) {
        await addGroupMember(groupId, userId);
      }
      onMemberAdded?.();
      onClose();
      setSelectedIds([]);
      setSearchKeyword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể thêm thành viên",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[min(86vh,500px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Thêm thành viên
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="xmark" size="lg" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-200 px-6 py-3">
          <div className="relative">
            <Icon
              name="search"
              size="sm"
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm tên hoặc email"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Icon
                name="spinner"
                size="xl"
                className="text-slate-400 animate-spin"
              />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-slate-500">
                {friends.length === 0
                  ? "Không có bạn bè nào"
                  : "Không tìm thấy kết quả khớp"}
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-3">
              {filteredFriends.map((friend) => {
                const isSelected = selectedIds.includes(friend.userId);
                return (
                  <button
                    key={friend.userId}
                    type="button"
                    onClick={() => handleToggle(friend.userId)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${isSelected ? "bg-sky-50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                      {friend.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {friend.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {friend.isOnline ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Icon
                              name="circle"
                              solid
                              size="xs"
                              className="inline"
                            />
                            Đang hoạt động
                          </span>
                        ) : (
                          "Ngoại tuyến"
                        )}
                      </p>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${isSelected ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"}`}
                    >
                      {isSelected && (
                        <Icon
                          name="check"
                          solid
                          size="xs"
                          className="text-white"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="border-t border-slate-200 bg-red-50 px-6 py-3">
            <p className="text-xs text-red-700">
              <Icon name="exclamation-circle" className="mr-2" />
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={handleAddMembers}
            disabled={selectedIds.length === 0 || isLoading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white transition hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Icon name="spinner" size="sm" className="mr-2 animate-spin" />
                Đang thêm...
              </>
            ) : (
              `Thêm ${selectedIds.length} thành viên`
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}
