import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  BubbleGradingSchema,
  PixelPoint,
} from "../../src/features/bubble-grading/schema";
import {
  analyzeBubbleGradingImage,
  type BubbleAnalysisResult,
} from "../../src/features/bubble-grading/bubble-analysis";
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

const DECISION_COLORS = {
  filled: "#00FF85",
  unfilled: "#00E5FF",
  uncertain: "#FFE600",
} as const;

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
  diagnostics?: BubbleAnalysisResult,
) {
  const { bubbleStyle } = schema;
  const diagnosticsByBubbleId = new Map(
    diagnostics?.bubbles.map((bubble) => [bubble.bubbleId, bubble]) ?? [],
  );
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
      const diagnostic = diagnosticsByBubbleId.get(bubble.id);
      const measuredCenter = diagnostic?.measuredCenterPx ?? bubble.centerPx;
      const color = diagnostic ? DECISION_COLORS[diagnostic.decision] : QUESTION_COLORS[questionIndex % QUESTION_COLORS.length];
      const answerLabel = `${question.label} · ${bubble.label}${correct ? " · ★ CORRECT" : ""}`;
      parts.push(
        `<g data-layer="bubble" data-bubble-id="${escapeXml(bubble.id)}">`,
        `<circle data-layer="bubble-roi" cx="${x}" cy="${y}" r="${bubbleStyle.roiRadiusPx}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.75" />`,
        `<circle data-layer="background-ring" cx="${measuredCenter.x}" cy="${measuredCenter.y}" r="${(bubbleStyle.backgroundRingInnerRadiusPx + bubbleStyle.backgroundRingOuterRadiusPx) / 2}" fill="none" stroke="${color}" stroke-width="${bubbleStyle.backgroundRingOuterRadiusPx - bubbleStyle.backgroundRingInnerRadiusPx}" stroke-opacity="0.35" />`,
        `<circle data-layer="bubble-circle" cx="${measuredCenter.x}" cy="${measuredCenter.y}" r="${bubbleStyle.radiusPx}" fill="none" stroke="${color}" stroke-width="2" />`,
        `<circle data-layer="fill-measurement" cx="${measuredCenter.x}" cy="${measuredCenter.y}" r="${bubbleStyle.fillRadiusPx}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1" />`,
        crosshair(bubble.centerPx, color, 7),
        `<text data-layer="bubble-label" x="${x - 3}" y="${y - bubbleStyle.roiRadiusPx - 4}" text-anchor="end" transform="rotate(-90 ${x - 3} ${y - bubbleStyle.roiRadiusPx - 4})" fill="${color}" ${textOutlineAttributes(7)}>${escapeXml(answerLabel)}</text>`,
        `<text data-layer="source-coordinates" x="${x + 4}" y="${y - bubbleStyle.roiRadiusPx - 4}" text-anchor="end" transform="rotate(-90 ${x + 4} ${y - bubbleStyle.roiRadiusPx - 4})" fill="${color}" ${textOutlineAttributes(6)}>${escapeXml(bubble.id)} · (${x},${y})px · r=${bubbleStyle.radiusPx}px</text>`,
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
  if (diagnostics) parts.push(diagnosticTable(diagnostics, width, height));
  parts.push(
    `<g data-layer="legend">`,
    `<rect x="${(width - legendWidth) / 2}" y="12" width="${legendWidth}" height="58" rx="8" fill="#000" fill-opacity="0.76" />`,
    `<text x="${width / 2}" y="34" text-anchor="middle" fill="#FFF" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(schema.test.id)} · ${escapeXml(schema.test.version)} · ${schema.questions.length}Q / ${bubbleCount} bubbles · ${width}×${height}px (${dimensionsStatus})</text>`,
    `<text x="${width / 2}" y="56" text-anchor="middle" fill="#FFE600" font-family="Arial, sans-serif" font-size="11" font-weight="700">cyan: unfilled · green: filled · yellow: uncertain · dashed: complete ROI</text>`,
    `</g>`,
    `</svg>`,
  );
  return { svg: parts.join("\n"), bubbleCount };
}

function diagnosticTable(diagnostics: BubbleAnalysisResult, width: number, height: number) {
  const lineHeight = 12;
  const margin = 8;
  const maximumRows = Math.max(1, Math.floor((height - 100) / lineHeight));
  const columnCount = Math.ceil(diagnostics.bubbles.length / maximumRows);
  const rowsPerColumn = Math.ceil(diagnostics.bubbles.length / columnCount);
  const panelHeight = (rowsPerColumn + 1) * lineHeight + 8;
  const columnWidth = (width - margin * 2) / columnCount;
  const top = height - panelHeight - margin;
  const parts = [
    `<g data-layer="diagnostic-table">`,
    `<rect x="${margin}" y="${top}" width="${width - margin * 2}" height="${panelHeight}" rx="6" fill="#000" fill-opacity="0.88" stroke="#FFE600" stroke-width="1" />`,
  ];
  diagnostics.bubbles.forEach((diagnostic, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = margin + 6 + column * columnWidth;
    const y = top + 16 + row * lineHeight;
    const color = DECISION_COLORS[diagnostic.decision];
    const reasons = diagnostic.reasonCodes.length > 0 ? diagnostic.reasonCodes.join(",") : "none";
    parts.push(
      `<text data-layer="bubble-diagnostic" data-bubble-id="${escapeXml(diagnostic.bubbleId)}" x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="8" font-weight="700">${escapeXml(`${diagnostic.questionId}/${diagnostic.bubbleId} · fill=${diagnostic.darkPixelRatio.toFixed(3)} · bg=${diagnostic.backgroundBrightness.toFixed(3)} · `)}<tspan data-layer="bubble-decision">${diagnostic.decision} · conf=${diagnostic.confidence.toFixed(3)}</tspan><tspan data-layer="bubble-reasons"> · ${escapeXml(reasons)}</tspan></text>`,
    );
  });
  parts.push(`</g>`);
  return parts.join("\n");
}

export async function generatePreview(
  candidate: unknown,
  inputPath: string,
  outputPath: string,
  resultPath = join(dirname(outputPath), "result.json"),
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

  const raw = await sharp(inputPath)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (raw.info.width !== metadata.width || raw.info.height !== metadata.height || raw.info.channels !== 1) {
    throw new Error(`Could not decode ${inputPath} as one-channel canonical grayscale pixels.`);
  }
  const diagnostics = analyzeBubbleGradingImage(validation.schema, {
    width: raw.info.width,
    height: raw.info.height,
    data: new Uint8Array(raw.data),
  });

  const { svg, bubbleCount } = buildOverlaySvg(
    validation.schema,
    validation.imageDimensions.width,
    validation.imageDimensions.height,
    diagnostics,
  );
  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);
  await writeFile(resultPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  return {
    bubbleCount,
    questionCount: validation.schema.questions.length,
    width: metadata.width,
    height: metadata.height,
    resultPath,
    diagnostics,
  };
}
