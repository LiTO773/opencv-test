import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MobileGradingOutcome } from './mobile-bubble-grading';
import type { CapturePipelineTimings } from '../four-point/types';
import {
  buildMobileGradingDiagnosticRecord,
  type DiagnosticReason,
} from './mobile-grading-diagnostic-record';

function formatNumber(value: number | null, digits = 4) {
  return value === null ? 'não registado' : value.toFixed(digits);
}

function formatIds(ids: string[]) {
  return ids.length > 0 ? ids.join(', ') : '∅';
}

function DiagnosticRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text selectable style={styles.rowLabel}>
        {label}
      </Text>
      <Text selectable style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

function ReasonRows({ emptyLabel, reasons }: { emptyLabel: string; reasons: DiagnosticReason[] }) {
  if (reasons.length === 0) {
    return (
      <Text selectable style={styles.emptyText}>
        {emptyLabel}
      </Text>
    );
  }
  return (
    <View style={styles.reasonList}>
      {reasons.map((reason, index) => (
        <View key={`${reason.code}-${index}`} style={styles.reasonItem}>
          <Text selectable style={styles.reasonCode}>
            [{reason.code}]
          </Text>
          <Text selectable style={styles.reasonExplanation}>
            {reason.explanation}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Disclosure({
  children,
  label,
  level = 'primary',
}: {
  children: ReactNode | (() => ReactNode);
  label: string;
  level?: 'primary' | 'secondary' | 'record';
}) {
  const [expanded, setExpanded] = useState(false);
  const containerStyle =
    level === 'primary'
      ? styles.primaryDisclosure
      : level === 'secondary'
        ? styles.secondaryDisclosure
        : styles.recordDisclosure;
  const titleStyle =
    level === 'primary'
      ? styles.primaryTitle
      : level === 'secondary'
        ? styles.secondaryTitle
        : styles.recordTitle;
  return (
    <View style={containerStyle}>
      <Pressable
        accessibilityHint={expanded ? 'Oculta este registo' : 'Mostra este registo'}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.disclosureButton,
          pressed ? styles.disclosureButtonPressed : null,
        ]}
      >
        <Text selectable style={titleStyle}>
          {label}
        </Text>
        <Text accessibilityElementsHidden style={styles.disclosureIndicator}>
          {expanded ? '−' : '+'}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.disclosureContent}>
          {typeof children === 'function' ? children() : children}
        </View>
      ) : null}
    </View>
  );
}

export function MobileGradingDiagnostics({
  imageHeight,
  imageWidth,
  outcome,
  pipelineTimings,
}: {
  imageHeight: number;
  imageWidth: number;
  outcome: MobileGradingOutcome;
  pipelineTimings?: CapturePipelineTimings;
}) {
  return (
    <View style={styles.container}>
      <Disclosure label="Diagnósticos técnicos">
        {() => {
          const record = buildMobileGradingDiagnosticRecord(outcome, {
        width: imageWidth,
        height: imageHeight,
          });
          return (
            <>
        <Text selectable style={styles.prototypeWarning}>
          Limites provisórios para calibração física; este registo não representa precisão de produção.
        </Text>

        <View style={styles.section}>
          <Text selectable style={styles.sectionTitle}>Leitura</Text>
          <DiagnosticRow
            label="dimensões esperadas"
            value={`${record.scan.canonicalDimensions.expected.width} × ${record.scan.canonicalDimensions.expected.height} px`}
          />
          <DiagnosticRow
            label="dimensões medidas"
            value={`${record.scan.canonicalDimensions.measured.width} × ${record.scan.canonicalDimensions.measured.height} px`}
          />
          <DiagnosticRow
            label="contrato canónico"
            value={record.scan.canonicalDimensions.matchesExpected ? 'corresponde' : 'não corresponde'}
          />
          <DiagnosticRow label="studentId" value={record.scan.qrMetadata.studentId ?? 'não disponível'} />
          <DiagnosticRow label="sheetId" value={record.scan.qrMetadata.sheetId ?? 'não disponível'} />
          <DiagnosticRow label="testId" value={record.scan.qrMetadata.testId ?? 'não disponível'} />
          <DiagnosticRow
            label="schemaVersion"
            value={record.scan.qrMetadata.schemaVersion ?? 'não disponível'}
          />
          <DiagnosticRow label="bolhas" value={record.scan.bubbleCount} />
          <DiagnosticRow
            label="tempo total"
            value={`${formatNumber(record.scan.totalAnalysisTimeMs, 3)} ms`}
          />
          {record.scan.detector ? (
            <>
              <DiagnosticRow label="detetor" value={record.scan.detector.id} />
              <DiagnosticRow
                label="estado dos limites"
                value={record.scan.detector.provisional ? 'provisórios' : 'calibrados'}
              />
            </>
          ) : null}
          {record.scan.globalQuality ? (
            <>
              <DiagnosticRow
                label="brilho médio do fundo"
                value={formatNumber(record.scan.globalQuality.averageBackgroundBrightness)}
              />
              <DiagnosticRow
                label="foco mínimo"
                value={formatNumber(record.scan.globalQuality.minimumFocusScore, 6)}
              />
              <DiagnosticRow
                label="decisões"
                value={`preenchidas ${record.scan.globalQuality.decisionCounts.filled} · vazias ${record.scan.globalQuality.decisionCounts.unfilled} · incertas ${record.scan.globalQuality.decisionCounts.uncertain}`}
              />
            </>
          ) : null}
          <Text selectable style={styles.subsectionTitle}>Motivos globais</Text>
          <ReasonRows emptyLabel="Nenhum motivo global registado." reasons={record.scan.reviewReasons} />
        </View>

        {pipelineTimings ? (
          <View style={styles.section}>
            <Text selectable style={styles.sectionTitle}>Pipeline de captura</Text>
            <DiagnosticRow label="captura" value={`${pipelineTimings.capturePhotoMs} ms`} />
            <DiagnosticRow label="descodificação" value={`${pipelineTimings.decodePhotoMs} ms`} />
            <DiagnosticRow label="deteção final" value={`${pipelineTimings.finalDetectionMs} ms`} />
            <DiagnosticRow
              label="perspetiva e leitura"
              value={`${pipelineTimings.perspectiveCorrectionMs} ms`}
            />
            <DiagnosticRow label="QR" value={`${pipelineTimings.qrDecodeMs} ms`} />
            <DiagnosticRow label="classificação" value={`${pipelineTimings.gradingMs} ms`} />
            <DiagnosticRow
              label="pré-visualização durante pipeline"
              value={`${pipelineTimings.previewFramesDuringPipeline} frames · ${pipelineTimings.previewFpsDuringPipeline} FPS`}
            />
            <DiagnosticRow label="total" value={`${pipelineTimings.totalMs} ms`} />
          </View>
        ) : null}

        {record.failure ? (
          <View style={styles.failureSection}>
            <Text selectable style={styles.sectionTitle}>Falha de análise</Text>
            <DiagnosticRow label="tipo" value={record.failure.kind} />
            <DiagnosticRow label="mensagem" value={record.failure.message} />
            {record.failure.validationErrors.map((error, index) => (
              <View key={`${error.path}-${error.code}-${index}`} style={styles.reasonItem}>
                <Text selectable style={styles.reasonCode}>[{error.code}] {error.path}</Text>
                <Text selectable style={styles.reasonExplanation}>{error.message}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {record.bubbles.length > 0 ? (
          <Disclosure label={`Bolhas (${record.bubbles.length})`} level="secondary">
            <View style={styles.recordList}>
              {record.bubbles.map((bubble) => (
                <Disclosure
                  key={bubble.bubbleId}
                  label={`${bubble.questionId} · ${bubble.bubbleId}`}
                  level="record"
                >
                  <View style={styles.recordDetails}>
                  <DiagnosticRow
                    label="centro esperado"
                    value={`(${bubble.expectedCenterPx.x}, ${bubble.expectedCenterPx.y}) px`}
                  />
                  <DiagnosticRow
                    label="centro medido"
                    value={`(${bubble.measuredCenterPx.x}, ${bubble.measuredCenterPx.y}) px`}
                  />
                  <DiagnosticRow
                    label="ajuste aplicado"
                    value={`x ${bubble.centerAdjustmentPx.x}, y ${bubble.centerAdjustmentPx.y}, distância ${formatNumber(bubble.centerAdjustmentPx.distance, 3)} px`}
                  />
                  <DiagnosticRow
                    label="raios"
                    value={`ROI ${bubble.measurementRadii.roiRadiusPx} · bolha ${bubble.measurementRadii.printedBubbleRadiusPx} · traço ${bubble.measurementRadii.printedOutlineWidthPx} · preenchimento ${bubble.measurementRadii.fillRadiusPx} · fundo ${bubble.measurementRadii.backgroundRingInnerRadiusPx}–${bubble.measurementRadii.backgroundRingOuterRadiusPx} · procura ${bubble.measurementRadii.centerSearchTolerancePx} px`}
                  />
                  <DiagnosticRow label="brilho interior" value={formatNumber(bubble.interiorBrightness)} />
                  <DiagnosticRow label="brilho do fundo" value={formatNumber(bubble.backgroundBrightness)} />
                  <DiagnosticRow label="píxeis escuros" value={formatNumber(bubble.darkPixelRatio)} />
                  <DiagnosticRow label="contraste" value={formatNumber(bubble.contrast)} />
                  <DiagnosticRow
                    label="evidência de foco"
                    value={`${formatNumber(bubble.blurEvidence.focusScore, 6)} / mínimo ${formatNumber(bubble.blurEvidence.minimumFocusScore, 6)} · ${bubble.blurEvidence.passesMinimum ? 'passa' : 'desfocada'}`}
                  />
                  <DiagnosticRow
                    label="limites"
                    value={`delta escuro ${bubble.thresholds.darkPixelDelta} · vazia ≤ ${bubble.thresholds.unfilledMaxDarkPixelRatio} · preenchida ≥ ${bubble.thresholds.filledMinDarkPixelRatio} · fundo ≥ ${bubble.thresholds.minimumBackgroundBrightness} · contraste ≥ ${bubble.thresholds.minimumMarkedContrast} · foco ≥ ${bubble.thresholds.minimumFocusScore}`}
                  />
                  <DiagnosticRow label="confiança" value={formatNumber(bubble.confidence)} />
                  <DiagnosticRow label="decisão" value={bubble.decision} />
                  <DiagnosticRow
                    label="tempo"
                    value={`${formatNumber(bubble.timing.durationMs, 3)} ms · ${bubble.timing.sampledPixelCount} píxeis`}
                  />
                  <ReasonRows emptyLabel="Sem motivos adicionais." reasons={bubble.reasons} />
                  </View>
                </Disclosure>
              ))}
            </View>
          </Disclosure>
        ) : null}

        {record.questions.length > 0 ? (
          <Disclosure label={`Perguntas (${record.questions.length})`} level="secondary">
            <View style={styles.recordList}>
              {record.questions.map((question) => (
                <Disclosure
                  key={question.questionId}
                  label={`${question.label} · ${question.questionId}`}
                  level="record"
                >
                  <View style={styles.recordDetails}>
                  <DiagnosticRow label="IDs detetados" value={formatIds(question.detectedBubbleIds)} />
                  <DiagnosticRow label="IDs corretos" value={formatIds(question.correctBubbleIds)} />
                  <DiagnosticRow
                    label="comparação exata"
                    value={question.exactSetMatch ? 'igual' : 'diferente'}
                  />
                  <DiagnosticRow label="estado" value={question.status} />
                  <DiagnosticRow
                    label="pontos"
                    value={`${question.awardedPoints} atribuídos · ${question.pendingPoints} pendentes · ${question.maximumPoints} máximos`}
                  />
                  <DiagnosticRow label="confiança" value={formatNumber(question.confidence)} />
                  <Text selectable style={styles.subsectionTitle}>Decisão</Text>
                  <ReasonRows emptyLabel="Sem motivos de decisão." reasons={question.reasons} />
                  <Text selectable style={styles.subsectionTitle}>Motivos das bolhas contribuintes</Text>
                  {question.contributingBubbleReasons.length > 0 ? (
                    <View style={styles.reasonList}>
                      {question.contributingBubbleReasons.map((contribution) => (
                        <View key={contribution.bubbleId} style={styles.contribution}>
                          <Text selectable style={styles.contributionTitle}>{contribution.bubbleId}</Text>
                          <ReasonRows emptyLabel="Sem motivos." reasons={contribution.reasons} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text selectable style={styles.emptyText}>Nenhuma bolha contribuiu com motivos adicionais.</Text>
                  )}
                  </View>
                </Disclosure>
              ))}
            </View>
          </Disclosure>
        ) : null}
            </>
          );
        }}
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 560 },
  primaryDisclosure: {
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  secondaryDisclosure: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#F9FAFB',
  },
  recordDisclosure: {
    overflow: 'hidden',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  disclosureButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclosureButtonPressed: { opacity: 0.72 },
  primaryTitle: { flex: 1, color: '#111827', fontSize: 18, fontWeight: '800' },
  secondaryTitle: { flex: 1, color: '#1F2937', fontSize: 15, fontWeight: '800' },
  disclosureIndicator: { color: '#4B5563', fontSize: 24, fontWeight: '500' },
  disclosureContent: { gap: 14, padding: 14, paddingTop: 0 },
  prototypeWarning: {
    color: '#78350F',
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
  },
  section: { gap: 7 },
  failureSection: {
    gap: 7,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  sectionTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },
  subsectionTitle: { color: '#374151', fontSize: 12, fontWeight: '800', paddingTop: 5 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowLabel: { width: 128, color: '#6B7280', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
  rowValue: { flex: 1, color: '#1F2937', fontFamily: 'monospace', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] },
  emptyText: { color: '#6B7280', fontSize: 12, lineHeight: 17 },
  reasonList: { gap: 7 },
  reasonItem: { gap: 2 },
  reasonCode: { color: '#374151', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
  reasonExplanation: { color: '#4B5563', fontSize: 12, lineHeight: 17 },
  recordList: { gap: 10 },
  recordDetails: { gap: 6 },
  recordTitle: { color: '#111827', fontSize: 14, fontWeight: '800' },
  contribution: { gap: 3, padding: 8, borderRadius: 9, backgroundColor: '#F3F4F6' },
  contributionTitle: { color: '#1F2937', fontFamily: 'monospace', fontSize: 11, fontWeight: '800' },
});
