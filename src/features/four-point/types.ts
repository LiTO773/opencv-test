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

export type FourPointScanState = 'searching' | 'ready' | 'capturing';

export type FourPointScan = {
  imageUri: string;
  width: number;
  height: number;
};
