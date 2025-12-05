// Declare OpenCV globally
declare global {
  interface Window {
    cv: any;
  }
}

interface UseImageCaptureReturn {
  captureFrame: (video: HTMLVideoElement) => string | null;
  cropToCard: (
    imageSrc: string,
    boundary: { x: number; y: number; width: number; height: number }
  ) => Promise<string>;
  detectAndCropCard: (imageSrc: string) => Promise<string>;
  imageToFile: (imageSrc: string, filename: string) => Promise<File>;
}

/**
 * Custom hook for capturing and processing images
 * Provides functions for frame capture, card cropping, and image conversion
 */
export const useImageCapture = (): UseImageCaptureReturn => {

  /**
   * Capture current frame from video element
   */
  const captureFrame = (video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Use maximum quality (1.0) for better OCR accuracy
      return canvas.toDataURL('image/jpeg', 1.0);
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  };

  /**
   * Crop image to card boundaries with minimal padding
   * Ensures only the card is shown, not background
   */
  const cropToCard = async (
    imageSrc: string,
    boundary: { x: number; y: number; width: number; height: number }
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Increased padding (5% of width/height) to ensure card edges and context are included
          // Document Intelligence works better with some context around the card
          const paddingX = Math.floor(boundary.width * 0.05);
          const paddingY = Math.floor(boundary.height * 0.05);
          
          // Calculate crop coordinates with padding
          const x = Math.max(0, boundary.x - paddingX);
          const y = Math.max(0, boundary.y - paddingY);
          const width = Math.min(img.width - x, boundary.width + paddingX * 2);
          const height = Math.min(img.height - y, boundary.height + paddingY * 2);
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Use high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw cropped image - card area with context
          ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
          
          // Use maximum quality (1.0) for better OCR accuracy
          resolve(canvas.toDataURL('image/jpeg', 1.0));
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageSrc;
    });
  };

  /**
   * Fallback: Detect card edges using OpenCV if detection failed
   * This ensures we always crop to the card, even if initial detection missed it
   * If detection fails completely, returns the full image as a last resort
   */
  const detectAndCropCard = async (imageSrc: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.cv || !window.cv.Mat) {
        // If OpenCV not available, return full image as fallback
        console.warn('OpenCV not available, using full image');
        resolve(imageSrc);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const imageArea = img.width * img.height;
          const minArea = imageArea * 0.05; // Lower threshold: 5% of image (was 10%)
          const maxArea = imageArea * 0.95; // Upper threshold: 95% of image
          
          // Create OpenCV Mat from image
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('Could not get canvas context, using full image');
            resolve(imageSrc);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const src = window.cv.matFromImageData(imageData);
          const gray = new window.cv.Mat();
          window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
          
          // Apply Gaussian blur (slightly stronger for better edge detection)
          const blurred = new window.cv.Mat();
          window.cv.GaussianBlur(gray, blurred, new window.cv.Size(7, 7), 0);
          
          // Try multiple Canny thresholds for better detection
          let largestContour = null;
          let largestArea = 0;
          const cannyThresholds = [
            { low: 30, high: 100 },  // More sensitive
            { low: 50, high: 150 },  // Default
            { low: 25, high: 75 }    // Very sensitive
          ];
          
          for (const threshold of cannyThresholds) {
            const edges = new window.cv.Mat();
            window.cv.Canny(blurred, edges, threshold.low, threshold.high);
            
            // Find contours
            const contours = new window.cv.MatVector();
            const hierarchy = new window.cv.Mat();
            window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
            
            // Find the largest valid contour
            for (let i = 0; i < contours.size(); i++) {
              const contour = contours.get(i);
              const area = window.cv.contourArea(contour);
              
              if (area > largestArea && area >= minArea && area <= maxArea) {
                // Check if it's roughly rectangular (card-like)
                const rect = window.cv.boundingRect(contour);
                const rectArea = rect.width * rect.height;
                const fillRatio = area / rectArea;
                
                // Accept if it fills at least 60% of bounding rect (more lenient)
                if (fillRatio >= 0.6) {
                  const aspectRatio = Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height);
                  // Accept aspect ratios from 1.2 to 2.5 (more lenient)
                  if (aspectRatio >= 1.2 && aspectRatio <= 2.5) {
                    if (largestContour) {
                      largestContour.delete();
                    }
                    largestArea = area;
                    largestContour = contour.clone();
                  }
                }
              }
              contour.delete();
            }
            
            // Clean up
            edges.delete();
            contours.delete();
            hierarchy.delete();
            
            // If we found a good contour, stop trying other thresholds
            if (largestContour) {
              break;
            }
          }
          
          // Clean up remaining OpenCV objects
          src.delete();
          gray.delete();
          blurred.delete();
          
          if (largestContour) {
            // Get bounding rect
            const rect = window.cv.boundingRect(largestContour);
            
            // Crop to bounding rect with padding for better OCR context
            const paddingX = Math.floor(rect.width * 0.05);
            const paddingY = Math.floor(rect.height * 0.05);
            
            const x = Math.max(0, rect.x - paddingX);
            const y = Math.max(0, rect.y - paddingY);
            const width = Math.min(img.width - x, rect.width + paddingX * 2);
            const height = Math.min(img.height - y, rect.height + paddingY * 2);
            
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = width;
            cropCanvas.height = height;
            const cropCtx = cropCanvas.getContext('2d');
            if (!cropCtx) {
              largestContour.delete();
              console.warn('Could not get crop canvas context, using full image');
              resolve(imageSrc);
              return;
            }
            
            // Use high-quality image rendering
            cropCtx.imageSmoothingEnabled = true;
            cropCtx.imageSmoothingQuality = 'high';
            
            cropCtx.drawImage(img, x, y, width, height, 0, 0, width, height);
            largestContour.delete();
            
            console.log('Card detected and cropped successfully');
            // Use maximum quality (1.0) for better OCR accuracy
            resolve(cropCanvas.toDataURL('image/jpeg', 1.0));
          } else {
            // No contour found - use full image as fallback instead of rejecting
            console.warn('No card contour detected, using full image as fallback');
            resolve(imageSrc);
          }
        } catch (err) {
          console.error('Error in edge detection:', err);
          // On error, return full image instead of rejecting
          resolve(imageSrc);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageSrc;
    });
  };

  /**
   * Convert data URL to File object
   */
  const imageToFile = async (imageSrc: string, filename: string): Promise<File> => {
    return fetch(imageSrc)
      .then(res => res.blob())
      .then(blob => new File([blob], filename, { type: 'image/jpeg' }));
  };

  return {
    captureFrame,
    cropToCard,
    detectAndCropCard,
    imageToFile
  };
};
