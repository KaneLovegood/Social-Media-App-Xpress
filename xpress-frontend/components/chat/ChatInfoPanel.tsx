"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/common/Icon";
import { ChatRoomSummary } from "@/lib/chat-rooms";
import {
  createGroupInviteLink,
  GroupRoomDetails,
  fetchRoomFiles,
  fetchRoomImages,
  promoteGroupMember,
  removeGroupMember,
} from "@/lib/chat-groups";
import AddGroupMemberModal from "./modal/AddGroupMemberModal";
import MediaGalleryModal from "./modal/MediaGalleryModal";
import FilesListModal from "./modal/FilesListModal";
import DeleteChatHistoryModal from "./modal/DeleteChatHistoryModal";
import ShareGroupQrModal from "./modal/ShareGroupQrModal";

interface ChatInfoPanelProps {
  room: ChatRoomSummary | null;
  groupDetails: GroupRoomDetails | null;
  currentUserId: string;
  onLeaveGroup: () => void;
  onDissolveGroup: () => void;
  onOpenCreateGroup: () => void;
  onDeleteChatHistory?: () => Promise<void>;
  onMembersAdded?: () => void;
  onGroupDetailsChange?: (nextDetails: GroupRoomDetails) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function initials(value: string) {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  const variantClass =
    variant === "danger"
      ? "bg-red-50 text-red-700 hover:bg-red-100"
      : "bg-sky-50 text-sky-700 hover:bg-sky-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition ${variantClass}`}
    >
      <Icon name={icon} size="lg" />
      <span className="text-xs">{label}</span>
    </button>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon name="info-circle" size="sm" />
          {title}
        </h3>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MemberItem({
  member,
  currentUserId,
  isAdmin,
  isLoadingAction,
  onPromote,
  onRemove,
}: {
  member: any;
  currentUserId: string;
  isAdmin: boolean;
  isLoadingAction: boolean;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const isSelf = member.userId === currentUserId;
  const isAdmin_ = member.role === "ADMIN";
  const canManageMember = isAdmin && !isSelf;
  const roleLabel = isAdmin_ ? "QUẢN TRỊ" : "THÀNH VIÊN";

  return (
    <div className="group flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">
            {member.nickname ?? member.name}
            {isSelf ? " (Bạn)" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
            isAdmin_
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {roleLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {member.isOnline ? (
            <>
              <Icon name="circle" solid size="xs" className="text-green-500" />
              <span>Đang hoạt động</span>
            </>
          ) : (
            <>
              <Icon name="circle" solid size="xs" className="text-slate-300" />
              <span>Ngoại tuyến</span>
            </>
          )}
        </div>
        {canManageMember ? (
          <div className="flex items-center gap-2">
            {!isAdmin_ ? (
              <button
                type="button"
                onClick={onPromote}
                disabled={isLoadingAction}
                className="rounded-md bg-sky-100 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                title="Nâng lên Admin"
              >
                Bổ nhiệm
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRemove}
              disabled={isLoadingAction}
              className="rounded-md bg-red-100 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Xóa khỏi nhóm"
            >
              Xóa
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ChatInfoPanel({
  room,
  groupDetails,
  currentUserId,
  onLeaveGroup,
  onDissolveGroup,
  onOpenCreateGroup,
  onDeleteChatHistory,
  onMembersAdded,
  onGroupDetailsChange,
  isMobileOpen = false,
  onCloseMobile,
}: ChatInfoPanelProps) {
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showFilesList, setShowFilesList] = useState(false);
  const [showDeleteHistory, setShowDeleteHistory] = useState(false);
  const [showShareQr, setShowShareQr] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isConversationPinned, setIsConversationPinned] = useState(false);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [memberActionLoadingUserId, setMemberActionLoadingUserId] = useState<
    string | null
  >(null);
  const [groupActionError, setGroupActionError] = useState("");
  const [images, setImages] = useState<
    Array<{ url: string; timestamp: string }>
  >([]);
  const [files, setFiles] = useState<
    Array<{ name: string; size: string; timestamp: string; type: string }>
  >([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  if (!room) {
    return (
      <aside className="hidden h-full w-96 border-l border-slate-200 bg-white/90 backdrop-blur lg:flex">
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
          <div>
            <Icon
              name="comments"
              size="2xl"
              className="mx-auto mb-2 text-slate-300"
            />
            <p>Chọn một cuộc trò chuyện để xem thông tin hội thoại.</p>
          </div>
        </div>
      </aside>
    );
  }

  const isGroup = room.roomType === "GROUP";
  const currentMemberRole = groupDetails?.members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isGroupAdmin = currentMemberRole
    ? currentMemberRole === "ADMIN"
    : groupDetails?.currentUserRole === "ADMIN";
  const avatarLabel = room.emoji ?? initials(room.title);
  const subtitle = isGroup
    ? `${groupDetails?.memberCount ?? room.memberCount ?? 0} thành viên`
    : room.isPeerOnline
      ? "Đang hoạt động"
      : "Ngoại tuyến";

  useEffect(() => {
    setIsConversationPinned(false);
  }, [room.id]);

  const loadMediaAndFiles = async () => {
    if (!isGroup) return;

    setIsLoadingMedia(true);
    try {
      const [imagesData, filesData] = await Promise.all([
        fetchRoomImages(room.id),
        fetchRoomFiles(room.id),
      ]);

      const nextImages = imagesData
        .map((message) => {
          const value = message.content.trim();
          if (!value) return null;

          const isLikelyImage =
            /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(value) ||
            value.startsWith("http");
          if (!isLikelyImage) return null;

          return {
            url: value,
            timestamp: new Date(message.createdAt).toLocaleDateString("vi-VN"),
          };
        })
        .filter(
          (item): item is { url: string; timestamp: string } => item !== null,
        );

      const nextFiles = filesData
        .map((message) => {
          const value = message.content.trim();
          if (!value) return null;

          const fileName = value.split(/[\\/]/).pop() ?? value;
          const extension = fileName.includes(".")
            ? (fileName.split(".").pop()?.toLowerCase() ?? "file")
            : "file";
          const isImageFile = [
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "avif",
            "bmp",
            "svg",
          ].includes(extension);
          if (isImageFile) return null;

          return {
            name: fileName,
            size: "Không rõ",
            timestamp: new Date(message.createdAt).toLocaleDateString("vi-VN"),
            type: extension || "file",
          };
        })
        .filter(
          (
            item,
          ): item is {
            name: string;
            size: string;
            timestamp: string;
            type: string;
          } => item !== null,
        );

      setImages(nextImages);
      setFiles(nextFiles);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const handleOpenMediaGallery = () => {
    if (images.length === 0) {
      void loadMediaAndFiles();
    }
    setShowMediaGallery(true);
  };

  const handleOpenFilesList = () => {
    if (files.length === 0) {
      void loadMediaAndFiles();
    }
    setShowFilesList(true);
  };

  const toAbsoluteInviteLink = (value: string): string => {
    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (typeof window === "undefined") {
      return value;
    }

    return `${window.location.origin}${
      value.startsWith("/") ? value : `/${value}`
    }`;
  };

  const handleOpenShareQr = async () => {
    if (!groupDetails) return;

    setIsShareLoading(true);
    setGroupActionError("");
    try {
      const result = await createGroupInviteLink(groupDetails.roomId);
      setShareLink(toAbsoluteInviteLink(result.inviteLink));
      setShowShareQr(true);
    } catch (error) {
      setGroupActionError(
        error instanceof Error ? error.message : "Không thể tạo link mời nhóm",
      );
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      return;
    }

    await handleOpenShareQr();
  };

  const handlePromoteMember = async (memberUserId: string) => {
    if (!groupDetails || !isGroupAdmin) return;

    setMemberActionLoadingUserId(memberUserId);
    setGroupActionError("");
    try {
      const next = await promoteGroupMember(groupDetails.roomId, memberUserId);
      onGroupDetailsChange?.(next);
    } catch (error) {
      setGroupActionError(
        error instanceof Error ? error.message : "Không thể bổ nhiệm admin",
      );
    } finally {
      setMemberActionLoadingUserId(null);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!groupDetails || !isGroupAdmin) return;

    setMemberActionLoadingUserId(memberUserId);
    setGroupActionError("");
    try {
      const next = await removeGroupMember(groupDetails.roomId, memberUserId);
      onGroupDetailsChange?.(next);
    } catch (error) {
      setGroupActionError(
        error instanceof Error ? error.message : "Không thể xóa thành viên",
      );
    } finally {
      setMemberActionLoadingUserId(null);
    }
  };

  return (
    <>
      <aside
        className={
          isMobileOpen
            ? "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm border-l border-slate-200 bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)] lg:hidden"
            : "hidden h-full w-96 shrink-0 border-l border-slate-200 bg-white shadow-[0_0_40px_rgba(15,23,42,0.04)] lg:flex"
        }
      >
        <div className="flex h-full w-full flex-col">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="relative flex items-center justify-center gap-3">
              <p className="flex items-center justify-center gap-2 text-center text-base font-semibold text-slate-900">
                <Icon name="circle-info" size="lg" />
                Thông tin hội thoại
              </p>
              {isMobileOpen ? (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="absolute right-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng thông tin hội thoại"
                >
                  <Icon name="xmark" size="lg" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="scrollbar-auto-hide min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-sky-100 via-slate-100 to-slate-200 text-3xl font-bold text-slate-700 shadow-md">
                  {avatarLabel}
                </div>
                <div className="mt-4">
                  <h2 className="max-w-56 truncate text-lg font-bold text-slate-900">
                    {room.title}
                  </h2>
                  <p className="mt-0.5 flex items-center justify-center gap-1 text-sm text-slate-500">
                    <Icon
                      name={isGroup ? "users" : "user"}
                      size="sm"
                      className="text-slate-400"
                    />
                    {subtitle}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {isGroup ? (
                  <>
                    <ActionButton
                      icon="user-plus"
                      label="Thêm thành viên"
                      onClick={() => setShowAddMembers(true)}
                    />
                    <ActionButton
                      icon="share"
                      label={isShareLoading ? "Đang tạo QR" : "Chia sẻ QR"}
                      onClick={() => {
                        void handleOpenShareQr();
                      }}
                    />
                    {isGroupAdmin ? (
                      <ActionButton
                        icon="trash"
                        label="Giải tán nhóm"
                        onClick={onDissolveGroup}
                        variant="danger"
                      />
                    ) : (
                      <ActionButton
                        icon="sign-out-alt"
                        label="Rời nhóm"
                        onClick={onLeaveGroup}
                        variant="danger"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <ActionButton
                      icon="users"
                      label="Tạo nhóm"
                      onClick={onOpenCreateGroup}
                    />
                    <ActionButton
                      icon="thumbtack"
                      label={
                        isConversationPinned
                          ? "Bỏ ghim hội thoại"
                          : "Ghim hội thoại"
                      }
                      onClick={() => {
                        setIsConversationPinned((prev) => !prev);
                      }}
                    />
                    <ActionButton
                      icon={isNotificationEnabled ? "bell" : "bell-slash"}
                      label={
                        isNotificationEnabled
                          ? "Thông báo bật"
                          : "Thông báo tắt"
                      }
                      onClick={() => {
                        setIsNotificationEnabled((prev) => !prev);
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              {isGroup && groupDetails ? (
                <SectionCard title="Thành viên">
                  <div className="space-y-2">
                    {groupDetails.members.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Chưa có thành viên nào
                      </p>
                    ) : (
                      groupDetails.members.slice(0, 5).map((member) => (
                        <MemberItem
                          key={member.userId}
                          member={member}
                          currentUserId={currentUserId}
                          isAdmin={isGroupAdmin}
                          isLoadingAction={
                            memberActionLoadingUserId === member.userId
                          }
                          onPromote={() => {
                            void handlePromoteMember(member.userId);
                          }}
                          onRemove={() => {
                            void handleRemoveMember(member.userId);
                          }}
                        />
                      ))
                    )}
                  </div>
                </SectionCard>
              ) : null}

              {isGroup && groupDetails ? (
                <SectionCard title="Link mời">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <Icon name="link" size="sm" className="text-slate-400" />
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
                      {groupDetails.inviteLink}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenShareQr();
                      }}
                      className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyInviteLink();
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Sao chép
                    </button>
                  </div>
                </SectionCard>
              ) : null}

              {groupActionError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {groupActionError}
                </div>
              ) : null}

              <SectionCard
                title="Ảnh & Video"
                action={{
                  label: "Xem tất cả",
                  onClick: handleOpenMediaGallery,
                }}
              >
                {isLoadingMedia && images.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Đang tải...
                  </div>
                ) : images.length === 0 ? (
                  <div className="py-8 text-center">
                    <Icon
                      name="image"
                      size="2xl"
                      className="mx-auto mb-2 text-slate-300"
                    />
                    <p className="text-xs text-slate-500">
                      Chưa có ảnh hoặc video
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(0, 8).map((image) => (
                      <button
                        type="button"
                        key={`${image.timestamp}-${image.url}`}
                        className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-sky-400 hover:shadow-md"
                        onClick={handleOpenMediaGallery}
                      >
                        <img
                          src={image.url}
                          alt={image.timestamp}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="File chia sẻ"
                action={{ label: "Xem tất cả", onClick: handleOpenFilesList }}
              >
                {isLoadingMedia && files.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500">
                    Đang tải...
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-6 text-center">
                    <Icon
                      name="file"
                      size="2xl"
                      className="mx-auto mb-2 text-slate-300"
                    />
                    <p className="text-xs text-slate-500">Chưa có file nào</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.slice(0, 3).map((file) => (
                      <div
                        key={`${file.name}-${file.timestamp}`}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <Icon
                          name="file"
                          size="lg"
                          className="text-slate-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {file.size} • {file.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <Icon name="trash" size="sm" />
                  Xóa lịch sử
                </h3>
                <p className="mt-2 text-xs text-red-600">
                  Xóa tất cả tin nhắn trong cuộc trò chuyện này.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteHistory(true)}
                  className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Xóa lịch sử
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <AddGroupMemberModal
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        groupId={room.id}
        existingMemberIds={
          groupDetails?.members.map((member) => member.userId) ?? []
        }
        onMemberAdded={() => {
          setShowAddMembers(false);
          onMembersAdded?.();
        }}
      />

      <MediaGalleryModal
        isOpen={showMediaGallery}
        onClose={() => setShowMediaGallery(false)}
        images={images}
      />

      <FilesListModal
        isOpen={showFilesList}
        onClose={() => setShowFilesList(false)}
        files={files}
      />

      <DeleteChatHistoryModal
        isOpen={showDeleteHistory}
        onClose={() => setShowDeleteHistory(false)}
        roomTitle={room.title}
        onConfirm={async () => {
          await onDeleteChatHistory?.();
        }}
      />

      <ShareGroupQrModal
        isOpen={showShareQr}
        onClose={() => setShowShareQr(false)}
        roomTitle={room.title}
        inviteLink={shareLink}
        onCopy={() => {
          void handleCopyInviteLink();
        }}
      />
    </>
  );
}
