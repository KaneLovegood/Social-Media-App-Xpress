"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Camera, Loader2, X } from "lucide-react";
import { fetchFriends, SocialUser } from "@/lib/social";
import { createGroupRoom, type GroupRoomDetails } from "@/lib/chat-groups";
import { getPresignedUrl, uploadFileToS3 } from "@/lib/chat-upload";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (groupDetails: GroupRoomDetails) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const MIN_GROUP_MEMBERS = 3;
  const MIN_SELECTED_OTHERS = MIN_GROUP_MEMBERS - 1;

  const [title, setTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const selectedCount = selectedMemberIds.length;
  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      selectedCount >= MIN_SELECTED_OTHERS &&
      !isSubmitting,
    [MIN_SELECTED_OTHERS, isSubmitting, selectedCount, title],
  );

  const filteredFriends = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return friends;

    return friends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(keyword) ||
        friend.email.toLowerCase().includes(keyword)
      );
    });
  }, [friends, searchKeyword]);

  const selectedFriends = useMemo(() => {
    const selectedSet = new Set(selectedMemberIds);
    return friends.filter((friend) => selectedSet.has(friend.userId));
  }, [friends, selectedMemberIds]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle("");
    setSearchKeyword("");
    setSelectedMemberIds([]);
    setAvatarFile(null);
    setAvatarPreviewUrl("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((item) => item !== userId)
        : [...prev, userId],
    );
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui long chon tep anh cho anh dai dien nhom.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Anh dai dien nhom khong duoc vuot qua 5MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setError("");
  };

  const uploadGroupAvatar = async (): Promise<string | undefined> => {
    if (!avatarFile) return undefined;

    setIsUploadingAvatar(true);
    try {
      const signed = await getPresignedUrl(
        avatarFile.name,
        avatarFile.type,
        avatarFile.size,
      );
      await uploadFileToS3(signed.uploadUrl, avatarFile);
      return signed.publicUrl;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCount < MIN_SELECTED_OTHERS) {
      setError(
        `Nhóm cần tối thiểu ${MIN_GROUP_MEMBERS} người (bạn + ${MIN_SELECTED_OTHERS} thành viên).`,
      );
      return;
    }

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const avatarUrl = await uploadGroupAvatar();
      const result = await createGroupRoom({
        title: title.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
        memberUserIds: selectedMemberIds,
      });

      onCreated(result);
      onClose();
      resetForm();
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
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="rounded-full p-2 text-[#8a95ae] transition hover:bg-[#f1f4fb] hover:text-[#2f3e66]"
            aria-label="Đóng popup tạo nhóm"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[1.3fr_1fr]">
          <div className="flex min-h-0 flex-col border-r border-[#e3e8f2] bg-white">
            <div className="border-b border-[#edf1f7] px-6 pb-4 pt-5">
              <div className="flex items-center gap-3 rounded-[14px] border border-[#e6ebf5] bg-[#f7f9fd] px-3 py-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7ecf7] text-[#6f7fa3]"
                  aria-label="Tải ảnh nhóm"
                >
                  {avatarPreviewUrl ? (
                    <img
                      src={avatarPreviewUrl}
                      alt="Ảnh đại diện nhóm"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {avatarPreviewUrl ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[9px] font-semibold text-white">
                      Đổi
                    </span>
                  ) : null}
                </button>
                {avatarFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#9aa7c3] transition hover:bg-[#edf2fb] hover:text-[#33466f]"
                    aria-label="Xóa ảnh đại diện nhóm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
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
                  placeholder="Tìm kiếm tên hoặc email"
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
                {selectedCount}/100
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
                      <X className="h-4 w-4" />
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
                {isSubmitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {isUploadingAvatar ? "Đang tải ảnh..." : "Đang tạo..."}
                  </span>
                ) : (
                  "Tạo nhóm ngay"
                )}
              </button>
              {selectedCount < MIN_SELECTED_OTHERS ? (
                <p className="mt-2 text-xs text-[#c2410c]">
                  Cần chọn ít nhất {MIN_SELECTED_OTHERS} thành viên để tạo nhóm.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
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
          Mẹo: bạn có thể tìm kiếm theo tên hoặc email để thêm thành viên nhanh hơn.
        </div>
      </form>
    </div>
  );
}
