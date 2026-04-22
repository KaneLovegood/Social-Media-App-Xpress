"use client";

import { useEffect, useRef, useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { useCameraScan } from "@/hooks/use-camera-scan";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { stream, error, isCapturing, startCamera, stopCamera } = useCameraScan();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.warn('Camera video play failed:', e));
    }
  }, [stream]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      // Convert dataUrl to File
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `camera-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          onClose();
        });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-6">
      <div className="relative flex h-full max-h-[800px] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <h3 className="text-lg font-semibold">Chụp ảnh</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {error ? (
            <div className="px-6 text-center text-white">
              <p className="mb-4 text-red-400">{error}</p>
              <button
                onClick={() => startCamera()}
                className="rounded-full bg-blue-600 px-6 py-2 font-medium hover:bg-blue-700"
              >
                Thử lại
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
              {!isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer */}
        <div className="flex h-32 items-center justify-around px-4">
          {capturedImage ? (
            <>
              <button
                onClick={handleRetake}
                className="flex flex-col items-center gap-2 text-white/70 hover:text-white"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <RotateCcw className="h-7 w-7" />
                </div>
                <span className="text-sm">Chụp lại</span>
              </button>
              <button
                onClick={handleConfirm}
                className="flex flex-col items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">
                  <Check className="h-9 w-9" />
                </div>
                <span className="text-sm font-medium">Sử dụng</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleCapture}
              disabled={!isCapturing}
              className="group flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 transition hover:border-white disabled:opacity-50"
            >
              <div className="h-16 w-16 rounded-full bg-white transition group-active:scale-90" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
