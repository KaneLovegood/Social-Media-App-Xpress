import { useState, useCallback } from "react";

/**
 * Hook for camera scanning using getUserMedia
 * This hook is compatible with Capacitor as it maps Web API to native permissions
 */
export const useCameraScan = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true);
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not access camera";
      setError(errorMessage);
      setIsCapturing(false);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  return {
    stream,
    error,
    isCapturing,
    startCamera,
    stopCamera,
  };
};
