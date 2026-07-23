# 01 — Build the six-marker page-layout contract

**What to build:** A complete, testable page-layout engine that recognizes top, middle, and bottom black markers in both margins as one coherent portrait-sheet hypothesis. It must preserve the marker-free crop defined by the outer markers and derive the four guaranteed blank-paper corridors needed by later calibration work.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Marker matches have stable top-left, middle-left, bottom-left, top-right, middle-right, and bottom-right identities across layout selection, crop generation, calibration geometry, and diagnostics.
- [ ] Candidate selection evaluates complete six-marker page hypotheses rather than selecting each marker independently.
- [ ] A valid layout enforces vertical ordering, approximate even spacing, column alignment, marker-size consistency, corresponding row geometry, left/right span consistency, convexity, portrait proportions, and minimum page area.
- [ ] A coherent perspective-distorted six-marker fixture is accepted and produces the expected marker ordering.
- [ ] A fixture containing only the four outer markers is rejected as an incomplete page layout.
- [ ] Missing, displaced, incorrectly ordered, badly sized, or unevenly spaced middle markers cause layout rejection even when the outer markers appear plausible.
- [ ] QR finder-pattern hierarchy rejection remains effective, including when a QR candidate has a stronger local appearance score than a real marker.
- [ ] The crop quadrilateral continues to use the inward-facing corners of the four outer markers and remains compatible with the established marker-free canonical crop.
- [ ] Four safe white-reference corridors are derived between top-to-middle and middle-to-bottom markers on both margins.
- [ ] Corridor geometry is inset from marker edges and unsafe boundaries so later sampling avoids toner spread, antialiasing, and marker pixels.
- [ ] Pure layout tests cover valid, incomplete, QR-confused, non-convex, landscape, implausibly narrow, implausibly wide, and internally inconsistent arrangements.
- [ ] Existing schema, grading, contour-hierarchy, type, and lint checks remain green.
