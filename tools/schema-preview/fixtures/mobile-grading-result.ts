import type {
  BubbleAnalysisResult,
  BubbleDiagnostic,
} from '../../../src/features/bubble-grading/bubble-analysis';

function bubbleFixture(
  questionId: string,
  bubbleId: string,
  decision: BubbleDiagnostic['decision'],
  reasonCodes: BubbleDiagnostic['reasonCodes'] = [],
): BubbleDiagnostic {
  return {
    questionId,
    bubbleId,
    expectedCenterPx: { x: 100, y: 100 },
    measuredCenterPx: { x: 100, y: 100 },
    centerAdjustmentPx: { x: 0, y: 0, distance: 0 },
    measurementRadii: {
      roiRadiusPx: 16,
      printedBubbleRadiusPx: 10,
      printedOutlineWidthPx: 1.5,
      fillRadiusPx: 7,
      backgroundRingInnerRadiusPx: 12,
      backgroundRingOuterRadiusPx: 14,
      centerSearchTolerancePx: 2,
    },
    interiorBrightness: decision === 'filled' ? 0.2 : 0.7,
    backgroundBrightness: 0.94,
    darkPixelRatio: decision === 'filled' ? 0.8 : 0.35,
    contrast: decision === 'filled' ? 0.74 : 0.24,
    focusScore: decision === 'filled' ? 0.02 : 0.0005,
    confidence: decision === 'filled' ? 0.82 : 0.25,
    decision,
    reasonCodes,
    thresholds: {
      darkPixelDelta: 0.1,
      unfilledMaxDarkPixelRatio: 0.18,
      filledMinDarkPixelRatio: 0.52,
      minimumBackgroundBrightness: 0.45,
      minimumMarkedContrast: 0.08,
      minimumFocusScore: 0.0015,
    },
    timing: { durationMs: null, sampledPixelCount: 900 },
  };
}

/** Stable mobile-presentation fixture; it never invokes OpenCV or camera code. */
export const mobileGradingResultFixture: BubbleAnalysisResult = {
  diagnosticFormatVersion: 1,
  detector: {
    id: 'provisional-physical-calibration-required-v1',
    provisional: true,
  },
  scan: {
    image: { width: 875, height: 1280 },
    bubbleCount: 2,
    decisionCounts: { filled: 1, unfilled: 0, uncertain: 1 },
    averageBackgroundBrightness: 0.94,
    minimumFocusScore: 0.0005,
    reasonCodes: ['excessive_blur'],
    timing: { durationMs: null, analyzedRoiCount: 2, sampledPixelCount: 1800 },
  },
  bubbles: [
    bubbleFixture('q1', 'q1-a', 'filled'),
    bubbleFixture('q2', 'q2-b', 'uncertain', ['excessive_blur']),
  ],
  questions: [
    {
      questionId: 'q1',
      label: 'Question 1',
      selectionMode: 'single',
      maximumPoints: 2,
      detectedFilledBubbleIds: ['q1-a'],
      correctBubbleIds: ['q1-a'],
      status: 'correct',
      awardedPoints: 2,
      pendingPoints: 0,
      confidence: 0.82,
      reasons: [{ code: 'exact_match' }],
    },
    {
      questionId: 'q2',
      label: 'Question 2',
      selectionMode: 'multiple',
      maximumPoints: 3,
      detectedFilledBubbleIds: [],
      correctBubbleIds: ['q2-b'],
      status: 'needs_review',
      awardedPoints: 0,
      pendingPoints: 3,
      confidence: 0.25,
      reasons: [
        {
          code: 'uncertain_bubbles_could_change_outcome',
          bubbles: [{ bubbleId: 'q2-b', reasonCodes: ['excessive_blur'] }],
        },
      ],
    },
  ],
  score: {
    maximumPoints: 5,
    awardedGradedPoints: 2,
    pendingReviewPoints: 3,
    counts: { correct: 1, incorrect: 0, needs_review: 1 },
  },
};
