import type { PointVector } from 'react-native-fast-opencv';
import {
  AdaptiveThresholdTypes,
  ColorConversionCodes,
  ContourApproximationModes,
  MorphShapes,
  MorphTypes,
  ObjectType,
  OpenCV,
  RetrievalModes,
  ThresholdTypes,
} from 'react-native-fast-opencv';

import type { DocumentQuadrilateral, Point2D } from '@/features/document-scanner/types';

export const ANALYSIS_WIDTH = 500;
export const ANALYSIS_HEIGHT = 667;

const MIN_MARKER_AREA = 20;
const MAX_MARKER_AREA = ANALYSIS_WIDTH * ANALYSIS_HEIGHT * 0.015;
const MAX_MARKER_CANDIDATES = 24;
const MAX_COLUMN_CANDIDATES = 16;
const A4_ASPECT_RATIO = 210 / 297;

type SquareMarker = {
  center: Point2D;
  corners: DocumentQuadrilateral;
  size: number;
  quality: number;
};

type MarkerColumn = {
  markers: [SquareMarker, SquareMarker, SquareMarker];
  score: number;
};

function distance(first: Point2D, second: Point2D) {
  'worklet';
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function polygonArea(points: readonly Point2D[]) {
  'worklet';
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function isConvexQuadrilateral(points: DocumentQuadrilateral) {
  'worklet';
  let expectedSign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const third = points[(index + 2) % points.length];
    const cross =
      (second.x - first.x) * (third.y - second.y) -
      (second.y - first.y) * (third.x - second.x);
    if (Math.abs(cross) < 0.001) return false;
    const sign = cross > 0 ? 1 : -1;
    if (expectedSign === 0) expectedSign = sign;
    else if (sign !== expectedSign) return false;
  }
  return true;
}

function orderQuadrilateral(points: Point2D[]): DocumentQuadrilateral {
  'worklet';
  const center = points.reduce(
    (result, point) => ({ x: result.x + point.x / 4, y: result.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
  const aroundCenter = [...points].sort(
    (first, second) =>
      Math.atan2(first.y - center.y, first.x - center.x) -
      Math.atan2(second.y - center.y, second.x - center.x),
  );
  let topLeftIndex = 0;
  let smallestCoordinateSum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < aroundCenter.length; index += 1) {
    const coordinateSum = aroundCenter[index].x + aroundCenter[index].y;
    if (coordinateSum < smallestCoordinateSum) {
      smallestCoordinateSum = coordinateSum;
      topLeftIndex = index;
    }
  }
  const ordered = [
    ...aroundCenter.slice(topLeftIndex),
    ...aroundCenter.slice(0, topLeftIndex),
  ];
  return [ordered[0], ordered[1], ordered[2], ordered[3]];
}

function centerOf(points: DocumentQuadrilateral): Point2D {
  'worklet';
  return points.reduce(
    (center, point) => ({ x: center.x + point.x / 4, y: center.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
}

function normalizedDot(first: Point2D, second: Point2D) {
  'worklet';
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (denominator === 0) return 0;
  return (first.x * second.x + first.y * second.y) / denominator;
}

function vector(from: Point2D, to: Point2D): Point2D {
  'worklet';
  return { x: to.x - from.x, y: to.y - from.y };
}

function markerFromPoints(points: Point2D[]): SquareMarker | null {
  'worklet';
  if (points.length !== 4) return null;
  const corners = orderQuadrilateral(points);
  if (!isConvexQuadrilateral(corners)) return null;
  const area = polygonArea(corners);
  if (area < MIN_MARKER_AREA || area > MAX_MARKER_AREA) return null;

  const sides = corners.map((point, index) => distance(point, corners[(index + 1) % 4]));
  const shortestSide = Math.min(...sides);
  const longestSide = Math.max(...sides);
  if (shortestSide < 3 || shortestSide / longestSide < 0.58) return null;

  const diagonals = [distance(corners[0], corners[2]), distance(corners[1], corners[3])];
  const diagonalBalance = Math.min(...diagonals) / Math.max(...diagonals);
  if (diagonalBalance < 0.72) return null;

  const averageSide = sides.reduce((sum, side) => sum + side, 0) / 4;
  const fillRatio = area / (averageSide * averageSide);
  if (fillRatio < 0.55 || fillRatio > 1.45) return null;

  return {
    center: centerOf(corners),
    corners,
    size: Math.sqrt(area),
    quality:
      (shortestSide / longestSide) *
      diagonalBalance *
      Math.min(1, Math.sqrt(area) / 12),
  };
}

function makeColumn(markers: [SquareMarker, SquareMarker, SquareMarker]): MarkerColumn | null {
  'worklet';
  const ordered = [...markers].sort((first, second) => first.center.y - second.center.y) as [
    SquareMarker,
    SquareMarker,
    SquareMarker,
  ];
  const [top, middle, bottom] = ordered;
  const verticalSpan = bottom.center.y - top.center.y;
  if (verticalSpan < ANALYSIS_HEIGHT * 0.25) return null;

  const firstGap = distance(top.center, middle.center);
  const secondGap = distance(middle.center, bottom.center);
  const spacingBalance = Math.min(firstGap, secondGap) / Math.max(firstGap, secondGap);
  if (spacingBalance < 0.62) return null;

  const progress = (middle.center.y - top.center.y) / verticalSpan;
  const expectedMiddleX = top.center.x + (bottom.center.x - top.center.x) * progress;
  const alignmentError = Math.abs(middle.center.x - expectedMiddleX) / verticalSpan;
  if (alignmentError > 0.055) return null;

  const sizes = ordered.map((marker) => marker.size);
  const sizeBalance = Math.min(...sizes) / Math.max(...sizes);
  if (sizeBalance < 0.5) return null;

  const averageQuality = ordered.reduce((sum, marker) => sum + marker.quality, 0) / 3;
  return {
    markers: ordered,
    score: spacingBalance * sizeBalance * averageQuality * (1 - alignmentError / 0.055),
  };
}

function retainBestColumn(columns: MarkerColumn[], candidate: MarkerColumn) {
  'worklet';
  columns.push(candidate);
  columns.sort((first, second) => second.score - first.score);
  if (columns.length > MAX_COLUMN_CANDIDATES) columns.pop();
}

function findMarkerColumns(markers: SquareMarker[]) {
  'worklet';
  const columns: MarkerColumn[] = [];
  for (let first = 0; first < markers.length - 2; first += 1) {
    for (let second = first + 1; second < markers.length - 1; second += 1) {
      for (let third = second + 1; third < markers.length; third += 1) {
        const column = makeColumn([markers[first], markers[second], markers[third]]);
        if (column) retainBestColumn(columns, column);
      }
    }
  }
  return columns;
}

function inwardCorner(marker: SquareMarker, horizontal: 1 | -1, vertical: 1 | -1) {
  'worklet';
  let best = marker.corners[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const corner of marker.corners) {
    const score = corner.x * horizontal + corner.y * vertical;
    if (score > bestScore) {
      best = corner;
      bestScore = score;
    }
  }
  return best;
}

function areaInsideMarkers(left: MarkerColumn, right: MarkerColumn): DocumentQuadrilateral {
  'worklet';
  return [
    inwardCorner(left.markers[0], 1, 1),
    inwardCorner(right.markers[0], -1, 1),
    inwardCorner(right.markers[2], -1, -1),
    inwardCorner(left.markers[2], 1, -1),
  ];
}

function markerPatternScore(first: MarkerColumn, second: MarkerColumn) {
  'worklet';
  const firstAverageX = first.markers.reduce((sum, marker) => sum + marker.center.x, 0) / 3;
  const secondAverageX = second.markers.reduce((sum, marker) => sum + marker.center.x, 0) / 3;
  const left = firstAverageX < secondAverageX ? first : second;
  const right = firstAverageX < secondAverageX ? second : first;

  const leftDirection = vector(left.markers[0].center, left.markers[2].center);
  const rightDirection = vector(right.markers[0].center, right.markers[2].center);
  const columnParallelism = normalizedDot(leftDirection, rightDirection);
  if (columnParallelism < 0.94) return null;

  const leftSpan = Math.hypot(leftDirection.x, leftDirection.y);
  const rightSpan = Math.hypot(rightDirection.x, rightDirection.y);
  const spanBalance = Math.min(leftSpan, rightSpan) / Math.max(leftSpan, rightSpan);
  if (spanBalance < 0.62) return null;

  const rowVectors = left.markers.map((marker, index) =>
    vector(marker.center, right.markers[index].center),
  );
  const rowWidths = rowVectors.map((row) => Math.hypot(row.x, row.y));
  if (Math.min(...rowWidths) < ANALYSIS_WIDTH * 0.28) return null;
  const widthBalance = Math.min(...rowWidths) / Math.max(...rowWidths);
  if (widthBalance < 0.55) return null;

  const rowParallelism = Math.min(
    normalizedDot(rowVectors[0], rowVectors[1]),
    normalizedDot(rowVectors[1], rowVectors[2]),
  );
  if (rowParallelism < 0.92) return null;

  const averageWidth = rowWidths.reduce((sum, width) => sum + width, 0) / 3;
  const averageHeight = (leftSpan + rightSpan) / 2;
  const observedAspectRatio = averageWidth / averageHeight;
  if (observedAspectRatio < 0.38 || observedAspectRatio > 1.15) return null;
  const aspectQuality = 1 / (1 + Math.abs(observedAspectRatio - A4_ASPECT_RATIO) * 2);

  const area = areaInsideMarkers(left, right);
  if (!isConvexQuadrilateral(area)) return null;
  if (polygonArea(area) < ANALYSIS_WIDTH * ANALYSIS_HEIGHT * 0.1) return null;

  return {
    area,
    score:
      left.score *
      right.score *
      columnParallelism *
      rowParallelism *
      spanBalance *
      widthBalance *
      aspectQuality,
  };
}

export function smoothQuadrilateral(
  previous: DocumentQuadrilateral | null,
  next: DocumentQuadrilateral,
  nextWeight = 0.35,
): DocumentQuadrilateral {
  'worklet';
  if (!previous) return next;
  return next.map((point, index) => ({
    x: previous[index].x * (1 - nextWeight) + point.x * nextWeight,
    y: previous[index].y * (1 - nextWeight) + point.y * nextWeight,
  })) as DocumentQuadrilateral;
}

export function mapAnalysisToFrame(
  point: Point2D,
  frameWidth: number,
  frameHeight: number,
): Point2D {
  'worklet';
  const scale = Math.max(ANALYSIS_WIDTH / frameWidth, ANALYSIS_HEIGHT / frameHeight);
  const croppedX = (frameWidth * scale - ANALYSIS_WIDTH) / 2;
  const croppedY = (frameHeight * scale - ANALYSIS_HEIGHT) / 2;
  return {
    x: (point.x + croppedX) / scale,
    y: (point.y + croppedY) / scale,
  };
}

export function detectDocument(pixelBuffer: ArrayBuffer): DocumentQuadrilateral | null {
  'worklet';
  try {
    const source = OpenCV.bufferToMat(
      'uint8',
      ANALYSIS_HEIGHT,
      ANALYSIS_WIDTH,
      3,
      new Uint8Array(pixelBuffer),
    );
    OpenCV.invoke('cvtColor', source, source, ColorConversionCodes.COLOR_BGR2GRAY);
    OpenCV.invoke('GaussianBlur', source, source, OpenCV.createObject(ObjectType.Size, 5, 5), 0);
    OpenCV.invoke(
      'adaptiveThreshold',
      source,
      source,
      255,
      AdaptiveThresholdTypes.ADAPTIVE_THRESH_GAUSSIAN_C,
      ThresholdTypes.THRESH_BINARY_INV,
      31,
      9,
    );
    const morphologySize = OpenCV.createObject(ObjectType.Size, 3, 3);
    const structuringElement = OpenCV.invoke(
      'getStructuringElement',
      MorphShapes.MORPH_RECT,
      morphologySize,
    );
    OpenCV.invoke('morphologyEx', source, source, MorphTypes.MORPH_OPEN, structuringElement);

    const contours = OpenCV.createObject(ObjectType.PointVectorOfVectors);
    OpenCV.invoke(
      'findContours',
      source,
      contours,
      RetrievalModes.RETR_LIST,
      ContourApproximationModes.CHAIN_APPROX_SIMPLE,
    );

    const contourCount = OpenCV.toJSValue(contours).array.length;
    const markers: SquareMarker[] = [];
    for (let index = 0; index < contourCount; index += 1) {
      const contour = OpenCV.copyObjectFromVector(contours, index);
      const contourArea = OpenCV.invoke('contourArea', contour, false).value;
      if (contourArea < MIN_MARKER_AREA || contourArea > MAX_MARKER_AREA) continue;

      const perimeter = OpenCV.invoke('arcLength', contour, true).value;
      const approximation = OpenCV.createObject(ObjectType.PointVector) as PointVector;
      OpenCV.invoke('approxPolyDP', contour, approximation, perimeter * 0.035, true);
      const marker = markerFromPoints(OpenCV.toJSValue(approximation).array);
      if (marker) markers.push(marker);
    }

    markers.sort((first, second) => second.quality - first.quality);
    if (markers.length > MAX_MARKER_CANDIDATES) markers.length = MAX_MARKER_CANDIDATES;
    if (markers.length < 6) return null;

    const columns = findMarkerColumns(markers);
    let bestArea: DocumentQuadrilateral | null = null;
    let bestScore = 0;
    for (let first = 0; first < columns.length - 1; first += 1) {
      for (let second = first + 1; second < columns.length; second += 1) {
        const pattern = markerPatternScore(columns[first], columns[second]);
        if (pattern && pattern.score > bestScore) {
          bestArea = pattern.area;
          bestScore = pattern.score;
        }
      }
    }
    return bestArea;
  } finally {
    OpenCV.clearBuffers();
  }
}
