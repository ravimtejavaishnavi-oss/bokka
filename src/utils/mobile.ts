/**
 * Mobile device detection and camera utilities
 */

/**
 * Detect if the current device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Detect if the current browser is iOS Safari
 */
export const isIOSSafari = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

/**
 * Check if camera permissions are available
 */
export const checkCameraPermissions = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API not supported');
      return false;
    }

    // Check if permissions API is available
    if (navigator.permissions) {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      console.log('Camera permission status:', permission.state);
      return permission.state === 'granted' || permission.state === 'prompt';
    }

    return true; // Assume available if permissions API not supported
  } catch (error) {
    console.warn('Error checking camera permissions:', error);
    return true; // Assume available on error
  }
};

/**
 * Get mobile-optimized camera constraints
 */
export const getMobileConstraints = (facingMode: 'user' | 'environment' = 'environment') => {
  const isMobile = isMobileDevice();
  const isIOS = isIOSSafari();

  if (isMobile) {
    return {
      video: {
        facingMode,
        width: { ideal: isIOS ? 640 : 1280, max: 1920 },
        height: { ideal: isIOS ? 480 : 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 }, // Lower framerate for mobile
      },
      audio: false
    };
  }

  // Desktop constraints
  return {
    video: {
      facingMode,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: false
  };
};

/**
 * Request camera permission with user interaction
 */
export const requestCameraPermission = async (facingMode: 'user' | 'environment' = 'environment'): Promise<MediaStream | null> => {
  try {
    console.log('Requesting camera permission for:', facingMode);
    
    const constraints = getMobileConstraints(facingMode);
    console.log('Using constraints:', constraints);
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Camera permission granted, stream obtained');
    
    return stream;
  } catch (error: any) {
    console.error('Camera permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      throw new Error('Camera access denied. Please allow camera permissions in your browser settings.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No camera found on this device.');
    } else if (error.name === 'NotReadableError') {
      throw new Error('Camera is being used by another application.');
    } else if (error.name === 'OverconstrainedError') {
      // Try with basic constraints
      try {
        console.log('Trying with basic constraints...');
        const basicStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });
        return basicStream;
      } catch (basicError) {
        throw new Error('Camera constraints not supported by this device.');
      }
    } else {
      throw new Error(`Camera error: ${error.message || 'Unknown error'}`);
    }
  }
};
