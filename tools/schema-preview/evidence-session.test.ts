import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeBubbleGradingImage,
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  type GrayscaleImage,
} from '../../src/features/bubble-grading/bubble-analysis';
import {
  analyzeEvidenceSession,
  EVIDENCE_SESSION_CONTRACT_VERSION,
  EVIDENCE_SESSION_DIAGNOSTIC_FORMAT_VERSION,
  EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION,
  EVIDENCE_REASON_CATEGORY_FORMAT_VERSION,
  EvidenceSessionValidationFailure,
  LEGACY_BUBBLE_REASON_CATEGORIES,
  validateEvidenceSessionInput,
  type EvidenceSessionInput,
} from '../../src/features/bubble-grading/evidence-session';
import { validSchemaFixture } from './fixtures/valid-schema';

function canonicalImage(): GrayscaleImage {
  const dimensions = validSchemaFixture.canonicalImage.dimensions;
  assert.equal(dimensions.status, 'fixed');
  if (dimensions.status !== 'fixed') throw new Error('Fixture dimensions must be fixed.');
  const data = new Uint8Array(dimensions.widthPx * dimensions.heightPx).fill(240);
  const filledBubbleIds = new Set(['q1-a', 'q2-a', 'q2-b']);
  for (const question of validSchemaFixture.questions) {
    for (const bubble of question.bubbles) {
      const { x: centerX, y: centerY } = bubble.centerPx;
      const radius = validSchemaFixture.bubbleStyle.radiusPx;
      for (let y = centerY - radius - 2; y <= centerY + radius + 2; y += 1) {
        for (let x = centerX - radius - 2; x <= centerX + radius + 2; x += 1) {
          const distance = Math.hypot(x - centerX, y - centerY);
          const isOutline = Math.abs(distance - radius) <= 1;
          const isFill =
            filledBubbleIds.has(bubble.id) &&
            distance <= validSchemaFixture.bubbleStyle.fillRadiusPx;
          if (isOutline || isFill) data[y * dimensions.widthPx + x] = 18;
        }
      }
    }
  }
  return { width: dimensions.widthPx, height: dimensions.heightPx, data };
}

function validSessionInput(): EvidenceSessionInput {
  const image = canonicalImage();
  return {
    contractVersion: EVIDENCE_SESSION_CONTRACT_VERSION,
    sessionId: 'scan-fixture-001',
    schema: validSchemaFixture,
    template: {
      id: 'fixture-template',
      version: 'grey-box-draft-1',
      correctionBoxStyleIds: ['grey-box-v1'],
    },
    detectorConfig: PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
    frames: [{
      frameId: 'frame-000',
      sequence: 0,
      capturedAtMs: 125,
      registration: {
        status: 'registered',
        coordinateSystem: 'canonical-crop-pixels',
      },
      quality: { status: 'credible', reasonCodes: [] },
      canonicalImage: image,
      correctionBoxes: [{
        bubbleId: 'q1-a',
        styleId: 'grey-box-v1',
        boundsPx: { x: 200, y: 180, width: 40, height: 40 },
        pixels: {
          pixelFormat: 'rgba8',
          width: 40,
          height: 40,
          data: new Uint8Array(40 * 40 * 4).fill(240),
        },
      }],
    }],
    groundTruth: {
      formatVersion: EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION,
      fixtureId: 'physical-sheet-001',
      layout: {
        schemaId: 'fixture-test',
        schemaVersion: '1',
      },
      template: {
        correctionBoxStyleId: 'grey-box-v1',
        appearanceRevision: 'grey-box-draft-1',
      },
      printerId: null,
      penId: 'black-gel-1',
      bubbles: [
        {
          bubbleId: 'q1-a',
          physicalCoverage: 'full',
          expectedDetectorClass: 'filled',
          correctionState: 'none',
        },
        {
          bubbleId: 'q1-b',
          physicalCoverage: 'empty',
          expectedDetectorClass: 'unfilled',
          correctionState: 'none',
        },
        {
          bubbleId: 'q2-a',
          physicalCoverage: 'full',
          expectedDetectorClass: 'filled',
          correctionState: 'none',
        },
        {
          bubbleId: 'q2-b',
          physicalCoverage: 'full',
          expectedDetectorClass: 'filled',
          correctionState: 'none',
        },
      ],
      questions: [
        { questionId: 'q1', expectedSelectedBubbleIds: ['q1-a'] },
        {
          questionId: 'q2',
          expectedSelectedBubbleIds: ['q2-a', 'q2-b'],
        },
      ],
    },
  };
}

test('validates and serializes the complete v1 evidence-session contract', () => {
  const input = validSessionInput();
  const validation = validateEvidenceSessionInput(input);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;

  const result = analyzeEvidenceSession(validation.input);
  assert.equal(result.contractVersion, EVIDENCE_SESSION_CONTRACT_VERSION);
  assert.equal(
    result.diagnosticFormatVersion,
    EVIDENCE_SESSION_DIAGNOSTIC_FORMAT_VERSION,
  );
  assert.equal(
    result.reasonCategoryFormatVersion,
    EVIDENCE_REASON_CATEGORY_FORMAT_VERSION,
  );
  assert.deepEqual(result.schema, {
    formatVersion: 1,
    testId: 'fixture-test',
    testVersion: '1',
  });
  assert.deepEqual(result.detectorConfig, PROVISIONAL_BUBBLE_DETECTOR_CONFIG);
  assert.deepEqual(result.template, {
    id: 'fixture-template',
    version: 'grey-box-draft-1',
    correctionBoxStyleIds: ['grey-box-v1'],
  });
  assert.deepEqual(result.groundTruth, {
    formatVersion: 1,
    fixtureId: 'physical-sheet-001',
    layout: { schemaId: 'fixture-test', schemaVersion: '1' },
    template: {
      correctionBoxStyleId: 'grey-box-v1',
      appearanceRevision: 'grey-box-draft-1',
    },
    printerId: null,
    penId: 'black-gel-1',
    bubbles: [
      {
        bubbleId: 'q1-a',
        physicalCoverage: 'full',
        expectedDetectorClass: 'filled',
        correctionState: 'none',
      },
      {
        bubbleId: 'q1-b',
        physicalCoverage: 'empty',
        expectedDetectorClass: 'unfilled',
        correctionState: 'none',
      },
      {
        bubbleId: 'q2-a',
        physicalCoverage: 'full',
        expectedDetectorClass: 'filled',
        correctionState: 'none',
      },
      {
        bubbleId: 'q2-b',
        physicalCoverage: 'full',
        expectedDetectorClass: 'filled',
        correctionState: 'none',
      },
    ],
    questions: [
      { questionId: 'q1', expectedSelectedBubbleIds: ['q1-a'] },
      {
        questionId: 'q2',
        expectedSelectedBubbleIds: ['q2-a', 'q2-b'],
      },
    ],
  });
  assert.deepEqual(result.frames[0].correctionBoxes, [{
    bubbleId: 'q1-a',
    styleId: 'grey-box-v1',
    boundsPx: { x: 200, y: 180, width: 40, height: 40 },
    pixelFormat: 'rgba8',
    width: 40,
    height: 40,
    byteLength: 6400,
  }]);
  assert.deepEqual(result.bestVisualReference, { frameId: 'frame-000' });
  assert.deepEqual(result.disagreement, {
    status: 'none',
    bubbleIds: [],
    questionIds: [],
    reasons: [],
  });
  assert.equal(JSON.parse(JSON.stringify(result)).sessionId, 'scan-fixture-001');
});

test('one credible session frame reproduces the frozen single-frame baseline', () => {
  const input = validSessionInput();
  const legacy = analyzeBubbleGradingImage(
    input.schema,
    input.frames[0].canonicalImage,
    input.detectorConfig,
  );
  const session = analyzeEvidenceSession(input);

  assert.deepEqual(session.frames[0].analysis, legacy);
  assert.deepEqual(session.combined.scan, legacy.scan);
  assert.deepEqual(session.combined.bubbles, legacy.bubbles);
  assert.deepEqual(session.combined.questions, legacy.questions);
  assert.deepEqual(session.combined.score, legacy.score);
  assert.deepEqual(session.combined.contributingFrameIds, ['frame-000']);
  assert.equal(session.combined.strategy, 'single-frame-baseline-v1');
});

test('repeated calls produce byte-for-byte identical serializable diagnostics', () => {
  const input = validSessionInput();
  const first = analyzeEvidenceSession(input);
  const second = analyzeEvidenceSession(input);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.timings.durationMs, null);
  assert.equal(first.timings.frameAnalysisDurationMs, null);
  assert.ok(Object.isFrozen(PROVISIONAL_BUBBLE_DETECTOR_CONFIG));
  assert.deepEqual(first.frames[0].reasons, []);
  assert.deepEqual(LEGACY_BUBBLE_REASON_CATEGORIES, {
    center_adjusted: 'geometry',
    fill_score_in_uncertain_band: 'measurement',
    poor_local_contrast: 'quality',
    excessive_blur: 'quality',
    measurement_region_incomplete: 'measurement',
  });
});

test('returns stable, actionable errors for incompatible session inputs', () => {
  const invalid = structuredClone(validSessionInput()) as unknown as {
    contractVersion: number;
    detectorConfig: {
      unfilledMaxDarkPixelRatio: number;
      filledMinDarkPixelRatio: number;
    };
    frames: Array<{
      frameId: string;
      correctionBoxes?: Array<{
        bubbleId: string;
        styleId: string;
        pixels: { data: Uint8Array };
      }>;
    }>;
    groundTruth: {
      bubbles: Array<{ bubbleId: string }>;
      questions: Array<{
        questionId: string;
        expectedSelectedBubbleIds: string[];
      }>;
    };
  };
  invalid.contractVersion = 99;
  invalid.detectorConfig.unfilledMaxDarkPixelRatio = 0.7;
  invalid.detectorConfig.filledMinDarkPixelRatio = 0.4;
  invalid.frames[0].correctionBoxes![0].bubbleId = 'unknown-bubble';
  invalid.frames[0].correctionBoxes![0].styleId = 'unknown-style';
  invalid.frames[0].correctionBoxes![0].pixels.data = new Uint8Array(3);
  invalid.frames.push({
    ...structuredClone(invalid.frames[0]),
    frameId: invalid.frames[0].frameId,
  });
  invalid.groundTruth.bubbles[0].bubbleId = 'unknown-bubble';
  invalid.groundTruth.questions[0].expectedSelectedBubbleIds = ['unknown-bubble'];

  const validation = validateEvidenceSessionInput(invalid);
  assert.equal(validation.valid, false);
  if (validation.valid) return;
  const codes = new Set(validation.errors.map((error) => error.code));
  for (const code of [
    'unsupported_evidence_session_version',
    'invalid_detector_threshold_order',
    'multi_frame_aggregation_not_implemented',
    'duplicate_frame_id',
    'unknown_bubble_id',
    'unknown_correction_box_style_id',
    'pixel_data_length_mismatch',
    'unknown_ground_truth_bubble_id',
    'unknown_ground_truth_selected_bubble_id',
  ]) {
    assert.ok(codes.has(code), `expected validation code ${code}`);
  }
  assert.throws(
    () => analyzeEvidenceSession(invalid),
    (error: unknown) =>
      error instanceof EvidenceSessionValidationFailure &&
      error.validationErrors.some(
        (item) => item.code === 'multi_frame_aggregation_not_implemented',
      ),
  );
});

test('keeps exact selected-set grading delegated to the unchanged baseline helper', () => {
  const result = analyzeEvidenceSession(validSessionInput());
  assert.deepEqual(
    result.combined.questions.map((question) => ({
      questionId: question.questionId,
      status: question.status,
      reasons: question.reasons,
    })),
    result.frames[0].analysis.questions.map((question) => ({
      questionId: question.questionId,
      status: question.status,
      reasons: question.reasons,
    })),
  );
});
