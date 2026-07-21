import assert from 'node:assert/strict';
import test from 'node:test';

import { countQrFinderNestingLevels } from '../../src/features/four-point/contour-hierarchy';
import {
  selectBestMarkerLayout,
  type MarkerCandidate,
  type MarkerCandidateGroups,
} from '../../src/features/four-point/four-point-layout';
import type { MarkerMatch, MarkerRegion, Point2D } from '../../src/features/four-point/types';

function marker(center: Point2D, size = 20): MarkerMatch {
  const half = size / 2;
  return {
    center,
    size,
    corners: [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half },
    ],
  };
}

function candidate(center: Point2D, appearanceScore: number): MarkerCandidate {
  return { marker: marker(center), appearanceScore, qrFinderNestingLevels: 0 };
}

const regions: [MarkerRegion, MarkerRegion, MarkerRegion, MarkerRegion] = [
  { position: 'top-left', x: 0, y: 0, width: 100, height: 100 },
  { position: 'top-right', x: 200, y: 0, width: 100, height: 100 },
  { position: 'bottom-right', x: 200, y: 300, width: 100, height: 100 },
  { position: 'bottom-left', x: 0, y: 300, width: 100, height: 100 },
];

test('identifies every contour in a QR-style black-white-black hierarchy family', () => {
  const hierarchy = new Int32Array([
    -1, -1, 1, -1,
    -1, -1, 2, 0,
    -1, -1, -1, 1,
  ]);

  assert.equal(countQrFinderNestingLevels(hierarchy, 0), 2);
  assert.equal(countQrFinderNestingLevels(hierarchy, 1), 2);
  assert.equal(countQrFinderNestingLevels(hierarchy, 2), 2);
});

test('does not confuse an isolated filled marker or one shallow defect with a QR finder', () => {
  const isolated = new Int32Array([-1, -1, -1, -1]);
  const oneShallowHole = new Int32Array([
    -1, -1, 1, -1,
    -1, -1, -1, 0,
  ]);

  assert.equal(countQrFinderNestingLevels(isolated, 0), 0);
  assert.equal(countQrFinderNestingLevels(oneShallowHole, 0), 1);
  assert.equal(countQrFinderNestingLevels(oneShallowHole, 1), 1);
});

test('selects the coherent page markers when an inward QR square has a better local score', () => {
  const actualTopRight = candidate({ x: 250, y: 50 }, 0.72);
  const inwardQrSquare = candidate({ x: 215, y: 82 }, 0.99);
  const candidates: MarkerCandidateGroups = [
    [candidate({ x: 50, y: 50 }, 0.8)],
    [inwardQrSquare, actualTopRight],
    [candidate({ x: 250, y: 350 }, 0.8)],
    [candidate({ x: 50, y: 350 }, 0.8)],
  ];

  const selected = selectBestMarkerLayout(candidates, regions);

  assert.ok(selected);
  assert.equal(selected.markers[1], actualTopRight.marker);
});

test('rejects candidate combinations that cannot form a portrait page', () => {
  const candidates: MarkerCandidateGroups = [
    [candidate({ x: 50, y: 50 }, 0.9)],
    [candidate({ x: 250, y: 50 }, 0.9)],
    [candidate({ x: 80, y: 80 }, 0.9)],
    [candidate({ x: 50, y: 350 }, 0.9)],
  ];

  assert.equal(selectBestMarkerLayout(candidates, regions), null);
});

