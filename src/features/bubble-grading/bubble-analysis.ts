import type {
  BubbleGradingSchema,
  BubbleStyle,
  PixelPoint,
  QuestionSchema,
} from './schema';
import {
  validateBubbleGradingSchema,
  type ImageDimensions,
  type SchemaValidationError,
} from './schema-validator';
import {
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  type BubbleDetectorConfig,
} from './bubble-detector-config';

export {
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  type BubbleDetectorConfig,
} from './bubble-detector-config';

export const BUBBLE_DIAGNOSTIC_FORMAT_VERSION = 1 as const;
export type BubbleDecision = 'filled' | 'unfilled' | 'uncertain';
export type BubbleReasonCode =
  | 'center_adjusted'
  | 'fill_score_in_uncertain_band'
  | 'poor_local_contrast'
  | 'excessive_blur'
  | 'measurement_region_incomplete';
export type QuestionDecision = 'correct' | 'incorrect' | 'needs_review';

export type QuestionDecisionReason =
  | { code: 'exact_match' }
  | { code: 'blank_response' }
  | { code: 'missing_selection'; bubbleIds: string[] }
  | { code: 'extra_selection'; bubbleIds: string[] }
  | {
      code: 'uncertain_bubbles_could_change_outcome';
      bubbles: {
        bubbleId: string;
        reasonCodes: BubbleReasonCode[];
      }[];
    };

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
    /** Null unless timing is explicitly enabled for a diagnostic run. */
    durationMs: number | null;
    sampledPixelCount: number;
  };
};

export type QuestionGradingResult = {
  questionId: string;
  label: string;
  selectionMode: QuestionSchema['selectionMode'];
  maximumPoints: number;
  detectedFilledBubbleIds: string[];
  correctBubbleIds: string[];
  status: QuestionDecision;
  awardedPoints: number;
  pendingPoints: number;
  confidence: number;
  reasons: QuestionDecisionReason[];
};

export type GradingScore = {
  maximumPoints: number;
  awardedGradedPoints: number;
  pendingReviewPoints: number;
  counts: Record<QuestionDecision, number>;
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
      durationMs: number | null;
      analyzedRoiCount: number;
      sampledPixelCount: number;
    };
  };
  bubbles: BubbleDiagnostic[];
  questions: QuestionGradingResult[];
  score: GradingScore;
};

export type BubbleAnalysisOptions = {
  /** Opt in for performance diagnostics; disabled by default for reproducible fixtures. */
  recordTiming?: boolean;
};

export class BubbleAnalysisValidationFailure extends Error {
  constructor(readonly validationErrors: SchemaValidationError[]) {
    super(`Bubble analysis requires a valid schema and exact canonical image dimensions.`);
    this.name = 'BubbleAnalysisValidationFailure';
  }
}

function rounded(value: number, digits = 6) {
  'worklet';
  return Number(value.toFixed(digits));
}

function nowMilliseconds() {
  'worklet';
  return globalThis.performance?.now() ?? Date.now();
}

function pixel(image: GrayscaleImage, x: number, y: number) {
  'worklet';
  return image.data[y * image.width + x];
}

function circleBounds(center: PixelPoint, radius: number) {
  'worklet';
  return {
    left: Math.floor(center.x - radius),
    top: Math.floor(center.y - radius),
    right: Math.ceil(center.x + radius),
    bottom: Math.ceil(center.y + radius),
  };
}

function mean(values: number[]) {
  'worklet';
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleDisk(
  image: GrayscaleImage,
  center: PixelPoint,
  radius: number,
  darkCutoff: number,
) {
  'worklet';
  const bounds = circleBounds(center, radius);
  let incomplete = false;
  let count = 0;
  let darkCount = 0;
  let sum = 0;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance > radius) continue;
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        incomplete = true;
      } else {
        const value = pixel(image, x, y);
        count += 1;
        sum += value;
        if (value <= darkCutoff) darkCount += 1;
      }
    }
  }
  return { count, darkCount, sum, incomplete };
}

function sampleRing(
  image: GrayscaleImage,
  center: PixelPoint,
  innerRadius: number,
  outerRadius: number,
) {
  'worklet';
  const bounds = circleBounds(center, outerRadius);
  let incomplete = false;
  let count = 0;
  let sum = 0;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance < innerRadius || distance > outerRadius) continue;
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        incomplete = true;
      } else {
        count += 1;
        sum += pixel(image, x, y);
      }
    }
  }
  return { count, sum, incomplete };
}

function outlineDarkness(
  image: GrayscaleImage,
  center: PixelPoint,
  style: BubbleStyle,
) {
  'worklet';
  const halfWidth = Math.max(0.75, style.printedOutlineWidthPx / 2);
  const ring = sampleRing(
    image,
    center,
    Math.max(0, style.radiusPx - halfWidth),
    style.radiusPx + halfWidth,
  );
  return ring.count === 0 ? 0 : 1 - ring.sum / ring.count / 255;
}

function findMeasuredCenter(
  image: GrayscaleImage,
  expectedCenter: PixelPoint,
  style: BubbleStyle,
) {
  'worklet';
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
  'worklet';
  const bounds = circleBounds(center, roiRadius);
  let count = 0;
  let sum = 0;
  let sumOfSquares = 0;
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
      count += 1;
      sum += laplacian;
      sumOfSquares += laplacian ** 2;
    }
  }
  const average = count === 0 ? 0 : sum / count;
  const variance = count === 0 ? 0 : Math.max(0, sumOfSquares / count - average ** 2);
  return { score: variance / 255 ** 2, sampledPixelCount: count };
}

function confidenceFor(
  decision: BubbleDecision,
  darkPixelRatio: number,
  config: BubbleDetectorConfig,
) {
  'worklet';
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
  recordTiming: boolean,
): BubbleDiagnostic {
  'worklet';
  const startedAt = recordTiming ? nowMilliseconds() : null;
  const style = schema.bubbleStyle;
  const centerMatch = findMeasuredCenter(image, expectedCenter, style);
  const background = sampleRing(
    image,
    centerMatch.center,
    style.backgroundRingInnerRadiusPx,
    style.backgroundRingOuterRadiusPx,
  );
  const focus = measureFocus(image, expectedCenter, style.roiRadiusPx);
  const backgroundMean = background.count === 0 ? 0 : background.sum / background.count;
  const darkCutoff = backgroundMean - config.darkPixelDelta * 255;
  const interior = sampleDisk(
    image,
    centerMatch.center,
    style.fillRadiusPx,
    darkCutoff,
  );
  const interiorMean = interior.count === 0 ? 0 : interior.sum / interior.count;
  const backgroundBrightness = backgroundMean / 255;
  const interiorBrightness = interiorMean / 255;
  const darkPixelRatio = interior.count === 0 ? 0 : interior.darkCount / interior.count;
  const contrast = (backgroundMean - interiorMean) / 255;
  const reasonCodes: BubbleReasonCode[] = [];
  if (centerMatch.distance > 0) reasonCodes.push('center_adjusted');
  if (interior.incomplete || background.incomplete || interior.count === 0 || background.count === 0) {
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
      durationMs: startedAt === null ? null : rounded(nowMilliseconds() - startedAt, 3),
      sampledPixelCount:
        interior.count + background.count + focus.sampledPixelCount,
    },
  };
}

function exactSetMatch(actual: Set<string>, expected: Set<string>) {
  'worklet';
  return actual.size === expected.size && [...actual].every((id) => expected.has(id));
}

function minimumConfidence(diagnostics: BubbleDiagnostic[]) {
  'worklet';
  return rounded(
    diagnostics.length === 0
      ? 1
      : Math.min(...diagnostics.map((diagnostic) => diagnostic.confidence)),
  );
}

/**
 * Converts already measured bubbles into exact-set question decisions. An
 * uncertain bubble only defers a question when some assignment of all
 * uncertain bubbles could produce the exact answer key.
 */
export function gradeBubbleDiagnostics(
  schema: BubbleGradingSchema,
  bubbles: BubbleDiagnostic[],
): { questions: QuestionGradingResult[]; score: GradingScore } {
  'worklet';
  const diagnosticsByQuestion = new Map<string, Map<string, BubbleDiagnostic>>();
  for (const diagnostic of bubbles) {
    const questionDiagnostics = diagnosticsByQuestion.get(diagnostic.questionId) ?? new Map();
    if (questionDiagnostics.has(diagnostic.bubbleId)) {
      throw new Error(`Duplicate diagnostic for bubble ${diagnostic.bubbleId}.`);
    }
    questionDiagnostics.set(diagnostic.bubbleId, diagnostic);
    diagnosticsByQuestion.set(diagnostic.questionId, questionDiagnostics);
  }

  const questions = schema.questions.map((question): QuestionGradingResult => {
    const diagnosticMap = diagnosticsByQuestion.get(question.id) ?? new Map();
    const diagnostics = question.bubbles.map((bubble) => {
      const diagnostic = diagnosticMap.get(bubble.id);
      if (!diagnostic) {
        throw new Error(`Missing diagnostic for bubble ${bubble.id}.`);
      }
      return diagnostic;
    });
    const detectedFilledBubbleIds = diagnostics
      .filter((diagnostic) => diagnostic.decision === 'filled')
      .map((diagnostic) => diagnostic.bubbleId);
    const uncertainDiagnostics = diagnostics.filter(
      (diagnostic) => diagnostic.decision === 'uncertain',
    );
    const filled = new Set(detectedFilledBubbleIds);
    const uncertain = new Set(uncertainDiagnostics.map((diagnostic) => diagnostic.bubbleId));
    const correct = new Set(question.correctBubbleIds);
    const missingCorrectIds = question.correctBubbleIds.filter((id) => !filled.has(id));
    const extraFilledIds = detectedFilledBubbleIds.filter((id) => !correct.has(id));
    const uncertaintyCanProduceExactAnswer =
      extraFilledIds.length === 0 &&
      missingCorrectIds.every((id) => uncertain.has(id));

    if (uncertainDiagnostics.length > 0 && uncertaintyCanProduceExactAnswer) {
      return {
        questionId: question.id,
        label: question.label,
        selectionMode: question.selectionMode,
        maximumPoints: question.points,
        detectedFilledBubbleIds,
        correctBubbleIds: [...question.correctBubbleIds],
        status: 'needs_review',
        awardedPoints: 0,
        pendingPoints: question.points,
        confidence: minimumConfidence(uncertainDiagnostics),
        reasons: [
          {
            code: 'uncertain_bubbles_could_change_outcome',
            bubbles: uncertainDiagnostics.map((diagnostic) => ({
              bubbleId: diagnostic.bubbleId,
              reasonCodes: [...diagnostic.reasonCodes],
            })),
          },
        ],
      };
    }

    if (exactSetMatch(filled, correct)) {
      return {
        questionId: question.id,
        label: question.label,
        selectionMode: question.selectionMode,
        maximumPoints: question.points,
        detectedFilledBubbleIds,
        correctBubbleIds: [...question.correctBubbleIds],
        status: 'correct',
        awardedPoints: question.points,
        pendingPoints: 0,
        confidence: minimumConfidence(diagnostics),
        reasons: [{ code: 'exact_match' }],
      };
    }

    const reasons: QuestionDecisionReason[] = [];
    if (detectedFilledBubbleIds.length === 0 && uncertainDiagnostics.length === 0) {
      reasons.push({ code: 'blank_response' });
    }
    const clearMissingIds = missingCorrectIds.filter((id) => !uncertain.has(id));
    if (clearMissingIds.length > 0) {
      reasons.push({ code: 'missing_selection', bubbleIds: clearMissingIds });
    }
    if (extraFilledIds.length > 0) {
      reasons.push({ code: 'extra_selection', bubbleIds: extraFilledIds });
    }
    const decisiveDiagnostics = diagnostics.filter(
      (diagnostic) =>
        extraFilledIds.includes(diagnostic.bubbleId) ||
        clearMissingIds.includes(diagnostic.bubbleId),
    );
    return {
      questionId: question.id,
      label: question.label,
      selectionMode: question.selectionMode,
      maximumPoints: question.points,
      detectedFilledBubbleIds,
      correctBubbleIds: [...question.correctBubbleIds],
      status: 'incorrect',
      awardedPoints: 0,
      pendingPoints: 0,
      confidence: minimumConfidence(decisiveDiagnostics),
      reasons,
    };
  });

  const counts: Record<QuestionDecision, number> = {
    correct: 0,
    incorrect: 0,
    needs_review: 0,
  };
  for (const question of questions) counts[question.status] += 1;
  return {
    questions,
    score: {
      maximumPoints: questions.reduce((sum, question) => sum + question.maximumPoints, 0),
      awardedGradedPoints: questions.reduce((sum, question) => sum + question.awardedPoints, 0),
      pendingReviewPoints: questions.reduce((sum, question) => sum + question.pendingPoints, 0),
      counts,
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
  options: BubbleAnalysisOptions = {},
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

  return analyzeValidatedBubbleGradingImage(validation.schema, image, config, options);
}

/**
 * Worker-safe analyzer for callers that already validated the schema and image
 * contract on the React Native runtime.
 */
export function analyzeValidatedBubbleGradingImage(
  schema: BubbleGradingSchema,
  image: GrayscaleImage,
  config: BubbleDetectorConfig = PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  options: BubbleAnalysisOptions = {},
): BubbleAnalysisResult {
  'worklet';
  const startedAt = options.recordTiming ? nowMilliseconds() : null;
  if (image.data.length !== image.width * image.height) {
    throw new Error(
      `Expected ${image.width * image.height} grayscale pixels but received ${image.data.length}.`,
    );
  }

  const bubbles = schema.questions.flatMap((question) =>
    question.bubbles.map((bubble) =>
      analyzeBubble(
        image,
        schema,
        question.id,
        bubble.id,
        bubble.centerPx,
        config,
        options.recordTiming === true,
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

  const grading = gradeBubbleDiagnostics(schema, bubbles);
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
        durationMs: startedAt === null ? null : rounded(nowMilliseconds() - startedAt, 3),
        analyzedRoiCount: bubbles.length,
        sampledPixelCount,
      },
    },
    bubbles,
    ...grading,
  };
}
