"use client";

import Icon from "@/components/common/Icon";

interface FilesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Array<{ name: string; size: string; timestamp: string; type: string }>;
}

function getFileIcon(type: string) {
  switch (type.toLowerCase()) {
    case "pdf":
      return "file-pdf";
    case "doc":
    case "docx":
      return "file-word";
    case "xls":
    case "xlsx":
      return "file-excel";
    default:
      return "file";
  }
}

function getFileColor(type: string) {
  switch (type.toLowerCase()) {
    case "pdf":
      return "text-red-600";
    case "doc":
    case "docx":
      return "text-blue-600";
    case "xls":
    case "xlsx":
      return "text-green-600";
    default:
      return "text-slate-600";
  }
}

export default function FilesListModal({
  isOpen,
  onClose,
  files,
}: FilesListModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex h-[min(86vh,600px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">File chia sẻ</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="xmark" size="lg" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <Icon
                  name="file"
                  size="2xl"
                  className="mx-auto mb-4 text-slate-300"
                />
                <p className="text-sm text-slate-500">Chưa có file nào</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {files.map((file) => (
                <div
                  key={`${file.name}-${file.timestamp}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                >
                  <Icon
                    name={getFileIcon(file.type)}
                    size="lg"
                    className={getFileColor(file.type)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {file.size} • {file.timestamp}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                    aria-label={`Tải xuống ${file.name}`}
                  >
                    <Icon name="download" size="sm" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
