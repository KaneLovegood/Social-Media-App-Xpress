"use client";

import { useMemo } from "react";
import { GroupDetail, GroupSummary } from "@/lib/groups";
import { ChatMessage } from "@/lib/realtime/types";

interface ConversationInfoPanelProps {
  currentUserId: string;
  peerName: string;
  peerUserId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  selectedMessage?: ChatMessage | null;
  onCreateGroup: () => void;
  onClearGroupHistory?: () => void;
  onLeaveGroup?: () => void;
  onDisbandGroup?: () => void;
  notice?: string;
  selectedGroup?: GroupDetail | GroupSummary | null;
  groupMessages?: ChatMessage[];
}

interface GroupAttachmentItem {
  name: string;
  createdAt: string;
  kind: "image" | "video" | "file";
}

function initials(value: string) {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
}

function getGroupMembers(selectedGroup: GroupDetail | GroupSummary) {
  return "members" in selectedGroup ? selectedGroup.members : [];
}

function getGroupAvatarLabel(selectedGroup: GroupDetail | GroupSummary) {
  if (selectedGroup.emoji) return selectedGroup.emoji;
  const members = getGroupMembers(selectedGroup);
  const count = members.length || selectedGroup.memberCount;
  if (count >= 10) return String(count).slice(0, 2);
  return initials(selectedGroup.name);
}

function getGroupAvatarSeeds(selectedGroup: GroupDetail | GroupSummary) {
  const members = getGroupMembers(selectedGroup)
    .slice(0, 3)
    .map((member) => initials(member.name));

  if (members.length >= 3) {
    return members;
  }

  const fallback = getGroupAvatarLabel(selectedGroup);
  return [...members, fallback, initials(selectedGroup.name)].slice(0, 3);
}

function extractGroupAttachments(
  messages: ChatMessage[] | undefined,
): GroupAttachmentItem[] {
  if (!messages?.length) return [];

  const items: GroupAttachmentItem[] = [];
  const fileTokenPattern = /\[file:([^\]]+)\]/g;
  const imagePattern = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
  const videoPattern = /\.(mp4|mov|webm|mkv|avi)$/i;

  messages.forEach((message) => {
    const matches = Array.from(message.content.matchAll(fileTokenPattern));
    matches.forEach((match) => {
      const name = match[1]?.trim();
      if (!name) return;

      const kind: GroupAttachmentItem["kind"] = imagePattern.test(name)
        ? "image"
        : videoPattern.test(name)
          ? "video"
          : "file";

      items.push({ name, createdAt: message.createdAt, kind });
    });
  });

  return items;
}

function formatBytesLabel(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension) return "Tệp đính kèm";

  if (
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"].includes(extension)
  ) {
    return "Ảnh";
  }

  if (["mp4", "mov", "webm", "mkv", "avi"].includes(extension)) {
    return "Video";
  }

  return "File";
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ConversationInfoPanel({
  currentUserId,
  peerName,
  peerUserId,
  isOnline,
  lastSeenAt,
  selectedMessage,
  onCreateGroup,
  onClearGroupHistory,
  onLeaveGroup,
  onDisbandGroup,
  notice,
  selectedGroup,
  groupMessages,
}: ConversationInfoPanelProps) {
  const isGroupView = Boolean(selectedGroup);
  const groupAttachments = useMemo(
    () => extractGroupAttachments(groupMessages),
    [groupMessages],
  );
  const mediaItems = groupAttachments.filter(
    (item) => item.kind === "image" || item.kind === "video",
  );
  const fileItems = groupAttachments.filter((item) => item.kind === "file");
  const canDisbandGroup = Boolean(
    selectedGroup &&
    "ownerUserId" in selectedGroup &&
    selectedGroup.ownerUserId === currentUserId,
  );

  return (
    <aside className="hidden h-full min-h-0 w-80 shrink-0 border-l border-[#d9deea] bg-[#fbfcff] lg:flex lg:flex-col xl:w-88">
      <div className="border-b border-[#e7e8ef] px-5 py-4">
        <p className="text-center text-xl font-black text-[#152033]">
          {isGroupView ? "Thông tin nhóm" : "Thông tin hội thoại"}
        </p>
        <p className="mt-1 text-center text-[12px] text-[#75809a]">
          {isGroupView
            ? "Xem nhanh nhóm trò chuyện, media và thiết lập."
            : "Xem nhanh người đang chat và tạo nhóm trò chuyện."}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {isGroupView && selectedGroup ? (
          <>
            <section className="rounded-3xl border border-[#e7ebf3] bg-white px-4 py-5 shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
              <div className="flex justify-center">
                <div className="relative h-18 w-24">
                  {getGroupAvatarSeeds(selectedGroup).map((seed, index) => (
                    <div
                      key={`${seed}-${index}`}
                      className="absolute top-0 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-linear-to-br from-[#eaf1fb] to-[#dbe4f3] text-[14px] font-black text-[#36507f] shadow-sm"
                      style={{ left: `${index * 22}px` }}
                    >
                      {seed}
                    </div>
                  ))}
                  <div className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#c8d2e3] text-[16px] font-black text-[#516382] shadow-sm">
                    {selectedGroup.memberCount > 99
                      ? "99+"
                      : String(selectedGroup.memberCount)}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                <p className="max-w-56 truncate text-center text-[17px] font-black leading-tight text-[#152c4f]">
                  {selectedGroup.name}
                </p>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9edf4] text-[#526480] transition hover:bg-[#dde4ef]"
                  aria-label="Chỉnh sửa nhóm"
                >
                  ✎
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs font-medium text-[#31415f]">
                <button
                  type="button"
                  className="rounded-2xl bg-[#f2f4f9] px-3 py-3.5 transition hover:bg-[#e9edf6]"
                >
                  <span className="mb-1 block text-2xl">🔔</span>
                  <span className="text-[15px] font-semibold text-[#152c4f]">
                    Tắt thông báo
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#f2f4f9] px-3 py-3.5 transition hover:bg-[#e9edf6]"
                >
                  <span className="mb-1 block text-2xl text-[#6a57c8]">✚</span>
                  <span className="text-[15px] font-semibold text-[#152c4f]">
                    Thêm thành viên
                  </span>
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7ebf3] bg-white shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-black text-[#152033]">
                  Ảnh/Video
                </span>
                <span className="text-[#66758f]">▾</span>
              </button>
              <div className="border-t border-[#edf1f6] px-4 py-4">
                {mediaItems.length > 0 ? (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {mediaItems.slice(0, 8).map((item, index) => (
                        <div
                          key={`${item.name}-${index}`}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl bg-[#f3f6fc] p-2 text-center"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                            {item.kind === "video" ? "🎞" : "🖼"}
                          </div>
                          <p className="mt-2 line-clamp-2 text-[10px] font-medium text-[#31415f]">
                            {item.name}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-xl bg-[#e5e9f2] px-4 py-2.5 text-sm font-semibold text-[#20355c]"
                    >
                      Xem tất cả
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-[#75809a]">
                    Chưa có ảnh hoặc video nào trong nhóm.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7ebf3] bg-white shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-black text-[#152033]">
                  File
                </span>
                <span className="text-[#66758f]">▾</span>
              </button>
              <div className="border-t border-[#edf1f6] px-4 py-4">
                {fileItems.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {fileItems.slice(0, 4).map((item, index) => (
                        <div
                          key={`${item.name}-${index}`}
                          className="flex items-center gap-3 rounded-2xl bg-white px-0 py-1"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff6666] text-sm font-black text-white shadow-sm">
                            PDF
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-[#152033]">
                              {item.name}
                            </p>
                            <p className="text-[12px] text-[#75809a]">
                              {formatBytesLabel(item.name)} •{" "}
                              {formatDateLabel(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-xl bg-[#e5e9f2] px-4 py-2.5 text-sm font-semibold text-[#20355c]"
                    >
                      Xem tất cả
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-[#75809a]">
                    Chưa có file nào trong nhóm.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7ebf3] bg-white shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-black text-[#152033]">
                  Thiết lập bảo mật
                </span>
                <span className="text-[#66758f]">▾</span>
              </button>
              <div className="border-t border-[#edf1f6] px-4 py-4">
                <div className="flex items-start gap-3 rounded-2xl bg-[#f8faff] px-3 py-3 text-[#7d8798]">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                    ⏱
                  </div>
                  <div>
                    <p className="text-[15px] font-medium">Tin nhắn tự xóa</p>
                    <p className="mt-1 text-[13px] text-[#9aa3b6]">
                      Chỉ dành cho trưởng hoặc phó nhóm
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl px-1 py-1">
                  <div className="flex items-center gap-3 text-[#31415f]">
                    <span className="text-xl">👁</span>
                    <p className="text-[15px]">Ẩn trò chuyện</p>
                  </div>
                  <div className="h-6 w-11 rounded-full bg-[#d1d5db] p-1">
                    <div className="h-4 w-4 rounded-full bg-white shadow-sm" />
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-4 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-[#e11d1d]"
                >
                  <span className="text-xl">⚠</span>
                  <span className="text-[15px]">Báo xấu</span>
                </button>

                <button
                  type="button"
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-[#e11d1d]"
                  onClick={onClearGroupHistory}
                >
                  <span className="text-xl">🗑</span>
                  <span className="text-[15px]">Xóa lịch sử trò chuyện</span>
                </button>

                <button
                  type="button"
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-[#e11d1d]"
                  onClick={onLeaveGroup}
                >
                  <span className="text-xl">↩</span>
                  <span className="text-[15px]">Rời nhóm</span>
                </button>

                {canDisbandGroup ? (
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-[#e11d1d]"
                    onClick={onDisbandGroup}
                  >
                    <span className="text-xl">⛔</span>
                    <span className="text-[15px]">Giải tán nhóm</span>
                  </button>
                ) : null}
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7ebf3] bg-white shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-black text-[#152033]">
                  Thành viên nhóm
                </span>
                <span className="text-[#66758f]">▾</span>
              </button>
              <div className="border-t border-[#edf1f6] px-4 py-4">
                <div className="flex items-center gap-3 text-[#31415f]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f5fb] text-lg">
                    👥
                  </div>
                  <p className="text-[15px] font-medium">
                    {selectedGroup.memberCount} thành viên
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {getGroupMembers(selectedGroup)
                    .slice(0, 5)
                    .map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 rounded-2xl bg-[#f8faff] px-3 py-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-[#0052cc] to-[#00a3ff] text-sm font-black text-white">
                          {initials(member.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#152033]">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-[#75809a]">
                            {member.role}
                            {member.nickname ? ` • ${member.nickname}` : ""}
                          </p>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${member.isOnline ? "bg-emerald-500" : "bg-zinc-300"}`}
                        />
                      </div>
                    ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-3xl bg-[#f8faff] px-4 py-5 shadow-sm ring-1 ring-[#e8eefc]">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-linear-to-br from-[#0052cc] to-[#00a3ff] text-xl font-black text-white">
                {initials(peerName)}
              </div>
              <div className="mt-4 text-center">
                <p className="text-lg font-bold text-[#152033]">{peerName}</p>
                <p className="mt-1 text-xs text-[#75809a]">{peerUserId}</p>
                <p
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isOnline ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {isOnline
                    ? "Đang online"
                    : lastSeenAt
                      ? `Offline từ ${new Date(lastSeenAt).toLocaleString()}`
                      : "Offline"}
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7e8ef] bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-[#152033]">
                Hành động nhanh
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#40506a]">
                <button
                  type="button"
                  className="rounded-2xl bg-[#f3f6ff] px-2 py-3 hover:bg-[#e8efff]"
                  onClick={onCreateGroup}
                >
                  <span className="block text-base">＋</span>
                  Tạo nhóm
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#f3f6ff] px-2 py-3 hover:bg-[#e8efff]"
                >
                  <span className="block text-base">📌</span>
                  Ghim
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#f3f6ff] px-2 py-3 hover:bg-[#e8efff]"
                >
                  <span className="block text-base">🔕</span>
                  Tắt báo
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-[#e7e8ef] bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-[#152033]">
                Tin nhắn đã chọn
              </p>
              {selectedMessage ? (
                <div className="mt-3 space-y-2 rounded-2xl bg-[#f8faff] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#75809a]">
                    <span>
                      {selectedMessage.senderId === peerUserId
                        ? peerName
                        : "Bạn"}
                    </span>
                    <span>
                      {new Date(selectedMessage.createdAt).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                  </div>
                  <p className="wrap-break-word whitespace-pre-wrap text-[#152033]">
                    {selectedMessage.content}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#75809a]">
                  Bấm vào một tin nhắn để xem chi tiết ở đây.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
