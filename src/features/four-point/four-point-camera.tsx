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
import { StyleSheet, useWindowDimensions } from 'react-native';
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
  createMarkerRegions,
  detectFourPoints,
  detectFourPointsFromRgba,
  mapAnalysisToSource,
} from '@/features/four-point/four-point-detection';
import { readQrMetadata } from '@/features/four-point/qr-reader';
import type {
  FourPointAnalysis,
  FourPointScan,
  FourPointScanState,
  MarkerRegion,
  Point2D,
  QrMetadata,
  Quadrilateral,
} from '@/features/four-point/types';

const ANALYSIS_WIDTH = 420;
const DETECTION_INTERVAL_FRAMES = 2;
const CONFIRMATION_FRAMES = 2;

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

function edgeLength(first: Point2D, second: Point2D) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function readQrFromImage(image: SkImage, width: number, height: number) {
  const pixels = image.readPixels(0, 0, {
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
    width,
    height,
  });
  if (!pixels || pixels instanceof Float32Array) return null;
  return readQrMetadata(
    new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength),
    width,
    height,
  );
}

function rotatePage180(image: SkImage, width: number, height: number) {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#FFFFFF'));
    canvas.rotate(180, width / 2, height / 2);
    canvas.drawImage(image, 0, 0);
    surface.flush();
    return { image: surface.makeImageSnapshot(), surface };
  } catch (caught) {
    surface.dispose();
    throw caught;
  }
}

function normalizeSnapshot(
  snapshot: SkImage,
  analysisQuadrilateral: Quadrilateral,
  analysisWidth: number,
  analysisHeight: number,
): FourPointScan | null {
  const source = analysisQuadrilateral.map((point) =>
    mapAnalysisToSource(
      point,
      analysisWidth,
      analysisHeight,
      snapshot.width(),
      snapshot.height(),
    ),
  ) as Quadrilateral;
  const outputWidth = Math.max(
    1,
    Math.round((edgeLength(source[0], source[1]) + edgeLength(source[3], source[2])) / 2),
  );
  const outputHeight = Math.max(
    1,
    Math.round((edgeLength(source[0], source[3]) + edgeLength(source[1], source[2])) / 2),
  );
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
    let rotatedPage: ReturnType<typeof rotatePage180> = null;
    try {
      const detectedQr = readQrFromImage(normalizedImage, outputWidth, outputHeight);
      let qr: QrMetadata | null = detectedQr;
      let finalImage = normalizedImage;
      if (detectedQr?.orientation === 'upside-down') {
        rotatedPage = rotatePage180(normalizedImage, outputWidth, outputHeight);
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
        width: outputWidth,
        height: outputHeight,
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

function analyzeAndNormalizeCapturedImage(
  image: SkImage,
  analysisWidth: number,
  analysisHeight: number,
  regions: readonly MarkerRegion[],
) {
  const analysisBuffer = makeStillAnalysisBuffer(image, analysisWidth, analysisHeight);
  if (!analysisBuffer) {
    throw new Error('Não foi possível preparar a fotografia final para análise.');
  }
  const analysis = detectFourPointsFromRgba(
    analysisBuffer,
    analysisWidth,
    analysisHeight,
    regions,
  );
  if (!analysis.cropQuadrilateral) {
    throw new Error('Um marcador saiu da área durante a fotografia. Enquadre novamente.');
  }
  const scan = normalizeSnapshot(
    image,
    analysis.cropQuadrilateral,
    analysisWidth,
    analysisHeight,
  );
  if (!scan) throw new Error('Não foi possível corrigir a perspetiva da fotografia.');
  return scan;
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

const emptyAnalysis: FourPointAnalysis = {
  cropQuadrilateral: null,
  markers: [null, null, null, null],
  matchedCount: 0,
};

export function FourPointCamera({
  device,
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
  const regions = useMemo(
    () => createMarkerRegions(ANALYSIS_WIDTH, analysisHeight),
    [analysisHeight],
  );
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
    height: analysisHeight,
    channelOrder: 'bgr',
    dataType: 'uint8',
    scaleMode: 'cover',
    pixelLayout: 'interleaved',
  });
  const frameCounter = useSharedValue(0);
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
    try {
      photo = await photoOutput.capturePhoto(
        { enableShutterSound: false, flashMode: 'off' },
        {},
      );
      decodedPhoto = await makeSkiaImageFromPhoto(photo);
      const scan = analyzeAndNormalizeCapturedImage(
        decodedPhoto.image,
        ANALYSIS_WIDTH,
        analysisHeight,
        regions,
      );
      onCropCaptured(scan);
    } catch (caught) {
      didCapture.value = false;
      consecutiveMatches.value = 0;
      lastAnalysis.value = emptyAnalysis;
      lastReportedMarkerCount.value = 0;
      lastReportedScanState.value = 'searching';
      onMarkerCountChange(0);
      onScanStateChange('searching');
      onProcessorError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      decodedPhoto?.image.dispose();
      decodedPhoto?.data.dispose();
      photo?.dispose();
    }
  }, [
    analysisHeight,
    consecutiveMatches,
    didCapture,
    lastAnalysis,
    lastReportedMarkerCount,
    lastReportedScanState,
    onCropCaptured,
    onMarkerCountChange,
    onProcessorError,
    onScanStateChange,
    photoOutput,
    regions,
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
        frameCounter.value = (frameCounter.value + 1) % DETECTION_INTERVAL_FRAMES;
        if (!didCapture.value && frameCounter.value === 0 && resizerState.resizer) {
          const resizedFrame = resizerState.resizer.resize(frame);
          try {
            const analysis = detectFourPoints(
              resizedFrame.getPixelBuffer(),
              ANALYSIS_WIDTH,
              analysisHeight,
              regions,
            );
            lastAnalysis.value = analysis;
            if (analysis.matchedCount !== lastReportedMarkerCount.value) {
              lastReportedMarkerCount.value = analysis.matchedCount;
              scheduleOnRN(reportMarkerCount, analysis.matchedCount);
            }

            if (analysis.cropQuadrilateral) {
              consecutiveMatches.value += 1;
              if (
                consecutiveMatches.value < CONFIRMATION_FRAMES &&
                lastReportedScanState.value !== 'ready'
              ) {
                lastReportedScanState.value = 'ready';
                scheduleOnRN(reportScanState, 'ready');
              }
            } else {
              consecutiveMatches.value = 0;
              if (lastReportedScanState.value !== 'searching') {
                lastReportedScanState.value = 'searching';
                scheduleOnRN(reportScanState, 'searching');
              }
            }
          } finally {
            resizedFrame.dispose();
          }
        }

        const analysis = lastAnalysis.value;
        const shouldCapture =
          analysis.cropQuadrilateral !== null &&
          consecutiveMatches.value >= CONFIRMATION_FRAMES &&
          !didCapture.value;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
          drawDetectionOverlay(
            canvas,
            frame,
            analysis,
            regions,
            ANALYSIS_WIDTH,
            analysisHeight,
          );
        });

        if (shouldCapture) {
          didCapture.value = true;
          lastReportedScanState.value = 'capturing';
          scheduleOnRN(reportScanState, 'capturing');
          scheduleOnRN(captureFinalPhoto);
        }
      } catch (caught) {
        consecutiveMatches.value = 0;
        render(({ canvas, frameTexture }) => {
          'worklet';
          canvas.drawImage(frameTexture, 0, 0);
          drawDetectionOverlay(
            canvas,
            frame,
            emptyAnalysis,
            regions,
            ANALYSIS_WIDTH,
            analysisHeight,
          );
        });
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
      captureFinalPhoto,
      consecutiveMatches,
      didCapture,
      didReportProcessorError,
      frameCounter,
      lastAnalysis,
      lastReportedMarkerCount,
      lastReportedScanState,
      onProcessorError,
      regions,
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
