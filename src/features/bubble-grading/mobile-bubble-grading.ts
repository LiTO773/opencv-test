import {
  PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
  type BubbleAnalysisResult,
  type BubbleReasonCode,
  type GrayscaleImage,
} from './bubble-analysis';
import { runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';
import { hardcodedBubbleGradingSchema } from './hardcoded-schema';
import {
  validateBubbleGradingSchema,
  type SchemaValidationError,
} from './schema-validator';
import {
  analyzeEvidenceSession,
  analyzeValidatedEvidenceSession,
  EVIDENCE_SESSION_CONTRACT_VERSION,
  EvidenceSessionValidationFailure,
  type EvidenceSessionAnalysisResult,
  type EvidenceSessionInput,
} from './evidence-session';
import { readQrPayloadId } from '../four-point/qr-reader';
import type { QrMetadata } from '../four-point/types';

export type MobileScanDiagnostics = {
  studentId: string | null;
  sheetId: string | null;
  testId: string | null;
  schemaVersion: string | null;
};

export type MobileGradingFailure = {
  kind: 'schema_validation' | 'analysis';
  message: string;
  validationErrors: SchemaValidationError[];
};

export type MobileGradingOutcome =
  | {
      status: 'graded';
      scanDiagnostics: MobileScanDiagnostics;
      result: BubbleAnalysisResult;
      evidenceSession: EvidenceSessionAnalysisResult;
    }
  | {
      status: 'failed';
      scanDiagnostics: MobileScanDiagnostics;
      failure: MobileGradingFailure;
    };

export type MobileScoreSummary = BubbleAnalysisResult['score'] & {
  provisional: boolean;
  reviewReasonCodes: BubbleReasonCode[];
};

const REVIEW_REASON_CODES = new Set<BubbleReasonCode>([
  'fill_score_in_uncertain_band',
  'poor_local_contrast',
  'excessive_blur',
  'measurement_region_incomplete',
]);

function singleFrameEvidenceSessionInput(
  schema: EvidenceSessionInput['schema'],
  image: GrayscaleImage,
  scanDiagnostics: MobileScanDiagnostics,
): EvidenceSessionInput {
  'worklet';
  return {
    contractVersion: EVIDENCE_SESSION_CONTRACT_VERSION,
    sessionId: scanDiagnostics.sheetId ?? 'mobile-single-frame-session',
    schema,
    template: {
      id: schema.test.id,
      version: schema.test.version,
      correctionBoxStyleIds: [],
    },
    detectorConfig: PROVISIONAL_BUBBLE_DETECTOR_CONFIG,
    frames: [{
      frameId: 'mobile-canonical-frame-0',
      sequence: 0,
      capturedAtMs: 0,
      registration: {
        status: 'registered',
        coordinateSystem: 'canonical-crop-pixels',
      },
      quality: { status: 'credible', reasonCodes: [] },
      canonicalImage: image,
    }],
  };
}

function legacyResultFromEvidenceSession(
  evidenceSession: EvidenceSessionAnalysisResult,
): BubbleAnalysisResult {
  'worklet';
  const frameAnalysis = evidenceSession.frames[0].analysis;
  return {
    diagnosticFormatVersion: frameAnalysis.diagnosticFormatVersion,
    detector: frameAnalysis.detector,
    scan: evidenceSession.combined.scan,
    bubbles: evidenceSession.combined.bubbles,
    questions: evidenceSession.combined.questions,
    score: evidenceSession.combined.score,
  };
}

export function readMobileScanDiagnostics(qr: QrMetadata | null): MobileScanDiagnostics {
  return {
    studentId: qr ? readQrPayloadId(qr, 'studentId') : null,
    sheetId: qr ? readQrPayloadId(qr, 'sheetId') : null,
    testId: qr ? readQrPayloadId(qr, 'testId') : null,
    schemaVersion: qr ? readQrPayloadId(qr, 'schemaVersion') : null,
  };
}

export function createMobileGradingFailure(
  qr: QrMetadata | null,
  message: string,
): MobileGradingOutcome {
  return {
    status: 'failed',
    scanDiagnostics: readMobileScanDiagnostics(qr),
    failure: {
      kind: 'analysis',
      message,
      validationErrors: [],
    },
  };
}

/** Converts an opaque Skia RGBA readback into the shared one-byte grayscale seam. */
export function rgbaPixelsToGrayscaleImage(
  rgba: Uint8Array,
  width: number,
  height: number,
): GrayscaleImage {
  'worklet';
  const expectedLength = width * height * 4;
  if (rgba.byteLength !== expectedLength) {
    throw new Error(
      `Esperados ${expectedLength} bytes RGBA, mas foram recebidos ${rgba.byteLength}.`,
    );
  }

  const data = new Uint8Array(width * height);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4) {
    data[targetIndex] = Math.round(
      rgba[sourceIndex] * 0.2126 +
        rgba[sourceIndex + 1] * 0.7152 +
        rgba[sourceIndex + 2] * 0.0722,
    );
    targetIndex += 1;
  }
  return { width, height, data };
}

/** Runs the full-page grayscale conversion and ROI analyzer away from the RN runtime. */
export async function analyzeMobileBubbleGradingImageOnRuntime(
  runtime: WorkletRuntime,
  rgba: Uint8Array,
  width: number,
  height: number,
  qr: QrMetadata | null,
): Promise<MobileGradingOutcome> {
  const scanDiagnostics = readMobileScanDiagnostics(qr);
  const validation = validateBubbleGradingSchema(hardcodedBubbleGradingSchema, {
    inputImage: { width, height },
  });
  if (!validation.valid) {
    return {
      status: 'failed',
      scanDiagnostics,
      failure: {
        kind: 'schema_validation',
        message: 'O esquema fixo ou as dimensões da imagem canónica não são válidos.',
        validationErrors: validation.errors,
      },
    };
  }

  try {
    const result = await runOnRuntimeAsync(
      runtime,
      (
        workerRgba: Uint8Array,
        workerWidth: number,
        workerHeight: number,
        schema: typeof validation.schema,
        workerScanDiagnostics: MobileScanDiagnostics,
      ) => {
        'worklet';
        const grayscale = rgbaPixelsToGrayscaleImage(workerRgba, workerWidth, workerHeight);
        return analyzeValidatedEvidenceSession(
          singleFrameEvidenceSessionInput(
            schema,
            grayscale,
            workerScanDiagnostics,
          ),
          { recordTiming: true },
        );
      },
      rgba,
      width,
      height,
      validation.schema,
      scanDiagnostics,
    );
    return {
      status: 'graded',
      scanDiagnostics,
      result: legacyResultFromEvidenceSession(result),
      evidenceSession: result,
    };
  } catch (caught) {
    return createMobileGradingFailure(
      qr,
      caught instanceof Error ? caught.message : String(caught),
    );
  }
}

/**
 * Mobile entry point for the same deterministic analyzer used by the offline
 * workbench. QR metadata is diagnostic-only and never selects or rejects a schema.
 */
export function analyzeMobileBubbleGradingImage(
  image: GrayscaleImage,
  qr: QrMetadata | null,
): MobileGradingOutcome {
  const scanDiagnostics = readMobileScanDiagnostics(qr);
  const validation = validateBubbleGradingSchema(hardcodedBubbleGradingSchema, {
    inputImage: { width: image.width, height: image.height },
  });
  if (!validation.valid) {
    return {
      status: 'failed',
      scanDiagnostics,
      failure: {
        kind: 'schema_validation',
        message: 'O esquema fixo ou as dimensões da imagem canónica não são válidos.',
        validationErrors: validation.errors,
      },
    };
  }

  try {
    const evidenceSession = analyzeEvidenceSession(
      singleFrameEvidenceSessionInput(
        validation.schema,
        image,
        scanDiagnostics,
      ),
      { recordTiming: true },
    );
    return {
      status: 'graded',
      scanDiagnostics,
      result: legacyResultFromEvidenceSession(evidenceSession),
      evidenceSession,
    };
  } catch (caught) {
    if (caught instanceof EvidenceSessionValidationFailure) {
      return {
        status: 'failed',
        scanDiagnostics,
        failure: {
          kind: 'schema_validation',
          message: caught.message,
          validationErrors: [...caught.validationErrors],
        },
      };
    }
    return {
      status: 'failed',
      scanDiagnostics,
      failure: {
        kind: 'analysis',
        message: caught instanceof Error ? caught.message : String(caught),
        validationErrors: [],
      },
    };
  }
}

export function buildMobileScoreSummary(result: BubbleAnalysisResult): MobileScoreSummary {
  const reviewReasonCodes = result.scan.reasonCodes.filter((reason) =>
    REVIEW_REASON_CODES.has(reason),
  );
  return {
    ...result.score,
    provisional:
      result.score.pendingReviewPoints > 0 || reviewReasonCodes.length > 0,
    reviewReasonCodes,
  };
}
