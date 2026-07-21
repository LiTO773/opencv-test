import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  type TestSchema,
} from '../../src/features/document-scanner/test-schema';

/**
 * This is the one hardcoded file your PDF script should update.
 *
 * The example uses the common PDF convention: (0, 0) is the bottom-left.
 * Replace the four capture anchors with the exact PDF coordinates of the
 * inward-facing corners of the four outer black markers. Their order is
 * always visual: top-left, top-right, bottom-right, bottom-left.
 */
export const testSchema: TestSchema = {
  id: 'replace-with-your-test-id',
  version: 1,
  page: {
    widthPt: A4_WIDTH_PT,
    heightPt: A4_HEIGHT_PT,
    origin: 'bottom-left',
    captureAnchorsPt: [
      { x: 0, y: A4_HEIGHT_PT },
      { x: A4_WIDTH_PT, y: A4_HEIGHT_PT },
      { x: A4_WIDTH_PT, y: 0 },
      { x: 0, y: 0 },
    ],
    qrRegionPt: {
      x: 36,
      y: A4_HEIGHT_PT - 108,
      width: 72,
      height: 72,
    },
  },
  questions: [
    {
      id: 'question-1',
      selection: 'single',
      points: 1,
      correctBubbleIds: ['a'],
      bubbles: [
        { id: 'a', label: 'A', centerPt: { x: 180, y: 610 }, radiusPt: 9 },
        { id: 'b', label: 'B', centerPt: { x: 230, y: 610 }, radiusPt: 9 },
        { id: 'c', label: 'C', centerPt: { x: 280, y: 610 }, radiusPt: 9 },
        { id: 'd', label: 'D', centerPt: { x: 330, y: 610 }, radiusPt: 9 },
      ],
    },
    {
      id: 'question-2',
      selection: 'multiple',
      points: 2,
      correctBubbleIds: ['b', 'd'],
      bubbles: [
        { id: 'a', label: 'A', centerPt: { x: 180, y: 550 }, radiusPt: 9 },
        { id: 'b', label: 'B', centerPt: { x: 230, y: 550 }, radiusPt: 9 },
        { id: 'c', label: 'C', centerPt: { x: 280, y: 550 }, radiusPt: 9 },
        { id: 'd', label: 'D', centerPt: { x: 330, y: 550 }, radiusPt: 9 },
      ],
    },
  ],
};
