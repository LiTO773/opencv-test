import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

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

test('builds every required visual layer without crop anchors', () => {
  const { svg } = buildOverlaySvg(validSchemaFixture, 640, 480);

  for (const layer of [
    'qr-region',
    'bubble-circle',
    'center-crosshair',
    'bubble-label',
    'source-coordinates',
  ]) {
    assert.match(svg, new RegExp(`data-layer="${layer}"`));
  }
  assert.match(svg, /★ CORRECT/);
  assert.match(svg, /r=12px/);
  assert.doesNotMatch(svg, /crop-anchor|capture-anchor/);
  assert.doesNotMatch(svg, /bubble-roi|background-ring|fill-measurement/);
});

test('writes a PNG overlay for a valid fixed input and schema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'schema-preview-'));
  const inputPath = join(directory, 'input.jpg');
  const outputPath = join(directory, 'output.png');
  try {
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#f5f2e8' },
    })
      .jpeg()
      .toFile(inputPath);

    const result = await generatePreview(validSchemaFixture, inputPath, outputPath);
    const metadata = await sharp(outputPath).metadata();

    assert.deepEqual(result, {
      bubbleCount: 4,
      questionCount: 2,
      width: 640,
      height: 480,
    });
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 640);
    assert.equal(metadata.height, 480);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
