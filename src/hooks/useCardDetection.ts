import { useState, useEffect, useRef } from 'react';

// Type definitions
interface CardBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseCardDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  webcamRef?: React.RefObject<any>; // Webcam component ref
  onCardDetected?: (boundary: CardBoundary) => void;
}

interface UseCardDetectionReturn {
  isCardDetected: boolean;
  cardBoundary: CardBoundary | null;
  focusQuality: number;
  isDetecting: boolean;
  startDetection: () => void;
  stopDetection: () => void;
}

// Declare OpenCV globally
declare global {
  interface Window {
    cv: any;
  }
}

/**
 * Custom hook for card detection using OpenCV.js
 * Provides real-time card boundary detection and focus quality assessment
 */
export const useCardDetection = ({
  videoRef,
  canvasRef,
  webcamRef,
  onCardDetected
}: UseCardDetectionProps): UseCardDetectionReturn => {
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [cardBoundary, setCardBoundary] = useState<CardBoundary | null>(null);
  const [focusQuality, setFocusQuality] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const animationRef = useRef<number>(0);
  const detectionTimeoutRef = useRef<number | null>(null);
  const detectionHistoryRef = useRef<boolean[]>([]);
  const stableDetectionCountRef = useRef<number>(0);

  /**
   * Load OpenCV.js library
   */
  const loadOpenCV = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.cv && window.cv.Mat) {
        resolve();
        return;
      }

      // Load from CDN since we excluded it from Vite bundling
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.5.0/opencv.js';
      script.async = true;
      
      script.onload = () => {
        // Wait for OpenCV to be fully initialized
        const checkOpenCV = () => {
          if (window.cv && window.cv.Mat) {
            console.log('OpenCV.js loaded successfully');
            resolve();
          } else {
            setTimeout(checkOpenCV, 100);
          }
        };
        checkOpenCV();
      };
      
      script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
      
      // Only add script if it doesn't already exist
      if (!document.querySelector('script[src*="opencv.js"]')) {
        document.head.appendChild(script);
      } else {
        // Script already exists, just wait for it to load
        const checkOpenCV = () => {
          if (window.cv && window.cv.Mat) {
            resolve();
          } else {
            setTimeout(checkOpenCV, 100);
          }
        };
        checkOpenCV();
      }
    });
  };

  /**
   * Calculate image sharpness using Laplacian variance
   */
  const calculateFocusQuality = (image: any): number => {
    if (!window.cv) return 0;

    try {
      const gray = new window.cv.Mat();
      window.cv.cvtColor(image, gray, window.cv.COLOR_RGBA2GRAY);

      const laplacian = new window.cv.Mat();
      window.cv.Laplacian(gray, laplacian, window.cv.CV_64F);

      const mean = new window.cv.Mat();
      const stdDev = new window.cv.Mat();
      window.cv.meanStdDev(laplacian, mean, stdDev);

      const variance = Math.pow(stdDev.doubleAt(0, 0), 2);

      // Clean up
      gray.delete();
      laplacian.delete();
      mean.delete();
      stdDev.delete();

      // Convert to 0-100 scale
      return Math.min(100, Math.round(variance / 100));
    } catch (err) {
      console.error('Error calculating focus quality:', err);
      return 0;
    }
  };

  /**
   * Check if a contour forms a valid card (works with both straight and curved edges)
   */
  const checkIfValidCard = (contour: any, boundingRect: any, imageArea: number): boolean => {
    if (!window.cv) return false;

    try {
      // Get contour area and bounding rect dimensions
      const contourArea = window.cv.contourArea(contour);
      const rectArea = boundingRect.width * boundingRect.height;
      
      // Calculate how well the contour fills the bounding rectangle
      // Mobile-optimized: slightly more lenient for mobile camera artifacts
      const fillRatio = contourArea / rectArea;
      const isGoodFill = fillRatio >= 0.70 && fillRatio <= 1.0;
      
      // Check aspect ratio (cards are typically 1.586:1 ratio, allow tolerance)
      // Mobile-optimized: wider range for various card orientations and perspectives
      const width = boundingRect.width;
      const height = boundingRect.height;
      const aspectRatio = Math.max(width, height) / Math.min(width, height);
      const isValidAspectRatio = aspectRatio >= 1.3 && aspectRatio <= 2.0;
      
      // Check if contour area is reasonable relative to image
      // Mobile-optimized: cards should fill meaningful portion of frame
      const areaRatio = contourArea / imageArea;
      const isValidSize = areaRatio >= 0.08 && areaRatio <= 0.92; // 8% to 92% of image
      
      console.log('Card validation:', {
        aspectRatio: aspectRatio.toFixed(2),
        isValidAspectRatio,
        fillRatio: fillRatio.toFixed(2),
        isGoodFill,
        areaRatio: areaRatio.toFixed(4),
        isValidSize,
        contourPoints: contour.rows
      });
      
      return isValidAspectRatio && isValidSize && isGoodFill;
    } catch (err) {
      console.error('Error checking card validity:', err);
      return false;
    }
  };

  /**
   * Detect card in the current video frame
   */
  const detectCard = () => {
    // Try to get video element from webcam ref first, then fallback to videoRef
    let video = webcamRef?.current?.video || videoRef.current;
    
    if (!video || !canvasRef.current) {
      console.log('Video or canvas ref not available', { 
        webcamVideo: !!webcamRef?.current?.video, 
        videoRef: !!videoRef.current, 
        canvas: !!canvasRef.current 
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.log('Canvas context not available');
      return;
    }
    
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      console.log('Video not ready, readyState:', video.readyState);
      return;
    }
    
    if (!window.cv || !window.cv.Mat) {
      console.log('OpenCV not loaded');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Create OpenCV Mat from canvas
      const src = window.cv.imread(canvas);
      const gray = new window.cv.Mat();
      const blurred = new window.cv.Mat();
      const adaptive = new window.cv.Mat();
      const edged = new window.cv.Mat();
      const morphed = new window.cv.Mat();

      const imageArea = canvas.width * canvas.height;
      
      // Calculate focus quality
      const quality = calculateFocusQuality(src);
      setFocusQuality(quality);

      // Convert to grayscale
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      // Apply adaptive preprocessing for better edge detection
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);
      
      // Use adaptive threshold for better edge detection in varying lighting
      // Mobile-optimized: larger block size for better detection with mobile camera noise
      const blockSize = 15; // Increased from 11 for mobile cameras
      window.cv.adaptiveThreshold(blurred, adaptive, 255, window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, window.cv.THRESH_BINARY, blockSize, 2);
      
      // Apply morphological operations to clean up the image
      const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
      window.cv.morphologyEx(adaptive, morphed, window.cv.MORPH_CLOSE, kernel);
      
      // Apply Canny edge detection with mobile-optimized thresholds
      // Lower thresholds work better with mobile camera quality
      window.cv.Canny(morphed, edged, 25, 75);

      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(edged, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      // Find the best card contour
      let bestScore = 0;
      let cardContour = null;
      let cardFound = false;
      let boundingRect = null;

      // Mobile-optimized area thresholds
      // Mobile cameras typically have cards filling 10-85% of frame for good detection
      const minArea = imageArea * 0.08; // Minimum 8% of image area
      const maxArea = imageArea * 0.92; // Maximum 92% of image area
      console.log('Detection frame:', { imageArea, minArea, contoursFound: contours.size() });
      
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        
        // Skip if too small or too large
        if (area < minArea || area > maxArea) {
          contour.delete();
          continue;
        }
        
        const approx = new window.cv.Mat();
        
        // Try multiple epsilon values for better approximation
        // Support both straight edges (4 points) and curved edges (4-8 points)
        const epsilons = [0.01, 0.02, 0.03, 0.04];
        let bestApprox: any = null;
        let foundValidCard = false;
        
        for (const eps of epsilons) {
          const epsilon = eps * window.cv.arcLength(contour, true);
          window.cv.approxPolyDP(contour, approx, epsilon, true);
          
          // Accept contours with 4-8 points (4 for straight edges, more for rounded corners)
          if (approx.rows >= 4 && approx.rows <= 8) {
            // Get bounding rectangle for this contour
            const rect = window.cv.boundingRect(contour);
            
            // Check if it's a valid card (works for both straight and curved edges)
            const isValidCard = checkIfValidCard(contour, rect, imageArea);
            
            if (isValidCard) {
              // Calculate score based on area and shape quality
              const perimeter = window.cv.arcLength(contour, true);
              const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
              const score = area * compactness; // Favor larger, more compact shapes
              
              if (score > bestScore) {
                bestScore = score;
                if (bestApprox) bestApprox.delete();
                bestApprox = approx.clone();
                if (cardContour) cardContour.delete();
                cardContour = contour.clone();
                cardFound = true;
                boundingRect = rect;
                foundValidCard = true;
              }
            }
          }
          
          // If we found a valid card, we can stop trying other epsilons
          if (foundValidCard) break;
        }
        
        if (bestApprox) bestApprox.delete();
        approx.delete();
        contour.delete();
      }

      // Update detection history for stability (less strict)
      detectionHistoryRef.current.push(cardFound);
      if (detectionHistoryRef.current.length > 3) {
        detectionHistoryRef.current.shift();
      }
      
      // Only report stable detections (2 out of last 3 frames)
      const recentDetections = detectionHistoryRef.current.filter(d => d).length;
      const isStableDetection = recentDetections >= 2;
      
      if (isStableDetection && cardFound) {
        stableDetectionCountRef.current++;
      } else {
        stableDetectionCountRef.current = 0;
      }
      
      // Update card detection state with stability check
      const finalDetection = isStableDetection && cardFound;
      setIsCardDetected(finalDetection);
      setCardBoundary(finalDetection ? boundingRect : null);

      console.log('Detection result:', { 
        cardFound, 
        isStableDetection, 
        finalDetection, 
        recentDetections, 
        historyLength: detectionHistoryRef.current.length 
      });

      if (finalDetection && boundingRect && stableDetectionCountRef.current >= 1) {
        onCardDetected?.(boundingRect);
      }

      // If we found a card contour, draw it
      if (cardContour && cardFound) {
        // Draw contour on canvas
        const color = new window.cv.Scalar(0, 255, 0);
        const contourVector = new window.cv.MatVector();
        contourVector.push_back(cardContour);
        window.cv.drawContours(src, contourVector, -1, color, 3);

        // Draw bounding rectangle
        if (boundingRect) {
          const rectColor = new window.cv.Scalar(255, 0, 0);
          const point1 = new window.cv.Point(boundingRect.x, boundingRect.y);
          const point2 = new window.cv.Point(boundingRect.x + boundingRect.width, boundingRect.y + boundingRect.height);
          window.cv.rectangle(src, point1, point2, rectColor, 2);

          // Highlight the detected card with a semi-transparent overlay
          const overlay = src.clone();
          const overlayColor = new window.cv.Scalar(0, 255, 0, 100);
          window.cv.rectangle(overlay, point1, point2, overlayColor, -1);
          window.cv.addWeighted(src, 0.7, overlay, 0.3, 0, src);
          overlay.delete();
        }
        
        contourVector.delete();
      }

      // Display result
      window.cv.imshow(canvas, src);

      // Clean up
      src.delete();
      gray.delete();
      blurred.delete();
      adaptive.delete();
      edged.delete();
      morphed.delete();
      contours.delete();
      hierarchy.delete();
      if (cardContour) cardContour.delete();

    } catch (err) {
      console.error('Error in card detection:', err);
    }
  };

  /**
   * Start the detection loop
   */
  const startDetectionLoop = () => {
    detectCard();
    if (isDetecting) {
      animationRef.current = requestAnimationFrame(startDetectionLoop);
    }
  };

  /**
   * Start card detection
   */
  const startDetection = async () => {
    try {
      await loadOpenCV();
      setIsDetecting(true);
    } catch (err) {
      console.error('Failed to load OpenCV:', err);
      setIsDetecting(false);
    }
  };

  /**
   * Stop card detection
   */
  const stopDetection = () => {
    setIsDetecting(false);
    setIsCardDetected(false);
    setCardBoundary(null);
    setFocusQuality(0);
    
    // Reset detection history
    detectionHistoryRef.current = [];
    stableDetectionCountRef.current = 0;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
  };

  // Start detection loop when isDetecting changes
  useEffect(() => {
    if (isDetecting) {
      startDetectionLoop();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDetecting]);

  return {
    isCardDetected,
    cardBoundary,
    focusQuality,
    isDetecting,
    startDetection,
    stopDetection
  };
};
