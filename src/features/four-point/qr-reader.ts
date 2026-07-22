import jsQR, { type QRCode } from 'jsqr';

import type {
  JsonValue,
  QrMetadata,
  QrOrientation,
} from '@/features/four-point/types';

export type QrPixelRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function parseJsonPayload(value: string):
  | { format: 'json'; payload: JsonValue }
  | { format: 'text'; payload: null } {
  try {
    return { format: 'json', payload: JSON.parse(value) as JsonValue };
  } catch {
    return { format: 'text', payload: null };
  }
}

function qrOrientation(code: QRCode): QrOrientation {
  const { topLeftCorner, topRightCorner } = code.location;
  const angle = Math.atan2(
    topRightCorner.y - topLeftCorner.y,
    topRightCorner.x - topLeftCorner.x,
  );
  const clockwiseQuarterTurns =
    ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4;

  if (clockwiseQuarterTurns === 1) return 'clockwise';
  if (clockwiseQuarterTurns === 2) return 'upside-down';
  if (clockwiseQuarterTurns === 3) return 'counter-clockwise';
  return 'upright';
}

export function readQrMetadata(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): QrMetadata | null {
  const code = jsQR(pixels, width, height, { inversionAttempts: 'attemptBoth' });
  if (!code) return null;

  const parsedPayload = parseJsonPayload(code.data);
  return {
    rawValue: code.data,
    payload: parsedPayload.payload,
    payloadFormat: parsedPayload.format,
    qrVersion: code.version,
    orientation: qrOrientation(code),
    rotationApplied: 0,
  };
}

function cropRgbaRegion(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  region: QrPixelRegion,
) {
  const left = Math.max(0, Math.floor(region.x));
  const top = Math.max(0, Math.floor(region.y));
  const right = Math.min(imageWidth, Math.ceil(region.x + region.width));
  const bottom = Math.min(imageHeight, Math.ceil(region.y + region.height));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  const cropped = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((top + y) * imageWidth + left) * 4;
    cropped.set(
      pixels.subarray(sourceStart, sourceStart + width * 4),
      y * width * 4,
    );
  }
  return { pixels: cropped, width, height };
}

/** Reads only schema-declared QR locations instead of scanning the whole page. */
export function readQrMetadataInRegions(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  regions: readonly QrPixelRegion[],
): QrMetadata | null {
  if (pixels.byteLength !== width * height * 4) {
    throw new Error(`Expected ${width * height * 4} RGBA bytes but received ${pixels.byteLength}.`);
  }
  for (const region of regions) {
    const cropped = cropRgbaRegion(pixels, width, height, region);
    if (!cropped) continue;
    const metadata = readQrMetadata(cropped.pixels, cropped.width, cropped.height);
    if (metadata) return metadata;
  }
  return null;
}

export function readQrPayloadId(
  metadata: QrMetadata,
  field: 'schemaVersion' | 'sheetId' | 'studentId' | 'testId',
): string | null {
  const { payload } = metadata;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return null;
  const value = payload[field];
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}
