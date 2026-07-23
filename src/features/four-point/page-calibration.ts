import {
  SIX_MARKER_POSITIONS,
  WHITE_REFERENCE_CORRIDOR_POSITIONS,
  type SelectedSixMarkerLayout,
  type SixMarkerPosition,
  type WhiteReferenceCorridorPosition,
} from './six-marker-layout';
import type { Point2D, Quadrilateral } from './types';

export const PAGE_CALIBRATION_CONTRACT_VERSION = 'page-reference-calibration-v1';

export type CalibrationFailureCode =
  | 'invalid_sampling_geometry'
  | 'insufficient_black_references'
  | 'insufficient_white_tiles'
  | 'white_clipping'
  | 'black_clipping'
  | 'washed_out_blacks'
  | 'insufficient_dynamic_range'
  | 'excessive_tile_dispersion'
  | 'vertical_reference_disagreement'
  | 'left_right_reference_disagreement'
  | 'black_reference_disagreement';

export type CalibrationSampleRejectionCode =
  | 'outside_image'
  | 'insufficient_pixels'
  | 'sample_dispersion'
  | 'tile_outlier'
  | 'washed_out_black';

export type CalibrationFinding = {
  code: CalibrationFailureCode;
  explanation: string;
};

export type CalibrationImage = {
  width: number;
  height: number;
  data: Uint8Array;
  channels?: 1 | 4;
};

export type CalibrationSampleStatistics = {
  median: number;
  trimmedMean: number;
  dispersion: number;
  darkClippedFraction: number;
  lightClippedFraction: number;
  sampleCount: number;
};

export type CalibrationSampleRegion = {
  id: string;
  kind: 'black-marker' | 'white-tile';
  markerPosition: SixMarkerPosition | null;
  corridorPosition: WhiteReferenceCorridorPosition | null;
  tileIndex: number | null;
  sourceQuadrilateral: Quadrilateral;
  sourceCenter: Point2D;
  normalizedPagePosition: Point2D;
};

export type CalibrationSampleDiagnostic = CalibrationSampleRegion & {
  accepted: boolean;
  rejectionCode: CalibrationSampleRejectionCode | null;
  statistics: CalibrationSampleStatistics | null;
};

export type WhiteCorridorDiagnostic = {
  position: WhiteReferenceCorridorPosition;
  acceptedTileCount: number;
  rejectedTileCount: number;
  robustWhiteValue: number | null;
  dispersion: number | null;
  tiles: CalibrationSampleDiagnostic[];
};

export type PageCalibrationResult = {
  contractVersion: typeof PAGE_CALIBRATION_CONTRACT_VERSION;
  valid: boolean;
  findings: CalibrationFinding[];
  black: {
    acceptedSampleCount: number;
    rejectedSampleCount: number;
    robustValue: number | null;
    dispersion: number | null;
    samples: CalibrationSampleDiagnostic[];
  };
  white: {
    acceptedTileCount: number;
    rejectedTileCount: number;
    robustValue: number | null;
    dispersion: number | null;
    corridors: {
      [Position in WhiteReferenceCorridorPosition]: WhiteCorridorDiagnostic;
    };
  };
  dynamicRange: number | null;
  durationMs: number;
};

export type PageCalibrationConfig = {
  markerInteriorInset: number;
  corridorRows: number;
  corridorColumns: number;
  tileInsetFraction: number;
  sampleGridSize: number;
  minimumSamplesPerRegion: number;
  minimumBlackReferences: number;
  minimumWhiteTilesPerCorridor: number;
  maximumBlackValue: number;
  minimumDynamicRange: number;
  maximumSampleDispersion: number;
  maximumCorridorDispersion: number;
  maximumBlackDisagreement: number;
  maximumVerticalDisagreement: number;
  maximumLeftRightDisagreement: number;
  minimumOutlierDelta: number;
  clippedDarkValue: number;
  clippedLightValue: number;
  maximumClippedFraction: number;
};

export const PAGE_CALIBRATION_CONFIG: PageCalibrationConfig = {
  markerInteriorInset: 0.28,
  corridorRows: 3,
  corridorColumns: 2,
  tileInsetFraction: 0.1,
  sampleGridSize: 12,
  minimumSamplesPerRegion: 64,
  minimumBlackReferences: 6,
  minimumWhiteTilesPerCorridor: 4,
  maximumBlackValue: 120,
  minimumDynamicRange: 80,
  maximumSampleDispersion: 18,
  maximumCorridorDispersion: 70,
  maximumBlackDisagreement: 55,
  maximumVerticalDisagreement: 70,
  maximumLeftRightDisagreement: 70,
  minimumOutlierDelta: 35,
  clippedDarkValue: 1,
  clippedLightValue: 254,
  maximumClippedFraction: 0.85,
};

export const CALIBRATION_FAILURE_EXPLANATIONS: Record<
  CalibrationFailureCode,
  string
> = {
  invalid_sampling_geometry:
    'As regiões de referência não ficaram inteiramente disponíveis na fotografia final.',
  insufficient_black_references:
    'Não foi possível medir com segurança o interior dos seis marcadores pretos.',
  insufficient_white_tiles:
    'Uma ou mais faixas de papel branco não forneceram amostras limpas suficientes.',
  white_clipping:
    'O papel branco ficou sem detalhe por excesso de exposição ou reflexo.',
  black_clipping:
    'Os marcadores pretos ficaram recortados no limite escuro da fotografia.',
  washed_out_blacks:
    'Os marcadores pretos ficaram demasiado claros para uma calibração fiável.',
  insufficient_dynamic_range:
    'A diferença entre o papel branco e os marcadores pretos é insuficiente.',
  excessive_tile_dispersion:
    'As amostras de papel variam demasiado dentro de uma faixa de calibração.',
  vertical_reference_disagreement:
    'A iluminação varia demasiado entre as referências superiores e inferiores.',
  left_right_reference_disagreement:
    'A iluminação varia demasiado entre as margens esquerda e direita.',
  black_reference_disagreement:
    'Os seis marcadores pretos apresentam níveis incompatíveis entre si.',
};

function nowMilliseconds() {
  return globalThis.performance?.now() ?? Date.now();
}

function rounded(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function interpolate(first: Point2D, second: Point2D, progress: number): Point2D {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress,
  };
}

function bilinearPoint(
  quadrilateral: Quadrilateral,
  horizontalProgress: number,
  verticalProgress: number,
) {
  const top = interpolate(quadrilateral[0], quadrilateral[1], horizontalProgress);
  const bottom = interpolate(
    quadrilateral[3],
    quadrilateral[2],
    horizontalProgress,
  );
  return interpolate(top, bottom, verticalProgress);
}

function subQuadrilateral(
  quadrilateral: Quadrilateral,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Quadrilateral {
  return [
    bilinearPoint(quadrilateral, left, top),
    bilinearPoint(quadrilateral, right, top),
    bilinearPoint(quadrilateral, right, bottom),
    bilinearPoint(quadrilateral, left, bottom),
  ];
}

function centerOf(quadrilateral: Quadrilateral) {
  return bilinearPoint(quadrilateral, 0.5, 0.5);
}

function solvePointTransform(source: Quadrilateral, destination: Quadrilateral) {
  const rows: number[][] = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index];
    const target = destination[index];
    rows.push([x, y, 1, 0, 0, 0, -target.x * x, -target.x * y, target.x]);
    rows.push([0, 0, 0, x, y, 1, -target.y * x, -target.y * y, target.y]);
  }
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 0.000001) return null;
    if (pivot !== column) [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
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
  ] as const;
}

function transformPoint(point: Point2D, transform: readonly number[]): Point2D {
  const denominator =
    transform[6] * point.x + transform[7] * point.y + transform[8];
  return {
    x: (transform[0] * point.x + transform[1] * point.y + transform[2]) / denominator,
    y: (transform[3] * point.x + transform[4] * point.y + transform[5]) / denominator,
  };
}

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((first, second) => first - second);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function trimmedMean(values: readonly number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((first, second) => first - second);
  const trim = ordered.length >= 10 ? Math.floor(ordered.length * 0.1) : 0;
  const retained = ordered.slice(trim, ordered.length - trim);
  return retained.reduce((sum, value) => sum + value, 0) / retained.length;
}

function medianAbsoluteDeviation(values: readonly number[], center: number) {
  return median(values.map((value) => Math.abs(value - center))) ?? 0;
}

function sampleStatistics(
  image: CalibrationImage,
  quadrilateral: Quadrilateral,
  config: PageCalibrationConfig,
): CalibrationSampleStatistics | null {
  const values: number[] = [];
  const channels = image.channels ?? 1;
  for (let row = 0; row < config.sampleGridSize; row += 1) {
    const verticalProgress = (row + 0.5) / config.sampleGridSize;
    for (let column = 0; column < config.sampleGridSize; column += 1) {
      const horizontalProgress = (column + 0.5) / config.sampleGridSize;
      const point = bilinearPoint(
        quadrilateral,
        horizontalProgress,
        verticalProgress,
      );
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const pixelIndex = (y * image.width + x) * channels;
      values.push(
        channels === 1
          ? image.data[pixelIndex]
          : Math.round(
              image.data[pixelIndex] * 0.2126 +
                image.data[pixelIndex + 1] * 0.7152 +
                image.data[pixelIndex + 2] * 0.0722,
            ),
      );
    }
  }
  if (values.length < config.minimumSamplesPerRegion) return null;
  const robustMedian = median(values);
  const robustMean = trimmedMean(values);
  if (robustMedian === null || robustMean === null) return null;
  return {
    median: rounded(robustMedian),
    trimmedMean: rounded(robustMean),
    dispersion: rounded(medianAbsoluteDeviation(values, robustMedian)),
    darkClippedFraction: rounded(
      values.filter((value) => value <= config.clippedDarkValue).length / values.length,
      6,
    ),
    lightClippedFraction: rounded(
      values.filter((value) => value >= config.clippedLightValue).length / values.length,
      6,
    ),
    sampleCount: values.length,
  };
}

function buildSamplingPlan(
  layout: SelectedSixMarkerLayout,
  config: PageCalibrationConfig,
): CalibrationSampleRegion[] | null {
  const normalizedTransform = solvePointTransform(layout.cropQuadrilateral, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  if (!normalizedTransform) return null;
  const regions: CalibrationSampleRegion[] = [];

  for (const position of SIX_MARKER_POSITIONS) {
    const sourceQuadrilateral = subQuadrilateral(
      layout.markers[position].corners,
      config.markerInteriorInset,
      config.markerInteriorInset,
      1 - config.markerInteriorInset,
      1 - config.markerInteriorInset,
    );
    const sourceCenter = centerOf(sourceQuadrilateral);
    regions.push({
      id: `black:${position}`,
      kind: 'black-marker',
      markerPosition: position,
      corridorPosition: null,
      tileIndex: null,
      sourceQuadrilateral,
      sourceCenter,
      normalizedPagePosition: transformPoint(sourceCenter, normalizedTransform),
    });
  }

  for (const position of WHITE_REFERENCE_CORRIDOR_POSITIONS) {
    const corridor = layout.whiteReferenceCorridors[position].quadrilateral;
    let tileIndex = 0;
    for (let row = 0; row < config.corridorRows; row += 1) {
      for (let column = 0; column < config.corridorColumns; column += 1) {
        const cellLeft = column / config.corridorColumns;
        const cellRight = (column + 1) / config.corridorColumns;
        const cellTop = row / config.corridorRows;
        const cellBottom = (row + 1) / config.corridorRows;
        const horizontalInset =
          (cellRight - cellLeft) * config.tileInsetFraction;
        const verticalInset = (cellBottom - cellTop) * config.tileInsetFraction;
        const sourceQuadrilateral = subQuadrilateral(
          corridor,
          cellLeft + horizontalInset,
          cellTop + verticalInset,
          cellRight - horizontalInset,
          cellBottom - verticalInset,
        );
        const sourceCenter = centerOf(sourceQuadrilateral);
        regions.push({
          id: `white:${position}:${tileIndex}`,
          kind: 'white-tile',
          markerPosition: null,
          corridorPosition: position,
          tileIndex,
          sourceQuadrilateral,
          sourceCenter,
          normalizedPagePosition: transformPoint(sourceCenter, normalizedTransform),
        });
        tileIndex += 1;
      }
    }
  }
  return regions;
}

export function createPageCalibrationSamplingPlan(
  layout: SelectedSixMarkerLayout,
  config: PageCalibrationConfig = PAGE_CALIBRATION_CONFIG,
) {
  return buildSamplingPlan(layout, config);
}

export function mapPageCalibrationLayout(
  layout: SelectedSixMarkerLayout,
  mapPoint: (point: Point2D) => Point2D,
): SelectedSixMarkerLayout {
  const markers = {} as {
    -readonly [Position in SixMarkerPosition]: SelectedSixMarkerLayout['markers'][Position];
  };
  for (const position of SIX_MARKER_POSITIONS) {
    const marker = layout.markers[position];
    const corners = marker.corners.map(mapPoint) as Quadrilateral;
    const mappedCenter = mapPoint(marker.center);
    const sideLengths = corners.map((point, index) => {
      const next = corners[(index + 1) % corners.length];
      return Math.hypot(point.x - next.x, point.y - next.y);
    });
    markers[position] = {
      center: mappedCenter,
      corners,
      size: sideLengths.reduce((sum, side) => sum + side, 0) / sideLengths.length,
    };
  }
  const whiteReferenceCorridors = {} as {
    -readonly [Position in WhiteReferenceCorridorPosition]: SelectedSixMarkerLayout['whiteReferenceCorridors'][Position];
  };
  for (const position of WHITE_REFERENCE_CORRIDOR_POSITIONS) {
    const corridor = layout.whiteReferenceCorridors[position];
    whiteReferenceCorridors[position] = {
      ...corridor,
      quadrilateral: corridor.quadrilateral.map(mapPoint) as Quadrilateral,
    };
  }
  return {
    ...layout,
    cropQuadrilateral: layout.cropQuadrilateral.map(mapPoint) as Quadrilateral,
    markers,
    whiteReferenceCorridors,
  };
}

function makeFinding(code: CalibrationFailureCode): CalibrationFinding {
  return { code, explanation: CALIBRATION_FAILURE_EXPLANATIONS[code] };
}

function uniqueFindings(codes: CalibrationFailureCode[]) {
  return [...new Set(codes)].map(makeFinding);
}

function sampleRegion(
  image: CalibrationImage,
  region: CalibrationSampleRegion,
  config: PageCalibrationConfig,
): CalibrationSampleDiagnostic {
  if (
    region.sourceQuadrilateral.some(
      (point) =>
        point.x < 0 ||
        point.y < 0 ||
        point.x >= image.width ||
        point.y >= image.height,
    )
  ) {
    return {
      ...region,
      accepted: false,
      rejectionCode: 'outside_image',
      statistics: null,
    };
  }
  const statistics = sampleStatistics(image, region.sourceQuadrilateral, config);
  if (!statistics) {
    return {
      ...region,
      accepted: false,
      rejectionCode: 'insufficient_pixels',
      statistics: null,
    };
  }
  if (statistics.dispersion > config.maximumSampleDispersion) {
    return {
      ...region,
      accepted: false,
      rejectionCode: 'sample_dispersion',
      statistics,
    };
  }
  if (region.kind === 'black-marker' && statistics.median > config.maximumBlackValue) {
    return {
      ...region,
      accepted: false,
      rejectionCode: 'washed_out_black',
      statistics,
    };
  }
  return { ...region, accepted: true, rejectionCode: null, statistics };
}

function corridorDiagnostics(
  position: WhiteReferenceCorridorPosition,
  samples: CalibrationSampleDiagnostic[],
  config: PageCalibrationConfig,
): WhiteCorridorDiagnostic {
  const initiallyAccepted = samples.filter(
    (sample) => sample.accepted && sample.statistics,
  );
  const initialValues = initiallyAccepted.map(
    (sample) => sample.statistics?.median ?? 0,
  );
  const initialMedian = median(initialValues);
  if (initialMedian !== null) {
    const deviation = medianAbsoluteDeviation(initialValues, initialMedian);
    const maximumDeviation = Math.max(
      config.minimumOutlierDelta,
      deviation * 4,
    );
    for (const sample of initiallyAccepted) {
      if (
        sample.statistics &&
        Math.abs(sample.statistics.median - initialMedian) > maximumDeviation
      ) {
        sample.accepted = false;
        sample.rejectionCode = 'tile_outlier';
      }
    }
  }

  const accepted = samples.filter((sample) => sample.accepted && sample.statistics);
  const values = accepted.map((sample) => sample.statistics?.median ?? 0);
  const robustWhiteValue = median(values);
  return {
    position,
    acceptedTileCount: accepted.length,
    rejectedTileCount: samples.length - accepted.length,
    robustWhiteValue:
      robustWhiteValue === null ? null : rounded(robustWhiteValue),
    dispersion:
      robustWhiteValue === null
        ? null
        : rounded(Math.max(...values) - Math.min(...values)),
    tiles: samples,
  };
}

export function calibratePageReferences(
  image: CalibrationImage,
  layout: SelectedSixMarkerLayout,
  config: PageCalibrationConfig = PAGE_CALIBRATION_CONFIG,
): PageCalibrationResult {
  const startedAt = nowMilliseconds();
  const channels = image.channels ?? 1;
  const expectedLength = image.width * image.height * channels;
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== expectedLength
  ) {
    throw new Error(
      `Expected ${expectedLength} grayscale pixels for calibration, received ${image.data.length}.`,
    );
  }

  const plan = buildSamplingPlan(layout, config);
  const emptyCorridor = (
    position: WhiteReferenceCorridorPosition,
  ): WhiteCorridorDiagnostic => ({
    position,
    acceptedTileCount: 0,
    rejectedTileCount: 0,
    robustWhiteValue: null,
    dispersion: null,
    tiles: [],
  });
  if (!plan) {
    return {
      contractVersion: PAGE_CALIBRATION_CONTRACT_VERSION,
      valid: false,
      findings: [makeFinding('invalid_sampling_geometry')],
      black: {
        acceptedSampleCount: 0,
        rejectedSampleCount: 0,
        robustValue: null,
        dispersion: null,
        samples: [],
      },
      white: {
        acceptedTileCount: 0,
        rejectedTileCount: 0,
        robustValue: null,
        dispersion: null,
        corridors: {
          'upper-left': emptyCorridor('upper-left'),
          'lower-left': emptyCorridor('lower-left'),
          'upper-right': emptyCorridor('upper-right'),
          'lower-right': emptyCorridor('lower-right'),
        },
      },
      dynamicRange: null,
      durationMs: rounded(nowMilliseconds() - startedAt),
    };
  }

  const sampled = plan.map((region) => sampleRegion(image, region, config));
  const blackSamples = sampled.filter((sample) => sample.kind === 'black-marker');
  const acceptedBlack = blackSamples.filter(
    (sample) => sample.accepted && sample.statistics,
  );
  const blackValues = acceptedBlack.map(
    (sample) => sample.statistics?.median ?? 0,
  );
  const robustBlack = median(blackValues);
  const blackDispersion =
    robustBlack === null
      ? null
      : Math.max(...blackValues) - Math.min(...blackValues);

  const corridorMap = {} as {
    [Position in WhiteReferenceCorridorPosition]: WhiteCorridorDiagnostic;
  };
  for (const position of WHITE_REFERENCE_CORRIDOR_POSITIONS) {
    corridorMap[position] = corridorDiagnostics(
      position,
      sampled.filter((sample) => sample.corridorPosition === position),
      config,
    );
  }
  const allWhiteSamples = WHITE_REFERENCE_CORRIDOR_POSITIONS.flatMap(
    (position) => corridorMap[position].tiles,
  );
  const acceptedWhite = allWhiteSamples.filter(
    (sample) => sample.accepted && sample.statistics,
  );
  const whiteValues = acceptedWhite.map(
    (sample) => sample.statistics?.median ?? 0,
  );
  const robustWhite = median(whiteValues);
  const whiteDispersion =
    robustWhite === null
      ? null
      : Math.max(...whiteValues) - Math.min(...whiteValues);
  const dynamicRange =
    robustBlack === null || robustWhite === null
      ? null
      : robustWhite - robustBlack;

  const failureCodes: CalibrationFailureCode[] = [];
  if (
    sampled.some(
      (sample) =>
        sample.rejectionCode === 'outside_image' ||
        sample.rejectionCode === 'insufficient_pixels',
    )
  ) {
    failureCodes.push('invalid_sampling_geometry');
  }
  if (acceptedBlack.length < config.minimumBlackReferences) {
    failureCodes.push('insufficient_black_references');
  }
  if (
    WHITE_REFERENCE_CORRIDOR_POSITIONS.some(
      (position) =>
        corridorMap[position].acceptedTileCount <
        config.minimumWhiteTilesPerCorridor,
    )
  ) {
    failureCodes.push('insufficient_white_tiles');
  }
  if (
    acceptedWhite.some(
      (sample) =>
        (sample.statistics?.lightClippedFraction ?? 0) >
        config.maximumClippedFraction,
    )
  ) {
    failureCodes.push('white_clipping');
  }
  if (
    acceptedBlack.length > 0 &&
    acceptedBlack.every(
      (sample) =>
        (sample.statistics?.darkClippedFraction ?? 0) >
        config.maximumClippedFraction,
    )
  ) {
    failureCodes.push('black_clipping');
  }
  if (
    blackSamples.some(
      (sample) =>
        sample.statistics &&
        sample.statistics.median > config.maximumBlackValue,
    )
  ) {
    failureCodes.push('washed_out_blacks');
  }
  if (dynamicRange === null || dynamicRange < config.minimumDynamicRange) {
    failureCodes.push('insufficient_dynamic_range');
  }
  if (
    WHITE_REFERENCE_CORRIDOR_POSITIONS.some(
      (position) =>
        corridorMap[position].dispersion !== null &&
        corridorMap[position].dispersion! > config.maximumCorridorDispersion,
    )
  ) {
    failureCodes.push('excessive_tile_dispersion');
  }
  if (
    blackDispersion !== null &&
    blackDispersion > config.maximumBlackDisagreement
  ) {
    failureCodes.push('black_reference_disagreement');
  }

  const corridorValue = (position: WhiteReferenceCorridorPosition) =>
    corridorMap[position].robustWhiteValue;
  const verticalPairs = [
    [corridorValue('upper-left'), corridorValue('lower-left')],
    [corridorValue('upper-right'), corridorValue('lower-right')],
  ] as const;
  if (
    verticalPairs.some(
      ([first, second]) =>
        first !== null &&
        second !== null &&
        Math.abs(first - second) > config.maximumVerticalDisagreement,
    )
  ) {
    failureCodes.push('vertical_reference_disagreement');
  }
  const horizontalPairs = [
    [corridorValue('upper-left'), corridorValue('upper-right')],
    [corridorValue('lower-left'), corridorValue('lower-right')],
  ] as const;
  if (
    horizontalPairs.some(
      ([first, second]) =>
        first !== null &&
        second !== null &&
        Math.abs(first - second) > config.maximumLeftRightDisagreement,
    )
  ) {
    failureCodes.push('left_right_reference_disagreement');
  }

  const findings = uniqueFindings(failureCodes);
  return {
    contractVersion: PAGE_CALIBRATION_CONTRACT_VERSION,
    valid: findings.length === 0,
    findings,
    black: {
      acceptedSampleCount: acceptedBlack.length,
      rejectedSampleCount: blackSamples.length - acceptedBlack.length,
      robustValue: robustBlack === null ? null : rounded(robustBlack),
      dispersion: blackDispersion === null ? null : rounded(blackDispersion),
      samples: blackSamples,
    },
    white: {
      acceptedTileCount: acceptedWhite.length,
      rejectedTileCount: allWhiteSamples.length - acceptedWhite.length,
      robustValue: robustWhite === null ? null : rounded(robustWhite),
      dispersion: whiteDispersion === null ? null : rounded(whiteDispersion),
      corridors: corridorMap,
    },
    dynamicRange: dynamicRange === null ? null : rounded(dynamicRange),
    durationMs: rounded(nowMilliseconds() - startedAt),
  };
}

function rotatePoint180(point: Point2D): Point2D {
  return { x: 1 - point.x, y: 1 - point.y };
}

export function rotatePageCalibrationEvidence180(
  result: PageCalibrationResult,
): PageCalibrationResult {
  const rotatedMarkerPosition: Record<SixMarkerPosition, SixMarkerPosition> = {
    'top-left': 'bottom-right',
    'middle-left': 'middle-right',
    'bottom-left': 'top-right',
    'top-right': 'bottom-left',
    'middle-right': 'middle-left',
    'bottom-right': 'top-left',
  };
  const rotatedCorridorPosition: Record<
    WhiteReferenceCorridorPosition,
    WhiteReferenceCorridorPosition
  > = {
    'upper-left': 'lower-right',
    'lower-left': 'upper-right',
    'upper-right': 'lower-left',
    'lower-right': 'upper-left',
  };
  const rotateSample = (
    sample: CalibrationSampleDiagnostic,
  ): CalibrationSampleDiagnostic => {
    const markerPosition = sample.markerPosition
      ? rotatedMarkerPosition[sample.markerPosition]
      : null;
    const corridorPosition = sample.corridorPosition
      ? rotatedCorridorPosition[sample.corridorPosition]
      : null;
    return {
      ...sample,
      id:
        sample.kind === 'black-marker'
          ? `black:${markerPosition}`
          : `white:${corridorPosition}:${sample.tileIndex}`,
      markerPosition,
      corridorPosition,
      normalizedPagePosition: rotatePoint180(sample.normalizedPagePosition),
    };
  };
  const corridors = {} as PageCalibrationResult['white']['corridors'];
  for (const position of WHITE_REFERENCE_CORRIDOR_POSITIONS) {
    const rotatedPosition = rotatedCorridorPosition[position];
    corridors[rotatedPosition] = {
      ...result.white.corridors[position],
      position: rotatedPosition,
      tiles: result.white.corridors[position].tiles.map(rotateSample),
    };
  }
  return {
    ...result,
    black: {
      ...result.black,
      samples: result.black.samples.map(rotateSample),
    },
    white: {
      ...result.white,
      corridors,
    },
  };
}
