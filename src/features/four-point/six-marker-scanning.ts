import type {
  PartialSixMarkerMatches,
  SelectedSixMarkerLayout,
} from '@/features/four-point/six-marker-layout';
import type {
  FourPointAnalysis,
  FourPointScanState,
  MarkerMatches,
  Quadrilateral,
} from '@/features/four-point/types';

export type PreviewValidation = {
  consecutiveCompleteLayouts: number;
  scanState: Extract<FourPointScanState, 'searching' | 'validating' | 'ready'>;
  shouldCapture: boolean;
};

export type FourGuideScannerPresentation = {
  instructionBody: string;
  instructionTitle: string;
  statusLabel: string;
  visibleMarkerCount: number;
};

export function emptySixMarkerMatches(): PartialSixMarkerMatches {
  'worklet';
  return {
    'top-left': null,
    'middle-left': null,
    'bottom-left': null,
    'top-right': null,
    'middle-right': null,
    'bottom-right': null,
  };
}

export function createFourGuideAnalysis(
  sixMarkerMatches: PartialSixMarkerMatches,
  cropQuadrilateral: Quadrilateral | null,
  pageLayout: SelectedSixMarkerLayout | null = null,
): FourPointAnalysis {
  'worklet';
  const markers: MarkerMatches = [
    sixMarkerMatches['top-left'],
    sixMarkerMatches['top-right'],
    sixMarkerMatches['bottom-right'],
    sixMarkerMatches['bottom-left'],
  ];
  let matchedCount = 0;
  for (const marker of markers) {
    if (marker) matchedCount += 1;
  }
  return {
    cropQuadrilateral,
    markers,
    matchedCount,
    sixMarkerMatches,
    pageLayout,
  };
}

export function evaluatePreviewValidation(
  analysis: FourPointAnalysis,
  previousConsecutiveCompleteLayouts: number,
  requiredConsecutiveCompleteLayouts: number,
  didCapture: boolean,
): PreviewValidation {
  'worklet';
  if (!analysis.cropQuadrilateral) {
    return {
      consecutiveCompleteLayouts: 0,
      scanState: analysis.matchedCount === 4 ? 'validating' : 'searching',
      shouldCapture: false,
    };
  }

  const consecutiveCompleteLayouts = previousConsecutiveCompleteLayouts + 1;
  return {
    consecutiveCompleteLayouts,
    scanState: 'ready',
    shouldCapture:
      consecutiveCompleteLayouts >= Math.max(1, requiredConsecutiveCompleteLayouts) &&
      !didCapture,
  };
}

function clampOuterMarkerCount(markerCount: number) {
  return Math.max(0, Math.min(4, Math.trunc(markerCount)));
}

export function getFourGuideScannerPresentation(
  scanState: FourPointScanState,
  markerCount: number,
): FourGuideScannerPresentation {
  const visibleMarkerCount = clampOuterMarkerCount(markerCount);

  if (scanState === 'processing') {
    return {
      visibleMarkerCount,
      statusLabel: 'A reconhecer respostas',
      instructionTitle: 'A processar sem interromper a câmara',
      instructionBody:
        'A validação final, o QR e as respostas estão a ser analisados. O resultado abre quando estiver completo.',
    };
  }
  if (scanState === 'capturing') {
    return {
      visibleMarkerCount,
      statusLabel: 'A capturar fotografia',
      instructionTitle: 'A capturar a folha',
      instructionBody:
        'Mantenha a folha estável por um instante enquanto a fotografia é capturada.',
    };
  }
  if (scanState === 'ready') {
    return {
      visibleMarkerCount,
      statusLabel: '4/4 marcadores · mantenha estável',
      instructionTitle: 'Folha detetada',
      instructionBody:
        'Mantenha a folha estável enquanto a leitura seguinte confirma a página.',
    };
  }
  if (scanState === 'validating' || visibleMarkerCount === 4) {
    return {
      visibleMarkerCount,
      statusLabel: '4/4 marcadores · a validar',
      instructionTitle: 'Mantenha a folha estável',
      instructionBody:
        'A página está a ser validada automaticamente. Mantenha o enquadramento por um instante.',
    };
  }

  return {
    visibleMarkerCount,
    statusLabel: `${visibleMarkerCount}/4 marcadores`,
    instructionTitle:
      visibleMarkerCount > 0
        ? 'Continue a alinhar a folha'
        : 'Coloque um quadrado preto em cada área',
    instructionBody:
      'Cada área fica verde quando encontra um dos quatro marcadores exteriores.',
  };
}
