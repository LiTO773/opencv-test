import type {
  BubbleDiagnostic,
  BubbleReasonCode,
  QuestionDecisionReason,
} from './bubble-analysis';
import { CANONICAL_CROP_CONTRACT } from './canonical-crop-contract';
import type {
  MobileGradingOutcome,
  MobileScanDiagnostics,
} from './mobile-bubble-grading';
import type { ImageDimensions } from './schema-validator';

export type DiagnosticReason = {
  code: string;
  explanation: string;
};

export type BubbleDiagnosticRecord = Omit<BubbleDiagnostic, 'reasonCodes'> & {
  blurEvidence: {
    focusScore: number;
    minimumFocusScore: number;
    passesMinimum: boolean;
  };
  reasons: DiagnosticReason[];
};

export type QuestionDiagnosticRecord = {
  questionId: string;
  label: string;
  detectedBubbleIds: string[];
  correctBubbleIds: string[];
  exactSetMatch: boolean;
  status: 'correct' | 'incorrect' | 'needs_review';
  awardedPoints: number;
  pendingPoints: number;
  maximumPoints: number;
  confidence: number;
  reasons: DiagnosticReason[];
  contributingBubbleReasons: {
    bubbleId: string;
    reasons: DiagnosticReason[];
  }[];
};

export type MobileGradingDiagnosticRecord = {
  status: MobileGradingOutcome['status'];
  scan: {
    canonicalDimensions: {
      expected: ImageDimensions;
      measured: ImageDimensions;
      matchesExpected: boolean;
    };
    qrMetadata: MobileScanDiagnostics;
    detector: { id: string; provisional: true } | null;
    globalQuality: {
      averageBackgroundBrightness: number;
      minimumFocusScore: number;
      decisionCounts: { filled: number; unfilled: number; uncertain: number };
    } | null;
    totalAnalysisTimeMs: number | null;
    bubbleCount: number;
    reviewReasons: DiagnosticReason[];
  };
  bubbles: BubbleDiagnosticRecord[];
  questions: QuestionDiagnosticRecord[];
  failure: {
    kind: 'schema_validation' | 'analysis';
    message: string;
    validationErrors: { code: string; path: string; message: string }[];
  } | null;
};

export const BUBBLE_REASON_EXPLANATIONS: Record<BubbleReasonCode, string> = {
  center_adjusted:
    'O centro medido foi ajustado dentro da tolerância local declarada pelo esquema.',
  fill_score_in_uncertain_band:
    'A proporção de píxeis escuros ficou entre os limites provisórios de vazia e preenchida.',
  poor_local_contrast:
    'O papel local é demasiado escuro ou a marca não contrasta suficientemente com o fundo.',
  excessive_blur:
    'A evidência de foco desta região ficou abaixo do limite provisório de nitidez.',
  measurement_region_incomplete:
    'Pelo menos uma região de medição ficou incompleta ou não forneceu píxeis suficientes.',
};

function bubbleReason(code: BubbleReasonCode): DiagnosticReason {
  return { code, explanation: BUBBLE_REASON_EXPLANATIONS[code] };
}

function questionReason(reason: QuestionDecisionReason): DiagnosticReason {
  switch (reason.code) {
    case 'exact_match':
      return {
        code: reason.code,
        explanation: 'As seleções detetadas coincidem exatamente com o conjunto correto.',
      };
    case 'blank_response':
      return {
        code: reason.code,
        explanation: 'Não foi detetada nenhuma seleção preenchida nem incerta.',
      };
    case 'missing_selection':
      return {
        code: reason.code,
        explanation: `Faltam seleções corretas confirmadas: ${reason.bubbleIds.join(', ')}.`,
      };
    case 'extra_selection':
      return {
        code: reason.code,
        explanation: `Existem seleções extra claramente preenchidas: ${reason.bubbleIds.join(', ')}.`,
      };
    case 'uncertain_bubbles_could_change_outcome':
      return {
        code: reason.code,
        explanation: `Medições incertas podem alterar a comparação exata: ${reason.bubbles
          .map((bubble) => bubble.bubbleId)
          .join(', ')}.`,
      };
  }
}

function exactSetMatch(actual: string[], expected: string[]) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return (
    actualSet.size === expectedSet.size &&
    [...actualSet].every((bubbleId) => expectedSet.has(bubbleId))
  );
}

function buildBubbleRecord(bubble: BubbleDiagnostic): BubbleDiagnosticRecord {
  return {
    questionId: bubble.questionId,
    bubbleId: bubble.bubbleId,
    expectedCenterPx: { ...bubble.expectedCenterPx },
    measuredCenterPx: { ...bubble.measuredCenterPx },
    centerAdjustmentPx: { ...bubble.centerAdjustmentPx },
    measurementRadii: { ...bubble.measurementRadii },
    interiorBrightness: bubble.interiorBrightness,
    backgroundBrightness: bubble.backgroundBrightness,
    darkPixelRatio: bubble.darkPixelRatio,
    contrast: bubble.contrast,
    focusScore: bubble.focusScore,
    blurEvidence: {
      focusScore: bubble.focusScore,
      minimumFocusScore: bubble.thresholds.minimumFocusScore,
      passesMinimum: bubble.focusScore >= bubble.thresholds.minimumFocusScore,
    },
    thresholds: { ...bubble.thresholds },
    confidence: bubble.confidence,
    decision: bubble.decision,
    timing: { ...bubble.timing },
    reasons: bubble.reasonCodes.map(bubbleReason),
  };
}

export function buildMobileGradingDiagnosticRecord(
  outcome: MobileGradingOutcome,
  measuredImage: ImageDimensions,
): MobileGradingDiagnosticRecord {
  const expected = {
    width: CANONICAL_CROP_CONTRACT.widthPx,
    height: CANONICAL_CROP_CONTRACT.heightPx,
  };
  const commonScan = {
    canonicalDimensions: {
      expected,
      measured: { ...measuredImage },
      matchesExpected:
        measuredImage.width === expected.width &&
        measuredImage.height === expected.height,
    },
    qrMetadata: { ...outcome.scanDiagnostics },
  };

  if (outcome.status === 'failed') {
    return {
      status: 'failed',
      scan: {
        ...commonScan,
        detector: null,
        globalQuality: null,
        totalAnalysisTimeMs: null,
        bubbleCount: 0,
        reviewReasons: [],
      },
      bubbles: [],
      questions: [],
      failure: {
        kind: outcome.failure.kind,
        message: outcome.failure.message,
        validationErrors: outcome.failure.validationErrors.map((error) => ({ ...error })),
      },
    };
  }

  const bubbles = outcome.result.bubbles.map(buildBubbleRecord);
  const bubblesByQuestion = new Map<string, BubbleDiagnosticRecord[]>();
  for (const bubble of bubbles) {
    const questionBubbles = bubblesByQuestion.get(bubble.questionId) ?? [];
    questionBubbles.push(bubble);
    bubblesByQuestion.set(bubble.questionId, questionBubbles);
  }

  return {
    status: 'graded',
    scan: {
      ...commonScan,
      detector: { ...outcome.result.detector },
      globalQuality: {
        averageBackgroundBrightness:
          outcome.result.scan.averageBackgroundBrightness,
        minimumFocusScore: outcome.result.scan.minimumFocusScore,
        decisionCounts: { ...outcome.result.scan.decisionCounts },
      },
      totalAnalysisTimeMs: outcome.result.scan.timing.durationMs,
      bubbleCount: outcome.result.scan.bubbleCount,
      reviewReasons: outcome.result.scan.reasonCodes.map(bubbleReason),
    },
    bubbles,
    questions: outcome.result.questions.map((question) => ({
      questionId: question.questionId,
      label: question.label,
      detectedBubbleIds: [...question.detectedFilledBubbleIds],
      correctBubbleIds: [...question.correctBubbleIds],
      exactSetMatch: exactSetMatch(
        question.detectedFilledBubbleIds,
        question.correctBubbleIds,
      ),
      status: question.status,
      awardedPoints: question.awardedPoints,
      pendingPoints: question.pendingPoints,
      maximumPoints: question.maximumPoints,
      confidence: question.confidence,
      reasons: question.reasons.map(questionReason),
      contributingBubbleReasons: (bubblesByQuestion.get(question.questionId) ?? [])
        .filter((bubble) => bubble.reasons.length > 0)
        .map((bubble) => ({
          bubbleId: bubble.bubbleId,
          reasons: bubble.reasons.map((reason) => ({ ...reason })),
        })),
    })),
    failure: null,
  };
}
