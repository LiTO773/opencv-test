/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable worklet state. */
import {
  AlphaType,
  ColorType,
  FilterMode,
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
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
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
import { scheduleOnRN, type WorkletRuntime } from 'react-native-worklets';

import { CANONICAL_CROP_CONTRACT } from '@/features/bubble-grading/canonical-crop-contract';
import { hardcodedBubbleGradingSchema } from '@/features/bubble-grading/hardcoded-schema';
import {
  analyzeMobileBubbleGradingImageOnRuntime,
} from '@/features/bubble-grading/mobile-bubble-grading';
import {
  createMarkerRegions,
  createSixMarkerRegions,
  detectSixMarkers,
  detectSixMarkersFromRgba,
  mapAnalysisToSource,
} from '@/features/four-point/four-point-detection';
import {
  readQrMetadataInRegions,
  readQrPayloadId,
  type QrPixelRegion,
} from '@/features/four-point/qr-reader';
import type { SixMarkerRegions } from '@/features/four-point/six-marker-layout';
import {
  createFourGuideAnalysis,
  emptySixMarkerMatches,
  evaluatePreviewValidation,
} from '@/features/four-point/six-marker-scanning';
import type {
  FourPointAnalysis,
  FourPointScan,
  FourPointScanState,
  MarkerRegion,
  QrMetadata,
  Quadrilateral,
} from '@/features/four-point/types';

const ANALYSIS_WIDTH = 420;
const DETECTION_INTERVAL_FRAMES = 2;
const CONFIRMATION_FRAMES = 2;

export const CANONICAL_CROP_WIDTH_PX = CANONICAL_CROP_CONTRACT.widthPx;
export const CANONICAL_CROP_HEIGHT_PX = CANONICAL_CROP_CONTRACT.heightPx;

const guidePaint = Skia.Paint();
guidePaint.setStyle(PaintStyle.Stroke);
guidePaint.setStrokeWidth(4);
guidePaint.setStrokeCap(StrokeCap.Round);
guidePaint.setStrokeJoin(StrokeJoin.Round);
guidePaint.setColor(Skia.Color('rgba(255, 255, 255, 0.78)'));

const matchedGuidePaint = Skia.Paint();
matchedGuidePaint.setStyle(PaintStyle.Stroke);
matchedGuidePaint.setStrokeWidth(5);
matchedGuidePaint.setStrokeCap(StrokeCap.Round);
matchedGuidePaint.setStrokeJoin(StrokeJoin.Round);
matchedGuidePaint.setColor(Skia.Color('#34D399'));

const markerPaint = Skia.Paint();
markerPaint.setStyle(PaintStyle.Stroke);
markerPaint.setStrokeWidth(7);
markerPaint.setStrokeCap(StrokeCap.Round);
markerPaint.setStrokeJoin(StrokeJoin.Round);
markerPaint.setColor(Skia.Color('#22C55E'));

type FourPointCameraProps = {
  device: NonNullable<ReturnType<typeof import('react-native-vision-camera').useCameraDevice>>;
  gradingRuntime: WorkletRuntime;
  isActive: boolean;
  onCropCaptured: (scan: FourPointScan) => void;
  onMarkerCountChange: (count: number) => void;
  onProcessorError: (message: string) => void;
  onScanStateChange: (state: FourPointScanState) => void;
  onTorchError: (message: string) => void;
  torchMode: TorchMode;
};

function solveHomography(
  source: Quadrilateral,
  destination: Quadrilateral,
): Matrix3 | null {
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

function nowMilliseconds() {
  return globalThis.performance?.now() ?? Date.now();
}

function roundedMilliseconds(value: number) {
  return Number(value.toFixed(3));
}

function disposeNativeResource(
  resource: { dispose: () => void } | null | undefined,
) {
  try {
    resource?.dispose();
  } catch {
    // Preserve the primary capture/validation result while still attempting to
    // dispose every remaining native resource.
  }
}

function readCanonicalPixels(image: SkImage, width: number, height: number) {
  const pixels = image.readPixels(0, 0, {
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
    width,
    height,
  });
  if (!pixels || pixels instanceof Float32Array) {
    throw new Error('Não foi possível ler os píxeis da imagem canónica para classificação.');
  }
  const copy = new Uint8Array(pixels.byteLength);
  copy.set(pixels);
  return copy;
}

function rotateRgba180InPlace(pixels: Uint8Array) {
  for (let left = 0, right = pixels.length - 4; left < right; left += 4, right -= 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const temporary = pixels[left + channel];
      pixels[left + channel] = pixels[right + channel];
      pixels[right + channel] = temporary;
    }
  }
}

function expandedQrRegion(region: QrPixelRegion, padding: number): QrPixelRegion {
  return {
    x: region.x - padding,
    y: region.y - padding,
    width: region.width + padding * 2,
    height: region.height + padding * 2,
  };
}

function qrSearchRegions(width: number, height: number): QrPixelRegion[] {
  const declared = hardcodedBubbleGradingSchema.qrRegionPx;
  const opposite = {
    x: width - declared.x - declared.width,
    y: height - declared.y - declared.height,
    width: declared.width,
    height: declared.height,
  };
  return [expandedQrRegion(declared, 12), expandedQrRegion(opposite, 12)];
}

type CanonicalScanPixels = {
  width: number;
  height: number;
  rgba: Uint8Array;
  qr: QrMetadata | null;
  perspectiveCorrectionMs: number;
  qrDecodeMs: number;
};

function normalizeSnapshot(
  snapshot: SkImage,
  analysisQuadrilateral: Quadrilateral,
  analysisWidth: number,
  analysisHeight: number,
): CanonicalScanPixels | null {
  const normalizationStartedAt = nowMilliseconds();
  const source = analysisQuadrilateral.map((point) =>
    mapAnalysisToSource(
      point,
      analysisWidth,
      analysisHeight,
      snapshot.width(),
      snapshot.height(),
    ),
  ) as Quadrilateral;
  const outputWidth = CANONICAL_CROP_WIDTH_PX;
  const outputHeight = CANONICAL_CROP_HEIGHT_PX;
  const destination: Quadrilateral = [
    { x: 0, y: 0 },
    { x: outputWidth, y: 0 },
    { x: outputWidth, y: outputHeight },
    { x: 0, y: outputHeight },
  ];
  const transform = solveHomography(source, destination);
  if (!transform) return null;

  const surface = Skia.Surface.Make(outputWidth, outputHeight);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#FFFFFF'));
    canvas.save();
    canvas.concat(transform);
    canvas.drawImage(snapshot, 0, 0);
    canvas.restore();
    surface.flush();

    const normalizedSnapshot = surface.makeImageSnapshot();
    const rasterImage = normalizedSnapshot.makeNonTextureImage();
    const normalizedImage = rasterImage ?? normalizedSnapshot;
    try {
      const rgba = readCanonicalPixels(normalizedImage, outputWidth, outputHeight);
      const qrStartedAt = nowMilliseconds();
      const detectedQr = readQrMetadataInRegions(
        new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
        outputWidth,
        outputHeight,
        qrSearchRegions(outputWidth, outputHeight),
      );
      const qrDecodeMs = roundedMilliseconds(nowMilliseconds() - qrStartedAt);
      let qr = detectedQr;
      if (detectedQr?.orientation === 'upside-down') {
        rotateRgba180InPlace(rgba);
        qr = {
          ...detectedQr,
          orientation: 'upright',
          rotationApplied: 180,
        };
      }

      return {
        width: outputWidth,
        height: outputHeight,
        rgba,
        qr,
        perspectiveCorrectionMs: roundedMilliseconds(qrStartedAt - normalizationStartedAt),
        qrDecodeMs,
      };
    } finally {
      if (rasterImage && rasterImage !== normalizedSnapshot) rasterImage.dispose();
      normalizedSnapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}

function makeStillAnalysisBuffer(
  image: SkImage,
  analysisWidth: number,
  analysisHeight: number,
) {
  const surface = Skia.Surface.Make(analysisWidth, analysisHeight);
  if (!surface) return null;
  try {
    const imageWidth = image.width();
    const imageHeight = image.height();
    const scale = Math.max(analysisWidth / imageWidth, analysisHeight / imageHeight);
    const visibleWidth = analysisWidth / scale;
    const visibleHeight = analysisHeight / scale;
    const source = Skia.XYWHRect(
      (imageWidth - visibleWidth) / 2,
      (imageHeight - visibleHeight) / 2,
      visibleWidth,
      visibleHeight,
    );
    const destination = Skia.XYWHRect(0, 0, analysisWidth, analysisHeight);
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
        width: analysisWidth,
        height: analysisHeight,
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
  const orientedImage = await photo.toImageAsync();
  try {
    const raw = await orientedImage.toRawPixelDataAsync();
    let data = Skia.Data.fromBytes(new Uint8Array(raw.buffer));
    const colorType =
      raw.pixelFormat === 'BGRA'
        ? ColorType.BGRA_8888
        : raw.pixelFormat === 'RGBA'
          ? ColorType.RGBA_8888
          : null;
    let image = colorType
      ? Skia.Image.MakeImage(
          {
            alphaType: AlphaType.Opaque,
            colorType,
            width: raw.width,
            height: raw.height,
          },
          data,
          raw.width * 4,
        )
      : null;
    if (image) {
      const sourceImage = image;
      const swapsDimensions = photo.orientation === 'right' || photo.orientation === 'left';
      const outputWidth = swapsDimensions ? sourceImage.height() : sourceImage.width();
      const outputHeight = swapsDimensions ? sourceImage.width() : sourceImage.height();
      if (Platform.OS === 'ios' && (photo.orientation !== 'up' || photo.isMirrored)) {
        const surface = Skia.Surface.Make(outputWidth, outputHeight);
        if (!surface) {
          sourceImage.dispose();
          data.dispose();
          throw new Error('Não foi possível orientar a fotografia final.');
        }
        const canvas = surface.getCanvas();
        canvas.clear(Skia.Color('#FFFFFF'));
        if (photo.isMirrored) {
          canvas.translate(outputWidth, 0);
          canvas.scale(-1, 1);
        }
        if (photo.orientation === 'right') {
          canvas.translate(sourceImage.height(), 0);
          canvas.rotate(90, 0, 0);
        } else if (photo.orientation === 'down') {
          canvas.translate(sourceImage.width(), sourceImage.height());
          canvas.rotate(180, 0, 0);
        } else if (photo.orientation === 'left') {
          canvas.translate(0, sourceImage.width());
          canvas.rotate(-90, 0, 0);
        }
        canvas.drawImage(sourceImage, 0, 0);
        surface.flush();
        image = surface.makeImageSnapshot();
        return { data, image, sourceImage, surface };
      }
    } else {
      data.dispose();
      const encodedImage = await orientedImage.toEncodedImageDataAsync('jpg', 90);
      data = Skia.Data.fromBytes(new Uint8Array(encodedImage.buffer));
      image = Skia.Image.MakeImageFromEncoded(data);
    }
    if (!image) {
      data.dispose();
      throw new Error('Não foi possível descodificar a fotografia final.');
    }
    return { data, image };
  } finally {
    orientedImage.dispose();
  }
}

function analyzeAndNormalizeCapturedImage(
  image: SkImage,
  analysisWidth: number,
  analysisHeight: number,
  regions: SixMarkerRegions,
) {
  const detectionStartedAt = nowMilliseconds();
  const analysisBuffer = makeStillAnalysisBuffer(image, analysisWidth, analysisHeight);
  if (!analysisBuffer) {
    throw new Error('Não foi possível preparar a fotografia final para análise.');
  }
  const analysis = detectSixMarkersFromRgba(
    analysisBuffer,
    analysisWidth,
    analysisHeight,
    regions,
  );
  const finalDetectionMs = roundedMilliseconds(nowMilliseconds() - detectionStartedAt);
  if (!analysis.cropQuadrilateral) {
    if (analysis.matchedCount < 4) {
      throw new Error(
        'A fotografia final já não contém os quatro marcadores exteriores. Enquadre a folha e tente novamente.',
      );
    }
    throw new Error(
      'A fotografia final não passou a validação da página. Mantenha a folha estável e tente novamente.',
    );
  }
  const scan = normalizeSnapshot(
    image,
    analysis.cropQuadrilateral,
    analysisWidth,
    analysisHeight,
  );
  if (!scan) throw new Error('Não foi possível corrigir a perspetiva da fotografia.');
  return { ...scan, finalDetectionMs };
}

function drawQuadrilateral(
  canvas: SkCanvas,
  quadrilateral: Quadrilateral,
  frame: Frame,
  analysisWidth: number,
  analysisHeight: number,
) {
  'worklet';
  const mapped = quadrilateral.map((point) =>
    mapAnalysisToSource(
      point,
      analysisWidth,
      analysisHeight,
      frame.width,
      frame.height,
    ),
  ) as Quadrilateral;
  const path = Skia.Path.Make();
  path.moveTo(mapped[0].x, mapped[0].y);
  for (let index = 1; index < mapped.length; index += 1) {
    path.lineTo(mapped[index].x, mapped[index].y);
  }
  path.close();
  canvas.drawPath(path, markerPaint);
}

function drawDetectionOverlay(
  canvas: SkCanvas,
  frame: Frame,
  analysis: FourPointAnalysis,
  regions: readonly MarkerRegion[],
  analysisWidth: number,
  analysisHeight: number,
) {
  'worklet';
  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    const topLeft = mapAnalysisToSource(
      { x: region.x, y: region.y },
      analysisWidth,
      analysisHeight,
      frame.width,
      frame.height,
    );
    const bottomRight = mapAnalysisToSource(
      { x: region.x + region.width, y: region.y + region.height },
      analysisWidth,
      analysisHeight,
      frame.width,
      frame.height,
    );
    const rectangle = Skia.XYWHRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
    canvas.drawRRect(
      Skia.RRectXY(rectangle, 18, 18),
      analysis.markers[index] ? matchedGuidePaint : guidePaint,
    );
    const marker = analysis.markers[index];
    if (marker) {
      drawQuadrilateral(
        canvas,
        marker.corners,
        frame,
        analysisWidth,
        analysisHeight,
      );
    }
  }
}

const emptyAnalysis: FourPointAnalysis = createFourGuideAnalysis(
  emptySixMarkerMatches(),
  null,
);

export function FourPointCamera({
  device,
  gradingRuntime,
  isActive,
  onCropCaptured,
  onMarkerCountChange,
  onProcessorError,
  onScanStateChange,
  onTorchError,
  torchMode,
}: FourPointCameraProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const analysisHeight = Math.max(
    600,
    Math.min(960, Math.round((ANALYSIS_WIDTH * windowHeight) / windowWidth)),
  );
  const detectionRegions = useMemo(
    () => createSixMarkerRegions(ANALYSIS_WIDTH, analysisHeight),
    [analysisHeight],
  );
  const guideRegions = useMemo(
    () => createMarkerRegions(ANALYSIS_WIDTH, analysisHeight),
    [analysisHeight],
  );
  const cameraRef = useRef<SkiaCameraRef>(null);
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: 0.9,
    qualityPrioritization: device.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
    targetResolution: CommonResolutions.QHD_4_3,
  });
  const cameraOutputs = useMemo(() => [photoOutput], [photoOutput]);
  const resizerState = useResizer({
    width: ANALYSIS_WIDTH,
    height: analysisHeight,
    channelOrder: 'bgr',
    dataType: 'uint8',
    scaleMode: 'cover',
    pixelLayout: 'interleaved',
  });
  const frameCounter = useSharedValue(0);
  const renderedFrameCount = useSharedValue(0);
  const captureStartedFrameCount = useSharedValue(0);
  const consecutiveMatches = useSharedValue(0);
  const lastAnalysis = useSharedValue<FourPointAnalysis>(emptyAnalysis);
  const lastReportedMarkerCount = useSharedValue(0);
  const lastReportedScanState = useSharedValue<FourPointScanState>('searching');
  const didReportProcessorError = useSharedValue(false);
  const didCapture = useSharedValue(false);

  useEffect(() => {
    if (resizerState.state === 'error') onProcessorError(resizerState.error.message);
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
    let captureFailed = false;
    const pipelineStartedAt = nowMilliseconds();
    try {
      const captureStartedAt = nowMilliseconds();
      photo = await photoOutput.capturePhoto(
        { enableShutterSound: false, flashMode: 'off' },
        {},
      );
      const capturePhotoMs = roundedMilliseconds(nowMilliseconds() - captureStartedAt);
      lastReportedScanState.value = 'processing';
      onScanStateChange('processing');

      const decodeStartedAt = nowMilliseconds();
      decodedPhoto = await makeSkiaImageFromPhoto(photo);
      const decodePhotoMs = roundedMilliseconds(nowMilliseconds() - decodeStartedAt);
      const canonical = analyzeAndNormalizeCapturedImage(
        decodedPhoto.image,
        ANALYSIS_WIDTH,
        analysisHeight,
        detectionRegions,
      );
      const gradingStartedAt = nowMilliseconds();
      const grading = await analyzeMobileBubbleGradingImageOnRuntime(
        gradingRuntime,
        canonical.rgba,
        canonical.width,
        canonical.height,
        canonical.qr,
      );
      const gradingMs = roundedMilliseconds(nowMilliseconds() - gradingStartedAt);
      const totalMs = roundedMilliseconds(nowMilliseconds() - pipelineStartedAt);
      const previewFramesDuringPipeline = Math.max(
        0,
        renderedFrameCount.value - captureStartedFrameCount.value,
      );
      onCropCaptured({
        width: canonical.width,
        height: canonical.height,
        qr: canonical.qr,
        studentId: canonical.qr ? readQrPayloadId(canonical.qr, 'studentId') : null,
        grading,
        pipelineTimings: {
          capturePhotoMs,
          decodePhotoMs,
          finalDetectionMs: canonical.finalDetectionMs,
          perspectiveCorrectionMs: canonical.perspectiveCorrectionMs,
          qrDecodeMs: canonical.qrDecodeMs,
          gradingMs,
          previewFramesDuringPipeline,
          previewFpsDuringPipeline:
            totalMs === 0
              ? 0
              : roundedMilliseconds((previewFramesDuringPipeline * 1000) / totalMs),
          totalMs,
        },
      });
    } catch (caught) {
      captureFailed = true;
      consecutiveMatches.value = 0;
      lastAnalysis.value = emptyAnalysis;
      lastReportedMarkerCount.value = 0;
      lastReportedScanState.value = 'searching';
      onMarkerCountChange(0);
      onScanStateChange('searching');
      onProcessorError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      disposeNativeResource(decodedPhoto?.image);
      disposeNativeResource(decodedPhoto?.sourceImage);
      disposeNativeResource(decodedPhoto?.surface);
      disposeNativeResource(decodedPhoto?.data);
      disposeNativeResource(photo);
      if (captureFailed) didCapture.value = false;
    }
  }, [
    analysisHeight,
    captureStartedFrameCount,
    consecutiveMatches,
    didCapture,
    gradingRuntime,
    lastAnalysis,
    lastReportedMarkerCount,
    lastReportedScanState,
    onCropCaptured,
    onMarkerCountChange,
    onProcessorError,
    onScanStateChange,
    photoOutput,
    renderedFrameCount,
    detectionRegions,
  ]);

  const reportMarkerCount = useCallback(
    (count: number) => onMarkerCountChange(count),
    [onMarkerCountChange],
  );
  const reportScanState = useCallback(
    (state: FourPointScanState) => onScanStateChange(state),
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
        let shouldCapture = false;
        renderedFrameCount.value += 1;
        frameCounter.value = (frameCounter.value + 1) % DETECTION_INTERVAL_FRAMES;
        if (!didCapture.value && frameCounter.value === 0 && resizerState.resizer) {
          const resizedFrame = resizerState.resizer.resize(frame);
          try {
            const analysis = detectSixMarkers(
              resizedFrame.getPixelBuffer(),
              ANALYSIS_WIDTH,
              analysisHeight,
              detectionRegions,
            );
            lastAnalysis.value = analysis;
            didReportProcessorError.value = false;
            if (analysis.matchedCount !== lastReportedMarkerCount.value) {
              lastReportedMarkerCount.value = analysis.matchedCount;
              scheduleOnRN(reportMarkerCount, analysis.matchedCount);
            }

            const validation = evaluatePreviewValidation(
              analysis,
              consecutiveMatches.value,
              CONFIRMATION_FRAMES,
              didCapture.value,
            );
            consecutiveMatches.value = validation.consecutiveCompleteLayouts;
            shouldCapture = validation.shouldCapture;
            if (lastReportedScanState.value !== validation.scanState) {
              lastReportedScanState.value = validation.scanState;
              scheduleOnRN(reportScanState, validation.scanState);
            }
          } finally {
            resizedFrame.dispose();
          }
        }

        const analysis = lastAnalysis.value;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
          drawDetectionOverlay(
            canvas,
            frame,
            analysis,
            guideRegions,
            ANALYSIS_WIDTH,
            analysisHeight,
          );
        });

        if (shouldCapture) {
          didCapture.value = true;
          captureStartedFrameCount.value = renderedFrameCount.value;
          lastReportedScanState.value = 'capturing';
          scheduleOnRN(reportScanState, 'capturing');
          scheduleOnRN(captureFinalPhoto);
        }
      } catch (caught) {
        consecutiveMatches.value = 0;
        lastAnalysis.value = emptyAnalysis;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
          drawDetectionOverlay(
            canvas,
            frame,
            emptyAnalysis,
            guideRegions,
            ANALYSIS_WIDTH,
            analysisHeight,
          );
        });
        if (lastReportedMarkerCount.value !== 0) {
          lastReportedMarkerCount.value = 0;
          scheduleOnRN(reportMarkerCount, 0);
        }
        if (lastReportedScanState.value !== 'searching') {
          lastReportedScanState.value = 'searching';
          scheduleOnRN(reportScanState, 'searching');
        }
        if (!didReportProcessorError.value) {
          didReportProcessorError.value = true;
          scheduleOnRN(
            onProcessorError,
            caught instanceof Error ? caught.message : String(caught),
          );
        }
      } finally {
        frame.dispose();
      }
    },
    [
      analysisHeight,
      captureStartedFrameCount,
      captureFinalPhoto,
      consecutiveMatches,
      didCapture,
      didReportProcessorError,
      detectionRegions,
      frameCounter,
      guideRegions,
      lastAnalysis,
      lastReportedMarkerCount,
      lastReportedScanState,
      onProcessorError,
      renderedFrameCount,
      reportMarkerCount,
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
