import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { BubbleAnalysisResult } from './bubble-analysis';
import {
  buildMobileQuestionReview,
  scaledBubbleFrame,
  type MobileBubbleReview,
  type MobileQuestionReview,
  type ReviewTone,
} from './mobile-question-review';

const REVIEW_COLORS: Record<
  Exclude<ReviewTone, 'subordinate'>,
  { border: string; background: string; text: string }
> = {
  success: { border: '#15803D', background: '#DCFCE7', text: '#166534' },
  error: { border: '#DC2626', background: '#FEE2E2', text: '#991B1B' },
  warning: { border: '#D97706', background: '#FEF3C7', text: '#92400E' },
};

function answerText(labels: string[]) {
  return labels.length > 0 ? labels.join(', ') : 'Em branco';
}

function initialQuestionId(questions: MobileQuestionReview[]) {
  return (
    questions.find((question) => question.status === 'needs_review') ??
    questions.find((question) => question.status === 'incorrect') ??
    questions[0]
  )?.questionId;
}

function BubbleOverlay({
  bubble,
  imageWidth,
  renderedWidth,
  selected,
}: {
  bubble: MobileBubbleReview;
  imageWidth: number;
  renderedWidth: number;
  selected: boolean;
}) {
  const frame = scaledBubbleFrame(
    bubble.centerPx,
    bubble.radiusPx,
    imageWidth,
    renderedWidth,
  );
  const color =
    bubble.tone === 'subordinate'
      ? 'rgba(31, 41, 55, 0.38)'
      : REVIEW_COLORS[bubble.tone].border;
  return (
    <View
      style={[
        styles.bubbleOverlay,
        frame,
        {
          borderColor: color,
          borderWidth: selected ? 3 : 2,
          opacity: selected ? 1 : bubble.tone === 'subordinate' ? 0.42 : 0.72,
        },
      ]}
    />
  );
}

function SelectedQuestionRegion({
  imageWidth,
  question,
  renderedWidth,
}: {
  imageWidth: number;
  question: MobileQuestionReview;
  renderedWidth: number;
}) {
  const frames = question.bubbles.map((bubble) =>
    scaledBubbleFrame(bubble.centerPx, bubble.radiusPx, imageWidth, renderedWidth),
  );
  if (frames.length === 0) return null;
  const padding = 7;
  const left = Math.min(...frames.map((frame) => frame.left)) - padding;
  const top = Math.min(...frames.map((frame) => frame.top)) - padding;
  const right = Math.max(...frames.map((frame) => frame.left + frame.width)) + padding;
  const bottom = Math.max(...frames.map((frame) => frame.top + frame.height)) + padding;
  return (
    <View
      style={[
        styles.selectedQuestionRegion,
        { left, top, width: right - left, height: bottom - top },
      ]}
    />
  );
}

function QuestionCard({
  onLocate,
  question,
  selected,
}: {
  onLocate?: () => void;
  question: MobileQuestionReview;
  selected: boolean;
}) {
  const color = REVIEW_COLORS[question.tone];
  return (
    <Pressable
      accessibilityHint={onLocate ? 'Mostra esta pergunta destacada sobre a folha' : undefined}
      accessibilityLabel={`${question.label}, ${question.statusLabel}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={!onLocate}
      onPress={onLocate}
      style={({ pressed }) => [
        styles.questionCard,
        { borderColor: selected ? '#2563EB' : color.border },
        pressed ? styles.questionCardPressed : null,
      ]}
    >
      <View style={styles.questionHeader}>
        <View style={styles.questionHeading}>
          <Text selectable style={styles.questionTitle}>
            {question.label}
          </Text>
          <Text selectable style={styles.selectionMode}>
            {question.selectionModeLabel}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color.background }]}>
          <Text selectable style={[styles.statusBadgeText, { color: color.text }]}>
            {question.statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.answerGrid}>
        <Text selectable style={styles.answerLabel}>Detetada</Text>
        <Text selectable style={styles.answerValue}>
          {answerText(question.detectedAnswerLabels)}
        </Text>
        <Text selectable style={styles.answerLabel}>Correta</Text>
        <Text selectable style={styles.answerValue}>
          {answerText(question.correctAnswerLabels)}
        </Text>
      </View>

      <View style={styles.questionMetrics}>
        <Text selectable style={styles.metricText}>
          {question.awardedPoints}/{question.maximumPoints} pontos
        </Text>
        <Text selectable style={styles.metricText}>
          {question.pendingPoints} pendentes
        </Text>
        <Text selectable style={styles.metricText}>
          {question.confidencePercent}% confiança
        </Text>
      </View>

      {question.status === 'needs_review' ? (
        <View style={styles.reasonList}>
          {question.reasonMessages.map((message) => (
            <Text key={message} selectable style={styles.reasonText}>
              • {message}
            </Text>
          ))}
        </View>
      ) : null}
      {onLocate ? (
        <Text selectable style={styles.locateHint}>
          {selected ? 'Localizada na imagem' : 'Toque para localizar na imagem'}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function MobileVisualQuestionReview({
  imageHeight,
  imageUri,
  imageWidth,
  onLocateQuestion,
  result,
}: {
  imageHeight: number;
  imageUri?: string;
  imageWidth: number;
  onLocateQuestion?: () => void;
  result: BubbleAnalysisResult;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const questions = useMemo(() => buildMobileQuestionReview(result), [result]);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() =>
    imageUri ? (initialQuestionId(questions) ?? null) : null,
  );
  const selectedQuestion =
    questions.find((question) => question.questionId === selectedQuestionId) ?? questions[0];
  const renderedWidth = Math.max(1, Math.min(windowWidth - 64, 528));
  const renderedHeight = renderedWidth * (imageHeight / imageWidth);
  const priorityQuestions = questions.filter((question) => question.status !== 'correct');
  const initialQuestions = (priorityQuestions.length > 0 ? priorityQuestions : questions).slice(0, 10);
  const visibleQuestions = showAllQuestions ? questions : initialQuestions;

  const selectQuestion = (questionId: string, locate: boolean) => {
    setSelectedQuestionId(questionId);
    if (locate) onLocateQuestion?.();
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <>
          <View style={styles.reviewHeader}>
        <View style={styles.reviewHeading}>
          <Text selectable style={styles.reviewTitle}>Revisão visual</Text>
          <Text selectable style={styles.reviewSubtitle}>
            A vista anotada é apenas uma camada sobre o JPEG limpo.
          </Text>
        </View>
        <View accessibilityRole="tablist" style={styles.viewSelector}>
          {(['clean', 'annotated'] as const).map((mode) => {
            const selected = mode === (selectedQuestionId === null ? 'clean' : 'annotated');
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={mode}
                onPress={() =>
                  setSelectedQuestionId(
                    mode === 'clean' ? null : (initialQuestionId(questions) ?? null),
                  )
                }
                style={[
                  styles.viewSelectorButton,
                  selected ? styles.viewSelectorButtonSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.viewSelectorText,
                    selected ? styles.viewSelectorTextSelected : null,
                  ]}
                >
                  {mode === 'clean' ? 'Limpa' : 'Anotada'}
                </Text>
              </Pressable>
            );
          })}
        </View>
          </View>

          <View style={[styles.imageFrame, { width: renderedWidth, height: renderedHeight }]}>
        <Image
          accessibilityLabel={
            selectedQuestionId === null
              ? 'Fotografia canónica limpa da folha'
              : 'Fotografia canónica da folha com decisões de bolhas sobrepostas'
          }
          resizeMode="contain"
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
        />
        {selectedQuestionId !== null ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {selectedQuestion ? (
              <SelectedQuestionRegion
                imageWidth={imageWidth}
                question={selectedQuestion}
                renderedWidth={renderedWidth}
              />
            ) : null}
            {questions.flatMap((question) =>
              question.bubbles.map((bubble) => (
                <BubbleOverlay
                  bubble={bubble}
                  imageWidth={imageWidth}
                  key={bubble.bubbleId}
                  renderedWidth={renderedWidth}
                  selected={question.questionId === selectedQuestionId}
                />
              )),
            )}
          </View>
        ) : null}
          </View>

          {selectedQuestionId !== null ? (
        <>
          <View style={styles.legend}>
            {(
              [
                ['success', 'Correta'],
                ['error', 'Incorreta'],
                ['warning', 'A rever'],
              ] as const
            ).map(([tone, label]) => (
              <View key={tone} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: REVIEW_COLORS[tone].border }]} />
                <Text selectable style={styles.legendText}>{label}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotSubordinate]} />
              <Text selectable style={styles.legendText}>Não selecionada</Text>
            </View>
          </View>
          <ScrollView
            accessibilityLabel="Escolher pergunta para destacar"
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.questionPicker}
          >
            <View style={styles.questionPickerContent}>
              {questions.map((question) => {
                const selected = question.questionId === selectedQuestionId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={question.questionId}
                    onPress={() => selectQuestion(question.questionId, false)}
                    style={[
                      styles.questionChip,
                      { borderColor: REVIEW_COLORS[question.tone].border },
                      selected ? styles.questionChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.questionChipText,
                        selected ? styles.questionChipTextSelected : null,
                      ]}
                    >
                      {question.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </>
          ) : null}
        </>
      ) : null}

      <View style={styles.questionListHeader}>
        <Text selectable style={styles.questionListTitle}>Perguntas</Text>
        <Text selectable style={styles.questionListCount}>
          {visibleQuestions.length}/{questions.length}
        </Text>
      </View>
      <View style={styles.questionList}>
        {visibleQuestions.map((question) => (
          <QuestionCard
            key={question.questionId}
            onLocate={imageUri ? () => selectQuestion(question.questionId, true) : undefined}
            question={question}
            selected={question.questionId === selectedQuestionId}
          />
        ))}
      </View>
      {visibleQuestions.length < questions.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAllQuestions(true)}
          style={styles.showAllButton}
        >
          <Text style={styles.showAllButtonText}>Mostrar todas as perguntas</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 560,
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  reviewHeader: { gap: 12 },
  reviewHeading: { gap: 3 },
  reviewTitle: { color: '#111827', fontSize: 20, fontWeight: '800' },
  reviewSubtitle: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
  viewSelector: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  viewSelectorButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 9,
  },
  viewSelectorButtonSelected: { backgroundColor: '#FFFFFF' },
  viewSelectorText: { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  viewSelectorTextSelected: { color: '#111827' },
  imageFrame: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#E5E7EB',
  },
  bubbleOverlay: { position: 'absolute', borderRadius: 999 },
  selectedQuestionRegion: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendDotSubordinate: { backgroundColor: 'rgba(31, 41, 55, 0.38)' },
  legendText: { color: '#4B5563', fontSize: 12 },
  questionPicker: { marginHorizontal: -16 },
  questionPickerContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  questionChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  questionChipSelected: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  questionChipText: { color: '#374151', fontSize: 13, fontWeight: '700' },
  questionChipTextSelected: { color: '#1D4ED8' },
  questionListHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  questionListTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  questionListCount: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  questionList: { gap: 10 },
  showAllButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#E5E7EB',
  },
  showAllButtonText: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  questionCard: {
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  questionCardPressed: { opacity: 0.78 },
  questionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  questionHeading: { flex: 1, gap: 2 },
  questionTitle: { color: '#111827', fontSize: 17, fontWeight: '800' },
  selectionMode: { color: '#6B7280', fontSize: 12 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  answerLabel: { width: 68, color: '#6B7280', fontSize: 13 },
  answerValue: { minWidth: 180, flex: 1, color: '#111827', fontSize: 14, fontWeight: '700' },
  questionMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricText: { color: '#4B5563', fontSize: 12, fontVariant: ['tabular-nums'] },
  reasonList: { gap: 4, padding: 10, borderRadius: 10, backgroundColor: '#FFFBEB' },
  reasonText: { color: '#92400E', fontSize: 13, lineHeight: 18 },
  locateHint: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
});
