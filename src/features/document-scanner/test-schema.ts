export const A4_WIDTH_PT = (210 / 25.4) * 72;
export const A4_HEIGHT_PT = (297 / 25.4) * 72;

export type PdfPoint = {
  x: number;
  y: number;
};

export type PdfRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Visual order, independent of whether the PDF origin is at the top or bottom. */
export type PdfQuadrilateral = [PdfPoint, PdfPoint, PdfPoint, PdfPoint];

export type BubbleSchema = {
  id: string;
  label: string;
  centerPt: PdfPoint;
  radiusPt: number;
};

export type QuestionSchema = {
  id: string;
  selection: 'single' | 'multiple';
  bubbles: BubbleSchema[];
  correctBubbleIds: string[];
  points: number;
};

/**
 * Everything needed to locate and grade one known printed test.
 *
 * Coordinates use PDF points. The QR payload is intentionally not used to
 * choose this schema. `captureAnchorsPt` are the PDF positions represented by
 * the four OpenCV crop corners, always ordered TL, TR, BR, BL visually.
 */
export type TestSchema = {
  id: string;
  version: number;
  page: {
    widthPt: number;
    heightPt: number;
    origin: 'bottom-left' | 'top-left';
    captureAnchorsPt: PdfQuadrilateral;
    qrRegionPt: PdfRectangle;
  };
  questions: QuestionSchema[];
};
