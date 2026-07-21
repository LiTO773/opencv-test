import type {
  BubbleAnalysisResult,
  BubbleDecision,
  BubbleReasonCode,
  QuestionDecision,
  QuestionDecisionReason,
} from './bubble-analysis';
import { hardcodedBubbleGradingSchema } from './hardcoded-schema';
import type { BubbleGradingSchema, PixelPoint } from './schema';

export type ReviewTone = 'success' | 'error' | 'warning' | 'subordinate';

export type MobileBubbleReview = {
  bubbleId: string;
  label: string;
  centerPx: PixelPoint;
  radiusPx: number;
  decision: BubbleDecision;
  tone: ReviewTone;
};

export type MobileQuestionReview = {
  questionId: string;
  label: string;
  selectionModeLabel: string;
  status: QuestionDecision;
  statusLabel: string;
  tone: Exclude<ReviewTone, 'subordinate'>;
  detectedAnswerLabels: string[];
  correctAnswerLabels: string[];
  awardedPoints: number;
  maximumPoints: number;
  pendingPoints: number;
  confidencePercent: number;
  reasonMessages: string[];
  reasonCodes: string[];
  bubbles: MobileBubbleReview[];
};

const BUBBLE_REASON_MESSAGES: Record<BubbleReasonCode, string> = {
  center_adjusted: 'A posição da marca foi ajustada localmente.',
  fill_score_in_uncertain_band: 'A marca está perto dos limites de classificação.',
  poor_local_contrast: 'A marca tem pouco contraste com o papel.',
  excessive_blur: 'A região da resposta está demasiado desfocada.',
  measurement_region_incomplete: 'A região de medição não ficou totalmente disponível.',
};

const QUESTION_STATUS: Record<
  QuestionDecision,
  { label: string; tone: Exclude<ReviewTone, 'subordinate'> }
> = {
  correct: { label: 'Correta', tone: 'success' },
  incorrect: { label: 'Incorreta', tone: 'error' },
  needs_review: { label: 'A rever', tone: 'warning' },
};

function answerLabels(ids: string[], labelsById: Map<string, string>) {
  return ids.map((id) => labelsById.get(id) ?? 'Resposta desconhecida');
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function explainReason(reason: QuestionDecisionReason) {
  switch (reason.code) {
    case 'exact_match':
      return {
        messages: ['A resposta coincide exatamente com a resposta correta.'],
        codes: [reason.code],
      };
    case 'blank_response':
      return { messages: ['Não foi detetada nenhuma resposta.'], codes: [reason.code] };
    case 'missing_selection':
      return { messages: ['Falta pelo menos uma seleção correta.'], codes: [reason.code] };
    case 'extra_selection':
      return { messages: ['Foi detetada pelo menos uma seleção extra.'], codes: [reason.code] };
    case 'uncertain_bubbles_could_change_outcome': {
      const bubbleReasonCodes = reason.bubbles.flatMap((bubble) => bubble.reasonCodes);
      return {
        messages: [
          'Marcas incertas podem alterar o resultado desta pergunta.',
          ...unique(bubbleReasonCodes).map((code) => BUBBLE_REASON_MESSAGES[code]),
        ],
        codes: [reason.code, ...bubbleReasonCodes],
      };
    }
  }
}

function bubbleTone(
  decision: BubbleDecision,
  bubbleId: string,
  correctBubbleIds: Set<string>,
): ReviewTone {
  if (decision === 'uncertain') return 'warning';
  if (decision === 'unfilled') return 'subordinate';
  return correctBubbleIds.has(bubbleId) ? 'success' : 'error';
}

/**
 * Converts the shared diagnostic contract into display-only, human-labelled
 * mobile review data. No grading decisions or source diagnostics are changed.
 */
export function buildMobileQuestionReview(
  result: BubbleAnalysisResult,
  schema: BubbleGradingSchema = hardcodedBubbleGradingSchema,
): MobileQuestionReview[] {
  const questionsById = new Map(
    result.questions.map((question) => [question.questionId, question]),
  );
  const diagnosticsByBubbleId = new Map(
    result.bubbles.map((bubble) => [bubble.bubbleId, bubble]),
  );

  return schema.questions.map((schemaQuestion) => {
    const question = questionsById.get(schemaQuestion.id);
    if (!question) throw new Error(`Missing grading result for question ${schemaQuestion.id}.`);

    const labelsById = new Map(schemaQuestion.bubbles.map((bubble) => [bubble.id, bubble.label]));
    const correctBubbleIds = new Set(question.correctBubbleIds);
    const explanations = question.reasons.map(explainReason);
    const status = QUESTION_STATUS[question.status];

    return {
      questionId: question.questionId,
      label: question.label,
      selectionModeLabel:
        question.selectionMode === 'single' ? 'Resposta única' : 'Várias respostas',
      status: question.status,
      statusLabel: status.label,
      tone: status.tone,
      detectedAnswerLabels: answerLabels(question.detectedFilledBubbleIds, labelsById),
      correctAnswerLabels: answerLabels(question.correctBubbleIds, labelsById),
      awardedPoints: question.awardedPoints,
      maximumPoints: question.maximumPoints,
      pendingPoints: question.pendingPoints,
      confidencePercent: Math.round(question.confidence * 100),
      reasonMessages: unique(explanations.flatMap((explanation) => explanation.messages)),
      reasonCodes: unique(explanations.flatMap((explanation) => explanation.codes)),
      bubbles: schemaQuestion.bubbles.map((bubble) => {
        const diagnostic = diagnosticsByBubbleId.get(bubble.id);
        if (!diagnostic) throw new Error(`Missing grading diagnostic for bubble ${bubble.id}.`);
        return {
          bubbleId: bubble.id,
          label: bubble.label,
          centerPx: bubble.centerPx,
          radiusPx: schema.bubbleStyle.radiusPx,
          decision: diagnostic.decision,
          tone: bubbleTone(diagnostic.decision, bubble.id, correctBubbleIds),
        };
      }),
    };
  });
}

export function scaledBubbleFrame(
  centerPx: PixelPoint,
  radiusPx: number,
  imageWidthPx: number,
  renderedWidth: number,
) {
  const scale = renderedWidth / imageWidthPx;
  return {
    left: (centerPx.x - radiusPx) * scale,
    top: (centerPx.y - radiusPx) * scale,
    width: radiusPx * 2 * scale,
    height: radiusPx * 2 * scale,
  };
}
