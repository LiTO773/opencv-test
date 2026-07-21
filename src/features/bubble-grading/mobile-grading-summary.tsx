import { StyleSheet, Text, View } from 'react-native';

import {
  buildMobileScoreSummary,
  type MobileGradingOutcome,
} from './mobile-bubble-grading';
import type { BubbleReasonCode } from './bubble-analysis';

const REVIEW_REASON_LABELS: Record<BubbleReasonCode, string> = {
  center_adjusted: 'A posição de uma bolha foi ajustada localmente.',
  fill_score_in_uncertain_band: 'Há marcas próximas dos limites de classificação.',
  poor_local_contrast: 'O papel ou algumas marcas têm pouco contraste local.',
  excessive_blur: 'A imagem apresenta desfocagem excessiva em zonas de resposta.',
  measurement_region_incomplete: 'Uma região de medição não ficou completamente disponível.',
};

function ScoreValue({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreValue}>
      <Text selectable style={styles.scoreNumber}>
        {value}
      </Text>
      <Text selectable style={styles.scoreLabel}>
        {label}
      </Text>
    </View>
  );
}

function CountValue({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.countValue}>
      <View style={[styles.countDot, { backgroundColor: color }]} />
      <Text selectable style={styles.countNumber}>
        {value}
      </Text>
      <Text selectable style={styles.countLabel}>
        {label}
      </Text>
    </View>
  );
}

export function MobileGradingSummary({ outcome }: { outcome: MobileGradingOutcome }) {
  const studentId = outcome.scanDiagnostics.studentId;

  return (
    <View style={styles.container}>
      <View style={styles.studentCard}>
        <Text selectable style={styles.cardEyebrow}>
          ALUNO
        </Text>
        <Text selectable style={styles.studentName}>
          {studentId ?? 'Não identificado'}
        </Text>
        {!studentId ? (
          <Text selectable style={styles.studentNote}>
            A folha continua disponível mesmo sem studentId no QR.
          </Text>
        ) : null}
      </View>

      {outcome.status === 'graded' ? (
        <GradedSummary outcome={outcome} />
      ) : (
        <View style={styles.failureCard}>
          <Text selectable style={styles.failureTitle}>
            Não foi possível classificar a folha
          </Text>
          <Text selectable style={styles.failureMessage}>
            {outcome.failure.message}
          </Text>
          {outcome.failure.validationErrors.length > 0 ? (
            <View style={styles.failureList}>
              {outcome.failure.validationErrors.map((error, index) => (
                <Text
                  key={`${error.path}-${error.code}-${index}`}
                  selectable
                  style={styles.failureDetail}
                >
                  {error.path} [{error.code}]: {error.message}
                </Text>
              ))}
            </View>
          ) : null}
          <Text selectable style={styles.failureNote}>
            A imagem canónica limpa e os metadados QR foram preservados abaixo para diagnóstico.
          </Text>
        </View>
      )}

    </View>
  );
}

function GradedSummary({
  outcome,
}: {
  outcome: Extract<MobileGradingOutcome, { status: 'graded' }>;
}) {
  const summary = buildMobileScoreSummary(outcome.result);
  return (
    <>
      <View style={styles.scoreCard}>
        <Text selectable style={styles.cardEyebrow}>
          {summary.provisional ? 'RESULTADO PROVISÓRIO' : 'RESULTADO'}
        </Text>
        <View style={styles.scoreRow}>
          <ScoreValue label="pontos atribuídos" value={summary.awardedGradedPoints} />
          <ScoreValue label="pontos máximos" value={summary.maximumPoints} />
          <ScoreValue label="pontos pendentes" value={summary.pendingReviewPoints} />
        </View>
        <View style={styles.countRow}>
          <CountValue color="#16A34A" label="corretas" value={summary.counts.correct} />
          <CountValue color="#DC2626" label="incorretas" value={summary.counts.incorrect} />
          <CountValue
            color="#D97706"
            label="a rever"
            value={summary.counts.needs_review}
          />
        </View>
      </View>

      {summary.provisional ? (
        <View style={styles.reviewCard}>
          <Text selectable style={styles.reviewTitle}>
            Revisão necessária
          </Text>
          {summary.reviewReasonCodes.length > 0 ? (
            summary.reviewReasonCodes.map((reason) => (
              <Text key={reason} selectable style={styles.reviewReason}>
                • {REVIEW_REASON_LABELS[reason]}
              </Text>
            ))
          ) : (
            <Text selectable style={styles.reviewReason}>
              • Existem respostas incertas que podem alterar a pontuação.
            </Text>
          )}
          <Text selectable style={styles.reviewNote}>
            Os pontos pendentes não foram atribuídos nem tratados silenciosamente como zero.
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 560, gap: 14 },
  studentCard: {
    gap: 4,
    padding: 18,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  cardEyebrow: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  studentName: { color: '#111827', fontSize: 26, fontWeight: '800' },
  studentNote: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
  scoreCard: {
    gap: 18,
    padding: 18,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scoreValue: { minWidth: 118, flex: 1, gap: 2 },
  scoreNumber: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: { color: '#6B7280', fontSize: 12, lineHeight: 16 },
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D5DB',
  },
  countValue: { minWidth: 105, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  countDot: { width: 9, height: 9, borderRadius: 5 },
  countNumber: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countLabel: { color: '#4B5563', fontSize: 13 },
  reviewCard: {
    gap: 7,
    padding: 18,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  reviewTitle: { color: '#92400E', fontSize: 17, fontWeight: '800' },
  reviewReason: { color: '#92400E', fontSize: 14, lineHeight: 20 },
  reviewNote: { color: '#78350F', fontSize: 12, lineHeight: 17, paddingTop: 3 },
  failureCard: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  failureTitle: { color: '#991B1B', fontSize: 18, fontWeight: '800' },
  failureMessage: { color: '#991B1B', fontSize: 14, lineHeight: 20 },
  failureList: { gap: 7, paddingTop: 4 },
  failureDetail: {
    color: '#7F1D1D',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  failureNote: { color: '#7F1D1D', fontSize: 12, lineHeight: 17, paddingTop: 3 },
});
