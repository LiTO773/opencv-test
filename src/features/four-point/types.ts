import type { MobileGradingOutcome } from '@/features/bubble-grading/mobile-bubble-grading';

export type Point2D = {
  x: number;
  y: number;
};

export type Quadrilateral = [Point2D, Point2D, Point2D, Point2D];

export type MarkerPosition = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

export type MarkerRegion = {
  position: MarkerPosition;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MarkerMatch = {
  center: Point2D;
  corners: Quadrilateral;
  size: number;
};

export type MarkerMatches = [
  MarkerMatch | null,
  MarkerMatch | null,
  MarkerMatch | null,
  MarkerMatch | null,
];

export type FourPointAnalysis = {
  cropQuadrilateral: Quadrilateral | null;
  markers: MarkerMatches;
  matchedCount: number;
};

export type FourPointScanState = 'searching' | 'ready' | 'capturing' | 'processing';

export type CapturePipelineTimings = {
  capturePhotoMs: number;
  decodePhotoMs: number;
  finalDetectionMs: number;
  perspectiveCorrectionMs: number;
  qrDecodeMs: number;
  gradingMs: number;
  previewFramesDuringPipeline: number;
  previewFpsDuringPipeline: number;
  totalMs: number;
};

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type QrOrientation =
  | 'upright'
  | 'clockwise'
  | 'upside-down'
  | 'counter-clockwise';

export type QrMetadata = {
  rawValue: string;
  payload: JsonValue | null;
  payloadFormat: 'json' | 'text';
  qrVersion: number;
  orientation: QrOrientation;
  rotationApplied: 0 | 180;
};

export type FourPointScan = {
  width: number;
  height: number;
  qr: QrMetadata | null;
  studentId: string | null;
  grading: MobileGradingOutcome;
  pipelineTimings: CapturePipelineTimings;
};
