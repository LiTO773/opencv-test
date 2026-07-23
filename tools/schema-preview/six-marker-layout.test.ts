import assert from 'node:assert/strict';
import test from 'node:test';

import {
  selectBestSixMarkerLayout,
  SIX_MARKER_LAYOUT_CONTRACT_VERSION,
  type SixMarkerCandidate,
  type SixMarkerCandidateGroups,
  type SixMarkerPosition,
  type SixMarkerRegions,
} from '../../src/features/four-point/six-marker-layout';
import type {
  MarkerMatch,
  Point2D,
  Quadrilateral,
} from '../../src/features/four-point/types';

const frameSize = { width: 500, height: 600 };

function marker(center: Point2D, size = 20, corners?: Quadrilateral): MarkerMatch {
  const half = size / 2;
  return {
    center,
    size,
    corners: corners ?? [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half },
    ],
  };
}

function candidate(
  center: Point2D,
  appearanceScore = 0.85,
  size = 20,
  qrFinderNestingLevels = 0,
): SixMarkerCandidate {
  return {
    marker: marker(center, size),
    appearanceScore,
    qrFinderNestingLevels,
  };
}

function candidateGroups(
  overrides: Partial<Record<SixMarkerPosition, readonly SixMarkerCandidate[]>> = {},
): SixMarkerCandidateGroups {
  return {
    'top-left': overrides['top-left'] ?? [candidate({ x: 100, y: 80 })],
    'middle-left': overrides['middle-left'] ?? [candidate({ x: 92, y: 285 }, 0.83, 21)],
    'bottom-left': overrides['bottom-left'] ?? [candidate({ x: 80, y: 500 }, 0.86, 22)],
    'top-right': overrides['top-right'] ?? [candidate({ x: 420, y: 110 }, 0.82, 19)],
    'middle-right':
      overrides['middle-right'] ?? [candidate({ x: 410, y: 300 }, 0.84, 20)],
    'bottom-right':
      overrides['bottom-right'] ?? [candidate({ x: 390, y: 490 }, 0.81, 21)],
  };
}

const regions: SixMarkerRegions = {
  'top-left': { position: 'top-left', x: 50, y: 30, width: 100, height: 100 },
  'middle-left': {
    position: 'middle-left',
    x: 42,
    y: 235,
    width: 100,
    height: 100,
  },
  'bottom-left': {
    position: 'bottom-left',
    x: 30,
    y: 450,
    width: 100,
    height: 100,
  },
  'top-right': { position: 'top-right', x: 370, y: 60, width: 100, height: 100 },
  'middle-right': {
    position: 'middle-right',
    x: 360,
    y: 250,
    width: 100,
    height: 100,
  },
  'bottom-right': {
    position: 'bottom-right',
    x: 340,
    y: 440,
    width: 100,
    height: 100,
  },
};

test('accepts a coherent perspective-distorted layout with stable identities', () => {
  const groups = candidateGroups();
  const selected = selectBestSixMarkerLayout(groups, regions, frameSize);

  assert.ok(selected);
  assert.equal(selected.contractVersion, SIX_MARKER_LAYOUT_CONTRACT_VERSION);
  assert.equal(selected.markers['top-left'], groups['top-left'][0].marker);
  assert.equal(selected.markers['middle-left'], groups['middle-left'][0].marker);
  assert.equal(selected.markers['bottom-left'], groups['bottom-left'][0].marker);
  assert.equal(selected.markers['top-right'], groups['top-right'][0].marker);
  assert.equal(selected.markers['middle-right'], groups['middle-right'][0].marker);
  assert.equal(selected.markers['bottom-right'], groups['bottom-right'][0].marker);
  assert.deepEqual(selected.cropQuadrilateral, [
    groups['top-left'][0].marker.corners[1],
    groups['top-right'][0].marker.corners[0],
    groups['bottom-right'][0].marker.corners[3],
    groups['bottom-left'][0].marker.corners[2],
  ]);
});

test('derives four inset white-reference corridors between adjacent markers', () => {
  const groups = candidateGroups();
  const selected = selectBestSixMarkerLayout(groups, regions, frameSize);

  assert.ok(selected);
  assert.deepEqual(selected.whiteReferenceCorridors['upper-left'].between, [
    'top-left',
    'middle-left',
  ]);
  assert.deepEqual(selected.whiteReferenceCorridors['lower-left'].between, [
    'middle-left',
    'bottom-left',
  ]);
  assert.deepEqual(selected.whiteReferenceCorridors['upper-right'].between, [
    'top-right',
    'middle-right',
  ]);
  assert.deepEqual(selected.whiteReferenceCorridors['lower-right'].between, [
    'middle-right',
    'bottom-right',
  ]);

  const upperLeft = selected.whiteReferenceCorridors['upper-left'].quadrilateral;
  const topMarkerBottom = Math.max(
    ...groups['top-left'][0].marker.corners.map((point) => point.y),
  );
  const middleMarkerTop = Math.min(
    ...groups['middle-left'][0].marker.corners.map((point) => point.y),
  );
  assert.ok(upperLeft.every((point) => point.y > topMarkerBottom));
  assert.ok(upperLeft.every((point) => point.y < middleMarkerTop));
  const topMarkerX = groups['top-left'][0].marker.corners.map((point) => point.x);
  const middleMarkerX = groups['middle-left'][0].marker.corners.map((point) => point.x);
  assert.ok(upperLeft[0].x > Math.min(...topMarkerX));
  assert.ok(upperLeft[1].x < Math.max(...topMarkerX));
  assert.ok(upperLeft[3].x > Math.min(...middleMarkerX));
  assert.ok(upperLeft[2].x < Math.max(...middleMarkerX));
});

test('rejects an incomplete layout containing only the four outer markers', () => {
  const groups = candidateGroups({
    'middle-left': [],
    'middle-right': [],
  });

  assert.equal(selectBestSixMarkerLayout(groups, regions, frameSize), null);
});

test('rejects missing, displaced, incorrectly ordered, badly sized, and uneven middle markers', () => {
  const invalidMiddleCandidates: readonly [
    string,
    Partial<Record<SixMarkerPosition, readonly SixMarkerCandidate[]>>,
  ][] = [
    ['missing', { 'middle-left': [] }],
    ['displaced', { 'middle-left': [candidate({ x: 160, y: 285 })] }],
    ['incorrectly ordered', { 'middle-right': [candidate({ x: 410, y: 95 })] }],
    ['badly sized', { 'middle-left': [candidate({ x: 92, y: 285 }, 0.9, 7)] }],
    ['unevenly spaced', { 'middle-right': [candidate({ x: 416, y: 175 })] }],
  ];

  for (const [description, overrides] of invalidMiddleCandidates) {
    assert.equal(
      selectBestSixMarkerLayout(candidateGroups(overrides), regions, frameSize),
      null,
      description,
    );
  }
});

test('rejects QR hierarchy candidates even when their local appearance is strongest', () => {
  const realMiddleRight = candidate({ x: 410, y: 300 }, 0.7);
  const qrFinder = candidate({ x: 410, y: 300 }, 1, 20, 2);
  const groups = candidateGroups({
    'middle-right': [qrFinder, realMiddleRight],
  });

  const selected = selectBestSixMarkerLayout(groups, regions, frameSize);

  assert.ok(selected);
  assert.equal(selected.markers['middle-right'], realMiddleRight.marker);
});

test('selects one coherent page hypothesis instead of the strongest marker in each region', () => {
  const coherentMiddleRight = candidate({ x: 410, y: 300 }, 0.68);
  const strongerButDisplaced = candidate({ x: 350, y: 210 }, 0.99);
  const groups = candidateGroups({
    'middle-right': [strongerButDisplaced, coherentMiddleRight],
  });

  const selected = selectBestSixMarkerLayout(groups, regions, frameSize);

  assert.ok(selected);
  assert.equal(selected.markers['middle-right'], coherentMiddleRight.marker);
});

test('rejects non-convex and landscape arrangements', () => {
  const nonConvex = candidateGroups({
    'bottom-right': [candidate({ x: 60, y: 490 })],
  });
  const landscape = candidateGroups({
    'top-left': [candidate({ x: 60, y: 180 })],
    'middle-left': [candidate({ x: 60, y: 280 })],
    'bottom-left': [candidate({ x: 60, y: 380 })],
    'top-right': [candidate({ x: 440, y: 180 })],
    'middle-right': [candidate({ x: 440, y: 280 })],
    'bottom-right': [candidate({ x: 440, y: 380 })],
  });

  assert.equal(selectBestSixMarkerLayout(nonConvex, regions, frameSize), null);
  assert.equal(selectBestSixMarkerLayout(landscape, regions, frameSize), null);
});

test('rejects implausibly narrow and implausibly wide portrait hypotheses', () => {
  const narrow = candidateGroups({
    'top-left': [candidate({ x: 180, y: 80 })],
    'middle-left': [candidate({ x: 180, y: 290 })],
    'bottom-left': [candidate({ x: 180, y: 500 })],
    'top-right': [candidate({ x: 285, y: 80 })],
    'middle-right': [candidate({ x: 285, y: 290 })],
    'bottom-right': [candidate({ x: 285, y: 500 })],
  });
  const wide = candidateGroups({
    'top-left': [candidate({ x: 40, y: 80 })],
    'middle-left': [candidate({ x: 40, y: 290 })],
    'bottom-left': [candidate({ x: 40, y: 500 })],
    'top-right': [candidate({ x: 460, y: 80 })],
    'middle-right': [candidate({ x: 460, y: 290 })],
    'bottom-right': [candidate({ x: 460, y: 500 })],
  });

  assert.equal(selectBestSixMarkerLayout(narrow, regions, frameSize), null);
  assert.equal(selectBestSixMarkerLayout(wide, regions, frameSize), null);
});

test('rejects internally inconsistent rows, columns, spans, and page area', () => {
  const inconsistentRows = candidateGroups({
    'middle-right': [candidate({ x: 280, y: 300 })],
  });
  const inconsistentColumns = candidateGroups({
    'middle-left': [candidate({ x: 92, y: 285 })],
    'bottom-left': [candidate({ x: 60, y: 500 })],
    'middle-right': [candidate({ x: 410, y: 300 })],
    'bottom-right': [candidate({ x: 470, y: 490 })],
  });
  const inconsistentSpans = candidateGroups({
    'middle-right': [candidate({ x: 415, y: 205 })],
    'bottom-right': [candidate({ x: 410, y: 300 })],
  });
  const tooSmall = candidateGroups({
    'top-left': [candidate({ x: 180, y: 190 }, 0.9, 8)],
    'middle-left': [candidate({ x: 180, y: 250 }, 0.9, 8)],
    'bottom-left': [candidate({ x: 180, y: 310 }, 0.9, 8)],
    'top-right': [candidate({ x: 280, y: 190 }, 0.9, 8)],
    'middle-right': [candidate({ x: 280, y: 250 }, 0.9, 8)],
    'bottom-right': [candidate({ x: 280, y: 310 }, 0.9, 8)],
  });

  assert.equal(selectBestSixMarkerLayout(inconsistentRows, regions, frameSize), null);
  assert.equal(selectBestSixMarkerLayout(inconsistentColumns, regions, frameSize), null);
  assert.equal(selectBestSixMarkerLayout(inconsistentSpans, regions, frameSize), null);
  assert.equal(selectBestSixMarkerLayout(tooSmall, regions, frameSize), null);
});
