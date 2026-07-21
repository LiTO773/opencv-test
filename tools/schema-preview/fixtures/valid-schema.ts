import type { BubbleGradingSchema } from '../../../src/features/bubble-grading/schema';

export const validSchemaFixture: BubbleGradingSchema = {
  formatVersion: 1,
  test: { id: 'fixture-test', version: '1' },
  canonicalImage: {
    coordinateSystem: 'canonical-crop-pixels',
    origin: 'top-left',
    dimensions: { status: 'fixed', widthPx: 640, heightPx: 480 },
    pixelsPerMillimeter: 4,
  },
  qrRegionPx: { x: 24, y: 24, width: 96, height: 96 },
  bubbleStyle: {
    radiusPx: 12,
    printedOutlineWidthPx: 2,
    roiRadiusPx: 22,
    fillRadiusPx: 8,
    backgroundRingInnerRadiusPx: 15,
    backgroundRingOuterRadiusPx: 19,
    centerSearchTolerancePx: 3,
  },
  questions: [
    {
      id: 'q1',
      label: 'Question 1',
      selectionMode: 'single',
      points: 1,
      correctBubbleIds: ['q1-a'],
      bubbles: [
        { id: 'q1-a', label: 'A', centerPx: { x: 220, y: 200 } },
        { id: 'q1-b', label: 'B', centerPx: { x: 300, y: 200 } },
      ],
    },
    {
      id: 'q2',
      label: 'Question 2',
      selectionMode: 'multiple',
      points: 2,
      correctBubbleIds: ['q2-a', 'q2-b'],
      bubbles: [
        { id: 'q2-a', label: 'A', centerPx: { x: 220, y: 300 } },
        { id: 'q2-b', label: 'B', centerPx: { x: 300, y: 300 } },
      ],
    },
  ],
};
