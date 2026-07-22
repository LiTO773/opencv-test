# 09 — Implement inspectable frame-quality gates

**Status:** Ready for agent  
**Type:** Evidence eligibility  
**Blocked by:** 01, 08  
**Blocks:** 11, 12

## Objective

Represent whether each candidate frame and each local bubble observation is
credible before aggregation. Poor capture evidence must not silently influence
a confident grade.

## Scope

- Measure spatial answer-area focus and local bubble focus.
- Place bubble-local paper and quality samples outside the complete correction
  box and exclude the expected grey border from dark/glare evidence.
- Measure exposure movement, local paper brightness, white-reference
  distribution, highlight clipping, spatial glare, illumination gradient,
  registration residual, center-adjustment distribution, and usable bubble
  coverage.
- Preserve individual measurements and reasons; do not hide behavior behind one
  opaque quality score.
- Support global exclusion for severe failure and local exclusion for affected
  bubble evidence.
- Keep visual-frame ranking distinct from numerical eligibility.
- Record every exclusion scope and reason in the versioned diagnostic contract.
- Make thresholds configuration-owned and replayable.

## Out of scope

- User-facing wording/visualization.
- Shadow correction itself.
- Device-specific definitions of valid evidence.
- Final threshold selection before calibration.

## Acceptance criteria

- [ ] Severe blur, clipping/glare, and misregistration cannot contribute to
      confident evidence silently.
- [ ] A localized defect does not automatically invalidate unaffected bubbles.
- [ ] An intact expected grey box does not independently trigger poor contrast,
      glare, or local-quality exclusion.
- [ ] Every excluded contribution names frame, scope, measurement, threshold,
      and stable reason code.
- [ ] Quality records remain inspectable without a composite score.
- [ ] Best-visual ranking does not change eligibility decisions.
- [ ] Identical evidence and configuration produce identical quality outcomes.
- [ ] Single credible frame compatibility is preserved when no quality reason
      applies.

## Validation evidence

- Deterministic sharp/blurred, normal/clipped, and registered/misregistered
  fixtures.
- Local-defect fixtures proving exclusion localization.
- Serialization and replay tests for quality records.
- Calibration-corpus distributions prepared for ticket 17 without tuning them
  in this ticket.

## Handoff notes

This ticket adds measurements and configurable gates. It must not choose values
by looking at held-out validation evidence.
