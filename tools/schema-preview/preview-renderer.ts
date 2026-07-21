import sharp from "sharp";

import type {
  BubbleGradingSchema,
  PixelPoint,
} from "../../src/features/bubble-grading/schema";
import {
  formatSchemaValidationErrors,
  validateBubbleGradingSchema,
  type SchemaValidationError,
} from "../../src/features/bubble-grading/schema-validator";

const QUESTION_COLORS = [
  "#00E5FF",
  "#FF2D95",
  "#B7FF00",
  "#FFB000",
  "#8C52FF",
  "#00FF85",
];

export class SchemaValidationFailure extends Error {
  constructor(readonly validationErrors: SchemaValidationError[]) {
    super(
      `Schema validation failed with ${validationErrors.length} error(s):\n${formatSchemaValidationErrors(validationErrors)}`,
    );
    this.name = "SchemaValidationFailure";
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function crosshair(point: PixelPoint, color: string, size: number) {
  return `
    <g data-layer="center-crosshair">
      <line x1="${point.x - size}" y1="${point.y}" x2="${point.x + size}" y2="${point.y}" stroke="${color}" stroke-width="2" />
      <line x1="${point.x}" y1="${point.y - size}" x2="${point.x}" y2="${point.y + size}" stroke="${color}" stroke-width="2" />
    </g>`;
}

function textOutlineAttributes(size: number) {
  return `font-family="Arial, sans-serif" font-size="${size}" font-weight="700" stroke="#000" stroke-width="3" paint-order="stroke"`;
}

export function buildOverlaySvg(
  schema: BubbleGradingSchema,
  width: number,
  height: number,
) {
  const { bubbleStyle } = schema;
  const parts = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<g data-layer="qr-region">`,
    `<rect x="${schema.qrRegionPx.x}" y="${schema.qrRegionPx.y}" width="${schema.qrRegionPx.width}" height="${schema.qrRegionPx.height}" fill="#FF00D4" fill-opacity="0.16" stroke="#FF00D4" stroke-width="4" stroke-dasharray="12 7" />`,
    `<text x="${schema.qrRegionPx.x + 8}" y="${schema.qrRegionPx.y + 24}" fill="#FF00D4" ${textOutlineAttributes(18)}>QR · ${schema.qrRegionPx.x}, ${schema.qrRegionPx.y} · ${schema.qrRegionPx.width}×${schema.qrRegionPx.height}px</text>`,
    `</g>`,
  ];

  schema.questions.forEach((question, questionIndex) => {
    const color = QUESTION_COLORS[questionIndex % QUESTION_COLORS.length];
    if (question.bubbles.length > 1) {
      const centers = question.bubbles.map(
        (bubble) => `${bubble.centerPx.x},${bubble.centerPx.y}`,
      );
      parts.push(
        `<polyline data-layer="question-group" points="${centers.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.65" stroke-dasharray="7 7" />`,
      );
    }

    question.bubbles.forEach((bubble) => {
      const { x, y } = bubble.centerPx;
      const correct = question.correctBubbleIds.includes(bubble.id);
      // const answerLabel = `${question.label} · ${bubble.label}${correct ? ' · ★ CORRECT' : ''}`;
      parts.push(
        `<g data-layer="bubble" data-bubble-id="${escapeXml(bubble.id)}">`,
        `<circle data-layer="bubble-circle" cx="${x}" cy="${y}" r="${bubbleStyle.radiusPx}" fill="${color}" fill-opacity="${correct ? 0.24 : 0.1}" stroke="${color}" stroke-width="4" />`,
        crosshair(bubble.centerPx, color, 7),
        // `<text data-layer="bubble-label" x="${x}" y="${y - bubbleStyle.radiusPx - 12}" text-anchor="middle" fill="${color}" ${textOutlineAttributes(14)}>${escapeXml(answerLabel)}</text>`,
        // `<text data-layer="source-coordinates" x="${x}" y="${y + bubbleStyle.radiusPx + 20}" text-anchor="middle" fill="${color}" ${textOutlineAttributes(11)}>${escapeXml(bubble.id)} · (${x}, ${y})px · r=${bubbleStyle.radiusPx}px</text>`,
        `</g>`,
      );
    });
  });

  const bubbleCount = schema.questions.reduce(
    (sum, question) => sum + question.bubbles.length,
    0,
  );
  const legendWidth = Math.max(240, Math.min(width - 24, 760));
  const dimensionsStatus =
    schema.canonicalImage.dimensions.status === "fixed"
      ? "fixed"
      : "TODO / input.jpg";
  parts.push(
    `<g data-layer="legend">`,
    `<rect x="${(width - legendWidth) / 2}" y="12" width="${legendWidth}" height="58" rx="8" fill="#000" fill-opacity="0.76" />`,
    `<text x="${width / 2}" y="34" text-anchor="middle" fill="#FFF" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(schema.test.id)} · ${escapeXml(schema.test.version)} · ${schema.questions.length}Q / ${bubbleCount} bubbles · ${width}×${height}px (${dimensionsStatus})</text>`,
    `<text x="${width / 2}" y="56" text-anchor="middle" fill="#FFE600" font-family="Arial, sans-serif" font-size="11" font-weight="700">colored circle: declared bubble radius · crosshair: declared center</text>`,
    `</g>`,
    `</svg>`,
  );
  return { svg: parts.join("\n"), bubbleCount };
}

export async function generatePreview(
  candidate: unknown,
  inputPath: string,
  outputPath: string,
) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions from ${inputPath}.`);
  }

  const validation = validateBubbleGradingSchema(candidate, {
    inputImage: { width: metadata.width, height: metadata.height },
  });
  if (!validation.valid) throw new SchemaValidationFailure(validation.errors);

  const { svg, bubbleCount } = buildOverlaySvg(
    validation.schema,
    validation.imageDimensions.width,
    validation.imageDimensions.height,
  );
  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return {
    bubbleCount,
    questionCount: validation.schema.questions.length,
    width: metadata.width,
    height: metadata.height,
  };
}
