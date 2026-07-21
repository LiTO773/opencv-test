import type {
  MarkerMatch,
  MarkerMatches,
  MarkerRegion,
  Point2D,
  Quadrilateral,
} from '@/features/four-point/types';

const A4_WIDTH_TO_HEIGHT = 210 / 297;

export type MarkerCandidate = {
  marker: MarkerMatch;
  appearanceScore: number;
  qrFinderNestingLevels: number;
};

export type MarkerCandidateGroups = readonly [
  readonly MarkerCandidate[],
  readonly MarkerCandidate[],
  readonly MarkerCandidate[],
  readonly MarkerCandidate[],
];

type CompleteMarkerMatches = [MarkerMatch, MarkerMatch, MarkerMatch, MarkerMatch];

export type SelectedMarkerLayout = {
  cropQuadrilateral: Quadrilateral;
  markers: CompleteMarkerMatches;
  score: number;
};

function distance(first: Point2D, second: Point2D) {
  'worklet';
  return Math.hypot(first.x - second.x, first.y - second.y);
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

function markerFreeCropQuadrilateral(markers: CompleteMarkerMatches): Quadrilateral {
  'worklet';
  const [topLeft, topRight, bottomRight, bottomLeft] = markers;

  // Marker corners are ordered top-left, top-right, bottom-right, bottom-left.
  // These inward-facing corners exclude both marker columns from the crop.
  return [
    topLeft.corners[1],
    topRight.corners[0],
    bottomRight.corners[3],
    bottomLeft.corners[2],
  ];
}

function layoutMeasurements(markers: CompleteMarkerMatches, crop: Quadrilateral) {
  'worklet';
  const [topLeft, topRight, bottomRight, bottomLeft] = markers;
  if (!isConvexQuadrilateral(crop)) return null;

  if (
    topRight.center.x <= topLeft.center.x ||
    bottomRight.center.x <= bottomLeft.center.x ||
    bottomLeft.center.y <= topLeft.center.y ||
    bottomRight.center.y <= topRight.center.y
  ) {
    return null;
  }

  const topWidth = distance(topLeft.center, topRight.center);
  const bottomWidth = distance(bottomLeft.center, bottomRight.center);
  const leftHeight = distance(topLeft.center, bottomLeft.center);
  const rightHeight = distance(topRight.center, bottomRight.center);
  const widthBalance = Math.min(topWidth, bottomWidth) / Math.max(topWidth, bottomWidth);
  const heightBalance = Math.min(leftHeight, rightHeight) / Math.max(leftHeight, rightHeight);
  if (widthBalance < 0.45 || heightBalance < 0.45) return null;

  const averageWidth = (topWidth + bottomWidth) / 2;
  const averageHeight = (leftHeight + rightHeight) / 2;
  const aspectRatio = averageWidth / averageHeight;
  if (aspectRatio < 0.46 || aspectRatio > 0.92) return null;

  const sizes = markers.map((marker) => marker.size);
  const sizeBalance = Math.min(...sizes) / Math.max(...sizes);
  if (sizeBalance < 0.28) return null;

  return { aspectRatio, heightBalance, sizeBalance, widthBalance };
}

function regionCenter(region: MarkerRegion): Point2D {
  'worklet';
  return { x: region.x + region.width / 2, y: region.y + region.height / 2 };
}

function guidePositionQuality(markers: CompleteMarkerMatches, regions: readonly MarkerRegion[]) {
  'worklet';
  let quality = 0;
  for (let index = 0; index < markers.length; index += 1) {
    const region = regions[index];
    const maximumDistance = Math.hypot(region.width, region.height) / 2;
    const normalizedDistance = Math.min(
      1,
      distance(markers[index].center, regionCenter(region)) / maximumDistance,
    );
    quality += 1 - normalizedDistance * 0.55;
  }
  return quality / markers.length;
}

function inwardDisplacementQuality(
  markers: CompleteMarkerMatches,
  regions: readonly MarkerRegion[],
) {
  'worklet';
  // QR metadata is printed inside the page, whereas each real marker is outside
  // the canonical crop. Penalizing inward displacement helps a nearby QR finder
  // square lose to the true corner marker without narrowing the forgiving ROIs.
  const inwardDirections: readonly Point2D[] = [
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
  ];
  let quality = 0;
  for (let index = 0; index < markers.length; index += 1) {
    const expected = regionCenter(regions[index]);
    const offset = {
      x: markers[index].center.x - expected.x,
      y: markers[index].center.y - expected.y,
    };
    const direction = inwardDirections[index];
    const inwardDistance = Math.max(0, (offset.x * direction.x + offset.y * direction.y) / Math.SQRT2);
    const regionRadius = Math.hypot(regions[index].width, regions[index].height) / 2;
    quality += 1 - Math.min(1, inwardDistance / regionRadius) * 0.7;
  }
  return quality / markers.length;
}

function scoreLayout(
  candidates: readonly [MarkerCandidate, MarkerCandidate, MarkerCandidate, MarkerCandidate],
  regions: readonly MarkerRegion[],
) {
  'worklet';
  const markers = candidates.map((candidate) => candidate.marker) as CompleteMarkerMatches;
  const cropQuadrilateral = markerFreeCropQuadrilateral(markers);
  const measurements = layoutMeasurements(markers, cropQuadrilateral);
  if (!measurements) return null;

  const appearanceQuality =
    candidates.reduce((sum, candidate) => sum + candidate.appearanceScore, 0) /
    candidates.length;
  const aspectQuality = 1 / (1 + Math.abs(measurements.aspectRatio - A4_WIDTH_TO_HEIGHT) * 4);
  const score =
    appearanceQuality *
    measurements.sizeBalance *
    measurements.widthBalance *
    measurements.heightBalance *
    aspectQuality *
    guidePositionQuality(markers, regions) *
    inwardDisplacementQuality(markers, regions);

  return { cropQuadrilateral, markers, score };
}

/**
 * Selects four markers as one page hypothesis instead of allowing a QR finder
 * square to win a corner independently. Keeping several candidates per ROI and
 * scoring their complete geometry is the second line of QR false-positive
 * protection after contour-hierarchy filtering.
 */
export function selectBestMarkerLayout(
  candidateGroups: MarkerCandidateGroups,
  regions: readonly MarkerRegion[],
): SelectedMarkerLayout | null {
  'worklet';
  let best: SelectedMarkerLayout | null = null;
  for (const topLeft of candidateGroups[0]) {
    for (const topRight of candidateGroups[1]) {
      for (const bottomRight of candidateGroups[2]) {
        for (const bottomLeft of candidateGroups[3]) {
          const layout = scoreLayout(
            [topLeft, topRight, bottomRight, bottomLeft],
            regions,
          );
          if (layout && (!best || layout.score > best.score)) best = layout;
        }
      }
    }
  }
  return best;
}

export function strongestCandidatesAsMatches(
  candidateGroups: MarkerCandidateGroups,
): MarkerMatches {
  'worklet';
  return candidateGroups.map((candidates) => candidates[0]?.marker ?? null) as MarkerMatches;
}
