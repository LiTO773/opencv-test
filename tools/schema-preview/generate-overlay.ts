import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

import type {
  PdfPoint,
  PdfQuadrilateral,
  PdfRectangle,
  TestSchema,
} from '../../src/features/document-scanner/test-schema';
import { testSchema } from './schema';

type Homography = [number, number, number, number, number, number, number, number, number];

const QUESTION_COLORS = [
  '#00E5FF',
  '#FF2D95',
  '#B7FF00',
  '#FFB000',
  '#8C52FF',
  '#00FF85',
];

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function solveHomography(source: PdfQuadrilateral, destination: PdfQuadrilateral): Homography {
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
    if (Math.abs(rows[pivot][column]) < 1e-9) {
      throw new Error('The four captureAnchorsPt do not form a usable quadrilateral.');
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

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

function transformPoint(point: PdfPoint, matrix: Homography): PdfPoint {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
}

function rectangleCorners(
  rectangle: PdfRectangle,
  origin: TestSchema['page']['origin'],
): PdfQuadrilateral {
  const { x, y, width, height } = rectangle;
  if (origin === 'bottom-left') {
    return [
      { x, y: y + height },
      { x: x + width, y: y + height },
      { x: x + width, y },
      { x, y },
    ];
  }
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function pointsToPath(points: PdfPoint[], close = true) {
  const commands = points.map(
    (point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
  );
  if (close) commands.push('Z');
  return commands.join(' ');
}

function circlePath(center: PdfPoint, radius: number, matrix: Homography) {
  const samples = Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    return transformPoint(
      {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      },
      matrix,
    );
  });
  return pointsToPath(samples);
}

function crosshair(point: PdfPoint, color: string, size: number) {
  return `
    <line x1="${point.x - size}" y1="${point.y}" x2="${point.x + size}" y2="${point.y}" stroke="${color}" stroke-width="2" />
    <line x1="${point.x}" y1="${point.y - size}" x2="${point.x}" y2="${point.y + size}" stroke="${color}" stroke-width="2" />
  `;
}

function validateSchema(schema: TestSchema) {
  if (schema.page.widthPt <= 0 || schema.page.heightPt <= 0) {
    throw new Error('page.widthPt and page.heightPt must be positive.');
  }

  const questionIds = new Set<string>();
  for (const question of schema.questions) {
    if (questionIds.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
    questionIds.add(question.id);

    const bubbleIds = new Set(question.bubbles.map((bubble) => bubble.id));
    if (bubbleIds.size !== question.bubbles.length) {
      throw new Error(`Question ${question.id} contains duplicate bubble ids.`);
    }
    for (const correctId of question.correctBubbleIds) {
      if (!bubbleIds.has(correctId)) {
        throw new Error(`Question ${question.id} references unknown correct bubble ${correctId}.`);
      }
    }
  }
}

function buildOverlaySvg(schema: TestSchema, width: number, height: number) {
  const destination: PdfQuadrilateral = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const matrix = solveHomography(schema.page.captureAnchorsPt, destination);
  const qrCorners = rectangleCorners(schema.page.qrRegionPt, schema.page.origin).map((point) =>
    transformPoint(point, matrix),
  );
  const parts: string[] = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<path d="${pointsToPath(qrCorners)}" fill="#FF00D4" fill-opacity="0.18" stroke="#FF00D4" stroke-width="4" stroke-dasharray="12 7" />`,
    `<text x="${qrCorners[0].x + 8}" y="${qrCorners[0].y + 22}" fill="#FF00D4" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif" font-size="18" font-weight="700">QR region</text>`,
  ];

  schema.page.captureAnchorsPt.forEach((anchor, index) => {
    const mapped = transformPoint(anchor, matrix);
    const labelX = Math.min(Math.max(mapped.x + (index === 1 || index === 2 ? -62 : 10), 8), width - 70);
    const labelY = Math.min(Math.max(mapped.y + (index >= 2 ? -12 : 24), 20), height - 8);
    parts.push(
      `<circle cx="${mapped.x}" cy="${mapped.y}" r="12" fill="#FFE600" fill-opacity="0.3" stroke="#FFE600" stroke-width="4" />`,
      crosshair(mapped, '#FFE600', 18),
      `<text x="${labelX}" y="${labelY}" fill="#FFE600" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif" font-size="16" font-weight="700">anchor ${index + 1}</text>`,
    );
  });

  schema.questions.forEach((question, questionIndex) => {
    const color = QUESTION_COLORS[questionIndex % QUESTION_COLORS.length];
    const centers = question.bubbles.map((bubble) => transformPoint(bubble.centerPt, matrix));
    if (centers.length > 1) {
      parts.push(
        `<path d="${pointsToPath(centers, false)}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.7" stroke-dasharray="6 6" />`,
      );
    }

    question.bubbles.forEach((bubble, bubbleIndex) => {
      const center = centers[bubbleIndex];
      const correct = question.correctBubbleIds.includes(bubble.id);
      const compactLabel = `Q${questionIndex + 1}:${bubble.label}${correct ? ' ✓' : ''}`;
      const coordinateLabel = `${bubble.centerPt.x.toFixed(1)}, ${bubble.centerPt.y.toFixed(1)}`;
      parts.push(
        `<path d="${circlePath(bubble.centerPt, bubble.radiusPt, matrix)}" fill="${color}" fill-opacity="${correct ? 0.28 : 0.1}" stroke="${color}" stroke-width="4" />`,
        crosshair(center, color, 7),
        `<text x="${center.x}" y="${center.y - 18}" text-anchor="middle" fill="${color}" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif" font-size="14" font-weight="700">${escapeXml(compactLabel)}</text>`,
        `<text x="${center.x}" y="${center.y + 27}" text-anchor="middle" fill="${color}" stroke="#000" stroke-width="2.5" paint-order="stroke" font-family="Arial, sans-serif" font-size="10" font-weight="700">${coordinateLabel}</text>`,
      );
    });
  });

  const bubbleCount = schema.questions.reduce((sum, question) => sum + question.bubbles.length, 0);
  const legendWidth = Math.min(width - 24, 480);
  parts.push(
    `<rect x="${(width - legendWidth) / 2}" y="12" width="${legendWidth}" height="34" rx="8" fill="#000" fill-opacity="0.72" />`,
    `<text x="${width / 2}" y="34" text-anchor="middle" fill="#FFF" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(schema.id)} v${schema.version} · ${schema.questions.length}Q / ${bubbleCount} bubbles · ${schema.page.origin} PDF origin</text>`,
    '</svg>',
  );
  return { svg: parts.join('\n'), bubbleCount };
}

async function main() {
  const positionalArguments = process.argv.slice(2).filter((argument) => argument !== '--');
  const inputPath = resolve(positionalArguments[0] ?? 'photo.png');
  const outputPath = resolve(positionalArguments[1] ?? 'output.png');
  if (inputPath === outputPath) throw new Error('Input and output paths must be different.');

  validateSchema(testSchema);
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions from ${inputPath}.`);
  }

  const { svg, bubbleCount } = buildOverlaySvg(testSchema, metadata.width, metadata.height);
  await mkdir(dirname(outputPath), { recursive: true });
  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  console.log(`Created ${outputPath}`);
  console.log(
    `Mapped ${testSchema.questions.length} questions and ${bubbleCount} bubbles onto ${metadata.width}×${metadata.height}px.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
