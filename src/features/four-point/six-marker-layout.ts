import type {
  MarkerMatch,
  Point2D,
  Quadrilateral,
} from '@/features/four-point/types';

export const SIX_MARKER_LAYOUT_CONTRACT_VERSION = 'six-marker-a4-v1';

export const SIX_MARKER_POSITIONS = [
  'top-left',
  'middle-left',
  'bottom-left',
  'top-right',
  'middle-right',
  'bottom-right',
] as const;

export type SixMarkerPosition = (typeof SIX_MARKER_POSITIONS)[number];

export const WHITE_REFERENCE_CORRIDOR_POSITIONS = [
  'upper-left',
  'lower-left',
  'upper-right',
  'lower-right',
] as const;

export type WhiteReferenceCorridorPosition =
  (typeof WHITE_REFERENCE_CORRIDOR_POSITIONS)[number];

export type SixMarkerRegion = {
  position: SixMarkerPosition;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SixMarkerRegions = {
  readonly [Position in SixMarkerPosition]: SixMarkerRegion;
};

export type SixMarkerCandidate = {
  marker: MarkerMatch;
  appearanceScore: number;
  qrFinderNestingLevels: number;
};

export type SixMarkerCandidateGroups = {
  readonly [Position in SixMarkerPosition]: readonly SixMarkerCandidate[];
};

export type SixMarkerMatches = {
  readonly [Position in SixMarkerPosition]: MarkerMatch;
};

export type PartialSixMarkerMatches = {
  readonly [Position in SixMarkerPosition]: MarkerMatch | null;
};

export type WhiteReferenceCorridor = {
  position: WhiteReferenceCorridorPosition;
  between: readonly [SixMarkerPosition, SixMarkerPosition];
  quadrilateral: Quadrilateral;
};

export type WhiteReferenceCorridors = {
  readonly [Position in WhiteReferenceCorridorPosition]: WhiteReferenceCorridor;
};

export type SelectedSixMarkerLayout = {
  contractVersion: typeof SIX_MARKER_LAYOUT_CONTRACT_VERSION;
  cropQuadrilateral: Quadrilateral;
  markers: SixMarkerMatches;
  score: number;
  whiteReferenceCorridors: WhiteReferenceCorridors;
};

export type SixMarkerFrameSize = {
  width: number;
  height: number;
};

const A4_WIDTH_TO_HEIGHT = 210 / 297;
const QR_FINDER_NESTING_LEVELS = 2;
const MIN_COLUMN_SPACING_BALANCE = 0.58;
const MIN_COLUMN_PARALLELISM = 0.88;
const MIN_COLUMN_SPAN_BALANCE = 0.58;
const MAX_COLUMN_ALIGNMENT_ERROR = 0.07;
const MIN_MIDDLE_PROGRESS = 0.3;
const MAX_MIDDLE_PROGRESS = 0.7;
const MAX_MIDDLE_PROGRESS_DIFFERENCE = 0.13;
const MIN_ROW_PARALLELISM = 0.88;
const MIN_ROW_WIDTH_BALANCE = 0.54;
const MIN_MARKER_SIZE_BALANCE = 0.42;
const MIN_PAGE_ASPECT_RATIO = 0.44;
const MAX_PAGE_ASPECT_RATIO = 0.94;
const MIN_PAGE_AREA_FRACTION = 0.08;
const MIN_PAGE_WIDTH_FRACTION = 0.24;
const CORRIDOR_MARKER_EDGE_INSET = 0.14;
const CORRIDOR_UNSAFE_BOUNDARY_INSET = 0.2;

type ColumnMeasurements = {
  alignmentError: number;
  direction: Point2D;
  firstGap: number;
  progress: number;
  secondGap: number;
  spacingBalance: number;
  span: number;
};

type LayoutMeasurements = {
  aspectRatio: number;
  columnAlignmentQuality: number;
  columnParallelism: number;
  markerSizeBalance: number;
  rowParallelism: number;
  rowWidthBalance: number;
  spacingBalance: number;
  spanBalance: number;
};

function distance(first: Point2D, second: Point2D) {
  'worklet';
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function vector(from: Point2D, to: Point2D): Point2D {
  'worklet';
  return { x: to.x - from.x, y: to.y - from.y };
}

function normalizedDot(first: Point2D, second: Point2D) {
  'worklet';
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (denominator === 0) return 0;
  return (first.x * second.x + first.y * second.y) / denominator;
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

function isFinitePoint(point: Point2D) {
  'worklet';
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isValidMarker(marker: MarkerMatch) {
  'worklet';
  if (!isFinitePoint(marker.center) || !Number.isFinite(marker.size) || marker.size <= 0) {
    return false;
  }
  for (const corner of marker.corners) {
    if (!isFinitePoint(corner)) return false;
  }
  return isConvexQuadrilateral(marker.corners);
}

function interpolate(first: Point2D, second: Point2D, progress: number): Point2D {
  'worklet';
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress,
  };
}

function markerFreeCropQuadrilateral(markers: SixMarkerMatches): Quadrilateral {
  'worklet';
  // Marker corners are ordered top-left, top-right, bottom-right, bottom-left.
  // Only the inward-facing corners of the four outer markers define the crop,
  // preserving the established marker-free canonical image.
  return [
    markers['top-left'].corners[1],
    markers['top-right'].corners[0],
    markers['bottom-right'].corners[3],
    markers['bottom-left'].corners[2],
  ];
}

function corridorBetween(
  position: WhiteReferenceCorridorPosition,
  upperPosition: SixMarkerPosition,
  lowerPosition: SixMarkerPosition,
  upper: MarkerMatch,
  lower: MarkerMatch,
): WhiteReferenceCorridor | null {
  'worklet';
  // Follow corresponding marker corners through the perspective-distorted gap.
  // The longitudinal inset clears toner/antialiasing near each marker, and the
  // lateral inset clears the unsafe outside and crop-facing corridor boundaries.
  const upperLeft = interpolate(
    upper.corners[3],
    lower.corners[0],
    CORRIDOR_MARKER_EDGE_INSET,
  );
  const upperRight = interpolate(
    upper.corners[2],
    lower.corners[1],
    CORRIDOR_MARKER_EDGE_INSET,
  );
  const lowerLeft = interpolate(
    upper.corners[3],
    lower.corners[0],
    1 - CORRIDOR_MARKER_EDGE_INSET,
  );
  const lowerRight = interpolate(
    upper.corners[2],
    lower.corners[1],
    1 - CORRIDOR_MARKER_EDGE_INSET,
  );
  const quadrilateral: Quadrilateral = [
    interpolate(upperLeft, upperRight, CORRIDOR_UNSAFE_BOUNDARY_INSET),
    interpolate(upperLeft, upperRight, 1 - CORRIDOR_UNSAFE_BOUNDARY_INSET),
    interpolate(lowerLeft, lowerRight, 1 - CORRIDOR_UNSAFE_BOUNDARY_INSET),
    interpolate(lowerLeft, lowerRight, CORRIDOR_UNSAFE_BOUNDARY_INSET),
  ];
  if (!isConvexQuadrilateral(quadrilateral) || polygonArea(quadrilateral) <= 1) return null;
  return {
    position,
    between: [upperPosition, lowerPosition],
    quadrilateral,
  };
}

function createWhiteReferenceCorridors(
  markers: SixMarkerMatches,
): WhiteReferenceCorridors | null {
  'worklet';
  const upperLeft = corridorBetween(
    'upper-left',
    'top-left',
    'middle-left',
    markers['top-left'],
    markers['middle-left'],
  );
  const lowerLeft = corridorBetween(
    'lower-left',
    'middle-left',
    'bottom-left',
    markers['middle-left'],
    markers['bottom-left'],
  );
  const upperRight = corridorBetween(
    'upper-right',
    'top-right',
    'middle-right',
    markers['top-right'],
    markers['middle-right'],
  );
  const lowerRight = corridorBetween(
    'lower-right',
    'middle-right',
    'bottom-right',
    markers['middle-right'],
    markers['bottom-right'],
  );
  if (!upperLeft || !lowerLeft || !upperRight || !lowerRight) return null;
  return {
    'upper-left': upperLeft,
    'lower-left': lowerLeft,
    'upper-right': upperRight,
    'lower-right': lowerRight,
  };
}

function measureColumn(
  top: MarkerMatch,
  middle: MarkerMatch,
  bottom: MarkerMatch,
): ColumnMeasurements | null {
  'worklet';
  if (!(top.center.y < middle.center.y && middle.center.y < bottom.center.y)) return null;

  const direction = vector(top.center, bottom.center);
  const spanSquared = direction.x * direction.x + direction.y * direction.y;
  if (spanSquared <= 0) return null;
  const span = Math.sqrt(spanSquared);
  const middleOffset = vector(top.center, middle.center);
  const progress =
    (middleOffset.x * direction.x + middleOffset.y * direction.y) / spanSquared;
  if (progress < MIN_MIDDLE_PROGRESS || progress > MAX_MIDDLE_PROGRESS) return null;

  const perpendicularDistance =
    Math.abs(middleOffset.x * direction.y - middleOffset.y * direction.x) / span;
  const alignmentError = perpendicularDistance / span;
  if (alignmentError > MAX_COLUMN_ALIGNMENT_ERROR) return null;

  const firstGap = distance(top.center, middle.center);
  const secondGap = distance(middle.center, bottom.center);
  const spacingBalance = Math.min(firstGap, secondGap) / Math.max(firstGap, secondGap);
  if (spacingBalance < MIN_COLUMN_SPACING_BALANCE) return null;

  return {
    alignmentError,
    direction,
    firstGap,
    progress,
    secondGap,
    spacingBalance,
    span,
  };
}

function hasDistinctMarkers(markers: SixMarkerMatches) {
  'worklet';
  const ordered = SIX_MARKER_POSITIONS.map((position) => markers[position]);
  for (let first = 0; first < ordered.length - 1; first += 1) {
    for (let second = first + 1; second < ordered.length; second += 1) {
      const minimumSeparation = Math.min(ordered[first].size, ordered[second].size) * 0.5;
      if (distance(ordered[first].center, ordered[second].center) < minimumSeparation) {
        return false;
      }
    }
  }
  return true;
}

function layoutMeasurements(
  markers: SixMarkerMatches,
  crop: Quadrilateral,
  frameSize: SixMarkerFrameSize,
): LayoutMeasurements | null {
  'worklet';
  if (
    !Number.isFinite(frameSize.width) ||
    !Number.isFinite(frameSize.height) ||
    frameSize.width <= 0 ||
    frameSize.height <= 0
  ) {
    return null;
  }
  for (const position of SIX_MARKER_POSITIONS) {
    if (!isValidMarker(markers[position])) return null;
  }
  if (!hasDistinctMarkers(markers) || !isConvexQuadrilateral(crop)) return null;

  const topLeft = markers['top-left'];
  const middleLeft = markers['middle-left'];
  const bottomLeft = markers['bottom-left'];
  const topRight = markers['top-right'];
  const middleRight = markers['middle-right'];
  const bottomRight = markers['bottom-right'];
  if (
    topRight.center.x <= topLeft.center.x ||
    middleRight.center.x <= middleLeft.center.x ||
    bottomRight.center.x <= bottomLeft.center.x
  ) {
    return null;
  }

  const outerCenters: Quadrilateral = [
    topLeft.center,
    topRight.center,
    bottomRight.center,
    bottomLeft.center,
  ];
  if (!isConvexQuadrilateral(outerCenters)) return null;
  if (polygonArea(crop) < frameSize.width * frameSize.height * MIN_PAGE_AREA_FRACTION) {
    return null;
  }

  const leftColumn = measureColumn(topLeft, middleLeft, bottomLeft);
  const rightColumn = measureColumn(topRight, middleRight, bottomRight);
  if (!leftColumn || !rightColumn) return null;

  const columnParallelism = normalizedDot(leftColumn.direction, rightColumn.direction);
  if (columnParallelism < MIN_COLUMN_PARALLELISM) return null;
  const spanBalance =
    Math.min(leftColumn.span, rightColumn.span) /
    Math.max(leftColumn.span, rightColumn.span);
  if (spanBalance < MIN_COLUMN_SPAN_BALANCE) return null;
  if (Math.abs(leftColumn.progress - rightColumn.progress) > MAX_MIDDLE_PROGRESS_DIFFERENCE) {
    return null;
  }

  const rowVectors = [
    vector(topLeft.center, topRight.center),
    vector(middleLeft.center, middleRight.center),
    vector(bottomLeft.center, bottomRight.center),
  ];
  const rowWidths = rowVectors.map((row) => Math.hypot(row.x, row.y));
  if (Math.min(...rowWidths) < frameSize.width * MIN_PAGE_WIDTH_FRACTION) return null;
  const rowWidthBalance = Math.min(...rowWidths) / Math.max(...rowWidths);
  if (rowWidthBalance < MIN_ROW_WIDTH_BALANCE) return null;
  const rowParallelism = Math.min(
    normalizedDot(rowVectors[0], rowVectors[1]),
    normalizedDot(rowVectors[1], rowVectors[2]),
  );
  if (rowParallelism < MIN_ROW_PARALLELISM) return null;

  const averageWidth = rowWidths.reduce((sum, width) => sum + width, 0) / rowWidths.length;
  const averageHeight = (leftColumn.span + rightColumn.span) / 2;
  const aspectRatio = averageWidth / averageHeight;
  if (aspectRatio < MIN_PAGE_ASPECT_RATIO || aspectRatio > MAX_PAGE_ASPECT_RATIO) {
    return null;
  }

  const sizes = SIX_MARKER_POSITIONS.map((position) => markers[position].size);
  const markerSizeBalance = Math.min(...sizes) / Math.max(...sizes);
  if (markerSizeBalance < MIN_MARKER_SIZE_BALANCE) return null;

  const maximumAlignmentError = Math.max(
    leftColumn.alignmentError,
    rightColumn.alignmentError,
  );
  return {
    aspectRatio,
    columnAlignmentQuality: 1 - maximumAlignmentError / MAX_COLUMN_ALIGNMENT_ERROR,
    columnParallelism,
    markerSizeBalance,
    rowParallelism,
    rowWidthBalance,
    spacingBalance: Math.min(leftColumn.spacingBalance, rightColumn.spacingBalance),
    spanBalance,
  };
}

function regionCenter(region: SixMarkerRegion): Point2D {
  'worklet';
  return { x: region.x + region.width / 2, y: region.y + region.height / 2 };
}

function guidePositionQuality(markers: SixMarkerMatches, regions: SixMarkerRegions) {
  'worklet';
  let quality = 0;
  for (const position of SIX_MARKER_POSITIONS) {
    const region = regions[position];
    const maximumDistance = Math.max(1, Math.hypot(region.width, region.height) / 2);
    const normalizedDistance = Math.min(
      1,
      distance(markers[position].center, regionCenter(region)) / maximumDistance,
    );
    quality += 1 - normalizedDistance * 0.55;
  }
  return quality / SIX_MARKER_POSITIONS.length;
}

function inwardDisplacementQuality(markers: SixMarkerMatches, regions: SixMarkerRegions) {
  'worklet';
  const inwardDirections: { readonly [Position in SixMarkerPosition]: Point2D } = {
    'top-left': { x: 1, y: 1 },
    'middle-left': { x: 1, y: 0 },
    'bottom-left': { x: 1, y: -1 },
    'top-right': { x: -1, y: 1 },
    'middle-right': { x: -1, y: 0 },
    'bottom-right': { x: -1, y: -1 },
  };
  let quality = 0;
  for (const position of SIX_MARKER_POSITIONS) {
    const region = regions[position];
    const expected = regionCenter(region);
    const offset = vector(expected, markers[position].center);
    const direction = inwardDirections[position];
    const directionLength = Math.hypot(direction.x, direction.y);
    const inwardDistance = Math.max(
      0,
      (offset.x * direction.x + offset.y * direction.y) / directionLength,
    );
    const regionRadius = Math.max(1, Math.hypot(region.width, region.height) / 2);
    quality += 1 - Math.min(1, inwardDistance / regionRadius) * 0.7;
  }
  return quality / SIX_MARKER_POSITIONS.length;
}

function scoreLayout(
  candidates: {
    readonly [Position in SixMarkerPosition]: SixMarkerCandidate;
  },
  regions: SixMarkerRegions,
  frameSize: SixMarkerFrameSize,
): SelectedSixMarkerLayout | null {
  'worklet';
  for (const position of SIX_MARKER_POSITIONS) {
    if (candidates[position].qrFinderNestingLevels >= QR_FINDER_NESTING_LEVELS) {
      return null;
    }
  }
  const markers: SixMarkerMatches = {
    'top-left': candidates['top-left'].marker,
    'middle-left': candidates['middle-left'].marker,
    'bottom-left': candidates['bottom-left'].marker,
    'top-right': candidates['top-right'].marker,
    'middle-right': candidates['middle-right'].marker,
    'bottom-right': candidates['bottom-right'].marker,
  };
  const cropQuadrilateral = markerFreeCropQuadrilateral(markers);
  const measurements = layoutMeasurements(markers, cropQuadrilateral, frameSize);
  if (!measurements) return null;
  const whiteReferenceCorridors = createWhiteReferenceCorridors(markers);
  if (!whiteReferenceCorridors) return null;

  let appearanceQuality = 0;
  for (const position of SIX_MARKER_POSITIONS) {
    appearanceQuality += Math.max(0, Math.min(1, candidates[position].appearanceScore));
  }
  appearanceQuality /= SIX_MARKER_POSITIONS.length;
  const aspectQuality =
    1 / (1 + Math.abs(measurements.aspectRatio - A4_WIDTH_TO_HEIGHT) * 4);
  const score =
    appearanceQuality *
    measurements.markerSizeBalance *
    measurements.spacingBalance *
    measurements.columnAlignmentQuality *
    measurements.columnParallelism *
    measurements.spanBalance *
    measurements.rowParallelism *
    measurements.rowWidthBalance *
    aspectQuality *
    guidePositionQuality(markers, regions) *
    inwardDisplacementQuality(markers, regions);

  return {
    contractVersion: SIX_MARKER_LAYOUT_CONTRACT_VERSION,
    cropQuadrilateral,
    markers,
    score,
    whiteReferenceCorridors,
  };
}

/**
 * Selects one coherent six-marker page hypothesis from grouped local
 * candidates. Candidate identity is explicit at the boundary, and no partial
 * four-marker arrangement can produce a valid result.
 */
export function selectBestSixMarkerLayout(
  candidateGroups: SixMarkerCandidateGroups,
  regions: SixMarkerRegions,
  frameSize: SixMarkerFrameSize,
): SelectedSixMarkerLayout | null {
  'worklet';
  let best: SelectedSixMarkerLayout | null = null;
  for (const topLeft of candidateGroups['top-left']) {
    for (const middleLeft of candidateGroups['middle-left']) {
      for (const bottomLeft of candidateGroups['bottom-left']) {
        for (const topRight of candidateGroups['top-right']) {
          for (const middleRight of candidateGroups['middle-right']) {
            for (const bottomRight of candidateGroups['bottom-right']) {
              const layout = scoreLayout(
                {
                  'top-left': topLeft,
                  'middle-left': middleLeft,
                  'bottom-left': bottomLeft,
                  'top-right': topRight,
                  'middle-right': middleRight,
                  'bottom-right': bottomRight,
                },
                regions,
                frameSize,
              );
              if (layout && (!best || layout.score > best.score)) best = layout;
            }
          }
        }
      }
    }
  }
  return best;
}

export function strongestSixMarkerCandidatesAsMatches(
  candidateGroups: SixMarkerCandidateGroups,
): PartialSixMarkerMatches {
  'worklet';
  const strongestEligible = (candidates: readonly SixMarkerCandidate[]) => {
    'worklet';
    for (const candidate of candidates) {
      if (candidate.qrFinderNestingLevels < QR_FINDER_NESTING_LEVELS) {
        return candidate.marker;
      }
    }
    return null;
  };
  return {
    'top-left': strongestEligible(candidateGroups['top-left']),
    'middle-left': strongestEligible(candidateGroups['middle-left']),
    'bottom-left': strongestEligible(candidateGroups['bottom-left']),
    'top-right': strongestEligible(candidateGroups['top-right']),
    'middle-right': strongestEligible(candidateGroups['middle-right']),
    'bottom-right': strongestEligible(candidateGroups['bottom-right']),
  };
}
