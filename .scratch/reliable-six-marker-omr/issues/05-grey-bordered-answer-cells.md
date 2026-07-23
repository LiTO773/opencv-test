# 05 — Support grey-bordered answer cells

**What to build:** The scanner must grade bubbles inside grey-bordered answer cells without allowing the printed box, bubble outline, labels, or other declared printed geometry to contaminate fill, centering, paper-reference, or focus evidence.

**Blocked by:** 04 — Grade bubbles using page-wide illumination normalization.

**Status:** ready-for-agent

- [ ] Every answer choice declares an explicit canonical answer-cell rectangle in addition to its bubble center and printed bubble geometry.
- [ ] Schema validation rejects missing, non-finite, non-positive, out-of-bounds, overlapping, or otherwise unsafe answer-cell geometry.
- [ ] Validation ensures the bubble and its permitted center-adjustment range fit inside the owning answer cell with the required border exclusion.
- [ ] Schema preview tooling renders answer-cell rectangles, grey-border exclusions, bubble interiors, and other safe or excluded measurement regions.
- [ ] Bubble fill measurement remains limited to the declared bubble interior.
- [ ] Grey cell borders, printed bubble outlines, labels, and other declared printed regions do not contribute to fill ratio or page-white evidence.
- [ ] The previous circular background ring is removed as a classification source of truth and obsolete contract fields are removed or migrated without leaving mobile/offline drift.
- [ ] Bubble-center adjustment remains bounded around the expected bubble and cannot be pulled toward a nearby grey border.
- [ ] Focus evidence uses declared safe geometry and a sharp grey border cannot make an unreadable bubble interior appear confidently readable.
- [ ] Equivalent empty and filled bubbles with no border, a normal grey border, a darker permissible grey border, and small perspective-resampling changes retain equivalent decisions.
- [ ] Border pixels are demonstrably absent from normalized fill evidence and diagnostic sampled-pixel accounting.
- [ ] Empty, clearly filled, borderline, faint, blurred, and low-contrast bubble fixtures retain safe and deterministic outcomes.
- [ ] Whole-cell painting or shading remains explicitly unsupported and is not interpreted as a reusable answer.
- [ ] Question scoring, pending-review behavior, QR diagnostics, canonical dimensions, and answer-key semantics remain unchanged.
- [ ] Mobile diagnostics and the offline workbench expose the same cell geometry, exclusions, normalized bubble evidence, and stable reason codes.
- [ ] Type checking, linting, and the complete six-marker, calibration, schema, grading, diagnostic, performance, and tooling test suite pass.
