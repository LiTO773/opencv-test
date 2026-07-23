import sharp from 'sharp';

import type {
  CalibrationSampleDiagnostic,
  PageCalibrationResult,
} from '../../src/features/four-point/page-calibration';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function polygonPoints(sample: CalibrationSampleDiagnostic) {
  return sample.sourceQuadrilateral
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
}

function sampleLayer(sample: CalibrationSampleDiagnostic) {
  const color = sample.accepted
    ? sample.kind === 'black-marker'
      ? '#00E5FF'
      : '#00FF85'
    : '#FF3B30';
  const label = [
    sample.id,
    sample.accepted ? 'accepted' : `rejected:${sample.rejectionCode}`,
    sample.statistics ? `median=${sample.statistics.median}` : 'no-sample',
    sample.statistics ? `mad=${sample.statistics.dispersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return [
    `<g data-layer="${sample.kind}" data-sample-id="${escapeXml(sample.id)}" data-accepted="${sample.accepted}">`,
    `<polygon points="${polygonPoints(sample)}" fill="${color}" fill-opacity="0.24" stroke="${color}" stroke-width="2" />`,
    `<circle cx="${sample.sourceCenter.x}" cy="${sample.sourceCenter.y}" r="3" fill="${color}" />`,
    `<title>${escapeXml(label)}</title>`,
    `</g>`,
  ].join('\n');
}

export function buildPageCalibrationOverlaySvg(
  calibration: PageCalibrationResult,
  width: number,
  height: number,
) {
  const blackSamples = calibration.black.samples;
  const whiteCorridors = Object.values(calibration.white.corridors);
  const whiteTiles = whiteCorridors.flatMap((corridor) => corridor.tiles);
  const outcomeColor = calibration.valid ? '#00FF85' : '#FF3B30';
  const findings =
    calibration.findings.length === 0
      ? 'none'
      : calibration.findings.map((finding) => finding.code).join(',');
  return [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<g data-layer="page-calibration" data-contract="${calibration.contractVersion}" data-valid="${calibration.valid}">`,
    ...blackSamples.map(sampleLayer),
    ...whiteCorridors.map((corridor) =>
      [
        `<g data-layer="white-corridor" data-corridor-position="${corridor.position}" data-accepted-tiles="${corridor.acceptedTileCount}" data-rejected-tiles="${corridor.rejectedTileCount}">`,
        ...corridor.tiles.map(sampleLayer),
        `</g>`,
      ].join('\n'),
    ),
    `<g data-layer="calibration-outcome">`,
    `<rect x="12" y="12" width="${Math.max(320, Math.min(width - 24, 760))}" height="64" rx="9" fill="#000" fill-opacity="0.82" stroke="${outcomeColor}" stroke-width="2" />`,
    `<text x="24" y="37" fill="${outcomeColor}" font-family="Arial, sans-serif" font-size="15" font-weight="700">${calibration.valid ? 'CALIBRATION VALID' : 'CALIBRATION FAILED'} · black=${calibration.black.robustValue ?? 'n/a'} · white=${calibration.white.robustValue ?? 'n/a'} · range=${calibration.dynamicRange ?? 'n/a'}</text>`,
    `<text x="24" y="60" fill="#FFF" font-family="Arial, sans-serif" font-size="11">black ${calibration.black.acceptedSampleCount}/${blackSamples.length} · white ${calibration.white.acceptedTileCount}/${whiteTiles.length} · rejected ${calibration.white.rejectedTileCount} · findings=${escapeXml(findings)}</text>`,
    `</g>`,
    `</g>`,
    `</svg>`,
  ].join('\n');
}

export async function renderPageCalibrationPreview(
  inputPath: string,
  outputPath: string,
  calibration: PageCalibrationResult,
) {
  const input = sharp(inputPath);
  const metadata = await input.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions from ${inputPath}.`);
  }
  const svg = buildPageCalibrationOverlaySvg(
    calibration,
    metadata.width,
    metadata.height,
  );
  await input
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toFile(outputPath);
  return {
    width: metadata.width,
    height: metadata.height,
    blackSampleCount: calibration.black.samples.length,
    whiteTileCount: Object.values(calibration.white.corridors).reduce(
      (count, corridor) => count + corridor.tiles.length,
      0,
    ),
    valid: calibration.valid,
  };
}
