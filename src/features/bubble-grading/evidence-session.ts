import {
  analyzeValidatedBubbleGradingImage,
  type BubbleAnalysisOptions,
  type BubbleAnalysisResult,
  type BubbleReasonCode,
  type GrayscaleImage,
} from './bubble-analysis';
import {
  BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION,
  type BubbleDetectorConfig,
} from './bubble-detector-config';
import type {
  BubbleGradingSchema,
  PixelRectangle,
} from './schema';
import {
  validateBubbleGradingSchema,
  type SchemaValidationError,
} from './schema-validator';

export const EVIDENCE_SESSION_CONTRACT_VERSION = 1 as const;
export const EVIDENCE_SESSION_DIAGNOSTIC_FORMAT_VERSION = 1 as const;
export const EVIDENCE_REASON_CATEGORY_FORMAT_VERSION = 1 as const;
export const EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION = 1 as const;

export type EvidenceReasonCategory =
  | 'geometry'
  | 'quality'
  | 'measurement'
  | 'color'
  | 'shadow'
  | 'disagreement'
  | 'session';

/**
 * Existing bubble codes are not renamed. The category layer lets later
 * diagnostics add geometry, quality, and disagreement details without
 * collapsing them into one generic uncertainty reason.
 */
export const LEGACY_BUBBLE_REASON_CATEGORIES: Readonly<
  Record<BubbleReasonCode, EvidenceReasonCategory>
> = Object.freeze({
  center_adjusted: 'geometry',
  fill_score_in_uncertain_band: 'measurement',
  poor_local_contrast: 'quality',
  excessive_blur: 'quality',
  measurement_region_incomplete: 'measurement',
});

export type EvidenceTemplateIdentity = Readonly<{
  id: string;
  version: string;
  correctionBoxStyleIds: readonly string[];
}>;

export type RegisteredPixelEvidence = Readonly<{
  pixelFormat: 'gray8' | 'rgba8';
  width: number;
  height: number;
  data: Uint8Array;
}>;

/**
 * The full registered box crop is evidence only in this sprint. No correction
 * state is inferred from it.
 */
export type RegisteredCorrectionBoxEvidence = Readonly<{
  bubbleId: string;
  styleId: string;
  boundsPx: PixelRectangle;
  pixels: RegisteredPixelEvidence;
}>;

export type RegisteredCanonicalFrameEvidence = Readonly<{
  frameId: string;
  sequence: number;
  capturedAtMs: number;
  registration: Readonly<{
    status: 'registered';
    coordinateSystem: 'canonical-crop-pixels';
  }>;
  quality: Readonly<{
    status: 'credible';
    reasonCodes: readonly [];
  }>;
  canonicalImage: GrayscaleImage;
  correctionBoxes?: readonly RegisteredCorrectionBoxEvidence[];
}>;

export type EvidenceSessionGroundTruth = Readonly<{
  formatVersion: typeof EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION;
  fixtureId: string;
  layout: Readonly<{
    schemaId: string;
    schemaVersion: string;
  }>;
  template: Readonly<{
    correctionBoxStyleId: string;
    appearanceRevision: string;
  }>;
  printerId: string | null;
  penId: string;
  bubbles: readonly Readonly<{
    bubbleId: string;
    physicalCoverage: 'empty' | '40-percent' | '70-percent' | 'full';
    expectedDetectorClass: 'unfilled' | 'uncertain-allowed' | 'filled';
    correctionState: 'none';
  }>[];
  questions: readonly Readonly<{
    questionId: string;
    expectedSelectedBubbleIds: readonly string[];
  }>[];
}>;

export type EvidenceSessionInput = Readonly<{
  contractVersion: typeof EVIDENCE_SESSION_CONTRACT_VERSION;
  sessionId: string;
  schema: BubbleGradingSchema;
  template: EvidenceTemplateIdentity;
  detectorConfig: BubbleDetectorConfig;
  frames: readonly RegisteredCanonicalFrameEvidence[];
  groundTruth?: EvidenceSessionGroundTruth;
}>;

export type EvidenceSessionValidationError = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

export type EvidenceSessionValidationResult =
  | Readonly<{
      valid: true;
      errors: readonly [];
      input: EvidenceSessionInput;
    }>
  | Readonly<{
      valid: false;
      errors: readonly EvidenceSessionValidationError[];
      input: null;
    }>;

export type CategorizedEvidenceReason = Readonly<{
  category: EvidenceReasonCategory;
  code: BubbleReasonCode;
  scope: 'bubble';
  frameId: string;
  questionId: string;
  bubbleId: string;
}>;

export type EvidenceSessionAnalysisResult = Readonly<{
  contractVersion: typeof EVIDENCE_SESSION_CONTRACT_VERSION;
  diagnosticFormatVersion: typeof EVIDENCE_SESSION_DIAGNOSTIC_FORMAT_VERSION;
  reasonCategoryFormatVersion: typeof EVIDENCE_REASON_CATEGORY_FORMAT_VERSION;
  sessionId: string;
  schema: Readonly<{
    formatVersion: BubbleGradingSchema['formatVersion'];
    testId: string;
    testVersion: string;
  }>;
  template: {
    id: string;
    version: string;
    correctionBoxStyleIds: string[];
  };
  detectorConfig: BubbleDetectorConfig;
  groundTruth: {
    formatVersion: typeof EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION;
    fixtureId: string;
    layout: {
      schemaId: string;
      schemaVersion: string;
    };
    template: {
      correctionBoxStyleId: string;
      appearanceRevision: string;
    };
    printerId: string | null;
    penId: string;
    bubbles: {
      bubbleId: string;
      physicalCoverage: 'empty' | '40-percent' | '70-percent' | 'full';
      expectedDetectorClass: 'unfilled' | 'uncertain-allowed' | 'filled';
      correctionState: 'none';
    }[];
    questions: {
      questionId: string;
      expectedSelectedBubbleIds: string[];
    }[];
  } | null;
  frames: readonly Readonly<{
    frameId: string;
    sequence: number;
    capturedAtMs: number;
    registration: RegisteredCanonicalFrameEvidence['registration'];
    quality: RegisteredCanonicalFrameEvidence['quality'];
    correctionBoxes: readonly Readonly<{
      bubbleId: string;
      styleId: string;
      boundsPx: PixelRectangle;
      pixelFormat: RegisteredPixelEvidence['pixelFormat'];
      width: number;
      height: number;
      byteLength: number;
    }>[];
    analysis: BubbleAnalysisResult;
    reasons: readonly CategorizedEvidenceReason[];
  }>[];
  combined: Readonly<{
    strategy: 'single-frame-baseline-v1';
    contributingFrameIds: readonly [string];
    scan: BubbleAnalysisResult['scan'];
    bubbles: BubbleAnalysisResult['bubbles'];
    questions: BubbleAnalysisResult['questions'];
    score: BubbleAnalysisResult['score'];
  }>;
  quality: Readonly<{
    status: 'credible';
    eligibleFrameIds: readonly [string];
    excludedFrames: readonly [];
    reasons: readonly [];
  }>;
  disagreement: Readonly<{
    status: 'none';
    bubbleIds: readonly [];
    questionIds: readonly [];
    reasons: readonly [];
  }>;
  bestVisualReference: Readonly<{
    frameId: string;
  }>;
  timings: Readonly<{
    /** Runtime metadata; null by default and excluded from deterministic parity. */
    durationMs: number | null;
    frameAnalysisDurationMs: number | null;
  }>;
}>;

type UnknownRecord = Record<string, unknown>;

export class EvidenceSessionValidationFailure extends Error {
  constructor(readonly validationErrors: readonly EvidenceSessionValidationError[]) {
    super('Evidence-session analysis requires a valid versioned session input.');
    this.name = 'EvidenceSessionValidationFailure';
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && isFiniteNumber(value) && value > 0;
}

function isUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function hasRequiredString(
  value: unknown,
  path: string,
  errors: EvidenceSessionValidationError[],
) {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  errors.push({
    path,
    code: 'required_string',
    message: 'must be a non-empty string.',
  });
  return false;
}

function addSchemaErrors(
  errors: EvidenceSessionValidationError[],
  schemaErrors: SchemaValidationError[],
) {
  for (const error of schemaErrors) {
    errors.push({
      path: `schema.${error.path}`,
      code: error.code,
      message: error.message,
    });
  }
}

function validateDetectorConfig(
  candidate: unknown,
  errors: EvidenceSessionValidationError[],
) {
  if (!isRecord(candidate)) {
    errors.push({
      path: 'detectorConfig',
      code: 'required_object',
      message: 'must be a detector configuration object.',
    });
    return;
  }
  if (candidate.formatVersion !== BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION) {
    errors.push({
      path: 'detectorConfig.formatVersion',
      code: 'unsupported_detector_config_version',
      message: `must equal ${BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION}.`,
    });
  }
  hasRequiredString(candidate.id, 'detectorConfig.id', errors);
  if (typeof candidate.provisional !== 'boolean') {
    errors.push({
      path: 'detectorConfig.provisional',
      code: 'required_boolean',
      message: 'must be a boolean.',
    });
  }

  const unitIntervalFields = [
    'darkPixelDelta',
    'unfilledMaxDarkPixelRatio',
    'filledMinDarkPixelRatio',
    'minimumBackgroundBrightness',
    'minimumMarkedContrast',
  ] as const;
  for (const field of unitIntervalFields) {
    if (!isUnitInterval(candidate[field])) {
      errors.push({
        path: `detectorConfig.${field}`,
        code: 'invalid_detector_threshold',
        message: 'must be a finite number from 0 through 1.',
      });
    }
  }
  if (!isFiniteNumber(candidate.minimumFocusScore) || candidate.minimumFocusScore < 0) {
    errors.push({
      path: 'detectorConfig.minimumFocusScore',
      code: 'invalid_detector_threshold',
      message: 'must be a finite non-negative number.',
    });
  }
  if (
    isUnitInterval(candidate.unfilledMaxDarkPixelRatio) &&
    isUnitInterval(candidate.filledMinDarkPixelRatio) &&
    candidate.unfilledMaxDarkPixelRatio >= candidate.filledMinDarkPixelRatio
  ) {
    errors.push({
      path: 'detectorConfig.filledMinDarkPixelRatio',
      code: 'invalid_detector_threshold_order',
      message: 'must be greater than unfilledMaxDarkPixelRatio.',
    });
  }
}

function validateTemplate(
  candidate: unknown,
  errors: EvidenceSessionValidationError[],
) {
  if (!isRecord(candidate)) {
    errors.push({
      path: 'template',
      code: 'required_object',
      message: 'must identify the registered printed template.',
    });
    return;
  }
  hasRequiredString(candidate.id, 'template.id', errors);
  hasRequiredString(candidate.version, 'template.version', errors);
  if (!Array.isArray(candidate.correctionBoxStyleIds)) {
    errors.push({
      path: 'template.correctionBoxStyleIds',
      code: 'required_array',
      message: 'must be an array of correction-box style ids.',
    });
    return;
  }
  const styleIds = new Set<string>();
  candidate.correctionBoxStyleIds.forEach((styleId, index) => {
    const path = `template.correctionBoxStyleIds[${index}]`;
    if (!hasRequiredString(styleId, path, errors)) return;
    if (styleIds.has(styleId as string)) {
      errors.push({
        path,
        code: 'duplicate_correction_box_style_id',
        message: `repeats "${styleId as string}".`,
      });
    }
    styleIds.add(styleId as string);
  });
}

function validatePixelRectangle(
  candidate: unknown,
  path: string,
  imageWidth: number | null,
  imageHeight: number | null,
  errors: EvidenceSessionValidationError[],
) {
  if (!isRecord(candidate)) {
    errors.push({
      path,
      code: 'required_object',
      message: 'must be an integer canonical-pixel rectangle.',
    });
    return false;
  }
  const fields = ['x', 'y', 'width', 'height'] as const;
  let valid = true;
  for (const field of fields) {
    const value = candidate[field];
    const fieldValid =
      field === 'x' || field === 'y'
        ? isNonNegativeInteger(value)
        : isPositiveInteger(value);
    if (!fieldValid) {
      errors.push({
        path: `${path}.${field}`,
        code: 'invalid_pixel_rectangle',
        message:
          field === 'x' || field === 'y'
            ? 'must be a non-negative integer.'
            : 'must be a positive integer.',
      });
      valid = false;
    }
  }
  if (
    valid &&
    imageWidth !== null &&
    imageHeight !== null &&
    ((candidate.x as number) + (candidate.width as number) > imageWidth ||
      (candidate.y as number) + (candidate.height as number) > imageHeight)
  ) {
    errors.push({
      path,
      code: 'correction_box_evidence_out_of_bounds',
      message: `must fit inside the ${imageWidth}x${imageHeight}px canonical image.`,
    });
    valid = false;
  }
  return valid;
}

function validateCorrectionBoxes(
  candidate: unknown,
  framePath: string,
  imageWidth: number | null,
  imageHeight: number | null,
  bubbleIds: ReadonlySet<string>,
  styleIds: ReadonlySet<string>,
  errors: EvidenceSessionValidationError[],
) {
  if (candidate === undefined) return;
  if (!Array.isArray(candidate)) {
    errors.push({
      path: `${framePath}.correctionBoxes`,
      code: 'required_array',
      message: 'must be an array when provided.',
    });
    return;
  }
  const seenBubbleIds = new Set<string>();
  candidate.forEach((box, boxIndex) => {
    const path = `${framePath}.correctionBoxes[${boxIndex}]`;
    if (!isRecord(box)) {
      errors.push({
        path,
        code: 'required_object',
        message: 'must be registered correction-box evidence.',
      });
      return;
    }
    if (hasRequiredString(box.bubbleId, `${path}.bubbleId`, errors)) {
      const bubbleId = box.bubbleId as string;
      if (!bubbleIds.has(bubbleId)) {
        errors.push({
          path: `${path}.bubbleId`,
          code: 'unknown_bubble_id',
          message: `does not identify a bubble in the schema: "${bubbleId}".`,
        });
      }
      if (seenBubbleIds.has(bubbleId)) {
        errors.push({
          path: `${path}.bubbleId`,
          code: 'duplicate_correction_box_evidence',
          message: `repeats correction-box evidence for "${bubbleId}".`,
        });
      }
      seenBubbleIds.add(bubbleId);
    }
    if (hasRequiredString(box.styleId, `${path}.styleId`, errors)) {
      const styleId = box.styleId as string;
      if (!styleIds.has(styleId)) {
        errors.push({
          path: `${path}.styleId`,
          code: 'unknown_correction_box_style_id',
          message: `is not declared by template.correctionBoxStyleIds: "${styleId}".`,
        });
      }
    }

    const rectangleValid = validatePixelRectangle(
      box.boundsPx,
      `${path}.boundsPx`,
      imageWidth,
      imageHeight,
      errors,
    );
    if (!isRecord(box.pixels)) {
      errors.push({
        path: `${path}.pixels`,
        code: 'required_object',
        message: 'must contain the complete registered box pixels.',
      });
      return;
    }
    if (box.pixels.pixelFormat !== 'gray8' && box.pixels.pixelFormat !== 'rgba8') {
      errors.push({
        path: `${path}.pixels.pixelFormat`,
        code: 'unsupported_pixel_format',
        message: 'must be "gray8" or "rgba8".',
      });
    }
    if (!isPositiveInteger(box.pixels.width)) {
      errors.push({
        path: `${path}.pixels.width`,
        code: 'invalid_image_dimension',
        message: 'must be a positive integer.',
      });
    }
    if (!isPositiveInteger(box.pixels.height)) {
      errors.push({
        path: `${path}.pixels.height`,
        code: 'invalid_image_dimension',
        message: 'must be a positive integer.',
      });
    }
    if (
      rectangleValid &&
      isRecord(box.boundsPx) &&
      isPositiveInteger(box.pixels.width) &&
      isPositiveInteger(box.pixels.height) &&
      (box.pixels.width !== box.boundsPx.width ||
        box.pixels.height !== box.boundsPx.height)
    ) {
      errors.push({
        path: `${path}.pixels`,
        code: 'correction_box_pixel_dimension_mismatch',
        message: 'pixel dimensions must exactly match boundsPx.',
      });
    }
    if (!(box.pixels.data instanceof Uint8Array)) {
      errors.push({
        path: `${path}.pixels.data`,
        code: 'invalid_pixel_data',
        message: 'must be a Uint8Array.',
      });
    } else if (
      isPositiveInteger(box.pixels.width) &&
      isPositiveInteger(box.pixels.height) &&
      (box.pixels.pixelFormat === 'gray8' || box.pixels.pixelFormat === 'rgba8')
    ) {
      const channelCount = box.pixels.pixelFormat === 'rgba8' ? 4 : 1;
      const expectedLength = box.pixels.width * box.pixels.height * channelCount;
      if (box.pixels.data.length !== expectedLength) {
        errors.push({
          path: `${path}.pixels.data`,
          code: 'pixel_data_length_mismatch',
          message: `must contain exactly ${expectedLength} bytes.`,
        });
      }
    }
  });
}

function validateGroundTruth(
  candidate: unknown,
  schema: BubbleGradingSchema | null,
  correctionBoxStyleIds: ReadonlySet<string>,
  errors: EvidenceSessionValidationError[],
) {
  if (candidate === undefined) return;
  if (!isRecord(candidate)) {
    errors.push({
      path: 'groundTruth',
      code: 'required_object',
      message: 'must be a versioned ground-truth record when provided.',
    });
    return;
  }
  if (candidate.formatVersion !== EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION) {
    errors.push({
      path: 'groundTruth.formatVersion',
      code: 'unsupported_ground_truth_version',
      message: `must equal ${EVIDENCE_SESSION_GROUND_TRUTH_FORMAT_VERSION}.`,
    });
  }
  hasRequiredString(candidate.fixtureId, 'groundTruth.fixtureId', errors);
  if (!isRecord(candidate.layout)) {
    errors.push({
      path: 'groundTruth.layout',
      code: 'required_object',
      message: 'must identify the schema used to declare physical truth.',
    });
  } else {
    hasRequiredString(candidate.layout.schemaId, 'groundTruth.layout.schemaId', errors);
    hasRequiredString(
      candidate.layout.schemaVersion,
      'groundTruth.layout.schemaVersion',
      errors,
    );
    if (schema && candidate.layout.schemaId !== schema.test.id) {
      errors.push({
        path: 'groundTruth.layout.schemaId',
        code: 'ground_truth_schema_mismatch',
        message: `must equal the analyzed schema id "${schema.test.id}".`,
      });
    }
    if (schema && candidate.layout.schemaVersion !== schema.test.version) {
      errors.push({
        path: 'groundTruth.layout.schemaVersion',
        code: 'ground_truth_schema_mismatch',
        message: `must equal the analyzed schema version "${schema.test.version}".`,
      });
    }
  }
  if (!isRecord(candidate.template)) {
    errors.push({
      path: 'groundTruth.template',
      code: 'required_object',
      message: 'must identify the frozen correction-box appearance.',
    });
  } else {
    if (
      hasRequiredString(
        candidate.template.correctionBoxStyleId,
        'groundTruth.template.correctionBoxStyleId',
        errors,
      ) &&
      !correctionBoxStyleIds.has(candidate.template.correctionBoxStyleId as string)
    ) {
      errors.push({
        path: 'groundTruth.template.correctionBoxStyleId',
        code: 'unknown_correction_box_style_id',
        message: 'must be declared by template.correctionBoxStyleIds.',
      });
    }
    hasRequiredString(
      candidate.template.appearanceRevision,
      'groundTruth.template.appearanceRevision',
      errors,
    );
  }
  if (
    candidate.printerId !== null &&
    (typeof candidate.printerId !== 'string' ||
      candidate.printerId.trim().length === 0)
  ) {
    errors.push({
      path: 'groundTruth.printerId',
      code: 'invalid_optional_identifier',
      message: 'must be null when unknown or a non-empty string.',
    });
  }
  hasRequiredString(candidate.penId, 'groundTruth.penId', errors);

  const schemaBubbleIds = new Set(
    schema?.questions.flatMap((question) =>
      question.bubbles.map((bubble) => bubble.id),
    ) ?? [],
  );
  if (!Array.isArray(candidate.bubbles)) {
    errors.push({
      path: 'groundTruth.bubbles',
      code: 'required_array',
      message: 'must declare physical truth for every schema bubble.',
    });
  } else {
    const seenBubbleIds = new Set<string>();
    const physicalCoverageClasses = new Set([
      'empty',
      '40-percent',
      '70-percent',
      'full',
    ]);
    const detectorClasses = new Set([
      'unfilled',
      'uncertain-allowed',
      'filled',
    ]);
    candidate.bubbles.forEach((bubble, index) => {
      const path = `groundTruth.bubbles[${index}]`;
      if (!isRecord(bubble)) {
        errors.push({
          path,
          code: 'required_object',
          message: 'must be per-bubble physical truth.',
        });
        return;
      }
      if (hasRequiredString(bubble.bubbleId, `${path}.bubbleId`, errors)) {
        const bubbleId = bubble.bubbleId as string;
        if (!schemaBubbleIds.has(bubbleId)) {
          errors.push({
            path: `${path}.bubbleId`,
            code: 'unknown_ground_truth_bubble_id',
            message: `does not identify a bubble in the schema: "${bubbleId}".`,
          });
        }
        if (seenBubbleIds.has(bubbleId)) {
          errors.push({
            path: `${path}.bubbleId`,
            code: 'duplicate_ground_truth_bubble_id',
            message: `repeats "${bubbleId}".`,
          });
        }
        seenBubbleIds.add(bubbleId);
      }
      if (!physicalCoverageClasses.has(bubble.physicalCoverage as string)) {
        errors.push({
          path: `${path}.physicalCoverage`,
          code: 'unsupported_physical_coverage',
          message: 'must be "empty", "40-percent", "70-percent", or "full".',
        });
      }
      if (!detectorClasses.has(bubble.expectedDetectorClass as string)) {
        errors.push({
          path: `${path}.expectedDetectorClass`,
          code: 'unsupported_expected_detector_class',
          message: 'must be "unfilled", "uncertain-allowed", or "filled".',
        });
      }
      if (bubble.correctionState !== 'none') {
        errors.push({
          path: `${path}.correctionState`,
          code: 'unsupported_correction_state',
          message: 'must be "none" for this sprint.',
        });
      }
    });
    if (
      schema &&
      seenBubbleIds.size !== schemaBubbleIds.size
    ) {
      errors.push({
        path: 'groundTruth.bubbles',
        code: 'incomplete_ground_truth_bubbles',
        message: `must declare exactly ${schemaBubbleIds.size} schema bubbles.`,
      });
    }
  }

  const schemaQuestions = new Map(
    schema?.questions.map((question) => [question.id, question]) ?? [],
  );
  if (!Array.isArray(candidate.questions)) {
    errors.push({
      path: 'groundTruth.questions',
      code: 'required_array',
      message: 'must declare an expected selected set for every question.',
    });
  } else {
    const seenQuestionIds = new Set<string>();
    candidate.questions.forEach((question, index) => {
      const path = `groundTruth.questions[${index}]`;
      if (!isRecord(question)) {
        errors.push({
          path,
          code: 'required_object',
          message: 'must be per-question ground truth.',
        });
        return;
      }
      const questionIdValid = hasRequiredString(
        question.questionId,
        `${path}.questionId`,
        errors,
      );
      const questionId = questionIdValid ? question.questionId as string : null;
      const schemaQuestion = questionId ? schemaQuestions.get(questionId) : null;
      if (questionId && !schemaQuestion) {
        errors.push({
          path: `${path}.questionId`,
          code: 'unknown_ground_truth_question_id',
          message: `does not identify a question in the schema: "${questionId}".`,
        });
      }
      if (questionId && seenQuestionIds.has(questionId)) {
        errors.push({
          path: `${path}.questionId`,
          code: 'duplicate_ground_truth_question_id',
          message: `repeats "${questionId}".`,
        });
      }
      if (questionId) seenQuestionIds.add(questionId);

      if (!Array.isArray(question.expectedSelectedBubbleIds)) {
        errors.push({
          path: `${path}.expectedSelectedBubbleIds`,
          code: 'required_array',
          message: 'must be an array of bubble ids from this question.',
        });
        return;
      }
      const questionBubbleIds = new Set(
        schemaQuestion?.bubbles.map((bubble) => bubble.id) ?? [],
      );
      const selectedIds = new Set<string>();
      question.expectedSelectedBubbleIds.forEach((bubbleId, bubbleIndex) => {
        const bubblePath = `${path}.expectedSelectedBubbleIds[${bubbleIndex}]`;
        if (!hasRequiredString(bubbleId, bubblePath, errors)) return;
        const id = bubbleId as string;
        if (!questionBubbleIds.has(id)) {
          errors.push({
            path: bubblePath,
            code: 'unknown_ground_truth_selected_bubble_id',
            message: `does not identify a bubble in question "${questionId ?? ''}": "${id}".`,
          });
        }
        if (selectedIds.has(id)) {
          errors.push({
            path: bubblePath,
            code: 'duplicate_ground_truth_selected_bubble_id',
            message: `repeats "${id}".`,
          });
        }
        selectedIds.add(id);
      });
    });
    if (schema && seenQuestionIds.size !== schemaQuestions.size) {
      errors.push({
        path: 'groundTruth.questions',
        code: 'incomplete_ground_truth_questions',
        message: `must declare exactly ${schemaQuestions.size} schema questions.`,
      });
    }
  }
}

export function validateEvidenceSessionInput(
  candidate: unknown,
): EvidenceSessionValidationResult {
  const errors: EvidenceSessionValidationError[] = [];
  if (!isRecord(candidate)) {
    return {
      valid: false,
      errors: [{
        path: '$',
        code: 'required_object',
        message: 'evidence session must be an object.',
      }],
      input: null,
    };
  }

  if (candidate.contractVersion !== EVIDENCE_SESSION_CONTRACT_VERSION) {
    errors.push({
      path: 'contractVersion',
      code: 'unsupported_evidence_session_version',
      message: `must equal ${EVIDENCE_SESSION_CONTRACT_VERSION}.`,
    });
  }
  hasRequiredString(candidate.sessionId, 'sessionId', errors);
  validateTemplate(candidate.template, errors);
  validateDetectorConfig(candidate.detectorConfig, errors);

  if (!Array.isArray(candidate.frames)) {
    errors.push({
      path: 'frames',
      code: 'required_array',
      message: 'must be an array of registered canonical frames.',
    });
  } else {
    if (candidate.frames.length === 0) {
      errors.push({
        path: 'frames',
        code: 'credible_frame_required',
        message: 'must contain one credible registered frame.',
      });
    }
    if (candidate.frames.length > 1) {
      errors.push({
        path: 'frames',
        code: 'multi_frame_aggregation_not_implemented',
        message:
          'contract v1 freezes the single-frame baseline; multi-frame aggregation belongs to ticket 12.',
      });
    }
  }

  const template = isRecord(candidate.template) ? candidate.template : null;
  const styleIds = new Set<string>(
    template && Array.isArray(template.correctionBoxStyleIds)
      ? template.correctionBoxStyleIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  );
  const frameIds = new Set<string>();
  const frame = Array.isArray(candidate.frames) && candidate.frames.length > 0
    ? candidate.frames[0]
    : null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;
  let imageDataValid = false;

  if (Array.isArray(candidate.frames)) {
    candidate.frames.forEach((frameCandidate, frameIndex) => {
      const path = `frames[${frameIndex}]`;
      if (!isRecord(frameCandidate)) {
        errors.push({
          path,
          code: 'required_object',
          message: 'must be a registered canonical frame.',
        });
        return;
      }
      if (hasRequiredString(frameCandidate.frameId, `${path}.frameId`, errors)) {
        const frameId = frameCandidate.frameId as string;
        if (frameIds.has(frameId)) {
          errors.push({
            path: `${path}.frameId`,
            code: 'duplicate_frame_id',
            message: `repeats "${frameId}".`,
          });
        }
        frameIds.add(frameId);
      }
      if (!isNonNegativeInteger(frameCandidate.sequence)) {
        errors.push({
          path: `${path}.sequence`,
          code: 'invalid_frame_sequence',
          message: 'must be a non-negative integer.',
        });
      }
      if (!isFiniteNumber(frameCandidate.capturedAtMs) || frameCandidate.capturedAtMs < 0) {
        errors.push({
          path: `${path}.capturedAtMs`,
          code: 'invalid_frame_timestamp',
          message: 'must be a finite non-negative number.',
        });
      }
      if (
        !isRecord(frameCandidate.registration) ||
        frameCandidate.registration.status !== 'registered' ||
        frameCandidate.registration.coordinateSystem !== 'canonical-crop-pixels'
      ) {
        errors.push({
          path: `${path}.registration`,
          code: 'registered_canonical_frame_required',
          message:
            'must declare status "registered" in "canonical-crop-pixels".',
        });
      }
      if (
        !isRecord(frameCandidate.quality) ||
        frameCandidate.quality.status !== 'credible' ||
        !Array.isArray(frameCandidate.quality.reasonCodes) ||
        frameCandidate.quality.reasonCodes.length !== 0
      ) {
        errors.push({
          path: `${path}.quality`,
          code: 'credible_frame_required',
          message:
            'contract v1 accepts a credible frame with no new quality exclusion.',
        });
      }
      if (!isRecord(frameCandidate.canonicalImage)) {
        errors.push({
          path: `${path}.canonicalImage`,
          code: 'required_object',
          message: 'must be a grayscale canonical image.',
        });
      } else {
        if (!isPositiveInteger(frameCandidate.canonicalImage.width)) {
          errors.push({
            path: `${path}.canonicalImage.width`,
            code: 'invalid_image_dimension',
            message: 'must be a positive integer.',
          });
        }
        if (!isPositiveInteger(frameCandidate.canonicalImage.height)) {
          errors.push({
            path: `${path}.canonicalImage.height`,
            code: 'invalid_image_dimension',
            message: 'must be a positive integer.',
          });
        }
        if (!(frameCandidate.canonicalImage.data instanceof Uint8Array)) {
          errors.push({
            path: `${path}.canonicalImage.data`,
            code: 'invalid_pixel_data',
            message: 'must be a Uint8Array.',
          });
        } else if (
          isPositiveInteger(frameCandidate.canonicalImage.width) &&
          isPositiveInteger(frameCandidate.canonicalImage.height)
        ) {
          const expectedLength =
            frameCandidate.canonicalImage.width *
            frameCandidate.canonicalImage.height;
          if (frameCandidate.canonicalImage.data.length !== expectedLength) {
            errors.push({
              path: `${path}.canonicalImage.data`,
              code: 'pixel_data_length_mismatch',
              message: `must contain exactly ${expectedLength} bytes.`,
            });
          } else if (frameIndex === 0) {
            imageDataValid = true;
          }
        }
        if (frameIndex === 0) {
          imageWidth = isPositiveInteger(frameCandidate.canonicalImage.width)
            ? frameCandidate.canonicalImage.width
            : null;
          imageHeight = isPositiveInteger(frameCandidate.canonicalImage.height)
            ? frameCandidate.canonicalImage.height
            : null;
        }
      }
    });
  }

  let schema: BubbleGradingSchema | null = null;
  if (frame && isRecord(frame) && imageWidth !== null && imageHeight !== null) {
    const schemaValidation = validateBubbleGradingSchema(candidate.schema, {
      inputImage: { width: imageWidth, height: imageHeight },
    });
    if (!schemaValidation.valid) {
      addSchemaErrors(errors, schemaValidation.errors);
    } else if (schemaValidation.schema.canonicalImage.dimensions.status !== 'fixed') {
      errors.push({
        path: 'schema.canonicalImage.dimensions.status',
        code: 'fixed_dimensions_required_for_analysis',
        message: 'must be "fixed" before evidence-session analysis can run.',
      });
    } else {
      schema = schemaValidation.schema;
    }
  } else if (!isRecord(candidate.schema)) {
    errors.push({
      path: 'schema',
      code: 'required_object',
      message: 'must be a bubble-grading schema.',
    });
  }

  const bubbleIds = new Set(
    schema?.questions.flatMap((question) =>
      question.bubbles.map((bubble) => bubble.id),
    ) ?? [],
  );
  if (Array.isArray(candidate.frames)) {
    candidate.frames.forEach((frameCandidate, frameIndex) => {
      if (!isRecord(frameCandidate)) return;
      validateCorrectionBoxes(
        frameCandidate.correctionBoxes,
        `frames[${frameIndex}]`,
        imageWidth,
        imageHeight,
        bubbleIds,
        styleIds,
        errors,
      );
    });
  }
  validateGroundTruth(candidate.groundTruth, schema, styleIds, errors);

  if (
    errors.length > 0 ||
    !schema ||
    !imageDataValid
  ) {
    return { valid: false, errors, input: null };
  }
  return {
    valid: true,
    errors: [],
    input: {
      ...(candidate as unknown as EvidenceSessionInput),
      schema,
    },
  };
}

function nowMilliseconds() {
  'worklet';
  return globalThis.performance?.now() ?? Date.now();
}

function roundedMilliseconds(value: number) {
  'worklet';
  return Number(value.toFixed(3));
}

function detectorConfigSnapshot(
  config: BubbleDetectorConfig,
): BubbleDetectorConfig {
  'worklet';
  return {
    formatVersion: config.formatVersion,
    id: config.id,
    provisional: config.provisional,
    darkPixelDelta: config.darkPixelDelta,
    unfilledMaxDarkPixelRatio: config.unfilledMaxDarkPixelRatio,
    filledMinDarkPixelRatio: config.filledMinDarkPixelRatio,
    minimumBackgroundBrightness: config.minimumBackgroundBrightness,
    minimumMarkedContrast: config.minimumMarkedContrast,
    minimumFocusScore: config.minimumFocusScore,
  };
}

function categorizedReasons(
  frameId: string,
  analysis: BubbleAnalysisResult,
): CategorizedEvidenceReason[] {
  'worklet';
  return analysis.bubbles.flatMap((bubble) =>
    bubble.reasonCodes.map((code) => ({
      category: LEGACY_BUBBLE_REASON_CATEGORIES[code],
      code,
      scope: 'bubble' as const,
      frameId,
      questionId: bubble.questionId,
      bubbleId: bubble.bubbleId,
    })),
  );
}

/**
 * Sole behavioral seam for already validated mobile and replay inputs.
 *
 * Contract v1 intentionally freezes the one-frame baseline. Ticket 12 may
 * replace the combination strategy here, while callers continue to use this
 * function and exact-set grading remains in `gradeBubbleDiagnostics`.
 */
export function analyzeValidatedEvidenceSession(
  input: EvidenceSessionInput,
  options: BubbleAnalysisOptions = {},
): EvidenceSessionAnalysisResult {
  'worklet';
  const startedAt = options.recordTiming ? nowMilliseconds() : null;
  const frame = input.frames[0];
  const analysis = analyzeValidatedBubbleGradingImage(
    input.schema,
    frame.canonicalImage,
    input.detectorConfig,
    options,
  );
  const correctionBoxes = (frame.correctionBoxes ?? []).map((box) => ({
    bubbleId: box.bubbleId,
    styleId: box.styleId,
    boundsPx: { ...box.boundsPx },
    pixelFormat: box.pixels.pixelFormat,
    width: box.pixels.width,
    height: box.pixels.height,
    byteLength: box.pixels.data.length,
  }));

  return {
    contractVersion: EVIDENCE_SESSION_CONTRACT_VERSION,
    diagnosticFormatVersion: EVIDENCE_SESSION_DIAGNOSTIC_FORMAT_VERSION,
    reasonCategoryFormatVersion: EVIDENCE_REASON_CATEGORY_FORMAT_VERSION,
    sessionId: input.sessionId,
    schema: {
      formatVersion: input.schema.formatVersion,
      testId: input.schema.test.id,
      testVersion: input.schema.test.version,
    },
    template: {
      id: input.template.id,
      version: input.template.version,
      correctionBoxStyleIds: [...input.template.correctionBoxStyleIds],
    },
    detectorConfig: detectorConfigSnapshot(input.detectorConfig),
    groundTruth: input.groundTruth
      ? {
          formatVersion: input.groundTruth.formatVersion,
          fixtureId: input.groundTruth.fixtureId,
          layout: { ...input.groundTruth.layout },
          template: { ...input.groundTruth.template },
          printerId: input.groundTruth.printerId,
          penId: input.groundTruth.penId,
          bubbles: input.groundTruth.bubbles.map((bubble) => ({ ...bubble })),
          questions: input.groundTruth.questions.map((question) => ({
            questionId: question.questionId,
            expectedSelectedBubbleIds: [
              ...question.expectedSelectedBubbleIds,
            ],
          })),
        }
      : null,
    frames: [{
      frameId: frame.frameId,
      sequence: frame.sequence,
      capturedAtMs: frame.capturedAtMs,
      registration: { ...frame.registration },
      quality: { status: 'credible', reasonCodes: [] },
      correctionBoxes,
      analysis,
      reasons: categorizedReasons(frame.frameId, analysis),
    }],
    combined: {
      strategy: 'single-frame-baseline-v1',
      contributingFrameIds: [frame.frameId],
      scan: analysis.scan,
      bubbles: analysis.bubbles,
      questions: analysis.questions,
      score: analysis.score,
    },
    quality: {
      status: 'credible',
      eligibleFrameIds: [frame.frameId],
      excludedFrames: [],
      reasons: [],
    },
    disagreement: {
      status: 'none',
      bubbleIds: [],
      questionIds: [],
      reasons: [],
    },
    bestVisualReference: { frameId: frame.frameId },
    timings: {
      durationMs:
        startedAt === null
          ? null
          : roundedMilliseconds(nowMilliseconds() - startedAt),
      frameAnalysisDurationMs: analysis.scan.timing.durationMs,
    },
  };
}

export function analyzeEvidenceSession(
  candidate: unknown,
  options: BubbleAnalysisOptions = {},
): EvidenceSessionAnalysisResult {
  const validation = validateEvidenceSessionInput(candidate);
  if (!validation.valid) {
    throw new EvidenceSessionValidationFailure(validation.errors);
  }
  return analyzeValidatedEvidenceSession(validation.input, options);
}

export function formatEvidenceSessionValidationErrors(
  errors: readonly EvidenceSessionValidationError[],
) {
  return errors
    .map((error) => `${error.path}: ${error.message} [${error.code}]`)
    .join('\n');
}
