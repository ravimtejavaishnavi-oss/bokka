// OpenCV.js loading utility to prevent multiple loads and conflicts

declare global {
  interface Window {
    cv: any;
    opencvLoading: boolean;
    opencvLoadPromise: Promise<void> | null;
  }
}

class OpenCVLoader {
  private static instance: OpenCVLoader;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): OpenCVLoader {
    if (!OpenCVLoader.instance) {
      OpenCVLoader.instance = new OpenCVLoader();
    }
    return OpenCVLoader.instance;
  }

  public async loadOpenCV(): Promise<void> {
    // Return existing promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Return immediately if already loaded
    if (window.cv && window.cv.Mat) {
      return Promise.resolve();
    }

    // Create new loading promise
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="opencv.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          this.waitForOpenCV().then(resolve).catch(reject);
        });
        existingScript.addEventListener('error', () => {
          this.loadPromise = null;
          reject(new Error('Failed to load OpenCV.js'));
        });
        return;
      }

      // Load OpenCV.js from CDN
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.5.0/opencv.js';
      script.async = true;
      script.onload = () => {
        this.waitForOpenCV().then(resolve).catch(reject);
      };
      script.onerror = () => {
        this.loadPromise = null;
        reject(new Error('Failed to load OpenCV.js'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  private waitForOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkOpenCV = () => {
        if (window.cv && window.cv.Mat) {
          resolve();
        } else {
          setTimeout(checkOpenCV, 100);
        }
      };
      
      // Set a timeout to prevent infinite waiting
      setTimeout(() => {
        reject(new Error('OpenCV.js failed to initialize'));
      }, 30000); // 30 second timeout
      
      checkOpenCV();
    });
  }

  public isLoaded(): boolean {
    return !!(window.cv && window.cv.Mat);
  }

  public reset(): void {
    this.loadPromise = null;
    window.opencvLoading = false;
  }
}

export const opencvLoader = OpenCVLoader.getInstance();
export default opencvLoader;
