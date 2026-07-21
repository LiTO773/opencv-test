import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  analyzeBubbleGradingImage,
  BubbleAnalysisValidationFailure,
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
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
import { validateBubbleGradingSchema } from '../../src/features/bubble-grading/schema-validator';
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
