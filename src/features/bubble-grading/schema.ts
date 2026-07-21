export const SUPPORTED_SCHEMA_FORMAT_VERSION = 1 as const;

export type PixelPoint = {
  x: number;
  y: number;
};

export type PixelRectangle = PixelPoint & {
  width: number;
  height: number;
};

/**
 * `unresolved` is a temporary workbench-only state. The preview resolves it
 * from input.jpg; grading must use a schema whose dimensions are fixed.
 */
export type CanonicalImageDimensions =
  | {
      status: 'unresolved';
      widthPx: null;
      heightPx: null;
    }
  | {
      status: 'fixed';
      widthPx: number;
      heightPx: number;
    };

export type CanonicalImageMetadata = {
  coordinateSystem: 'canonical-crop-pixels';
  origin: 'top-left';
  dimensions: CanonicalImageDimensions;
  pixelsPerMillimeter: number;
};

export type BubbleStyle = {
  /** Radius of the printed bubble circumference. */
  radiusPx: number;
  printedOutlineWidthPx: number;
  /** Complete patch visited by the detector around the declared center. */
  roiRadiusPx: number;
  /** Interior disk used for fill measurements; excludes the printed outline. */
  fillRadiusPx: number;
  /** Annulus guaranteed by the generator to contain clear local paper. */
  backgroundRingInnerRadiusPx: number;
  backgroundRingOuterRadiusPx: number;
  /** Maximum local center adjustment; never a whole-page circle search. */
  centerSearchTolerancePx: number;
};

export type BubbleSchema = {
  id: string;
  label: string;
  centerPx: PixelPoint;
};

export type QuestionSchema = {
  id: string;
  label: string;
  selectionMode: 'single' | 'multiple';
  points: number;
  correctBubbleIds: string[];
  bubbles: BubbleSchema[];
};

/**
 * Generator-owned layout data for one known test. Every coordinate and radius
 * is expressed directly in pixels of the marker-free canonical crop.
 */
export type BubbleGradingSchema = {
  formatVersion: typeof SUPPORTED_SCHEMA_FORMAT_VERSION;
  test: {
    id: string;
    version: string;
  };
  canonicalImage: CanonicalImageMetadata;
  qrRegionPx: PixelRectangle;
  bubbleStyle: BubbleStyle;
  questions: QuestionSchema[];
};
