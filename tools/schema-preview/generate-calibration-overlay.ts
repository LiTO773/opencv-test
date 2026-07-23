import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PAGE_CALIBRATION_CONTRACT_VERSION,
  type PageCalibrationResult,
} from '../../src/features/four-point/page-calibration';
import { renderPageCalibrationPreview } from './page-calibration-overlay';

function usage() {
  return [
    'Usage:',
    '  pnpm calibration:preview -- <accepted-still> <calibration.json> [output.png]',
    '',
    'The JSON must be the PageCalibrationResult emitted by the mobile calibration contract.',
  ].join('\n');
}

async function main() {
  const argumentsAfterScript = process.argv.slice(2).filter((argument) => argument !== '--');
  if (argumentsAfterScript.length < 2 || argumentsAfterScript.length > 3) {
    throw new Error(usage());
  }
  const [inputArgument, resultArgument, outputArgument = 'calibration-output.png'] =
    argumentsAfterScript;
  const inputPath = resolve(inputArgument);
  const resultPath = resolve(resultArgument);
  const outputPath = resolve(outputArgument);
  const candidate = JSON.parse(await readFile(resultPath, 'utf8')) as {
    contractVersion?: unknown;
  };
  if (candidate.contractVersion !== PAGE_CALIBRATION_CONTRACT_VERSION) {
    throw new Error(
      `Expected calibration contract ${PAGE_CALIBRATION_CONTRACT_VERSION} in ${resultPath}.`,
    );
  }
  const rendered = await renderPageCalibrationPreview(
    inputPath,
    outputPath,
    candidate as PageCalibrationResult,
  );
  console.log(
    `[calibration:preview] Created ${outputPath} · ${rendered.blackSampleCount} black samples · ${rendered.whiteTileCount} white tiles · ${rendered.valid ? 'valid' : 'failed'}`,
  );
}

void main().catch((caught) => {
  console.error(caught instanceof Error ? caught.message : String(caught));
  process.exitCode = 1;
});
