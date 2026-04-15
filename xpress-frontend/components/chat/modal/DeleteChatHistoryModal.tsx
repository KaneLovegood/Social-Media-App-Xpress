"use client";

import { useState } from "react";
import Icon from "@/components/common/Icon";

interface DeleteChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  roomTitle: string;
}

export default function DeleteChatHistoryModal({
  isOpen,
  onClose,
  onConfirm,
  roomTitle,
}: DeleteChatHistoryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setIsLoading(true);
    setError("");

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể xóa lịch sử trò chuyện",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-center border-b border-slate-200 px-6 py-6">
          <div className="rounded-full bg-red-100 p-4">
            <Icon name="trash" size="xl" className="text-red-600" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Xóa lịch sử trò chuyện?
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Hành động này sẽ xóa tất cả tin nhắn trong cuộc trò chuyện{" "}
            <strong>{roomTitle}</strong> và không thể phục hồi.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <Icon name="exclamation-circle" className="mr-2" />
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Icon name="spinner" size="sm" className="mr-2 animate-spin" />
                Đang xóa...
              </>
            ) : (
              "Xóa"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
