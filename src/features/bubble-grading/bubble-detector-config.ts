/**
 * Camera- and pen-dependent prototype values. These deliberately live outside
 * the generator-owned schema and must be calibrated against physical sheets.
 *
 * Keep `provisional: true` until representative printed sheets have been
 * measured on the target iPhone. Phase 08 diagnostics expose every value below
 * beside the measurement that it influences.
 */
export const BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION = 1 as const;

export type BubbleDetectorConfig = Readonly<{
  formatVersion: typeof BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION;
  id: string;
  provisional: boolean;
  darkPixelDelta: number;
  unfilledMaxDarkPixelRatio: number;
  filledMinDarkPixelRatio: number;
  minimumBackgroundBrightness: number;
  minimumMarkedContrast: number;
  minimumFocusScore: number;
}>;

export const PROVISIONAL_BUBBLE_DETECTOR_CONFIG: BubbleDetectorConfig =
  Object.freeze({
    formatVersion: BUBBLE_DETECTOR_CONFIG_FORMAT_VERSION,
    id: 'provisional-physical-calibration-required-v1',
    provisional: true,
    darkPixelDelta: 0.1,
    unfilledMaxDarkPixelRatio: 0.18,
    filledMinDarkPixelRatio: 0.52,
    minimumBackgroundBrightness: 0.45,
    minimumMarkedContrast: 0.08,
    minimumFocusScore: 0.0015,
  });
