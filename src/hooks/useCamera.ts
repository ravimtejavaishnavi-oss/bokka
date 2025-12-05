import { useState, useEffect, useRef } from 'react';
import { requestCameraPermission, checkCameraPermissions, isMobileDevice } from '../utils/mobile';

interface UseCameraProps {
  constraints?: MediaStreamConstraints;
}

interface UseCameraReturn {
  stream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

/**
 * Custom hook for accessing device camera
 * Handles camera permissions, stream management, and error handling
 */
export const useCamera = ({
  constraints = { video: { facingMode: 'environment' } }
}: UseCameraProps = {}): UseCameraReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Start camera stream
   */
  const startCamera = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Check camera permissions first
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) {
        throw new Error('Camera permissions not available');
      }

      // Get facing mode from constraints
      const videoConstraints = constraints.video as MediaTrackConstraints || {};
      const facingMode = (videoConstraints as any)?.facingMode || 'environment';
      
      console.log('Starting camera for mobile:', isMobileDevice(), 'facingMode:', facingMode);

      // Use mobile-optimized camera request
      const mediaStream = await requestCameraPermission(facingMode);
      
      if (!mediaStream) {
        throw new Error('Failed to obtain camera stream');
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      console.log('Camera stream started successfully');
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError(err.message || 'Failed to access camera. Please try again.');
      setStream(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Stop camera stream
   */
  const stopCamera = (): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    stream,
    error,
    isLoading,
    startCamera,
    stopCamera
  };
};
