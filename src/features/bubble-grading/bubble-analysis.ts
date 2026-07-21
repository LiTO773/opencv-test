import type { BubbleGradingSchema, BubbleStyle, PixelPoint } from './schema';
import {
  validateBubbleGradingSchema,
  type ImageDimensions,
  type SchemaValidationError,
} from './schema-validator';

export const BUBBLE_DIAGNOSTIC_FORMAT_VERSION = 1 as const;

/**
 * Camera- and pen-dependent prototype values. These deliberately live outside
 * the generator-owned schema and must be calibrated against physical sheets.
 */
export const PROVISIONAL_BUBBLE_DETECTOR_CONFIG = Object.freeze({
  id: 'provisional-physical-calibration-required-v1',
  provisional: true as const,
  darkPixelDelta: 0.1,
  unfilledMaxDarkPixelRatio: 0.18,
  filledMinDarkPixelRatio: 0.52,
  minimumBackgroundBrightness: 0.45,
  minimumMarkedContrast: 0.08,
  minimumFocusScore: 0.0015,
});

export type BubbleDetectorConfig = typeof PROVISIONAL_BUBBLE_DETECTOR_CONFIG;
export type BubbleDecision = 'filled' | 'unfilled' | 'uncertain';
export type BubbleReasonCode =
  | 'center_adjusted'
  | 'fill_score_in_uncertain_band'
  | 'poor_local_contrast'
  | 'excessive_blur'
  | 'measurement_region_incomplete';

export type GrayscaleImage = ImageDimensions & {
  /** One row-major 0...255 luminance byte per pixel. */
  data: Uint8Array;
};

export type BubbleMeasurementRadii = {
  roiRadiusPx: number;
  printedBubbleRadiusPx: number;
  printedOutlineWidthPx: number;
  fillRadiusPx: number;
  backgroundRingInnerRadiusPx: number;
  backgroundRingOuterRadiusPx: number;
  centerSearchTolerancePx: number;
};

export type BubbleDiagnostic = {
  questionId: string;
  bubbleId: string;
  expectedCenterPx: PixelPoint;
  measuredCenterPx: PixelPoint;
  centerAdjustmentPx: PixelPoint & { distance: number };
  measurementRadii: BubbleMeasurementRadii;
  interiorBrightness: number;
  backgroundBrightness: number;
  darkPixelRatio: number;
  contrast: number;
  focusScore: number;
  confidence: number;
  decision: BubbleDecision;
  reasonCodes: BubbleReasonCode[];
  thresholds: {
    darkPixelDelta: number;
    unfilledMaxDarkPixelRatio: number;
    filledMinDarkPixelRatio: number;
    minimumBackgroundBrightness: number;
    minimumMarkedContrast: number;
    minimumFocusScore: number;
  };
  timing: {
    /** Kept null so unchanged offline inputs serialize identically across runs. */
    durationMs: null;
    sampledPixelCount: number;
  };
};

export type BubbleAnalysisResult = {
  diagnosticFormatVersion: typeof BUBBLE_DIAGNOSTIC_FORMAT_VERSION;
  detector: {
    id: string;
    provisional: true;
  };
  scan: {
    image: ImageDimensions;
    bubbleCount: number;
    decisionCounts: Record<BubbleDecision, number>;
    averageBackgroundBrightness: number;
    minimumFocusScore: number;
    reasonCodes: BubbleReasonCode[];
    timing: {
      durationMs: null;
      analyzedRoiCount: number;
      sampledPixelCount: number;
    };
  };
  bubbles: BubbleDiagnostic[];
};

export class BubbleAnalysisValidationFailure extends Error {
  constructor(readonly validationErrors: SchemaValidationError[]) {
    super(`Bubble analysis requires a valid schema and exact canonical image dimensions.`);
    this.name = 'BubbleAnalysisValidationFailure';
  }
}

function rounded(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function pixel(image: GrayscaleImage, x: number, y: number) {
  return image.data[y * image.width + x];
}

function circleBounds(center: PixelPoint, radius: number) {
  return {
    left: Math.floor(center.x - radius),
    top: Math.floor(center.y - radius),
    right: Math.ceil(center.x + radius),
    bottom: Math.ceil(center.y + radius),
  };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectDisk(
  image: GrayscaleImage,
  center: PixelPoint,
  radius: number,
) {
  const values: number[] = [];
  const bounds = circleBounds(center, radius);
  let incomplete = false;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance > radius) continue;
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        incomplete = true;
      } else {
        values.push(pixel(image, x, y));
      }
    }
  }
  return { values, incomplete };
}

function collectRing(
  image: GrayscaleImage,
  center: PixelPoint,
  innerRadius: number,
  outerRadius: number,
) {
  const values: number[] = [];
  const bounds = circleBounds(center, outerRadius);
  let incomplete = false;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance < innerRadius || distance > outerRadius) continue;
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        incomplete = true;
      } else {
        values.push(pixel(image, x, y));
      }
    }
  }
  return { values, incomplete };
}

function outlineDarkness(
  image: GrayscaleImage,
  center: PixelPoint,
  style: BubbleStyle,
) {
  const halfWidth = Math.max(0.75, style.printedOutlineWidthPx / 2);
  const ring = collectRing(
    image,
    center,
    Math.max(0, style.radiusPx - halfWidth),
    style.radiusPx + halfWidth,
  );
  return ring.values.length === 0 ? 0 : 1 - mean(ring.values) / 255;
}

function findMeasuredCenter(
  image: GrayscaleImage,
  expectedCenter: PixelPoint,
  style: BubbleStyle,
) {
  const tolerance = style.centerSearchTolerancePx;
  let best = {
    center: expectedCenter,
    score: outlineDarkness(image, expectedCenter, style),
    distance: 0,
    dx: 0,
    dy: 0,
  };
  const integerLimit = Math.ceil(tolerance);
  for (let dy = -integerLimit; dy <= integerLimit; dy += 1) {
    for (let dx = -integerLimit; dx <= integerLimit; dx += 1) {
      const distance = Math.hypot(dx, dy);
      if (distance > tolerance || (dx === 0 && dy === 0)) continue;
      const center = { x: expectedCenter.x + dx, y: expectedCenter.y + dy };
      const score = outlineDarkness(image, center, style);
      const isBetter =
        score > best.score + 1e-9 ||
        (Math.abs(score - best.score) <= 1e-9 &&
          (distance < best.distance ||
            (distance === best.distance && (dy < best.dy || (dy === best.dy && dx < best.dx)))));
      if (isBetter) best = { center, score, distance, dx, dy };
    }
  }
  return best;
}

function measureFocus(image: GrayscaleImage, center: PixelPoint, roiRadius: number) {
  const bounds = circleBounds(center, roiRadius);
  const values: number[] = [];
  for (let y = bounds.top + 1; y < bounds.bottom - 1; y += 1) {
    for (let x = bounds.left + 1; x < bounds.right - 1; x += 1) {
      if (
        x <= 0 ||
        y <= 0 ||
        x >= image.width - 1 ||
        y >= image.height - 1 ||
        Math.hypot(x - center.x, y - center.y) > roiRadius - 1
      ) {
        continue;
      }
      const laplacian =
        pixel(image, x - 1, y) +
        pixel(image, x + 1, y) +
        pixel(image, x, y - 1) +
        pixel(image, x, y + 1) -
        4 * pixel(image, x, y);
      values.push(laplacian);
    }
  }
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return { score: variance / 255 ** 2, sampledPixelCount: values.length };
}

function confidenceFor(
  decision: BubbleDecision,
  darkPixelRatio: number,
  config: BubbleDetectorConfig,
) {
  if (decision === 'unfilled') {
    return rounded(Math.max(0, 1 - darkPixelRatio / config.unfilledMaxDarkPixelRatio));
  }
  if (decision === 'filled') {
    return rounded(
      Math.max(
        0,
        (darkPixelRatio - config.filledMinDarkPixelRatio) /
          (1 - config.filledMinDarkPixelRatio),
      ),
    );
  }
  const bandWidth = config.filledMinDarkPixelRatio - config.unfilledMaxDarkPixelRatio;
  const nearestBoundary = Math.min(
    Math.abs(darkPixelRatio - config.unfilledMaxDarkPixelRatio),
    Math.abs(config.filledMinDarkPixelRatio - darkPixelRatio),
  );
  return rounded(Math.min(0.49, nearestBoundary / Math.max(bandWidth, Number.EPSILON)));
}

function analyzeBubble(
  image: GrayscaleImage,
  schema: BubbleGradingSchema,
  questionId: string,
  bubbleId: string,
  expectedCenter: PixelPoint,
  config: BubbleDetectorConfig,
): BubbleDiagnostic {
  const style = schema.bubbleStyle;
  const centerMatch = findMeasuredCenter(image, expectedCenter, style);
  const interior = collectDisk(image, centerMatch.center, style.fillRadiusPx);
  const background = collectRing(
    image,
    centerMatch.center,
    style.backgroundRingInnerRadiusPx,
    style.backgroundRingOuterRadiusPx,
  );
  const focus = measureFocus(image, expectedCenter, style.roiRadiusPx);
  const interiorMean = mean(interior.values);
  const backgroundMean = mean(background.values);
  const backgroundBrightness = backgroundMean / 255;
  const interiorBrightness = interiorMean / 255;
  const darkCutoff = backgroundMean - config.darkPixelDelta * 255;
  const darkPixelRatio =
    interior.values.length === 0
      ? 0
      : interior.values.filter((value) => value <= darkCutoff).length / interior.values.length;
  const contrast = (backgroundMean - interiorMean) / 255;
  const reasonCodes: BubbleReasonCode[] = [];
  if (centerMatch.distance > 0) reasonCodes.push('center_adjusted');
  if (interior.incomplete || background.incomplete || interior.values.length === 0 || background.values.length === 0) {
    reasonCodes.push('measurement_region_incomplete');
  }
  if (
    backgroundBrightness < config.minimumBackgroundBrightness ||
    (darkPixelRatio > config.unfilledMaxDarkPixelRatio && contrast < config.minimumMarkedContrast)
  ) {
    reasonCodes.push('poor_local_contrast');
  }
  if (focus.score < config.minimumFocusScore) reasonCodes.push('excessive_blur');

  let decision: BubbleDecision;
  if (darkPixelRatio <= config.unfilledMaxDarkPixelRatio) {
    decision = 'unfilled';
  } else if (darkPixelRatio >= config.filledMinDarkPixelRatio) {
    decision = 'filled';
  } else {
    decision = 'uncertain';
    reasonCodes.push('fill_score_in_uncertain_band');
  }
  if (
    reasonCodes.some((reason) =>
      reason === 'measurement_region_incomplete' ||
      reason === 'poor_local_contrast' ||
      reason === 'excessive_blur',
    )
  ) {
    decision = 'uncertain';
  }

  const confidence =
    decision === 'uncertain'
      ? Math.min(0.49, confidenceFor(decision, darkPixelRatio, config))
      : confidenceFor(decision, darkPixelRatio, config);
  return {
    questionId,
    bubbleId,
    expectedCenterPx: { ...expectedCenter },
    measuredCenterPx: { ...centerMatch.center },
    centerAdjustmentPx: {
      x: centerMatch.dx,
      y: centerMatch.dy,
      distance: rounded(centerMatch.distance),
    },
    measurementRadii: {
      roiRadiusPx: style.roiRadiusPx,
      printedBubbleRadiusPx: style.radiusPx,
      printedOutlineWidthPx: style.printedOutlineWidthPx,
      fillRadiusPx: style.fillRadiusPx,
      backgroundRingInnerRadiusPx: style.backgroundRingInnerRadiusPx,
      backgroundRingOuterRadiusPx: style.backgroundRingOuterRadiusPx,
      centerSearchTolerancePx: style.centerSearchTolerancePx,
    },
    interiorBrightness: rounded(interiorBrightness),
    backgroundBrightness: rounded(backgroundBrightness),
    darkPixelRatio: rounded(darkPixelRatio),
    contrast: rounded(contrast),
    focusScore: rounded(focus.score),
    confidence,
    decision,
    reasonCodes,
    thresholds: {
      darkPixelDelta: config.darkPixelDelta,
      unfilledMaxDarkPixelRatio: config.unfilledMaxDarkPixelRatio,
      filledMinDarkPixelRatio: config.filledMinDarkPixelRatio,
      minimumBackgroundBrightness: config.minimumBackgroundBrightness,
      minimumMarkedContrast: config.minimumMarkedContrast,
      minimumFocusScore: config.minimumFocusScore,
    },
    timing: {
      durationMs: null,
      sampledPixelCount:
        interior.values.length + background.values.length + focus.sampledPixelCount,
    },
  };
}

/**
 * Deterministic, platform-neutral analysis. Pixel loops are bounded to the
 * schema-declared ROI around each expected bubble; there is no page search.
 */
export function analyzeBubbleGradingImage(
  candidate: unknown,
  image: GrayscaleImage,
  config: BubbleDetectorConfig = PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
): BubbleAnalysisResult {
  const validation = validateBubbleGradingSchema(candidate, {
    inputImage: { width: image.width, height: image.height },
  });
  if (!validation.valid) throw new BubbleAnalysisValidationFailure(validation.errors);
  if (validation.schema.canonicalImage.dimensions.status !== 'fixed') {
    throw new BubbleAnalysisValidationFailure([
      {
        path: 'canonicalImage.dimensions.status',
        code: 'fixed_dimensions_required_for_analysis',
        message: 'must be "fixed" before bubble analysis can run.',
      },
    ]);
  }
  if (image.data.length !== image.width * image.height) {
    throw new Error(
      `Expected ${image.width * image.height} grayscale pixels but received ${image.data.length}.`,
    );
  }

  const bubbles = validation.schema.questions.flatMap((question) =>
    question.bubbles.map((bubble) =>
      analyzeBubble(
        image,
        validation.schema,
        question.id,
        bubble.id,
        bubble.centerPx,
        config,
      ),
    ),
  );
  const decisionCounts: Record<BubbleDecision, number> = {
    filled: 0,
    unfilled: 0,
    uncertain: 0,
  };
  const reasonCodes = new Set<BubbleReasonCode>();
  let sampledPixelCount = 0;
  for (const bubble of bubbles) {
    decisionCounts[bubble.decision] += 1;
    sampledPixelCount += bubble.timing.sampledPixelCount;
    bubble.reasonCodes.forEach((reason) => reasonCodes.add(reason));
  }

  return {
    diagnosticFormatVersion: BUBBLE_DIAGNOSTIC_FORMAT_VERSION,
    detector: { id: config.id, provisional: true },
    scan: {
      image: { width: image.width, height: image.height },
      bubbleCount: bubbles.length,
      decisionCounts,
      averageBackgroundBrightness: rounded(mean(bubbles.map((bubble) => bubble.backgroundBrightness))),
      minimumFocusScore: rounded(
        bubbles.length === 0 ? 0 : Math.min(...bubbles.map((bubble) => bubble.focusScore)),
      ),
      reasonCodes: [...reasonCodes],
      timing: {
        durationMs: null,
        analyzedRoiCount: bubbles.length,
        sampledPixelCount,
      },
    },
    bubbles,
  };
}
