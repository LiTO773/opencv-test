# 10 — Add color-preserving bubble evidence

**Status:** Ready for agent  
**Type:** Bubble measurement  
**Blocked by:** 03, 06  
**Blocks:** 12, 17

## Objective

Retain useful camera color long enough to recognize supported blue ink while
preserving black-ink and grayscale behavior.

## Scope

- Preserve expected/measured center, outline darkness, local paper luminance,
  interior luminance, dark-pixel ratio, contrast, focus, confidence, and reasons.
- Preserve the complete registered correction-box crop and distinct masks for
  bubble interior, expected printed outlines/border, box interior outside the
  bubble, and local paper outside the box.
- Exclude the expected grey border from student-ink, dark-pixel, color-distance,
  and local-paper measurements.
- Continue using the existing BT.709-style luminance definition wherever a
  grayscale value is required.
- Add color distance between bubble interior and local paper.
- Add blue/chroma, saturation, and channel-difference evidence normalized to
  the local paper instead of using raw RGB device thresholds.
- Keep physical coverage labels distinct from measured pixel ratios.
- Make new evidence serializable, configurable, and offline-replayable.
- Compare grayscale-only and color-aware behavior on identical evidence.

## Out of scope

- Pencil or arbitrary ink colors.
- Interpreting handwritten crosses or fully painted correction boxes.
- Colored printed forms.
- Learned classification or per-device grading thresholds.
- Declaring final parameter values before ticket 17.

## Acceptance criteria

- [ ] Deterministic black, blue, gray, and white pixel fixtures have expected
      luminance and color evidence.
- [ ] Common exposure shifts that move interior and local paper together do not
      create raw-color instability.
- [ ] Existing black-ink fixtures do not regress.
- [ ] An unmarked expected grey border does not change the ordinary bubble
      decision relative to equivalent bubble evidence.
- [ ] Color-aware and grayscale-only reports can be generated from identical
      recorded pixels.
- [ ] Full blue and black calibration marks remain measurable under supported
      lighting.
- [ ] Approximately 40%/70% labels remain ground-truth metadata rather than
      being equated with a pixel-ratio threshold.
- [ ] Mobile and replay calculations meet the declared parity tolerance.

## Validation evidence

- Synthetic color fixtures and exposure-shift fixtures.
- Calibration-corpus reports split by black and blue ink.
- Per-field replay-parity report.
- A regression summary showing whether color evidence preserves or improves
  each supported ink category.

## Handoff notes

An apparent blue-ink gain is unacceptable if it silently damages black ink.
Final acceptance is based on ticket 17's configuration comparison, not selected
examples.
