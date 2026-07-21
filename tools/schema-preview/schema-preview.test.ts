import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  analyzeBubbleGradingImage,
  BubbleAnalysisValidationFailure,
  gradeBubbleDiagnostics,
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  type BubbleDecision,
  type BubbleDiagnostic,
  type GrayscaleImage,
} from '../../src/features/bubble-grading/bubble-analysis';
import {
  CANONICAL_CROP_ASPECT_RATIO,
  CANONICAL_CROP_CONTRACT,
} from '../../src/features/bubble-grading/canonical-crop-contract';
import {
  assertHardcodedSchemaImageContract,
  CanonicalCropContractError,
} from '../../src/features/bubble-grading/hardcoded-schema-contract';
import { hardcodedBubbleGradingSchema } from '../../src/features/bubble-grading/hardcoded-schema';
import {
  analyzeMobileBubbleGradingImage,
  buildMobileScoreSummary,
  rgbaPixelsToGrayscaleImage,
} from '../../src/features/bubble-grading/mobile-bubble-grading';
import { buildMobileGradingDiagnosticRecord } from '../../src/features/bubble-grading/mobile-grading-diagnostic-record';
import {
  buildMobileQuestionReview,
  scaledBubbleFrame,
} from '../../src/features/bubble-grading/mobile-question-review';
import type { BubbleGradingSchema, QuestionSchema } from '../../src/features/bubble-grading/schema';
import { validateBubbleGradingSchema } from '../../src/features/bubble-grading/schema-validator';
import type { QrMetadata } from '../../src/features/four-point/types';
import { mobileGradingResultFixture } from './fixtures/mobile-grading-result';
import { multipleErrorsSchemaFixture } from './fixtures/multiple-errors-schema';
import { validSchemaFixture } from './fixtures/valid-schema';
import { buildOverlaySvg, generatePreview } from './preview-renderer';

function oneBubbleSchema() {
  const schema = structuredClone(validSchemaFixture);
  schema.questions = [
    {
      ...schema.questions[0],
      bubbles: [schema.questions[0].bubbles[0]],
      correctBubbleIds: [schema.questions[0].bubbles[0].id],
    },
  ];
  return schema;
}

function syntheticBubbleImage(options: {
  fillRatio?: number;
  centerOffset?: { x: number; y: number };
  localBrightness?: number;
  omitOutline?: boolean;
  darkOutsideRoi?: boolean;
} = {}): GrayscaleImage {
  const schema = oneBubbleSchema();
  const { widthPx: width, heightPx: height } = schema.canonicalImage.dimensions.status === 'fixed'
    ? schema.canonicalImage.dimensions
    : { widthPx: 640, heightPx: 480 };
  const expected = schema.questions[0].bubbles[0].centerPx;
  const center = {
    x: expected.x + (options.centerOffset?.x ?? 0),
    y: expected.y + (options.centerOffset?.y ?? 0),
  };
  const style = schema.bubbleStyle;
  const paper = options.localBrightness ?? 240;
  const data = new Uint8Array(width * height).fill(options.darkOutsideRoi ? 0 : paper);
  if (options.darkOutsideRoi) {
    for (let y = Math.floor(expected.y - style.roiRadiusPx); y < Math.ceil(expected.y + style.roiRadiusPx); y += 1) {
      for (let x = Math.floor(expected.x - style.roiRadiusPx); x < Math.ceil(expected.x + style.roiRadiusPx); x += 1) {
        data[y * width + x] = paper;
      }
    }
  }

  const interiorPixels: Array<{ x: number; y: number }> = [];
  for (let y = Math.floor(center.y - style.roiRadiusPx); y < Math.ceil(center.y + style.roiRadiusPx); y += 1) {
    for (let x = Math.floor(center.x - style.roiRadiusPx); x < Math.ceil(center.x + style.roiRadiusPx); x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      if (!options.omitOutline && Math.abs(distance - style.radiusPx) <= style.printedOutlineWidthPx / 2) {
        data[y * width + x] = 18;
      }
      if (distance <= style.fillRadiusPx) interiorPixels.push({ x, y });
    }
  }
  const darkCount = Math.floor(interiorPixels.length * (options.fillRatio ?? 0));
  interiorPixels.forEach(({ x, y }, index) => {
    data[y * width + x] = index < darkCount ? 18 : paper;
  });
  return { width, height, data };
}

function gradingQuestion(
  id: string,
  selectionMode: QuestionSchema['selectionMode'],
  points: number,
  correctLabels: string[],
  labels: string[] = ['a', 'b', 'c'],
): QuestionSchema {
  return {
    id,
    label: `Question ${id}`,
    selectionMode,
    points,
    correctBubbleIds: correctLabels.map((label) => `${id}-${label}`),
    bubbles: labels.map((label, index) => ({
      id: `${id}-${label}`,
      label: label.toUpperCase(),
      centerPx: { x: 200 + index * 60, y: 200 },
    })),
  };
}

function diagnosticsFor(
  schema: BubbleGradingSchema,
  decisions: Record<string, BubbleDecision>,
): BubbleDiagnostic[] {
  const template = analyzeBubbleGradingImage(
    oneBubbleSchema(),
    syntheticBubbleImage(),
  ).bubbles[0];
  return schema.questions.flatMap((question) =>
    question.bubbles.map((bubble) => {
      const decision = decisions[bubble.id] ?? 'unfilled';
      return {
        ...template,
        questionId: question.id,
        bubbleId: bubble.id,
        expectedCenterPx: { ...bubble.centerPx },
        measuredCenterPx: { ...bubble.centerPx },
        confidence: decision === 'uncertain' ? 0.25 : 0.9,
        decision,
        reasonCodes:
          decision === 'uncertain' ? ['fill_score_in_uncertain_band'] : [],
      };
    }),
  );
}

test('locks the app schema to the user-reviewed canonical crop', () => {
  assert.deepEqual(hardcodedBubbleGradingSchema.canonicalImage.dimensions, {
    status: 'fixed',
    widthPx: 875,
    heightPx: 1280,
  });
  assert.deepEqual(CANONICAL_CROP_CONTRACT, {
    widthPx: 875,
    heightPx: 1280,
    pixelsPerMillimeter: 4,
  });
  assert.equal(CANONICAL_CROP_ASPECT_RATIO, 875 / 1280);
});

test('accepts only images that match the hardcoded app schema dimensions', () => {
  assert.doesNotThrow(() =>
    assertHardcodedSchemaImageContract({
      width: CANONICAL_CROP_CONTRACT.widthPx,
      height: CANONICAL_CROP_CONTRACT.heightPx,
    }),
  );

  assert.throws(
    () => assertHardcodedSchemaImageContract({ width: 876, height: 1280 }),
    (error: unknown) => {
      assert.ok(error instanceof CanonicalCropContractError);
      assert.equal(error.code, 'canonical_crop_contract_error');
      assert.match(error.message, /875x1280px/);
      assert.match(error.message, /876x1280px/);
      return true;
    },
  );
});

test('converts mobile RGBA pixels into the shared grayscale image contract', () => {
  const image = rgbaPixelsToGrayscaleImage(
    new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
    ]),
    2,
    1,
  );

  assert.deepEqual(
    { width: image.width, height: image.height, data: [...image.data] },
    { width: 2, height: 1, data: [54, 182] },
  );
  assert.throws(
    () => rgbaPixelsToGrayscaleImage(new Uint8Array(7), 2, 1),
    /Esperados 8 bytes RGBA/,
  );
});

test('grades the exact canonical mobile image with the offline result shape and diagnostic-only QR ids', () => {
  const qr: QrMetadata = {
    rawValue: '{"studentId":"student-7"}',
    payload: {
      studentId: 'student-7',
      sheetId: 'sheet-22',
      testId: 'a-different-test-id',
      schemaVersion: '999',
    },
    payloadFormat: 'json',
    qrVersion: 5,
    orientation: 'upright',
    rotationApplied: 0,
  };
  const image: GrayscaleImage = {
    width: CANONICAL_CROP_CONTRACT.widthPx,
    height: CANONICAL_CROP_CONTRACT.heightPx,
    data: new Uint8Array(
      CANONICAL_CROP_CONTRACT.widthPx * CANONICAL_CROP_CONTRACT.heightPx,
    ).fill(240),
  };

  const mobile = analyzeMobileBubbleGradingImage(image, qr);
  assert.equal(mobile.status, 'graded');
  if (mobile.status !== 'graded') return;
  assert.deepEqual(mobile.scanDiagnostics, {
    studentId: 'student-7',
    sheetId: 'sheet-22',
    testId: 'a-different-test-id',
    schemaVersion: '999',
  });
  assert.deepEqual(Object.keys(mobile.result), [
    'diagnosticFormatVersion',
    'detector',
    'scan',
    'bubbles',
    'questions',
    'score',
  ]);
  assert.equal(mobile.result.questions.length, hardcodedBubbleGradingSchema.questions.length);
  assert.equal(typeof mobile.result.scan.timing.durationMs, 'number');
});

test('presents exact mobile dimension failures without discarding QR diagnostics', () => {
  const qr: QrMetadata = {
    rawValue: 'student-only',
    payload: { studentId: 'student-8', sheetId: 'sheet-23' },
    payloadFormat: 'json',
    qrVersion: 2,
    orientation: 'upright',
    rotationApplied: 0,
  };
  const width = CANONICAL_CROP_CONTRACT.widthPx - 1;
  const mobile = analyzeMobileBubbleGradingImage(
    {
      width,
      height: CANONICAL_CROP_CONTRACT.heightPx,
      data: new Uint8Array(width * CANONICAL_CROP_CONTRACT.heightPx),
    },
    qr,
  );

  assert.equal(mobile.status, 'failed');
  if (mobile.status !== 'failed') return;
  assert.equal(mobile.failure.kind, 'schema_validation');
  assert.ok(
    mobile.failure.validationErrors.some(
      (error) => error.code === 'image_dimension_mismatch',
    ),
  );
  assert.equal(mobile.scanDiagnostics.studentId, 'student-8');
  assert.equal(mobile.scanDiagnostics.sheetId, 'sheet-23');
});

test('builds the first mobile score summary from a deterministic grading-result fixture', () => {
  assert.deepEqual(buildMobileScoreSummary(mobileGradingResultFixture), {
    maximumPoints: 5,
    awardedGradedPoints: 2,
    pendingReviewPoints: 3,
    counts: { correct: 1, incorrect: 0, needs_review: 1 },
    provisional: true,
    reviewReasonCodes: ['excessive_blur'],
  });
});

test('builds complete scan, bubble, and question diagnostic records with explanations', () => {
  const record = buildMobileGradingDiagnosticRecord(
    {
      status: 'graded',
      scanDiagnostics: {
        studentId: 'student-7',
        sheetId: 'sheet-22',
        testId: 'test-3',
        schemaVersion: '1',
      },
      result: mobileGradingResultFixture,
    },
    { width: 875, height: 1280 },
  );

  assert.deepEqual(record.scan.canonicalDimensions, {
    expected: { width: 875, height: 1280 },
    measured: { width: 875, height: 1280 },
    matchesExpected: true,
  });
  assert.deepEqual(record.scan.qrMetadata, {
    studentId: 'student-7',
    sheetId: 'sheet-22',
    testId: 'test-3',
    schemaVersion: '1',
  });
  assert.equal(record.scan.bubbleCount, 2);
  assert.equal(record.scan.totalAnalysisTimeMs, null);
  assert.deepEqual(record.scan.globalQuality, {
    averageBackgroundBrightness: 0.94,
    minimumFocusScore: 0.0005,
    decisionCounts: { filled: 1, unfilled: 0, uncertain: 1 },
  });
  assert.deepEqual(record.scan.reviewReasons, [
    {
      code: 'excessive_blur',
      explanation:
        'A evidência de foco desta região ficou abaixo do limite provisório de nitidez.',
    },
  ]);

  const blurredBubble = record.bubbles[1];
  assert.deepEqual(blurredBubble.blurEvidence, {
    focusScore: 0.0005,
    minimumFocusScore: 0.0015,
    passesMinimum: false,
  });
  assert.deepEqual(blurredBubble.expectedCenterPx, { x: 100, y: 100 });
  assert.deepEqual(blurredBubble.measuredCenterPx, { x: 100, y: 100 });
  assert.deepEqual(blurredBubble.centerAdjustmentPx, { x: 0, y: 0, distance: 0 });
  assert.equal(blurredBubble.interiorBrightness, 0.7);
  assert.equal(blurredBubble.backgroundBrightness, 0.94);
  assert.equal(blurredBubble.darkPixelRatio, 0.35);
  assert.equal(blurredBubble.contrast, 0.24);
  assert.equal(blurredBubble.decision, 'uncertain');
  assert.equal(blurredBubble.confidence, 0.25);
  assert.equal(blurredBubble.reasons[0].code, 'excessive_blur');

  const reviewQuestion = record.questions[1];
  assert.deepEqual(reviewQuestion.detectedBubbleIds, []);
  assert.deepEqual(reviewQuestion.correctBubbleIds, ['q2-b']);
  assert.equal(reviewQuestion.exactSetMatch, false);
  assert.equal(reviewQuestion.status, 'needs_review');
  assert.equal(reviewQuestion.awardedPoints, 0);
  assert.equal(reviewQuestion.pendingPoints, 3);
  assert.equal(reviewQuestion.confidence, 0.25);
  assert.equal(
    reviewQuestion.reasons[0].code,
    'uncertain_bubbles_could_change_outcome',
  );
  assert.deepEqual(
    reviewQuestion.contributingBubbleReasons.map((contribution) => ({
      bubbleId: contribution.bubbleId,
      codes: contribution.reasons.map((reason) => reason.code),
    })),
    [{ bubbleId: 'q2-b', codes: ['excessive_blur'] }],
  );
});

test('keeps clear extra selections diagnostically distinct from uncertain measurements', () => {
  const bubbles = diagnosticsFor(validSchemaFixture, {
    'q1-a': 'filled',
    'q1-b': 'filled',
  });
  const grading = gradeBubbleDiagnostics(validSchemaFixture, bubbles);
  const record = buildMobileGradingDiagnosticRecord(
    {
      status: 'graded',
      scanDiagnostics: {
        studentId: null,
        sheetId: null,
        testId: null,
        schemaVersion: null,
      },
      result: {
        ...mobileGradingResultFixture,
        bubbles,
        questions: grading.questions,
        score: grading.score,
      },
    },
    { width: 875, height: 1280 },
  );
  const question = record.questions[0];

  assert.equal(question.status, 'incorrect');
  assert.equal(question.pendingPoints, 0);
  assert.equal(question.exactSetMatch, false);
  assert.deepEqual(question.reasons.map((reason) => reason.code), ['extra_selection']);
  assert.match(question.reasons[0].explanation, /claramente preenchidas/);
});

test('builds human-labelled visual question review without changing grading diagnostics', () => {
  const bubbles = diagnosticsFor(validSchemaFixture, {
    'q1-a': 'filled',
    'q2-a': 'uncertain',
    'q2-b': 'uncertain',
  });
  const grading = gradeBubbleDiagnostics(validSchemaFixture, bubbles);
  const result = {
    ...mobileGradingResultFixture,
    bubbles,
    questions: grading.questions,
    score: grading.score,
  };
  const before = structuredClone(result);

  const review = buildMobileQuestionReview(result, validSchemaFixture);

  assert.deepEqual(result, before);
  assert.deepEqual(
    review.map((question) => ({
      label: question.label,
      mode: question.selectionModeLabel,
      detected: question.detectedAnswerLabels,
      correct: question.correctAnswerLabels,
      status: question.status,
      points: [question.awardedPoints, question.pendingPoints],
      confidence: question.confidencePercent,
    })),
    [
      {
        label: 'Question 1',
        mode: 'Resposta única',
        detected: ['A'],
        correct: ['A'],
        status: 'correct',
        points: [1, 0],
        confidence: 90,
      },
      {
        label: 'Question 2',
        mode: 'Várias respostas',
        detected: [],
        correct: ['A', 'B'],
        status: 'needs_review',
        points: [0, 2],
        confidence: 25,
      },
    ],
  );
  assert.deepEqual(
    review[0].bubbles.map((bubble) => bubble.tone),
    ['success', 'subordinate'],
  );
  assert.deepEqual(
    review[1].bubbles.map((bubble) => bubble.tone),
    ['warning', 'warning'],
  );
  assert.ok(review[1].reasonMessages.every((message) => !message.includes('q2-')));
  assert.deepEqual(review[1].reasonCodes, [
    'uncertain_bubbles_could_change_outcome',
    'fill_score_in_uncertain_band',
  ]);
});

test('scales schema bubble geometry into the fitted image coordinate space', () => {
  assert.deepEqual(scaledBubbleFrame({ x: 220, y: 200 }, 12, 640, 320), {
    left: 104,
    top: 94,
    width: 12,
    height: 12,
  });
});

test('accepts a complete canonical-pixel schema', () => {
  const result = validateBubbleGradingSchema(validSchemaFixture, {
    inputImage: { width: 640, height: 480 },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('resolves explicitly unfinished dimensions from the workbench input image', () => {
  const unresolved = structuredClone(validSchemaFixture);
  unresolved.canonicalImage.dimensions = {
    status: 'unresolved',
    widthPx: null,
    heightPx: null,
  };

  const result = validateBubbleGradingSchema(unresolved, {
    inputImage: { width: 640, height: 480 },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.imageDimensions, { width: 640, height: 480 });
});

test('returns multiple simultaneous validation failures with schema locations', () => {
  const result = validateBubbleGradingSchema(multipleErrorsSchemaFixture, {
    inputImage: { width: 100, height: 100 },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 14);
  const paths = new Set(result.errors.map((error) => error.path));
  const codes = new Set(result.errors.map((error) => error.code));
  assert.ok(paths.has('formatVersion'));
  assert.ok(paths.has('canonicalImage.coordinateSystem'));
  assert.ok(paths.has('canonicalImage.origin'));
  assert.ok(paths.has('qrRegionPx'));
  assert.ok(paths.has('questions[1].id'));
  assert.ok(codes.has('duplicate_bubble_id'));
  assert.ok(codes.has('unknown_correct_bubble'));
  assert.ok(codes.has('unsupported_selection_mode'));
  assert.ok(codes.has('invalid_points'));
});

test('rejects an input image that differs from fixed canonical dimensions', () => {
  const result = validateBubbleGradingSchema(validSchemaFixture, {
    inputImage: { width: 641, height: 480 },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'image_dimension_mismatch'));
});

test('rejects invalid measurement ordering and overlapping bubble ROIs', () => {
  const invalid = structuredClone(validSchemaFixture);
  invalid.bubbleStyle.fillRadiusPx = invalid.bubbleStyle.radiusPx;
  invalid.questions[0].bubbles[1].centerPx = { x: 230, y: 200 };

  const result = validateBubbleGradingSchema(invalid, {
    inputImage: { width: 640, height: 480 },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'invalid_radius_order'));
  assert.ok(result.errors.some((error) => error.code === 'overlapping_measurement_regions'));
});

test('builds every required visual layer without crop anchors', () => {
  const diagnostics = analyzeBubbleGradingImage(
    validSchemaFixture,
    syntheticBubbleImage(),
  );
  const { svg } = buildOverlaySvg(validSchemaFixture, 640, 480, diagnostics);

  for (const layer of [
    'qr-region',
    'bubble-roi',
    'background-ring',
    'bubble-circle',
    'fill-measurement',
    'center-crosshair',
    'bubble-label',
    'source-coordinates',
    'bubble-diagnostic',
    'bubble-decision',
    'bubble-reasons',
    'question-decision',
    'question-diagnostic',
    'score-diagnostic',
  ]) {
    assert.match(svg, new RegExp(`data-layer="${layer}"`));
  }
  assert.match(svg, /★ CORRECT/);
  assert.match(svg, /r=12px/);
  assert.match(svg, /fill=/);
  assert.match(svg, /bg=/);
  assert.match(svg, /conf=/);
  assert.doesNotMatch(svg, /crop-anchor|capture-anchor/);
});

test('measures only declared ROIs and emits deterministic platform-neutral diagnostics', () => {
  const schema = oneBubbleSchema();
  const image = syntheticBubbleImage({ darkOutsideRoi: true });
  const first = analyzeBubbleGradingImage(schema, image);
  const second = analyzeBubbleGradingImage(schema, image);

  assert.deepEqual(first, second);
  assert.equal(first.diagnosticFormatVersion, 1);
  assert.equal(first.detector.provisional, true);
  assert.equal(first.scan.bubbleCount, 1);
  assert.equal(first.scan.timing.analyzedRoiCount, 1);
  assert.equal(first.bubbles[0].decision, 'unfilled');
  assert.equal(first.bubbles[0].reasonCodes.includes('excessive_blur'), false);
  assert.equal(first.bubbles[0].timing.durationMs, null);
  assert.ok(first.bubbles[0].timing.sampledPixelCount > 0);
  assert.deepEqual(Object.keys(first.bubbles[0].thresholds), [
    'darkPixelDelta',
    'unfilledMaxDarkPixelRatio',
    'filledMinDarkPixelRatio',
    'minimumBackgroundBrightness',
    'minimumMarkedContrast',
    'minimumFocusScore',
  ]);
});

test('classifies representative empty, filled, threshold, low-contrast, and blurred bubbles', () => {
  const schema = oneBubbleSchema();
  const empty = analyzeBubbleGradingImage(schema, syntheticBubbleImage()).bubbles[0];
  const filled = analyzeBubbleGradingImage(
    schema,
    syntheticBubbleImage({ fillRatio: 0.8 }),
  ).bubbles[0];
  const threshold = analyzeBubbleGradingImage(
    schema,
    syntheticBubbleImage({ fillRatio: 0.35 }),
  ).bubbles[0];
  const lowContrast = analyzeBubbleGradingImage(
    schema,
    syntheticBubbleImage({ fillRatio: 0.8, localBrightness: 110 }),
  ).bubbles[0];
  const blurred = analyzeBubbleGradingImage(
    schema,
    syntheticBubbleImage({ omitOutline: true }),
  ).bubbles[0];

  assert.equal(empty.decision, 'unfilled');
  assert.equal(filled.decision, 'filled');
  assert.equal(threshold.decision, 'uncertain');
  assert.ok(threshold.reasonCodes.includes('fill_score_in_uncertain_band'));
  assert.equal(lowContrast.decision, 'uncertain');
  assert.ok(lowContrast.reasonCodes.includes('poor_local_contrast'));
  assert.equal(blurred.decision, 'uncertain');
  assert.ok(blurred.reasonCodes.includes('excessive_blur'));
});

test('limits center adjustment to the schema tolerance and records the applied offset', () => {
  const schema = oneBubbleSchema();
  const diagnostic = analyzeBubbleGradingImage(
    schema,
    syntheticBubbleImage({ centerOffset: { x: 2, y: 0 } }),
  ).bubbles[0];

  assert.ok(diagnostic.centerAdjustmentPx.distance <= schema.bubbleStyle.centerSearchTolerancePx);
  assert.deepEqual(diagnostic.centerAdjustmentPx, { x: 2, y: 0, distance: 2 });
  assert.deepEqual(diagnostic.measuredCenterPx, {
    x: diagnostic.expectedCenterPx.x + 2,
    y: diagnostic.expectedCenterPx.y,
  });
  assert.ok(diagnostic.reasonCodes.includes('center_adjusted'));
});

test('refuses analysis for invalid schemas and exact-dimension mismatches', () => {
  assert.throws(
    () => analyzeBubbleGradingImage(multipleErrorsSchemaFixture, syntheticBubbleImage()),
    BubbleAnalysisValidationFailure,
  );
  const mismatched = syntheticBubbleImage();
  assert.throws(
    () =>
      analyzeBubbleGradingImage(validSchemaFixture, {
        width: mismatched.width - 1,
        height: mismatched.height,
        data: mismatched.data.subarray(0, (mismatched.width - 1) * mismatched.height),
      }),
    (error: unknown) =>
      error instanceof BubbleAnalysisValidationFailure &&
      error.validationErrors.some((item) => item.code === 'image_dimension_mismatch'),
  );

  const unresolved = structuredClone(oneBubbleSchema());
  unresolved.canonicalImage.dimensions = {
    status: 'unresolved',
    widthPx: null,
    heightPx: null,
  };
  assert.throws(
    () => analyzeBubbleGradingImage(unresolved, syntheticBubbleImage()),
    (error: unknown) =>
      error instanceof BubbleAnalysisValidationFailure &&
      error.validationErrors.some(
        (item) => item.code === 'fixed_dimensions_required_for_analysis',
      ),
  );
});

test('keeps provisional detector thresholds outside the generated schema', () => {
  assert.equal('unfilledMaxDarkPixelRatio' in validSchemaFixture.bubbleStyle, false);
  assert.equal(PROVISIONAL_BUBBLE_DETECTOR_CONFIG.provisional, true);
  assert.ok(
    PROVISIONAL_BUBBLE_DETECTOR_CONFIG.unfilledMaxDarkPixelRatio <
      PROVISIONAL_BUBBLE_DETECTOR_CONFIG.filledMinDarkPixelRatio,
  );
});

test('grades single and multiple questions by exact selected-set equality', () => {
  const schema = structuredClone(validSchemaFixture);
  schema.questions = [
    gradingQuestion('single', 'single', 1, ['a']),
    gradingQuestion('multiple', 'multiple', 2, ['a', 'c']),
    gradingQuestion('blank', 'single', 1, ['a']),
    gradingQuestion('missing', 'multiple', 2, ['a', 'b']),
    gradingQuestion('extra', 'single', 2, ['a']),
    gradingQuestion('review', 'single', 3, ['a']),
    gradingQuestion('review-multiple', 'multiple', 4, ['a', 'b']),
  ];
  const decisions: Record<string, BubbleDecision> = {
    'single-a': 'filled',
    'multiple-a': 'filled',
    'multiple-c': 'filled',
    'missing-a': 'filled',
    'missing-c': 'uncertain',
    'extra-a': 'filled',
    'extra-b': 'filled',
    'extra-c': 'uncertain',
    'review-a': 'uncertain',
    'review-multiple-a': 'uncertain',
    'review-multiple-b': 'uncertain',
  };

  const result = gradeBubbleDiagnostics(schema, diagnosticsFor(schema, decisions));
  assert.deepEqual(
    result.questions.map((question) => question.status),
    ['correct', 'correct', 'incorrect', 'incorrect', 'incorrect', 'needs_review', 'needs_review'],
  );
  assert.deepEqual(result.score, {
    maximumPoints: 15,
    awardedGradedPoints: 3,
    pendingReviewPoints: 7,
    counts: { correct: 2, incorrect: 3, needs_review: 2 },
  });

  const blank = result.questions[2];
  assert.deepEqual(blank.detectedFilledBubbleIds, []);
  assert.deepEqual(blank.reasons, [
    { code: 'blank_response' },
    { code: 'missing_selection', bubbleIds: ['blank-a'] },
  ]);
  const missing = result.questions[3];
  assert.deepEqual(missing.detectedFilledBubbleIds, ['missing-a']);
  assert.deepEqual(missing.reasons, [
    { code: 'missing_selection', bubbleIds: ['missing-b'] },
  ]);
  const clearExtra = result.questions[4];
  assert.equal(clearExtra.status, 'incorrect');
  assert.deepEqual(clearExtra.reasons, [
    { code: 'extra_selection', bubbleIds: ['extra-b'] },
  ]);
});

test('reports every outcome-changing uncertain bubble and keeps its points pending', () => {
  const schema = structuredClone(validSchemaFixture);
  schema.questions = [gradingQuestion('q', 'multiple', 4, ['a', 'b'])];
  const diagnostics = diagnosticsFor(schema, {
    'q-a': 'uncertain',
    'q-b': 'uncertain',
  });

  const result = gradeBubbleDiagnostics(schema, diagnostics);
  const question = result.questions[0];
  assert.equal(question.status, 'needs_review');
  assert.equal(question.awardedPoints, 0);
  assert.equal(question.pendingPoints, 4);
  assert.equal(question.confidence, 0.25);
  assert.deepEqual(question.reasons, [
    {
      code: 'uncertain_bubbles_could_change_outcome',
      bubbles: [
        { bubbleId: 'q-a', reasonCodes: ['fill_score_in_uncertain_band'] },
        { bubbleId: 'q-b', reasonCodes: ['fill_score_in_uncertain_band'] },
      ],
    },
  ]);
});

test('analyzes and grades a representative 50-question, 250-bubble sheet with bounded ROI work and timing', () => {
  const width = 700;
  const height = 2700;
  const schema = structuredClone(validSchemaFixture);
  schema.canonicalImage.dimensions = { status: 'fixed', widthPx: width, heightPx: height };
  schema.questions = Array.from({ length: 50 }, (_, questionIndex) => {
    const id = `q${questionIndex + 1}`;
    const question = gradingQuestion(id, 'multiple', 2, ['a', 'c'], ['a', 'b', 'c', 'd', 'e']);
    question.bubbles.forEach((bubble, bubbleIndex) => {
      bubble.centerPx = { x: 220 + bubbleIndex * 60, y: 180 + questionIndex * 50 };
    });
    return question;
  });
  const image: GrayscaleImage = {
    width,
    height,
    data: new Uint8Array(width * height).fill(240),
  };

  const result = analyzeBubbleGradingImage(
    schema,
    image,
    undefined,
    { recordTiming: true },
  );
  assert.equal(result.scan.bubbleCount, 250);
  assert.equal(result.scan.timing.analyzedRoiCount, 250);
  assert.equal(typeof result.scan.timing.durationMs, 'number');
  assert.ok(result.bubbles.every((bubble) => typeof bubble.timing.durationMs === 'number'));
  assert.equal(result.questions.length, 50);
  assert.deepEqual(result.score, {
    maximumPoints: 100,
    awardedGradedPoints: 0,
    pendingReviewPoints: 100,
    counts: { correct: 0, incorrect: 0, needs_review: 50 },
  });
  const maximumBoundedSamples =
    result.scan.bubbleCount * (schema.bubbleStyle.roiRadiusPx * 2 + 1) ** 2 * 2;
  assert.ok(result.scan.timing.sampledPixelCount < maximumBoundedSamples);
});

test('writes a PNG overlay for a valid fixed input and schema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'schema-preview-'));
  const inputPath = join(directory, 'input.jpg');
  const outputPath = join(directory, 'output.png');
  const resultPath = join(directory, 'result.json');
  try {
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#f5f2e8' },
    })
      .jpeg()
      .toFile(inputPath);

    const result = await generatePreview(validSchemaFixture, inputPath, outputPath, resultPath);
    const metadata = await sharp(outputPath).metadata();
    const diagnostics = JSON.parse(await readFile(resultPath, 'utf8'));

    assert.equal(result.bubbleCount, 4);
    assert.equal(result.questionCount, 2);
    assert.equal(result.width, 640);
    assert.equal(result.height, 480);
    assert.equal(result.resultPath, resultPath);
    assert.equal(diagnostics.scan.bubbleCount, 4);
    assert.equal(typeof diagnostics.scan.timing.durationMs, 'number');
    assert.equal(diagnostics.questions.length, 2);
    assert.deepEqual(diagnostics.score.counts, {
      correct: 0,
      incorrect: 0,
      needs_review: 2,
    });
    assert.deepEqual(diagnostics.bubbles.map((bubble: { bubbleId: string }) => bubble.bubbleId), [
      'q1-a',
      'q1-b',
      'q2-a',
      'q2-b',
    ]);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 640);
    assert.equal(metadata.height, 480);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
