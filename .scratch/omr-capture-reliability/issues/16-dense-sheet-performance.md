# 16 — Validate dense-sheet performance

**Status:** Ready for agent and owner collaboration  
**Type:** Performance and architecture gate  
**Blocked by:** 06, 13, 14  
**Blocks:** 17, 18

## Objective

Measure the complete TypeScript/worklet pipeline at the actual ceiling of 50
questions and 7 choices each on both required devices before considering a
native hot path.

## Scope

- Run release and diagnostic builds with the 350-bubble physical fixture using
  the final grey correction box around every bubble.
- Report acquisition, normalization, readback, measurement, aggregation, QR,
  persistence, UI handoff, memory, bundle size, and total time separately.
- Report median, P95, and worst observations by device and mode.
- Verify the 1.5-second evidence-window cap and 3-second release-result P95.
- Profile the TypeScript/worklet hot path under representative frame counts.
- Identify whether frame throughput may vary by device without changing grading
  semantics.
- Produce an architecture decision: keep TypeScript/worklet with margin, or
  recommend a later targeted native investigation naming the exact bottleneck.

## Out of scope

- Implementing native OpenCV, JSI, Nitro, or another rewrite.
- Reducing reliability evidence merely to make a benchmark pass.
- Device-specific grading thresholds.

## Acceptance criteria

- [ ] Physical measurements exist for iPhone 15 Pro/iOS 26 and Pocophone
      F1/MIUI Android 10.
- [ ] The dense fixture exercises all 350 bubble ROIs.
- [ ] Timing and memory include preservation of the full correction-box evidence
      required by replay and the next sprint.
- [ ] Evidence collection ends by 1.5 seconds on both devices.
- [ ] Release result presentation meets the 3-second P95 target on both devices,
      or the exact failed stage is identified.
- [ ] Diagnostic overhead is excluded from the release acceptance number and
      reported separately.
- [ ] Memory and evidence-bundle size are recorded.
- [ ] The architecture recommendation follows measured data and includes
      reasonable performance margin, not a single best run.

## Validation evidence

- Owner-run repeated physical benchmark traces on both devices.
- Stage-timing distributions and hot-path profiles.
- Configuration, build, schema, and fixture identities for every run.
- A signed-off performance/architecture decision report.

## Handoff notes

If the TypeScript/worklet path misses the target, this sprint records the
bottleneck and recommendation. A native implementation requires a separately
approved ticket or sprint.
