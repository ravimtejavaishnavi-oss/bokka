/**
 * Type definitions for OpenCV.js
 * This file provides basic type definitions for OpenCV.js functionality used in the application
 */

declare global {
  interface Window {
    cv: {
      Mat: any;
      MatVector: any;
      Point: any;
      Scalar: any;
      Size: any;
      imread: (source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement) => any;
      imshow: (canvas: HTMLCanvasElement, mat: any) => void;
      cvtColor: (src: any, dst: any, code: number) => void;
      GaussianBlur: (src: any, dst: any, ksize: any, sigmaX: number) => void;
      adaptiveThreshold: (src: any, dst: any, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number) => void;
      morphologyEx: (src: any, dst: any, op: number, kernel: any) => void;
      Canny: (src: any, dst: any, threshold1: number, threshold2: number) => void;
      Laplacian: (src: any, dst: any, ddepth: number) => void;
      meanStdDev: (src: any, mean: any, stddev: any) => void;
      findContours: (image: any, contours: any, hierarchy: any, mode: number, method: number) => void;
      contourArea: (contour: any, oriented?: boolean) => number;
      boundingRect: (contour: any) => { x: number; y: number; width: number; height: number };
      arcLength: (curve: any, closed: boolean) => number;
      approxPolyDP: (curve: any, approxCurve: any, epsilon: number, closed: boolean) => void;
      drawContours: (image: any, contours: any, contourIdx: number, color: any, thickness: number) => void;
      rectangle: (img: any, pt1: any, pt2: any, color: any, thickness: number) => void;
      addWeighted: (src1: any, alpha: number, src2: any, beta: number, gamma: number, dst: any) => void;
      getStructuringElement: (shape: number, ksize: any) => any;
      
      // Constants
      COLOR_RGBA2GRAY: number;
      CV_64F: number;
      ADAPTIVE_THRESH_GAUSSIAN_C: number;
      THRESH_BINARY: number;
      MORPH_RECT: number;
      MORPH_CLOSE: number;
      RETR_EXTERNAL: number;
      CHAIN_APPROX_SIMPLE: number;
    };
  }
}

export {};
