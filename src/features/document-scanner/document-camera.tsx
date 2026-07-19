/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable worklet state. */
import {
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type Matrix3,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { Frame, TorchMode } from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { SkiaCamera, type SkiaCameraRef } from 'react-native-vision-camera-skia';
import { scheduleOnRN } from 'react-native-worklets';

import {
  ANALYSIS_HEIGHT,
  ANALYSIS_WIDTH,
  detectDocument,
  mapAnalysisToFrame,
  smoothQuadrilateral,
} from '@/features/document-scanner/document-detection';
import type { DocumentQuadrilateral } from '@/features/document-scanner/types';

const DETECTION_INTERVAL_FRAMES = 4;
const DETECTIONS_BEFORE_CAPTURE = 1;
const MISSES_BEFORE_CLEARING = 4;
const CAPTURE_WIDTH = 840;
const CAPTURE_HEIGHT = 1188;

const documentFill = Skia.Paint();
documentFill.setStyle(PaintStyle.Fill);
documentFill.setColor(Skia.Color('rgba(45, 212, 191, 0.18)'));

const documentBorder = Skia.Paint();
documentBorder.setStyle(PaintStyle.Stroke);
documentBorder.setStrokeWidth(5);
documentBorder.setStrokeCap(StrokeCap.Round);
documentBorder.setStrokeJoin(StrokeJoin.Round);
documentBorder.setColor(Skia.Color('#5EEAD4'));

type DocumentCameraProps = {
  device: NonNullable<ReturnType<typeof import('react-native-vision-camera').useCameraDevice>>;
  isActive: boolean;
  onDetectionChange: (detected: boolean) => void;
  onCropCaptured: (imageUri: string) => void;
  onProcessorError: (message: string) => void;
  onTorchError: (message: string) => void;
  torchMode: TorchMode;
};

function drawDetectedDocument(
  canvas: SkCanvas,
  quadrilateral: DocumentQuadrilateral,
  frame: Frame,
) {
  'worklet';
  const mapped = quadrilateral.map((point) =>
    mapAnalysisToFrame(point, frame.width, frame.height),
  ) as DocumentQuadrilateral;
  const path = Skia.Path.Make();
  path.moveTo(mapped[0].x, mapped[0].y);
  for (let index = 1; index < mapped.length; index += 1) {
    path.lineTo(mapped[index].x, mapped[index].y);
  }
  path.close();
  canvas.drawPath(path, documentFill);
  canvas.drawPath(path, documentBorder);
}

function solveHomography(
  source: DocumentQuadrilateral,
  destination: DocumentQuadrilateral,
): Matrix3 | null {
  'worklet';
  const rows: number[][] = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index];
    const { x: targetX, y: targetY } = destination[index];
    rows.push([x, y, 1, 0, 0, 0, -targetX * x, -targetX * y, targetX]);
    rows.push([0, 0, 0, x, y, 1, -targetY * x, -targetY * y, targetY]);
  }

  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 0.000001) return null;
    if (pivot !== column) {
      const temporary = rows[column];
      rows[column] = rows[pivot];
      rows[pivot] = temporary;
    }

    const divisor = rows[column][column];
    for (let entry = column; entry < 9; entry += 1) rows[column][entry] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const multiplier = rows[row][column];
      for (let entry = column; entry < 9; entry += 1) {
        rows[row][entry] -= multiplier * rows[column][entry];
      }
    }
  }

  return [
    rows[0][8],
    rows[1][8],
    rows[2][8],
    rows[3][8],
    rows[4][8],
    rows[5][8],
    rows[6][8],
    rows[7][8],
    1,
  ];
}

function cropSnapshot(
  snapshot: SkImage,
  quadrilateral: DocumentQuadrilateral,
  frameWidth: number,
  frameHeight: number,
) {
  const source = quadrilateral.map((point) =>
    mapAnalysisToFrame(point, frameWidth, frameHeight),
  ) as DocumentQuadrilateral;
  const destination: DocumentQuadrilateral = [
    { x: 0, y: 0 },
    { x: CAPTURE_WIDTH, y: 0 },
    { x: CAPTURE_WIDTH, y: CAPTURE_HEIGHT },
    { x: 0, y: CAPTURE_HEIGHT },
  ];
  const transform = solveHomography(source, destination);
  if (!transform) return null;

  const surface = Skia.Surface.Make(CAPTURE_WIDTH, CAPTURE_HEIGHT);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#FFFFFF'));
    canvas.concat(transform);
    canvas.drawImage(snapshot, 0, 0);
    surface.flush();

    const croppedSnapshot = surface.makeImageSnapshot();
    const rasterImage = croppedSnapshot.makeNonTextureImage();
    const image = rasterImage ?? croppedSnapshot;
    try {
      return `data:image/jpeg;base64,${image.encodeToBase64(ImageFormat.JPEG, 90)}`;
    } finally {
      if (rasterImage && rasterImage !== croppedSnapshot) rasterImage.dispose();
      croppedSnapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}

export function DocumentCamera({
  device,
  isActive,
  onCropCaptured,
  onDetectionChange,
  onProcessorError,
  onTorchError,
  torchMode,
}: DocumentCameraProps) {
  const cameraRef = useRef<SkiaCameraRef>(null);
  const resizerState = useResizer({
    width: ANALYSIS_WIDTH,
    height: ANALYSIS_HEIGHT,
    channelOrder: 'bgr',
    dataType: 'uint8',
    scaleMode: 'cover',
    pixelLayout: 'interleaved',
  });
  const frameCounter = useSharedValue(0);
  const consecutiveMisses = useSharedValue(0);
  const consecutiveDetections = useSharedValue(0);
  const lastDocument = useSharedValue<DocumentQuadrilateral | null>(null);
  const lastReportedDetection = useSharedValue(false);
  const didReportProcessorError = useSharedValue(false);
  const didCapture = useSharedValue(false);

  useEffect(() => {
    if (resizerState.state === 'error') {
      onProcessorError(resizerState.error.message);
    }
  }, [onProcessorError, resizerState]);

  useEffect(() => {
    if (!isActive) return;
    const animationFrame = requestAnimationFrame(() => {
      cameraRef.current?.setTorchMode(torchMode).catch((caught) => {
        if (torchMode === 'on') {
          onTorchError(caught instanceof Error ? caught.message : String(caught));
        }
      });
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [isActive, onTorchError, torchMode]);

  const captureDetectedFrame = useCallback(
    (
      quadrilateral: DocumentQuadrilateral,
      frameWidth: number,
      frameHeight: number,
    ) => {
      let attemptsRemaining = 3;
      const attemptCapture = () => {
        requestAnimationFrame(() => {
          const snapshot = cameraRef.current?.takeSnapshot();
          if (!snapshot) {
            attemptsRemaining -= 1;
            if (attemptsRemaining > 0) {
              attemptCapture();
            } else {
              didCapture.value = false;
              consecutiveDetections.value = 0;
              onProcessorError('Não foi possível obter a imagem da câmara. Tente novamente.');
            }
            return;
          }

          try {
            const imageUri = cropSnapshot(snapshot, quadrilateral, frameWidth, frameHeight);
            if (!imageUri) throw new Error('A superfície do recorte não ficou disponível.');
            onCropCaptured(imageUri);
          } catch (caught) {
            didCapture.value = false;
            consecutiveDetections.value = 0;
            onProcessorError(caught instanceof Error ? caught.message : String(caught));
          } finally {
            snapshot.dispose();
          }
        });
      };
      attemptCapture();
    },
    [consecutiveDetections, didCapture, onCropCaptured, onProcessorError],
  );

  const processFrame = useCallback(
    (frame: Frame, render: Parameters<typeof SkiaCamera>[0]['onFrame'] extends (
      frame: Frame,
      render: infer Render,
    ) => void
      ? Render
      : never) => {
      'worklet';
      try {
        frameCounter.value = (frameCounter.value + 1) % DETECTION_INTERVAL_FRAMES;
        if (!didCapture.value && frameCounter.value === 0 && resizerState.resizer) {
          const resizedFrame = resizerState.resizer.resize(frame);
          try {
            const detected = detectDocument(resizedFrame.getPixelBuffer());
            if (detected) {
              lastDocument.value = smoothQuadrilateral(lastDocument.value, detected);
              consecutiveDetections.value += 1;
              consecutiveMisses.value = 0;
              if (!lastReportedDetection.value) {
                lastReportedDetection.value = true;
                scheduleOnRN(onDetectionChange, true);
              }
            } else {
              consecutiveDetections.value = 0;
              consecutiveMisses.value += 1;
              if (consecutiveMisses.value >= MISSES_BEFORE_CLEARING) {
                lastDocument.value = null;
                if (lastReportedDetection.value) {
                  lastReportedDetection.value = false;
                  scheduleOnRN(onDetectionChange, false);
                }
              }
            }
          } finally {
            resizedFrame.dispose();
          }
        }

        const document = lastDocument.value;
        const shouldCapture =
          document !== null &&
          consecutiveDetections.value >= DETECTIONS_BEFORE_CAPTURE &&
          !didCapture.value;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
          if (document && !shouldCapture) {
            drawDetectedDocument(canvas, document, frame);
          }
        });
        if (shouldCapture && document) {
          didCapture.value = true;
          scheduleOnRN(captureDetectedFrame, document, frame.width, frame.height);
        }
      } catch (caught) {
        consecutiveDetections.value = 0;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
        });
        if (!didReportProcessorError.value) {
          didReportProcessorError.value = true;
          const message = caught instanceof Error ? caught.message : String(caught);
          scheduleOnRN(onProcessorError, message);
        }
      } finally {
        frame.dispose();
      }
    },
    [
      consecutiveMisses,
      consecutiveDetections,
      captureDetectedFrame,
      didCapture,
      didReportProcessorError,
      frameCounter,
      lastDocument,
      lastReportedDetection,
      onDetectionChange,
      onProcessorError,
      resizerState.resizer,
    ],
  );

  return (
    <SkiaCamera
      ref={cameraRef}
      device={device}
      enablePhysicalBufferRotation
      enablePreviewSizedOutputBuffers
      isActive={isActive}
      onError={(error) => onProcessorError(error.message)}
      onFrame={processFrame}
      pixelFormat="yuv"
      style={StyleSheet.absoluteFill}
      torchMode={torchMode}
    />
  );
}
