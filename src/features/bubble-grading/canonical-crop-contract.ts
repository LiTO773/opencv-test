/**
 * User-reviewed dimensions established with the phase 02 schema workbench.
 * The scanner and hardcoded app schema must import this single contract.
 */
export const CANONICAL_CROP_CONTRACT = {
  widthPx: 875,
  heightPx: 1280,
  pixelsPerMillimeter: 4,
} as const;

export const CANONICAL_CROP_ASPECT_RATIO =
  CANONICAL_CROP_CONTRACT.widthPx / CANONICAL_CROP_CONTRACT.heightPx;
