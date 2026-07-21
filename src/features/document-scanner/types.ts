export type Point2D = {
  x: number;
  y: number;
};

export type DocumentQuadrilateral = [Point2D, Point2D, Point2D, Point2D];

export type DocumentAnalysis = {
  quadrilateral: DocumentQuadrilateral;
  sharpness: number;
};

export type ScanState = 'searching' | 'hold-steady' | 'improve-focus' | 'capturing';

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

export type DocumentScan = {
  imageUri: string;
  width: number;
  height: number;
  quality: {
    sharpness: number;
  };
  qr: QrMetadata | null;
};
