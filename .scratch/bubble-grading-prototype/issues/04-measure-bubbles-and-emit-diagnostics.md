# 04 — Phase 2A: Measure bubbles and emit diagnostics

**What to build:** Extend the offline workbench so a canonical scan and validated schema produce transparent measurements for every expected bubble. Analysis must remain limited to small schema-declared regions, classify bubbles as filled, unfilled, or uncertain, annotate the preview, and emit a machine-readable diagnostic result with explicit reasons.

**Blocked by:** 03 — Phase 0B: Lock the canonical crop contract.

**Status:** ready-for-agent

- [ ] The analyzer refuses to run when schema validation fails or image dimensions do not exactly match the schema.
- [ ] Analysis visits only schema-defined bubble ROIs and does not search the full page for unknown circles.
- [ ] The printed outline is excluded from the fill measurement by using the declared fill radius.
- [ ] The declared background ring is used to estimate nearby paper brightness and local contrast.
- [ ] The center-search tolerance permits only a small local adjustment and records any applied adjustment in diagnostics.
- [ ] Every bubble result includes question ID, bubble ID, expected and measured center, measurement radii, interior brightness, background brightness, dark-pixel ratio, contrast, blur or focus evidence, confidence, decision, timing, and reason codes.
- [ ] Bubble decisions have exactly three states: filled, unfilled, and uncertain.
- [ ] Filled and unfilled decision bands are centralized detector configuration, clearly marked as provisional, and not stored in the generated schema.
- [ ] Measurements near a decision boundary become uncertain with an explicit threshold-related reason.
- [ ] Poor local contrast, excessive blur, or an incomplete measurement region creates explicit uncertainty reasons rather than a guessed decision.
- [ ] The workbench overlay prints each bubble's fill score, background score, decision, confidence, and triggered reasons in readable bright colors.
- [ ] The workbench writes `result.json` containing scan-level and bubble-level diagnostics.
- [ ] Running the analyzer repeatedly against unchanged inputs produces the same diagnostics.
- [ ] The diagnostic format is platform-neutral so the mobile app can later expose the same measurements and reason codes.
- [ ] Representative empty, clearly filled, low-contrast, and deliberately uncertain fixtures demonstrate the external behavior without asserting internal OpenCV call order.
- [ ] Existing TypeScript and lint checks pass.
- [ ] Work stops after bubble-level diagnostics are complete; question grading and mobile integration are not started.
