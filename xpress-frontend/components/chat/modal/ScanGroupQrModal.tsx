"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, Loader2, QrCode, X } from "lucide-react";
import { extractGroupInviteCode } from "@/lib/chat-groups";
import { useCameraScan } from "@/hooks/use-camera-scan";

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};

interface ScanGroupQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (inviteCode: string) => Promise<void>;
}

export default function ScanGroupQrModal({
  isOpen,
  onClose,
  onJoin,
}: ScanGroupQrModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const isHandlingRef = useRef(false);
  const { stream, error, startCamera, stopCamera } = useCameraScan();
  const [manualValue, setManualValue] = useState("");
  const [status, setStatus] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isDetectorSupported, setIsDetectorSupported] = useState(true);

  const stopScanLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleJoin = useCallback(
    async (rawValue: string) => {
      const inviteCode = extractGroupInviteCode(rawValue);
      if (!inviteCode || isHandlingRef.current) return;

      isHandlingRef.current = true;
      setIsJoining(true);
      setStatus("Dang tham gia nhom...");

      try {
        await onJoin(inviteCode);
        setStatus("Da tham gia nhom.");
        stopScanLoop();
        stopCamera();
        onClose();
      } catch (joinError) {
        isHandlingRef.current = false;
        setStatus(
          joinError instanceof Error
            ? joinError.message
            : "Khong the tham gia nhom bang ma nay.",
        );
      } finally {
        setIsJoining(false);
      }
    },
    [onClose, onJoin, stopCamera, stopScanLoop],
  );

  useEffect(() => {
    if (!isOpen) {
      stopScanLoop();
      stopCamera();
      setManualValue("");
      setStatus("");
      setIsJoining(false);
      isHandlingRef.current = false;
      return;
    }

    const detectorClass = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    setIsDetectorSupported(Boolean(detectorClass));
    void startCamera();

    return () => {
      stopScanLoop();
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, stopScanLoop]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!isOpen || !stream || !videoRef.current || isJoining) return;

    const detectorClass = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    if (!detectorClass) return;

    const detector = new detectorClass({ formats: ["qr_code"] });
    const scan = async () => {
      const video = videoRef.current;
      if (!video || isHandlingRef.current) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const results = await detector.detect(video);
          const rawValue = results[0]?.rawValue;
          if (rawValue) {
            await handleJoin(rawValue);
            return;
          }
        } catch {
          setStatus("Khong doc duoc QR tu camera nay. Ban co the nhap link moi ben duoi.");
        }
      }

      rafRef.current = window.requestAnimationFrame(scan);
    };

    rafRef.current = window.requestAnimationFrame(scan);
    return stopScanLoop;
  }, [handleJoin, isJoining, isOpen, stopScanLoop, stream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-sky-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Quet QR tham gia nhom
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dong may quet QR"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square flex-col items-center justify-center gap-3 text-slate-300">
                <Camera className="h-9 w-9" />
                <p className="px-6 text-center text-sm">
                  Dang mo camera...
                </p>
              </div>
            )}
          </div>

          {!isDetectorSupported ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Trinh duyet nay chua ho tro quet QR truc tiep. Hay dan link moi hoac ma moi vao o ben duoi.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          {status ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {status}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Keyboard className="h-3.5 w-3.5" />
              Nhap link moi hoac ma moi
            </label>
            <input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="https://.../chat/join?code=ma-moi"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Dong
          </button>
          <button
            type="button"
            onClick={() => {
              void handleJoin(manualValue);
            }}
            disabled={!manualValue.trim() || isJoining}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Tham gia
          </button>
        </div>
      </div>
    </div>
  );
}
