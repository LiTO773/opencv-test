export const multipleErrorsSchemaFixture: unknown = {
  formatVersion: 99,
  test: { id: '', version: '' },
  canonicalImage: {
    coordinateSystem: 'pdf-points',
    origin: 'bottom-left',
    dimensions: { status: 'fixed', widthPx: 100, heightPx: 100 },
    pixelsPerMillimeter: 0,
  },
  qrRegionPx: { x: 90, y: -2, width: 20, height: 20 },
  bubbleStyle: {
    radiusPx: -1,
  },
  questions: [
    {
      id: 'duplicate-question',
      label: '',
      selectionMode: 'choose-any',
      points: 1.5,
      correctBubbleIds: ['missing'],
      bubbles: [
        { id: 'duplicate-bubble', label: '', centerPx: { x: 5, y: 5 } },
        { id: 'nearby-bubble', label: 'B', centerPx: { x: 6, y: 6 } },
      ],
    },
    {
      id: 'duplicate-question',
      label: 'Question 2',
      selectionMode: 'single',
      points: -1,
      correctBubbleIds: ['duplicate-bubble'],
      bubbles: [
        { id: 'duplicate-bubble', label: 'A', centerPx: { x: 50, y: 50 } },
      ],
    },
  ],
};
