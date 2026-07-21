import { CANONICAL_CROP_CONTRACT } from '../../src/features/bubble-grading/canonical-crop-contract';
import type { BubbleGradingSchema } from '../../src/features/bubble-grading/schema';

/**
 * Fixed generator handoff. Replace this object and input.jpg, then keep
 * `pnpm schema:preview --watch` running while coordinates are refined. The
 * prototype app imports this same hardcoded schema so the contracts cannot drift.
 */
export const schema: BubbleGradingSchema = {
  formatVersion: 1,
  test: {
    id: "ABCD",
    version: "draft-1",
  },
  canonicalImage: {
    coordinateSystem: "canonical-crop-pixels",
    origin: "top-left",
    dimensions: {
      status: "fixed",
      widthPx: CANONICAL_CROP_CONTRACT.widthPx,
      heightPx: CANONICAL_CROP_CONTRACT.heightPx,
    },
    pixelsPerMillimeter: CANONICAL_CROP_CONTRACT.pixelsPerMillimeter,
  },
  qrRegionPx: {
    x: 700,
    y: 10,
    width: 170,
    height: 170,
  },
  bubbleStyle: {
    radiusPx: 10,
    printedOutlineWidthPx: 1.5,
    roiRadiusPx: 16,
    fillRadiusPx: 7,
    backgroundRingInnerRadiusPx: 12,
    backgroundRingOuterRadiusPx: 14,
    centerSearchTolerancePx: 2,
  },
  questions: [
    {
      id: "1-luna",
      label: "1 Luna",
      selectionMode: "multiple",
      points: 2,
      correctBubbleIds: ["1-luna-5", "1-luna-7"],
      bubbles: [
        { id: "1-luna-1", label: "1", centerPx: { x: 152, y: 524 } },
        { id: "1-luna-2", label: "2", centerPx: { x: 186, y: 524 } },
        { id: "1-luna-3", label: "3", centerPx: { x: 219, y: 524 } },
        { id: "1-luna-4", label: "4", centerPx: { x: 253, y: 524 } },
        { id: "1-luna-5", label: "5", centerPx: { x: 287, y: 524 } },
        { id: "1-luna-6", label: "6", centerPx: { x: 321, y: 524 } },
        { id: "1-luna-7", label: "7", centerPx: { x: 355, y: 524 } },
      ],
    },
    {
      id: "1-theo",
      label: "1 Theo",
      selectionMode: "multiple",
      points: 3,
      correctBubbleIds: ["1-theo-1", "1-theo-3", "1-theo-4"],
      bubbles: [
        { id: "1-theo-1", label: "1", centerPx: { x: 152, y: 557 } },
        { id: "1-theo-2", label: "2", centerPx: { x: 186, y: 557 } },
        { id: "1-theo-3", label: "3", centerPx: { x: 219, y: 557 } },
        { id: "1-theo-4", label: "4", centerPx: { x: 253, y: 557 } },
        { id: "1-theo-5", label: "5", centerPx: { x: 287, y: 557 } },
        { id: "1-theo-6", label: "6", centerPx: { x: 321, y: 557 } },
        { id: "1-theo-7", label: "7", centerPx: { x: 355, y: 557 } },
      ],
    },
    {
      id: "1-isa",
      label: "1 Isabella",
      selectionMode: "multiple",
      points: 3,
      correctBubbleIds: ["1-isa-2", "1-isa-6"],
      bubbles: [
        { id: "1-isa-1", label: "1", centerPx: { x: 152, y: 590 } },
        { id: "1-isa-2", label: "2", centerPx: { x: 186, y: 590 } },
        { id: "1-isa-3", label: "3", centerPx: { x: 219, y: 590 } },
        { id: "1-isa-4", label: "4", centerPx: { x: 253, y: 590 } },
        { id: "1-isa-5", label: "5", centerPx: { x: 287, y: 590 } },
        { id: "1-isa-6", label: "6", centerPx: { x: 321, y: 590 } },
        { id: "1-isa-7", label: "7", centerPx: { x: 355, y: 590 } },
      ],
    },
    {
      id: "2.1",
      label: "2.1",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.1-a"],
      bubbles: [
        { id: "2.1-a", label: "A", centerPx: { x: 152, y: 657 } },
        { id: "2.1-b", label: "B", centerPx: { x: 186, y: 657 } },
        { id: "2.1-c", label: "C", centerPx: { x: 219, y: 657 } },
      ],
    },
    {
      id: "2.2",
      label: "2.2",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.2-c"],
      bubbles: [
        { id: "2.2-a", label: "A", centerPx: { x: 152, y: 690 } },
        { id: "2.2-b", label: "B", centerPx: { x: 186, y: 690 } },
        { id: "2.2-c", label: "C", centerPx: { x: 219, y: 690 } },
      ],
    },
    {
      id: "2.3",
      label: "2.3",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.3-c"],
      bubbles: [
        { id: "2.3-a", label: "A", centerPx: { x: 152, y: 723 } },
        { id: "2.3-b", label: "B", centerPx: { x: 186, y: 723 } },
        { id: "2.3-c", label: "C", centerPx: { x: 219, y: 723 } },
      ],
    },
    {
      id: "2.4",
      label: "2.4",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.4-b"],
      bubbles: [
        { id: "2.4-a", label: "A", centerPx: { x: 152, y: 756 } },
        { id: "2.4-b", label: "B", centerPx: { x: 186, y: 756 } },
        { id: "2.4-c", label: "C", centerPx: { x: 219, y: 756 } },
      ],
    },
    {
      id: "2.5",
      label: "2.5",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.5-b"],
      bubbles: [
        { id: "2.5-a", label: "A", centerPx: { x: 152, y: 789 } },
        { id: "2.5-b", label: "B", centerPx: { x: 186, y: 789 } },
        { id: "2.5-c", label: "C", centerPx: { x: 219, y: 789 } },
      ],
    },
    {
      id: "2.6",
      label: "2.6",
      selectionMode: "single",
      points: 8,
      correctBubbleIds: ["2.6-c"],
      bubbles: [
        { id: "2.6-a", label: "A", centerPx: { x: 152, y: 823 } },
        { id: "2.6-b", label: "B", centerPx: { x: 186, y: 823 } },
        { id: "2.6-c", label: "C", centerPx: { x: 219, y: 823 } },
      ],
    },
  ],
};
