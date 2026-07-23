import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calibratePageReferences,
  createPageCalibrationSamplingPlan,
  rotatePageCalibrationEvidence180,
  type CalibrationImage,
  type CalibrationSampleRegion,
} from '../../src/features/four-point/page-calibration';
import {
  selectBestSixMarkerLayout,
  type SelectedSixMarkerLayout,
  type SixMarkerCandidateGroups,
  type SixMarkerPosition,
  type SixMarkerRegions,
} from '../../src/features/four-point/six-marker-layout';
import type { MarkerMatch, Point2D } from '../../src/features/four-point/types';
import { buildPageCalibrationOverlaySvg } from './page-calibration-overlay';

const WIDTH = 500;
const HEIGHT = 700;
const MARKER_SIZE = 30;

const centers: Record<SixMarkerPosition, Point2D> = {
  'top-left': { x: 70, y: 60 },
  'middle-left': { x: 70, y: 350 },
  'bottom-left': { x: 70, y: 640 },
  'top-right': { x: 430, y: 60 },
  'middle-right': { x: 430, y: 350 },
  'bottom-right': { x: 430, y: 640 },
};

function marker(center: Point2D): MarkerMatch {
  const half = MARKER_SIZE / 2;
  return {
    center,
    size: MARKER_SIZE,
    corners: [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half },
    ],
  };
}

function layoutFixture() {
  const groups = {} as {
    [Position in SixMarkerPosition]: SixMarkerCandidateGroups[Position];
  };
  const regions = {} as {
    [Position in SixMarkerPosition]: SixMarkerRegions[Position];
  };
  for (const [position, center] of Object.entries(centers) as [
    SixMarkerPosition,
    Point2D,
  ][]) {
    groups[position] = [
      {
        marker: marker(center),
        appearanceScore: 0.9,
        qrFinderNestingLevels: 0,
      },
    ];
    regions[position] = {
      position,
      x: center.x - 40,
      y: center.y - 40,
      width: 80,
      height: 80,
    };
  }
  const layout = selectBestSixMarkerLayout(groups, regions, {
    width: WIDTH,
    height: HEIGHT,
  });
  assert.ok(layout);
  return layout;
}

function fillRegion(
  image: CalibrationImage,
  region: Pick<CalibrationSampleRegion, 'sourceQuadrilateral'>,
  value: number,
) {
  const minimumX = Math.floor(
    Math.min(...region.sourceQuadrilateral.map((point) => point.x)),
  );
  const maximumX = Math.ceil(
    Math.max(...region.sourceQuadrilateral.map((point) => point.x)),
  );
  const minimumY = Math.floor(
    Math.min(...region.sourceQuadrilateral.map((point) => point.y)),
  );
  const maximumY = Math.ceil(
    Math.max(...region.sourceQuadrilateral.map((point) => point.y)),
  );
  for (let y = Math.max(0, minimumY); y <= Math.min(image.height - 1, maximumY); y += 1) {
    for (let x = Math.max(0, minimumX); x <= Math.min(image.width - 1, maximumX); x += 1) {
      image.data[y * image.width + x] = value;
    }
  }
}

function splitRegion(
  image: CalibrationImage,
  region: CalibrationSampleRegion,
  first: number,
  second: number,
) {
  const minimumX = Math.floor(
    Math.min(...region.sourceQuadrilateral.map((point) => point.x)),
  );
  const maximumX = Math.ceil(
    Math.max(...region.sourceQuadrilateral.map((point) => point.x)),
  );
  const midpoint = (minimumX + maximumX) / 2;
  const minimumY = Math.floor(
    Math.min(...region.sourceQuadrilateral.map((point) => point.y)),
  );
  const maximumY = Math.ceil(
    Math.max(...region.sourceQuadrilateral.map((point) => point.y)),
  );
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      image.data[y * image.width + x] = x < midpoint ? first : second;
    }
  }
}

function calibrationFixture(paper = 230, black = 25) {
  const layout = layoutFixture();
  const image: CalibrationImage = {
    width: WIDTH,
    height: HEIGHT,
    data: new Uint8Array(WIDTH * HEIGHT).fill(paper),
  };
  for (const position of Object.keys(centers) as SixMarkerPosition[]) {
    fillRegion(image, { sourceQuadrilateral: layout.markers[position].corners }, black);
  }
  const plan = createPageCalibrationSamplingPlan(layout);
  assert.ok(plan);
  return { image, layout, plan };
}

function findingCodes(
  image: CalibrationImage,
  layout: SelectedSixMarkerLayout,
) {
  return calibratePageReferences(image, layout).findings.map((finding) => finding.code);
}

test('extracts six inset black references and four tiled white corridors', () => {
  const { image, layout } = calibrationFixture();
  const calibration = calibratePageReferences(image, layout);

  assert.equal(calibration.valid, true);
  assert.equal(calibration.black.samples.length, 6);
  assert.equal(calibration.black.acceptedSampleCount, 6);
  assert.equal(calibration.black.robustValue, 25);
  assert.equal(calibration.white.acceptedTileCount, 24);
  assert.equal(calibration.white.robustValue, 230);
  assert.equal(calibration.dynamicRange, 205);
  for (const corridor of Object.values(calibration.white.corridors)) {
    assert.equal(corridor.tiles.length, 6);
    assert.equal(corridor.acceptedTileCount, 6);
  }
  for (const sample of [
    ...calibration.black.samples,
    ...Object.values(calibration.white.corridors).flatMap(
      (corridor) => corridor.tiles,
    ),
  ]) {
    assert.ok(Number.isFinite(sample.normalizedPagePosition.x));
    assert.ok(Number.isFinite(sample.normalizedPagePosition.y));
  }
});

test('offline overlay exposes six black samples, white tiles, and quality outcome', () => {
  const { image, layout } = calibrationFixture();
  const calibration = calibratePageReferences(image, layout);
  const svg = buildPageCalibrationOverlaySvg(calibration, WIDTH, HEIGHT);

  assert.equal((svg.match(/data-layer="black-marker"/g) ?? []).length, 6);
  assert.equal((svg.match(/data-layer="white-corridor"/g) ?? []).length, 4);
  assert.equal((svg.match(/data-layer="white-tile"/g) ?? []).length, 24);
  assert.match(svg, /data-layer="calibration-outcome"/);
  assert.match(svg, /data-valid="true"/);
});

test('rotates calibration identities and normalized positions with an upside-down page', () => {
  const { image, layout } = calibrationFixture();
  const calibration = calibratePageReferences(image, layout);
  const originalTopLeft = calibration.black.samples.find(
    (sample) => sample.markerPosition === 'top-left',
  );
  assert.ok(originalTopLeft);

  const rotated = rotatePageCalibrationEvidence180(calibration);
  const rotatedBottomRight = rotated.black.samples.find(
    (sample) => sample.markerPosition === 'bottom-right',
  );
  assert.ok(rotatedBottomRight);
  assert.equal(
    rotatedBottomRight.normalizedPagePosition.x,
    1 - originalTopLeft.normalizedPagePosition.x,
  );
  assert.equal(
    rotatedBottomRight.normalizedPagePosition.y,
    1 - originalTopLeft.normalizedPagePosition.y,
  );
  assert.equal(
    rotated.white.corridors['lower-right'].tiles[0].corridorPosition,
    'lower-right',
  );
});

test('excludes mild tile contamination while retaining sufficient evidence', () => {
  const { image, layout, plan } = calibrationFixture();
  const contaminated = plan.find((region) => region.id === 'white:upper-left:0');
  assert.ok(contaminated);
  fillRegion(image, contaminated, 30);

  const calibration = calibratePageReferences(image, layout);

  assert.equal(calibration.valid, true);
  assert.equal(calibration.white.rejectedTileCount, 1);
  assert.equal(
    calibration.white.corridors['upper-left'].tiles[0].rejectionCode,
    'tile_outlier',
  );
  assert.equal(calibration.white.robustValue, 230);
});

test('fails safely when contamination becomes excessive', () => {
  const { image, layout, plan } = calibrationFixture();
  for (const tile of plan.filter(
    (region) =>
      region.corridorPosition === 'upper-left' &&
      region.tileIndex !== null &&
      region.tileIndex < 4,
  )) {
    fillRegion(image, tile, 30);
  }

  const calibration = calibratePageReferences(image, layout);

  assert.equal(calibration.valid, false);
  assert.ok(calibration.findings.length > 0);
});

test('rejects clipped whites', () => {
  const { image, layout, plan } = calibrationFixture();
  for (const tile of plan.filter((region) => region.kind === 'white-tile')) {
    fillRegion(image, tile, 255);
  }
  assert.ok(findingCodes(image, layout).includes('white_clipping'));
});

test('rejects washed-out blacks', () => {
  const { image, layout, plan } = calibrationFixture();
  for (const sample of plan.filter((region) => region.kind === 'black-marker')) {
    fillRegion(image, sample, 165);
  }
  const codes = findingCodes(image, layout);
  assert.ok(codes.includes('washed_out_blacks'));
  assert.ok(codes.includes('insufficient_black_references'));
});

test('rejects insufficient black-to-white range', () => {
  const { image, layout } = calibrationFixture(105, 35);
  assert.ok(findingCodes(image, layout).includes('insufficient_dynamic_range'));
});

test('rejects a corridor with too few valid tiles', () => {
  const { image, layout, plan } = calibrationFixture();
  for (const tile of plan.filter(
    (region) => region.corridorPosition === 'lower-right',
  )) {
    splitRegion(image, tile, 20, 230);
  }
  const calibration = calibratePageReferences(image, layout);

  assert.equal(calibration.white.corridors['lower-right'].acceptedTileCount, 0);
  assert.ok(
    calibration.findings.some(
      (finding) => finding.code === 'insufficient_white_tiles',
    ),
  );
});

test('rejects implausible left/right and vertical reference disagreement', () => {
  const { image, layout, plan } = calibrationFixture();
  for (const tile of plan.filter(
    (region) => region.corridorPosition === 'upper-left',
  )) {
    fillRegion(image, tile, 140);
  }
  const codes = findingCodes(image, layout);

  assert.ok(codes.includes('left_right_reference_disagreement'));
  assert.ok(codes.includes('vertical_reference_disagreement'));
});
