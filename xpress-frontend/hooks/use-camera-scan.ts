import { useState, useCallback, useRef } from "react";

/**
 * Hook for camera scanning using getUserMedia
 * This hook is compatible with Capacitor as it maps Web API to native permissions
 */
export const useCameraScan = (initialFacingMode: "user" | "environment" = "environment") => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(initialFacingMode);
  
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCapturing(false);
  }, []);

  const startCamera = useCallback(async (currentFacing?: "user" | "environment") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      setIsCapturing(true);
      setError(null);
      
      const targetFacing = currentFacing || facingMode;
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: targetFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not access camera";
      setError(errorMessage);
      setIsCapturing(false);
      return null;
    }
  }, [facingMode]);

  const switchCamera = useCallback(async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    return await startCamera(nextFacing);
  }, [facingMode, startCamera]);

  return {
    stream,
    error,
    isCapturing,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
  };
};
