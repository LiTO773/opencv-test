# 08 — Phase 3C: Expose diagnostics and harden the prototype

**What to build:** Complete the prototype with an expandable in-app diagnostic record and end-to-end iPhone hardening. Every automatic decision and review condition must be explainable, performance must be visible for a representative full page, and the agreed capture-to-grade-to-share workflow must pass final verification without adding production concerns.

**Blocked by:** 07 — Phase 3B: Add visual question review.

**Status:** ready-for-agent

- [ ] The result screen contains an expandable diagnostics section that is collapsed by default.
- [ ] Scan-level logs include canonical dimensions, QR metadata, global quality findings, total analysis time, bubble count, and all scan-level review reasons.
- [ ] Bubble-level logs include identity, expected and measured center, radii, applied center adjustment, interior brightness, background brightness, dark-pixel ratio, contrast, blur evidence, thresholds, confidence, decision, timing, and reason codes.
- [ ] Question-level logs include detected IDs, correct IDs, exact-set comparison, status, awarded points, pending points, confidence, and contributing bubble reasons.
- [ ] Human-readable explanations are shown alongside stable structured reason codes.
- [ ] Clearly incorrect extra selections remain distinguishable from genuinely uncertain measurements.
- [ ] Globally blurry or low-contrast captures show provisional results and explain every affected question rather than disappearing.
- [ ] A representative page of approximately 50 questions and up to roughly 250 bubbles is manually exercised on the target iPhone with visible timing information.
- [ ] Repeated scans confirm fixed canonical dimensions, stable marker-free boundaries, QR/student identification, grading, clean/annotated views, and clean JPEG sharing.
- [ ] The user can manually tune provisional detector thresholds based on observed diagnostics without editing generated schemas.
- [ ] No persistence, manual correction, production schema retrieval, backend integration, Android-specific work, OCR, or non-filled-circle mark recognition is introduced.
- [ ] TypeScript, lint, diff checks, and iOS production bundling pass.
- [ ] The implementation documentation identifies remaining calibration TODOs without presenting provisional thresholds as production-ready.
- [ ] Work stops at the agreed prototype boundary and is handed back for the user's final sprint review.
