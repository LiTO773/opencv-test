import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFourGuideAnalysis,
  evaluatePreviewValidation,
  getFourGuideScannerPresentation,
} from '../../src/features/four-point/six-marker-scanning';
import type {
  PartialSixMarkerMatches,
} from '../../src/features/four-point/six-marker-layout';
import type {
  MarkerMatch,
  Point2D,
  Quadrilateral,
} from '../../src/features/four-point/types';

function marker(center: Point2D): MarkerMatch {
  return {
    center,
    size: 20,
    corners: [
      { x: center.x - 10, y: center.y - 10 },
      { x: center.x + 10, y: center.y - 10 },
      { x: center.x + 10, y: center.y + 10 },
      { x: center.x - 10, y: center.y + 10 },
    ],
  };
}

function completeMatches(): PartialSixMarkerMatches {
  return {
    'top-left': marker({ x: 80, y: 80 }),
    'middle-left': marker({ x: 80, y: 280 }),
    'bottom-left': marker({ x: 80, y: 480 }),
    'top-right': marker({ x: 380, y: 80 }),
    'middle-right': marker({ x: 380, y: 280 }),
    'bottom-right': marker({ x: 380, y: 480 }),
  };
}

const crop: Quadrilateral = [
  { x: 90, y: 70 },
  { x: 370, y: 70 },
  { x: 370, y: 490 },
  { x: 90, y: 490 },
];

test('projects six backend identities into exactly four outer UI matches', () => {
  const matches = completeMatches();
  const analysis = createFourGuideAnalysis(matches, crop);

  assert.equal(analysis.markers.length, 4);
  assert.equal(analysis.matchedCount, 4);
  assert.deepEqual(analysis.markers, [
    matches['top-left'],
    matches['top-right'],
    matches['bottom-right'],
    matches['bottom-left'],
  ]);
  assert.equal(analysis.sixMarkerMatches['middle-left'], matches['middle-left']);
  assert.equal(analysis.sixMarkerMatches['middle-right'], matches['middle-right']);
});

test('four outer matches without a complete six-marker layout only validate', () => {
  const matches: PartialSixMarkerMatches = {
    ...completeMatches(),
    'middle-left': null,
    'middle-right': null,
  };
  const analysis = createFourGuideAnalysis(matches, null);
  const validation = evaluatePreviewValidation(analysis, 20, 2, false);

  assert.equal(analysis.matchedCount, 4);
  assert.deepEqual(validation, {
    consecutiveCompleteLayouts: 0,
    scanState: 'validating',
    shouldCapture: false,
  });
});

test('automatic capture requires consecutive complete six-marker layouts', () => {
  const analysis = createFourGuideAnalysis(completeMatches(), crop);
  const first = evaluatePreviewValidation(analysis, 0, 2, false);
  const second = evaluatePreviewValidation(
    analysis,
    first.consecutiveCompleteLayouts,
    2,
    false,
  );

  assert.equal(first.scanState, 'ready');
  assert.equal(first.shouldCapture, false);
  assert.equal(second.shouldCapture, true);
});

test('scanner presentation exposes only four guides and neutral validation copy', () => {
  const presentation = getFourGuideScannerPresentation('validating', 6);
  const allCopy = [
    presentation.statusLabel,
    presentation.instructionTitle,
    presentation.instructionBody,
  ].join(' ');

  assert.equal(presentation.visibleMarkerCount, 4);
  assert.match(presentation.statusLabel, /4\/4/);
  assert.doesNotMatch(allCopy, /6|meio|centro/i);
  assert.match(allCopy, /estável|validada/i);
});
