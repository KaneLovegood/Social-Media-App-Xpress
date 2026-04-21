import { useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Hook to handle camera access for scanning or taking pictures.
 * This hook uses the standard Web MediaDevices API, which Capacitor
 * automatically maps to native permissions on mobile devices.
 */
export const useCameraScan = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'environment') => {
    setIsLoading(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera implementation not found in this browser environment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      setStream(mediaStream);
      return mediaStream;
    } catch (err: unknown) {
      const errorMessage = (err as Error).message || 'Failed to access camera';
      setError(errorMessage);

      // Provide a helpful toast for common mobile issues
      if (errorMessage.includes('Permission denied')) {
        toast.error('Permission Denied: Please allow camera access in your device settings.');
      } else {
        toast.error(`Camera Error: ${errorMessage}`);
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const takePhoto = useCallback(async (): Promise<File | null> => {
    if (!stream) {
      toast.error('Camera is not active');
      return null;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      const blob = await imageCapture.takePhoto();
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      return file;
    } catch {
      // Fallback for browsers that don't support ImageCapture
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          } else {
            resolve(null);
          }
        }, 'image/jpeg');
      });
    }
  }, [stream]);

  return {
    stream,
    error,
    isLoading,
    startCamera,
    stopCamera,
    takePhoto,
  };
};
