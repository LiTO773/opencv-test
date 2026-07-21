import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';

import { readQrPayloadId } from '@/features/four-point/qr-reader';
import type { FourPointScan } from '@/features/four-point/types';

function safeFileStem(value: string) {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96);
  return sanitized || null;
}

function timestampFileStem(now: Date) {
  return `sheet-${now.toISOString().replace(/[:.]/g, '-')}`;
}

export function cleanScanFileName(scan: FourPointScan, now = new Date()) {
  const sheetId = scan.qr ? readQrPayloadId(scan.qr, 'sheetId') : null;
  return `${(sheetId && safeFileStem(sheetId)) || timestampFileStem(now)}.jpg`;
}

export async function shareCleanScan(scan: FourPointScan) {
  const match = /^data:image\/jpeg;base64,(.+)$/s.exec(scan.imageUri);
  if (!match) throw new Error('A imagem limpa não está disponível como JPEG.');

  const file = new File(Paths.cache, cleanScanFileName(scan));
  file.create({ overwrite: true });
  file.write(match[1], { encoding: 'base64' });
  await Share.share({ url: file.uri });
}
