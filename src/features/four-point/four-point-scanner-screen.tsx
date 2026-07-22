import { GlassView } from 'expo-glass-effect';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createWorkletRuntime } from 'react-native-worklets';

import { MobileGradingSummary } from '@/features/bubble-grading/mobile-grading-summary';
import { MobileGradingDiagnostics } from '@/features/bubble-grading/mobile-grading-diagnostics';
import { MobileVisualQuestionReview } from '@/features/bubble-grading/mobile-visual-question-review';
import { FourPointCamera } from '@/features/four-point/four-point-camera';
import type {
  FourPointScan,
  FourPointScanState,
} from '@/features/four-point/types';

function useIsAppActive() {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return isActive;
}

function MessageScreen({
  action,
  actionLabel,
  body,
  title,
}: {
  action?: () => void;
  actionLabel?: string;
  body: string;
  title: string;
}) {
  return (
    <View style={styles.messageScreen}>
      <View style={styles.messageCard}>
        <Text selectable style={styles.messageTitle}>
          {title}
        </Text>
        <Text selectable style={styles.messageBody}>
          {body}
        </Text>
        {action && actionLabel ? (
          <Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ScannerCamera() {
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const isAppActive = useIsAppActive();
  const gradingRuntime = useMemo(
    () => createWorkletRuntime({ name: 'omr-grading-runtime' }),
    [],
  );
  const [scanState, setScanState] = useState<FourPointScanState>('searching');
  const [markerCount, setMarkerCount] = useState(0);
  const [processorError, setProcessorError] = useState<string | null>(null);
  const [capturedScan, setCapturedScan] = useState<FourPointScan | null>(null);
  const [scanSession, setScanSession] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const handleScanStateChange = useCallback((state: FourPointScanState) => {
    setScanState(state);
    if (state === 'ready') setProcessorError(null);
  }, []);
  const handleMarkerCountChange = useCallback((count: number) => {
    setMarkerCount(count);
    if (count > 0) setProcessorError(null);
  }, []);
  const handleProcessorError = useCallback((message: string) => {
    setProcessorError(message);
  }, []);
  const handleTorchError = useCallback((message: string) => {
    setTorchEnabled(false);
    setProcessorError(`Não foi possível controlar o flash: ${message}`);
  }, []);
  const handleCropCaptured = useCallback((scan: FourPointScan) => {
    setTorchEnabled(false);
    setProcessorError(null);
    setCapturedScan(scan);
  }, []);
  const handleCloseCrop = useCallback(() => {
    setCapturedScan(null);
    setMarkerCount(0);
    setScanState('searching');
    setScanSession((session) => session + 1);
  }, []);
  if (!device) {
    return (
      <MessageScreen
        body="Não foi encontrada uma câmara traseira neste dispositivo."
        title="Câmara indisponível"
      />
    );
  }

  const statusLabel =
    scanState === 'processing'
      ? 'A reconhecer respostas'
      : scanState === 'capturing'
      ? 'A capturar fotografia'
      : scanState === 'ready'
        ? '4 marcadores encontrados'
        : markerCount === 4
          ? 'Alinhe os quatro marcadores'
          : `${markerCount}/4 marcadores`;

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <FourPointCamera
        key={scanSession}
        device={device}
        gradingRuntime={gradingRuntime}
        isActive={isAppActive && !capturedScan}
        onCropCaptured={handleCropCaptured}
        onMarkerCountChange={handleMarkerCountChange}
        onProcessorError={handleProcessorError}
        onScanStateChange={handleScanStateChange}
        onTorchError={handleTorchError}
        torchMode={
          torchEnabled &&
          isAppActive &&
          !capturedScan &&
          scanState !== 'capturing' &&
          scanState !== 'processing'
            ? 'on'
            : 'off'
        }
      />

      <View
        pointerEvents="none"
        style={[
          styles.topOverlay,
          {
            paddingTop: insets.top + 12,
            paddingRight: device.hasTorch ? 78 : 18,
          },
        ]}
      >
        <GlassView colorScheme="dark" glassEffectStyle="regular" style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              scanState === 'capturing' || scanState === 'processing'
                ? styles.statusDotCapturing
                : scanState === 'ready'
                  ? styles.statusDotReady
                  : markerCount > 0
                    ? styles.statusDotPartial
                    : styles.statusDotSearching,
            ]}
          />
          <Text selectable style={styles.statusText}>
            {statusLabel}
          </Text>
        </GlassView>
      </View>

      {device.hasTorch ? (
        <View style={[styles.flashOverlay, { top: insets.top + 12 }]}>
          <GlassView
            colorScheme="dark"
            glassEffectStyle="regular"
            isInteractive
            style={[
              styles.flashGlassButton,
              torchEnabled ? styles.flashGlassButtonActive : null,
            ]}
          >
            <Pressable
              accessibilityLabel={torchEnabled ? 'Desligar flash' : 'Ligar flash'}
              accessibilityRole="switch"
              accessibilityState={{ checked: torchEnabled }}
              onPress={() => {
                setProcessorError(null);
                setTorchEnabled((enabled) => !enabled);
              }}
              style={styles.flashButton}
            >
              <Text
                style={[
                  styles.flashButtonIcon,
                  torchEnabled ? styles.flashButtonIconActive : null,
                ]}
              >
                ϟ
              </Text>
            </Pressable>
          </GlassView>
        </View>
      ) : null}

      <View
        pointerEvents="none"
        style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 18 }]}
      >
        <GlassView colorScheme="dark" glassEffectStyle="regular" style={styles.instructionCard}>
          <Text selectable style={styles.instructionTitle}>
            {scanState === 'processing'
              ? 'A processar sem interromper a câmara'
              : scanState === 'capturing'
                ? 'A capturar a folha'
              : scanState === 'ready'
                ? 'Folha detetada'
                : markerCount === 4
                  ? 'Ajuste ligeiramente o enquadramento'
                  : markerCount > 0
                    ? 'Continue a alinhar a folha'
                    : 'Coloque um quadrado preto em cada área'}
          </Text>
          <Text selectable style={styles.instructionBody}>
            {scanState === 'processing'
              ? 'A validação final, o QR e as respostas estão a ser analisados. O resultado abre quando estiver completo.'
              : scanState === 'capturing'
                ? 'Mantenha a folha estável por um instante enquanto a fotografia é capturada.'
              : scanState === 'ready'
                ? 'A captura é automática assim que a segunda leitura confirmar os marcadores.'
                : markerCount === 4
                  ? 'Os quatro quadrados foram vistos, mas ainda não formam uma página vertical válida.'
                  : 'Cada área funciona de forma independente e fica verde quando encontra o seu marcador.'}
          </Text>
        </GlassView>
      </View>

      {processorError ? (
        <View style={[styles.errorBanner, { top: insets.top + 76 }]}>
          <Text selectable style={styles.errorText}>
            Ocorreu um erro: {processorError}
          </Text>
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={handleCloseCrop}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={capturedScan !== null}
      >
        <StatusBar style="dark" />
        <View style={styles.cropModal}>
          <View style={[styles.cropHeader, { paddingTop: insets.top + 10 }]}>
            <View style={styles.cropHeaderCopy}>
              <Text selectable style={styles.cropTitle}>
                Resultado da leitura
              </Text>
              <Text selectable style={styles.cropSubtitle}>
                {capturedScan
                  ? `${capturedScan.width} × ${capturedScan.height} px · perspetiva corrigida`
                  : 'Perspetiva corrigida'}
              </Text>
            </View>
            <GlassView isInteractive style={styles.closeGlassButton}>
              <Pressable
                accessibilityLabel="Fechar fotografia e digitalizar novamente"
                accessibilityRole="button"
                onPress={handleCloseCrop}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Nova leitura</Text>
              </Pressable>
            </GlassView>
          </View>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.cropScrollContent}
          >
            {capturedScan ? (
              <>
                <MobileGradingSummary outcome={capturedScan.grading} />
                {capturedScan.grading.status === 'graded' ? (
                  <View style={styles.visualReviewContainer}>
                    <MobileVisualQuestionReview
                      imageHeight={capturedScan.height}
                      imageWidth={capturedScan.width}
                      result={capturedScan.grading.result}
                    />
                  </View>
                ) : null}
                <MobileGradingDiagnostics
                  imageHeight={capturedScan.height}
                  imageWidth={capturedScan.width}
                  outcome={capturedScan.grading}
                  pipelineTimings={capturedScan.pipelineTimings}
                />
                <View style={styles.qrCard}>
                  <Text selectable style={styles.qrTitle}>
                    {capturedScan.qr ? 'Payload QR original' : 'QR não encontrado'}
                  </Text>
                  {capturedScan.qr ? (
                    <>
                      <Text selectable style={styles.qrMetadata}>
                        {capturedScan.qr.payloadFormat === 'json'
                          ? JSON.stringify(capturedScan.qr.payload, null, 2)
                          : capturedScan.qr.rawValue}
                      </Text>
                      <Text selectable style={styles.qrDetails}>
                        QR v{capturedScan.qr.qrVersion}
                        {capturedScan.qr.rotationApplied === 180
                          ? ' · folha rodada automaticamente 180°'
                          : ''}
                      </Text>
                    </>
                  ) : (
                    <Text selectable style={styles.qrDetails}>
                      A fotografia foi recortada, mas não foi possível descodificar um QR.
                    </Text>
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>
          <View style={{ height: insets.bottom }} />
        </View>
      </Modal>
    </View>
  );
}

export function FourPointScannerScreen() {
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch((caught) => {
        setPermissionError(caught instanceof Error ? caught.message : String(caught));
      });
    }
  }, [canRequestPermission, hasPermission, requestPermission]);

  if (hasPermission) return <ScannerCamera />;

  if (canRequestPermission) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#22C55E" size="large" />
        <Text selectable style={styles.loadingText}>
          A pedir acesso à câmara…
        </Text>
        {permissionError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => requestPermission()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <MessageScreen
      action={() => Linking.openSettings()}
      actionLabel="Abrir definições"
      body="Ative o acesso à câmara nas definições do sistema. As imagens são analisadas no dispositivo."
      title="Acesso à câmara necessário"
    />
  );
}

const styles = StyleSheet.create({
  cameraScreen: { flex: 1, backgroundColor: '#000000' },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  statusPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 10, 0.48)',
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusDotSearching: { backgroundColor: '#FBBF24' },
  statusDotPartial: { backgroundColor: '#A7F3D0' },
  statusDotReady: { backgroundColor: '#22C55E' },
  statusDotCapturing: { backgroundColor: '#60A5FA' },
  statusText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  flashOverlay: { position: 'absolute', right: 18 },
  flashGlassButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 10, 0.48)',
  },
  flashGlassButtonActive: { backgroundColor: 'rgba(146, 88, 0, 0.78)' },
  flashButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flashButtonIcon: { color: '#FFFFFF', fontSize: 27, fontWeight: '700' },
  flashButtonIconActive: { color: '#FDE68A' },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
  },
  instructionCard: {
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 10, 0.52)',
  },
  instructionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  instructionBody: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 18 },
  errorBanner: {
    position: 'absolute',
    left: 18,
    right: 18,
    padding: 13,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(153, 27, 27, 0.94)',
  },
  errorText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  messageScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F2F2F7',
  },
  messageCard: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 16,
    padding: 24,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 10px 30px rgba(0,0,0,0.09)',
  },
  messageTitle: { color: '#111827', fontSize: 23, fontWeight: '700', textAlign: 'center' },
  messageBody: { color: '#4B5563', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#15803D',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#F2F2F7',
  },
  loadingText: { color: '#374151', fontSize: 16 },
  cropModal: { flex: 1, backgroundColor: '#F2F2F7' },
  cropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(242, 242, 247, 0.96)',
  },
  cropHeaderCopy: { flex: 1, gap: 2 },
  cropTitle: { color: '#111827', fontSize: 20, fontWeight: '700' },
  cropSubtitle: { color: '#6B7280', fontSize: 13 },
  closeGlassButton: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
  },
  closeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15 },
  closeButtonText: { color: '#15803D', fontSize: 14, fontWeight: '700' },
  cropScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 16,
  },
  visualReviewContainer: { width: '100%', alignItems: 'center' },
  qrCard: {
    width: '100%',
    maxWidth: 560,
    gap: 8,
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  qrTitle: { color: '#111827', fontSize: 17, fontWeight: '700' },
  qrMetadata: {
    color: '#1F2937',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
  qrDetails: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
});
