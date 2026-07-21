/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable worklet state. */
import {
  AlphaType,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type Matrix3,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  CommonResolutions,
  usePhotoOutput,
  type Frame,
  type Photo,
  type TorchMode,
} from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { SkiaCamera, type SkiaCameraRef } from 'react-native-vision-camera-skia';
import { scheduleOnRN } from 'react-native-worklets';

import {
  ANALYSIS_HEIGHT,
  ANALYSIS_WIDTH,
  detectDocument,
  detectDocumentFromRgba,
  mapAnalysisToFrame,
  smoothQuadrilateral,
} from '@/features/document-scanner/document-detection';
import { readQrMetadata } from '@/features/document-scanner/qr-reader';
import type {
  DocumentQuadrilateral,
  DocumentScan,
  QrMetadata,
  ScanState,
} from '@/features/document-scanner/types';

const DETECTION_INTERVAL_FRAMES = 4;
const STABLE_DETECTIONS_BEFORE_CAPTURE = 5;
const MISSES_BEFORE_CLEARING = 4;
const MAX_STABLE_CORNER_MOVEMENT = ANALYSIS_WIDTH * 0.01;
const MIN_PREVIEW_SHARPNESS = 65;
const MIN_CAPTURE_SHARPNESS = 75;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_PIXELS_PER_MM = 4;
export const A4_IMAGE_WIDTH = A4_WIDTH_MM * A4_PIXELS_PER_MM;
export const A4_IMAGE_HEIGHT = A4_HEIGHT_MM * A4_PIXELS_PER_MM;
const EDGE_CLEANUP_PX = A4_PIXELS_PER_MM;

const documentFill = Skia.Paint();
documentFill.setStyle(PaintStyle.Fill);
documentFill.setColor(Skia.Color('rgba(45, 212, 191, 0.18)'));

const documentBorder = Skia.Paint();
documentBorder.setStyle(PaintStyle.Stroke);
documentBorder.setStrokeWidth(5);
documentBorder.setStrokeCap(StrokeCap.Round);
documentBorder.setStrokeJoin(StrokeJoin.Round);
documentBorder.setColor(Skia.Color('#5EEAD4'));

const pageEdgeCleanup = Skia.Paint();
pageEdgeCleanup.setStyle(PaintStyle.Fill);
pageEdgeCleanup.setColor(Skia.Color('#FFFFFF'));

type DocumentCameraProps = {
  device: NonNullable<ReturnType<typeof import('react-native-vision-camera').useCameraDevice>>;
  isActive: boolean;
  onCropCaptured: (scan: DocumentScan) => void;
  onProcessorError: (message: string) => void;
  onScanStateChange: (state: ScanState) => void;
  onTorchError: (message: string) => void;
  torchMode: TorchMode;
};

function maximumCornerMovement(
  previous: DocumentQuadrilateral,
  next: DocumentQuadrilateral,
) {
  'worklet';
  let maximum = 0;
  for (let index = 0; index < previous.length; index += 1) {
    maximum = Math.max(
      maximum,
      Math.hypot(previous[index].x - next[index].x, previous[index].y - next[index].y),
    );
  }
  return maximum;
}

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

function cleanNormalizedPageEdges(canvas: SkCanvas) {
  canvas.drawRect(Skia.XYWHRect(0, 0, A4_IMAGE_WIDTH, EDGE_CLEANUP_PX), pageEdgeCleanup);
  canvas.drawRect(
    Skia.XYWHRect(0, A4_IMAGE_HEIGHT - EDGE_CLEANUP_PX, A4_IMAGE_WIDTH, EDGE_CLEANUP_PX),
    pageEdgeCleanup,
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, EDGE_CLEANUP_PX, A4_IMAGE_HEIGHT), pageEdgeCleanup);
  canvas.drawRect(
    Skia.XYWHRect(A4_IMAGE_WIDTH - EDGE_CLEANUP_PX, 0, EDGE_CLEANUP_PX, A4_IMAGE_HEIGHT),
    pageEdgeCleanup,
  );
}

function readQrFromImage(image: SkImage) {
  const pixels = image.readPixels(0, 0, {
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
    width: A4_IMAGE_WIDTH,
    height: A4_IMAGE_HEIGHT,
  });
  if (!pixels || pixels instanceof Float32Array) return null;
  return readQrMetadata(
    new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength),
    A4_IMAGE_WIDTH,
    A4_IMAGE_HEIGHT,
  );
}

function rotatePage180(image: SkImage) {
  const surface = Skia.Surface.Make(A4_IMAGE_WIDTH, A4_IMAGE_HEIGHT);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#FFFFFF'));
  canvas.rotate(180, A4_IMAGE_WIDTH / 2, A4_IMAGE_HEIGHT / 2);
  canvas.drawImage(image, 0, 0);
  surface.flush();
  return { image: surface.makeImageSnapshot(), surface };
}

function normalizeSnapshot(
  snapshot: SkImage,
  quadrilateral: DocumentQuadrilateral,
  frameWidth: number,
  frameHeight: number,
  sharpness: number,
): DocumentScan | null {
  const source = quadrilateral.map((point) =>
    mapAnalysisToFrame(point, frameWidth, frameHeight),
  ) as DocumentQuadrilateral;
  const destination: DocumentQuadrilateral = [
    { x: 0, y: 0 },
    { x: A4_IMAGE_WIDTH, y: 0 },
    { x: A4_IMAGE_WIDTH, y: A4_IMAGE_HEIGHT },
    { x: 0, y: A4_IMAGE_HEIGHT },
  ];
  const transform = solveHomography(source, destination);
  if (!transform) return null;

  const surface = Skia.Surface.Make(A4_IMAGE_WIDTH, A4_IMAGE_HEIGHT);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#FFFFFF'));
    canvas.save();
    canvas.concat(transform);
    canvas.drawImage(snapshot, 0, 0);
    canvas.restore();
    cleanNormalizedPageEdges(canvas);
    surface.flush();

    const normalizedSnapshot = surface.makeImageSnapshot();
    const rasterImage = normalizedSnapshot.makeNonTextureImage();
    const normalizedImage = rasterImage ?? normalizedSnapshot;
    const detectedQr = readQrFromImage(normalizedImage);
    let qr: QrMetadata | null = detectedQr;
    let rotatedPage: ReturnType<typeof rotatePage180> = null;
    try {
      let finalImage = normalizedImage;
      if (detectedQr?.orientation === 'upside-down') {
        rotatedPage = rotatePage180(normalizedImage);
        if (rotatedPage) {
          finalImage = rotatedPage.image;
          qr = {
            ...detectedQr,
            orientation: 'upright',
            rotationApplied: 180,
          };
        }
      }

      return {
        imageUri: `data:image/jpeg;base64,${finalImage.encodeToBase64(ImageFormat.JPEG, 92)}`,
        width: A4_IMAGE_WIDTH,
        height: A4_IMAGE_HEIGHT,
        quality: { sharpness },
        qr,
      };
    } finally {
      rotatedPage?.image.dispose();
      rotatedPage?.surface.dispose();
      if (rasterImage && rasterImage !== normalizedSnapshot) rasterImage.dispose();
      normalizedSnapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}

function makeStillAnalysisBuffer(image: SkImage) {
  const surface = Skia.Surface.Make(ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  if (!surface) return null;
  try {
    const imageWidth = image.width();
    const imageHeight = image.height();
    const scale = Math.max(ANALYSIS_WIDTH / imageWidth, ANALYSIS_HEIGHT / imageHeight);
    const visibleWidth = ANALYSIS_WIDTH / scale;
    const visibleHeight = ANALYSIS_HEIGHT / scale;
    const source = Skia.XYWHRect(
      (imageWidth - visibleWidth) / 2,
      (imageHeight - visibleHeight) / 2,
      visibleWidth,
      visibleHeight,
    );
    const destination = Skia.XYWHRect(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#FFFFFF'));
    canvas.drawImageRectOptions(
      image,
      source,
      destination,
      FilterMode.Linear,
      MipmapMode.None,
    );
    surface.flush();

    const analysisImage = surface.makeImageSnapshot();
    try {
      const pixels = analysisImage.readPixels(0, 0, {
        alphaType: AlphaType.Unpremul,
        colorType: ColorType.RGBA_8888,
        width: ANALYSIS_WIDTH,
        height: ANALYSIS_HEIGHT,
      });
      if (!pixels || pixels instanceof Float32Array) return null;
      const copy = new Uint8Array(pixels.byteLength);
      copy.set(pixels);
      return copy.buffer;
    } finally {
      analysisImage.dispose();
    }
  } finally {
    surface.dispose();
  }
}

async function makeSkiaImageFromPhoto(photo: Photo) {
  // `toImageAsync` physically applies the photo's EXIF orientation before we
  // inspect pixels, which keeps Android and iOS portrait captures consistent.
  const orientedImage = await photo.toImageAsync();
  try {
    const encodedImage = await orientedImage.toEncodedImageDataAsync('jpg', 95);
    const data = Skia.Data.fromBytes(new Uint8Array(encodedImage.buffer));
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      data.dispose();
      throw new Error('Não foi possível descodificar a fotografia final.');
    }
    return { data, image };
  } finally {
    orientedImage.dispose();
  }
}

class CaptureRejectedError extends Error {}

function analyzeAndNormalizeCapturedImage(image: SkImage) {
  const analysisBuffer = makeStillAnalysisBuffer(image);
  if (!analysisBuffer) {
    throw new Error('Não foi possível preparar a fotografia final para análise.');
  }
  const analysis = detectDocumentFromRgba(analysisBuffer);
  if (!analysis) {
    throw new CaptureRejectedError(
      'A folha mexeu durante a fotografia. Enquadre novamente os seis quadrados.',
    );
  }
  if (analysis.sharpness < MIN_CAPTURE_SHARPNESS) {
    throw new CaptureRejectedError(
      'A fotografia ficou desfocada. Mantenha a folha e o telemóvel imóveis.',
    );
  }

  const scan = normalizeSnapshot(
    image,
    analysis.quadrilateral,
    image.width(),
    image.height(),
    analysis.sharpness,
  );
  if (!scan) throw new Error('Não foi possível normalizar a fotografia A4 final.');
  return scan;
}

export function DocumentCamera({
  device,
  isActive,
  onCropCaptured,
  onProcessorError,
  onScanStateChange,
  onTorchError,
  torchMode,
}: DocumentCameraProps) {
  const cameraRef = useRef<SkiaCameraRef>(null);
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: 0.95,
    qualityPrioritization: 'quality',
    targetResolution: CommonResolutions.QHD_4_3,
  });
  const cameraOutputs = useMemo(() => [photoOutput], [photoOutput]);
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
  const consecutiveStableDetections = useSharedValue(0);
  const lastDocument = useSharedValue<DocumentQuadrilateral | null>(null);
  const lastRawDocument = useSharedValue<DocumentQuadrilateral | null>(null);
  const lastReportedScanState = useSharedValue<ScanState>('searching');
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

  const captureFinalPhoto = useCallback(async () => {
    let photo: Photo | null = null;
    let decodedPhoto: Awaited<ReturnType<typeof makeSkiaImageFromPhoto>> | null = null;
    try {
      photo = await photoOutput.capturePhoto(
        { enableShutterSound: false, flashMode: 'off' },
        {},
      );
      decodedPhoto = await makeSkiaImageFromPhoto(photo);
      const scan = analyzeAndNormalizeCapturedImage(decodedPhoto.image);
      onCropCaptured(scan);
    } catch (caught) {
      didCapture.value = false;
      consecutiveStableDetections.value = 0;
      consecutiveMisses.value = 0;
      lastDocument.value = null;
      lastRawDocument.value = null;
      lastReportedScanState.value = 'searching';
      onScanStateChange('searching');
      onProcessorError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      decodedPhoto?.image.dispose();
      decodedPhoto?.data.dispose();
      photo?.dispose();
    }
  }, [
    consecutiveMisses,
    consecutiveStableDetections,
    didCapture,
    lastDocument,
    lastRawDocument,
    lastReportedScanState,
    onCropCaptured,
    onProcessorError,
    onScanStateChange,
    photoOutput,
  ]);

  const reportScanState = useCallback(
    (state: ScanState) => {
      onScanStateChange(state);
    },
    [onScanStateChange],
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
              const previous = lastRawDocument.value;
              const isStable =
                previous !== null &&
                maximumCornerMovement(previous, detected.quadrilateral) <=
                  MAX_STABLE_CORNER_MOVEMENT &&
                detected.sharpness >= MIN_PREVIEW_SHARPNESS;
              lastRawDocument.value = detected.quadrilateral;
              lastDocument.value = smoothQuadrilateral(
                lastDocument.value,
                detected.quadrilateral,
              );
              consecutiveStableDetections.value = isStable
                ? consecutiveStableDetections.value + 1
                : 0;
              consecutiveMisses.value = 0;
              const waitingState: ScanState =
                detected.sharpness >= MIN_PREVIEW_SHARPNESS
                  ? 'hold-steady'
                  : 'improve-focus';
              if (
                consecutiveStableDetections.value < STABLE_DETECTIONS_BEFORE_CAPTURE &&
                lastReportedScanState.value !== waitingState
              ) {
                lastReportedScanState.value = waitingState;
                scheduleOnRN(reportScanState, waitingState);
              }
            } else {
              consecutiveStableDetections.value = 0;
              lastRawDocument.value = null;
              consecutiveMisses.value += 1;
              if (consecutiveMisses.value >= MISSES_BEFORE_CLEARING) {
                lastDocument.value = null;
                if (lastReportedScanState.value !== 'searching') {
                  lastReportedScanState.value = 'searching';
                  scheduleOnRN(reportScanState, 'searching');
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
          consecutiveStableDetections.value >= STABLE_DETECTIONS_BEFORE_CAPTURE &&
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
          lastReportedScanState.value = 'capturing';
          scheduleOnRN(reportScanState, 'capturing');
          scheduleOnRN(captureFinalPhoto);
        }
      } catch (caught) {
        consecutiveStableDetections.value = 0;
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
      consecutiveStableDetections,
      captureFinalPhoto,
      didCapture,
      didReportProcessorError,
      frameCounter,
      lastDocument,
      lastRawDocument,
      lastReportedScanState,
      onProcessorError,
      reportScanState,
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
      outputs={cameraOutputs}
      pixelFormat="yuv"
      style={StyleSheet.absoluteFill}
      torchMode={torchMode}
    />
  );
}
