"use client";

import { useState } from "react";
import Icon from "@/components/common/Icon";
import { GroupMemberSummary } from "@/lib/chat-groups";

interface TransferAdminAndLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: GroupMemberSummary[];
  currentUserId: string;
  roomTitle: string;
  onConfirm: (newAdminUserId: string) => Promise<void>;
}

function initials(name: string) {
  const words = name.split(/[\s._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function TransferAdminAndLeaveModal({
  isOpen,
  onClose,
  members,
  currentUserId,
  roomTitle,
  onConfirm,
}: TransferAdminAndLeaveModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Chỉ hiển thị các thành viên khác (không phải bản thân)
  const otherMembers = members.filter((m) => m.userId !== currentUserId);

  const handleConfirm = async () => {
    if (!selectedUserId) {
      setError("Vui lòng chọn một thành viên để chuyển quyền quản trị.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await onConfirm(selectedUserId);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể chuyển quyền và rời nhóm. Vui lòng thử lại.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setSelectedUserId(null);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Icon name="crown" size="lg" className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Chuyển quyền quản trị
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Nhóm:{" "}
                <span className="font-semibold text-slate-700">{roomTitle}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed"
              aria-label="Đóng"
            >
              <Icon name="xmark" size="lg" />
            </button>
          </div>
        </div>

        {/* Notice */}
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-3">
          <p className="flex items-start gap-2 text-xs text-amber-800">
            <Icon
              name="exclamation-triangle"
              size="sm"
              className="mt-0.5 shrink-0 text-amber-500"
            />
            Bạn là quản trị viên. Để rời nhóm, hãy chọn một thành viên bên dưới
            để <strong>chuyển quyền quản trị</strong> trước khi rời đi.
          </p>
        </div>

        {/* Member list */}
        <div className="px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Chọn thành viên nhận quyền ({otherMembers.length} thành viên)
          </p>

          {otherMembers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
              <Icon
                name="users"
                size="2xl"
                className="mx-auto mb-2 text-slate-300"
              />
              <p className="text-sm text-slate-500">
                Không có thành viên nào khác trong nhóm.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Bạn có thể giải tán nhóm thay thế.
              </p>
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {otherMembers.map((member) => {
                const isSelected = selectedUserId === member.userId;
                const isCurrentAdmin = member.role === "ADMIN";

                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(member.userId);
                      setError("");
                    }}
                    disabled={isLoading}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-50 shadow-sm ring-1 ring-sky-300"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    } disabled:cursor-not-allowed`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isSelected
                          ? "bg-sky-200 text-sky-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        initials(member.nickname ?? member.name)
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {member.nickname ?? member.name}
                        </p>
                        {isCurrentAdmin && (
                          <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Icon
                          name="circle"
                          solid
                          size="xs"
                          className={
                            member.isOnline ? "text-green-500" : "text-slate-300"
                          }
                        />
                        {member.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                      </p>
                    </div>

                    {/* Check indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        isSelected
                          ? "border-sky-500 bg-sky-500"
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {isSelected && (
                        <Icon name="check" size="xs" className="text-white" />
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
          <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <Icon
              name="exclamation-circle"
              size="sm"
              className="mt-0.5 shrink-0"
            />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isLoading || !selectedUserId || otherMembers.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? (
              <>
                <Icon name="spinner" size="sm" className="animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Icon name="sign-out-alt" size="sm" />
                Chuyển quyền &amp; Rời nhóm
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
