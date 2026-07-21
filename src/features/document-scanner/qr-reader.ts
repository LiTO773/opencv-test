import jsQR, { type QRCode } from 'jsqr';

import type {
  JsonValue,
  QrMetadata,
  QrOrientation,
} from '@/features/document-scanner/types';

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
