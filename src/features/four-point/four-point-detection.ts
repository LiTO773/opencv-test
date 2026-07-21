import type { PointVector } from 'react-native-fast-opencv';
import {
  AdaptiveThresholdTypes,
  ColorConversionCodes,
  ContourApproximationModes,
  DataTypes,
  ObjectType,
  OpenCV,
  RetrievalModes,
  ThresholdTypes,
} from 'react-native-fast-opencv';

import type {
  FourPointAnalysis,
  MarkerMatch,
  MarkerMatches,
  MarkerRegion,
  Point2D,
  Quadrilateral,
} from '@/features/four-point/types';

const PAGE_WIDTH_FRACTION = 0.76;
const A4_HEIGHT_TO_WIDTH = 297 / 210;
const REGION_WIDTH_FRACTION = 0.25;
const MIN_DARKNESS = 145;

export function createMarkerRegions(
  analysisWidth: number,
  analysisHeight: number,
): [MarkerRegion, MarkerRegion, MarkerRegion, MarkerRegion] {
  const pageWidth = analysisWidth * PAGE_WIDTH_FRACTION;
  const pageHeight = pageWidth * A4_HEIGHT_TO_WIDTH;
  const left = (analysisWidth - pageWidth) / 2;
  // Leave the lower part of the preview clear for the instruction card while
  // keeping the four targets arranged as a true portrait-A4 rectangle.
  const top = analysisHeight * 0.46 - pageHeight / 2;
  const right = left + pageWidth;
  const bottom = top + pageHeight;
  const regionSize = analysisWidth * REGION_WIDTH_FRACTION;
  const halfRegion = regionSize / 2;

  const makeRegion = (
    position: MarkerRegion['position'],
    centerX: number,
    centerY: number,
  ): MarkerRegion => ({
    position,
    x: Math.round(Math.max(0, Math.min(analysisWidth - regionSize, centerX - halfRegion))),
    y: Math.round(Math.max(0, Math.min(analysisHeight - regionSize, centerY - halfRegion))),
    width: Math.round(regionSize),
    height: Math.round(regionSize),
  });

  return [
    makeRegion('top-left', left, top),
    makeRegion('top-right', right, top),
    makeRegion('bottom-right', right, bottom),
    makeRegion('bottom-left', left, bottom),
  ];
}

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

function orderQuadrilateral(points: Point2D[]): Quadrilateral {
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

function isConvexQuadrilateral(points: Quadrilateral) {
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

function centerOf(points: Quadrilateral): Point2D {
  'worklet';
  return points.reduce(
    (center, point) => ({ x: center.x + point.x / 4, y: center.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
}

function markerFromPoints(
  points: Point2D[],
  grayscaleRegion: ReturnType<typeof OpenCV.bufferToMat>,
  region: MarkerRegion,
): { marker: MarkerMatch; score: number } | null {
  'worklet';
  if (points.length !== 4) return null;
  const localCorners = orderQuadrilateral(points);
  if (!isConvexQuadrilateral(localCorners)) return null;

  const area = polygonArea(localCorners);
  const regionArea = region.width * region.height;
  if (area < 14 || area > regionArea * 0.14) return null;

  const sides = localCorners.map((point, index) =>
    distance(point, localCorners[(index + 1) % 4]),
  );
  const shortestSide = Math.min(...sides);
  const longestSide = Math.max(...sides);
  if (shortestSide < 3 || shortestSide / longestSide < 0.55) return null;

  const diagonals = [
    distance(localCorners[0], localCorners[2]),
    distance(localCorners[1], localCorners[3]),
  ];
  const diagonalBalance = Math.min(...diagonals) / Math.max(...diagonals);
  if (diagonalBalance < 0.68) return null;

  const averageSide = sides.reduce((sum, side) => sum + side, 0) / 4;
  const contourFill = area / (averageSide * averageSide);
  if (contourFill < 0.55 || contourFill > 1.45) return null;

  const minimumX = Math.min(...localCorners.map((point) => point.x));
  const maximumX = Math.max(...localCorners.map((point) => point.x));
  const minimumY = Math.min(...localCorners.map((point) => point.y));
  const maximumY = Math.max(...localCorners.map((point) => point.y));
  const innerX = Math.max(0, Math.round(minimumX + (maximumX - minimumX) * 0.25));
  const innerY = Math.max(0, Math.round(minimumY + (maximumY - minimumY) * 0.25));
  const innerWidth = Math.max(
    1,
    Math.min(region.width - innerX, Math.round((maximumX - minimumX) * 0.5)),
  );
  const innerHeight = Math.max(
    1,
    Math.min(region.height - innerY, Math.round((maximumY - minimumY) * 0.5)),
  );
  const inner = OpenCV.createObject(ObjectType.Mat, innerHeight, innerWidth, DataTypes.CV_8U);
  const innerRectangle = OpenCV.createObject(
    ObjectType.Rect,
    innerX,
    innerY,
    innerWidth,
    innerHeight,
  );
  OpenCV.invoke('crop', grayscaleRegion, inner, innerRectangle);
  const mean = OpenCV.toJSValue(OpenCV.invoke('mean', inner)).a;
  if (mean > MIN_DARKNESS) return null;

  const localCenter = centerOf(localCorners);
  const regionCenter = { x: region.width / 2, y: region.height / 2 };
  const centerDistance = distance(localCenter, regionCenter);
  const maximumCenterDistance = Math.hypot(region.width, region.height) / 2;
  const centerQuality = 1 - Math.min(1, centerDistance / maximumCenterDistance) * 0.45;
  const shapeQuality = (shortestSide / longestSide) * diagonalBalance;
  const darknessQuality = 1 - mean / 255;
  const corners = localCorners.map((point) => ({
    x: point.x + region.x,
    y: point.y + region.y,
  })) as Quadrilateral;

  return {
    marker: {
      center: { x: localCenter.x + region.x, y: localCenter.y + region.y },
      corners,
      size: Math.sqrt(area),
    },
    score: shapeQuality * darknessQuality * centerQuality,
  };
}

function findMarkerInRegion(
  source: ReturnType<typeof OpenCV.bufferToMat>,
  channels: 3 | 4,
  conversion: ColorConversionCodes,
  region: MarkerRegion,
) {
  'worklet';
  const colorRegion = OpenCV.createObject(
    ObjectType.Mat,
    region.height,
    region.width,
    channels === 3 ? DataTypes.CV_8UC3 : DataTypes.CV_8UC4,
  );
  const grayscaleRegion = OpenCV.createObject(
    ObjectType.Mat,
    region.height,
    region.width,
    DataTypes.CV_8U,
  );
  const rectangle = OpenCV.createObject(
    ObjectType.Rect,
    region.x,
    region.y,
    region.width,
    region.height,
  );
  OpenCV.invoke('crop', source, colorRegion, rectangle);
  OpenCV.invoke('cvtColor', colorRegion, grayscaleRegion, conversion);

  const thresholded = OpenCV.createObject(
    ObjectType.Mat,
    region.height,
    region.width,
    DataTypes.CV_8U,
  );
  OpenCV.invoke(
    'GaussianBlur',
    grayscaleRegion,
    thresholded,
    OpenCV.createObject(ObjectType.Size, 3, 3),
    0,
  );
  OpenCV.invoke(
    'adaptiveThreshold',
    thresholded,
    thresholded,
    255,
    AdaptiveThresholdTypes.ADAPTIVE_THRESH_GAUSSIAN_C,
    ThresholdTypes.THRESH_BINARY_INV,
    21,
    7,
  );

  const contours = OpenCV.createObject(ObjectType.PointVectorOfVectors);
  OpenCV.invoke(
    'findContours',
    thresholded,
    contours,
    RetrievalModes.RETR_LIST,
    ContourApproximationModes.CHAIN_APPROX_SIMPLE,
  );

  const contourCount = OpenCV.toJSValue(contours).array.length;
  let bestMarker: MarkerMatch | null = null;
  let bestScore = 0;
  for (let index = 0; index < contourCount; index += 1) {
    const contour = OpenCV.copyObjectFromVector(contours, index);
    const contourArea = OpenCV.invoke('contourArea', contour, false).value;
    if (contourArea < 14 || contourArea > region.width * region.height * 0.14) continue;

    const perimeter = OpenCV.invoke('arcLength', contour, true).value;
    const approximation = OpenCV.createObject(ObjectType.PointVector) as PointVector;
    OpenCV.invoke('approxPolyDP', contour, approximation, perimeter * 0.04, true);
    const candidate = markerFromPoints(
      OpenCV.toJSValue(approximation).array,
      grayscaleRegion,
      region,
    );
    if (candidate && candidate.score > bestScore) {
      bestMarker = candidate.marker;
      bestScore = candidate.score;
    }
  }
  return bestMarker;
}

function markerFreeCropQuadrilateral(markers: MarkerMatches): Quadrilateral | null {
  'worklet';
  const [topLeft, topRight, bottomRight, bottomLeft] = markers;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;

  // Marker corners are ordered top-left, top-right, bottom-right, bottom-left.
  // Use the inward-facing corners so both complete marker columns are excluded,
  // while the top and bottom marker edges retain the intended vertical span.
  return [
    topLeft.corners[1],
    topRight.corners[0],
    bottomRight.corners[3],
    bottomLeft.corners[2],
  ];
}

function isPlausiblePortraitLayout(markers: MarkerMatches, crop: Quadrilateral) {
  'worklet';
  const [topLeft, topRight, bottomRight, bottomLeft] = markers;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return false;
  if (!isConvexQuadrilateral(crop)) return false;

  if (
    topRight.center.x <= topLeft.center.x ||
    bottomRight.center.x <= bottomLeft.center.x ||
    bottomLeft.center.y <= topLeft.center.y ||
    bottomRight.center.y <= topRight.center.y
  ) {
    return false;
  }

  const widths = [distance(topLeft.center, topRight.center), distance(bottomLeft.center, bottomRight.center)];
  const heights = [distance(topLeft.center, bottomLeft.center), distance(topRight.center, bottomRight.center)];
  const widthBalance = Math.min(...widths) / Math.max(...widths);
  const heightBalance = Math.min(...heights) / Math.max(...heights);
  if (widthBalance < 0.45 || heightBalance < 0.45) return false;

  const averageWidth = (widths[0] + widths[1]) / 2;
  const averageHeight = (heights[0] + heights[1]) / 2;
  const aspectRatio = averageWidth / averageHeight;
  if (aspectRatio < 0.46 || aspectRatio > 0.92) return false;

  const sizes = [topLeft.size, topRight.size, bottomRight.size, bottomLeft.size];
  return Math.min(...sizes) / Math.max(...sizes) >= 0.28;
}

function analyzePixels(
  pixelBuffer: ArrayBuffer,
  channels: 3 | 4,
  conversion: ColorConversionCodes,
  analysisWidth: number,
  analysisHeight: number,
  regions: readonly MarkerRegion[],
): FourPointAnalysis {
  'worklet';
  try {
    const source = OpenCV.bufferToMat(
      'uint8',
      analysisHeight,
      analysisWidth,
      channels,
      new Uint8Array(pixelBuffer),
    );

    const markers: MarkerMatches = [null, null, null, null];
    for (let index = 0; index < 4; index += 1) {
      markers[index] = findMarkerInRegion(source, channels, conversion, regions[index]);
    }
    const matchedCount = markers.reduce((count, marker) => count + (marker ? 1 : 0), 0);
    const crop = markerFreeCropQuadrilateral(markers);
    return {
      markers,
      matchedCount,
      cropQuadrilateral: crop && isPlausiblePortraitLayout(markers, crop) ? crop : null,
    };
  } finally {
    OpenCV.clearBuffers();
  }
}

export function detectFourPoints(
  pixelBuffer: ArrayBuffer,
  analysisWidth: number,
  analysisHeight: number,
  regions: readonly MarkerRegion[],
) {
  'worklet';
  return analyzePixels(
    pixelBuffer,
    3,
    ColorConversionCodes.COLOR_BGR2GRAY,
    analysisWidth,
    analysisHeight,
    regions,
  );
}

export function detectFourPointsFromRgba(
  pixelBuffer: ArrayBuffer,
  analysisWidth: number,
  analysisHeight: number,
  regions: readonly MarkerRegion[],
) {
  'worklet';
  return analyzePixels(
    pixelBuffer,
    4,
    ColorConversionCodes.COLOR_RGBA2GRAY,
    analysisWidth,
    analysisHeight,
    regions,
  );
}

export function mapAnalysisToSource(
  point: Point2D,
  analysisWidth: number,
  analysisHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): Point2D {
  'worklet';
  const scale = Math.max(analysisWidth / sourceWidth, analysisHeight / sourceHeight);
  const croppedX = (sourceWidth * scale - analysisWidth) / 2;
  const croppedY = (sourceHeight * scale - analysisHeight) / 2;
  return {
    x: (point.x + croppedX) / scale,
    y: (point.y + croppedY) / scale,
  };
}
