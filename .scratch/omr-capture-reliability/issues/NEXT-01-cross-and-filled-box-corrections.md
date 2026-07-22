# NEXT-01 — Calibrate cross and filled-box corrections

**Status:** Deferred to next sprint  
**Type:** Committed correction-semantics follow-up  
**Blocked by:** Current sprint ticket 18 and frozen grey-box template geometry  
**Blocks:** Future correction-enabled scanner acceptance

## Objective

Allow students to correct an answer without erasing it: a qualifying cross that
uses the surrounding grey box edges invalidates the bubble, and fully painting
that box selects the answer again.

## Required semantic precedence

Evaluate correction intent over the complete registered box area, using this
precedence:

1. **Fully painted box:** selected, even when an earlier cross remains visible.
2. **Valid cross:** invalidated/unselected, including when drawn over a filled
   bubble.
3. **Ordinary bubble state:** selected or unselected using the reliable bubble
   detector produced by the current sprint.
4. **Ambiguous correction evidence:** uncertain; do not guess.

## Scope

- Define the exact designated border/corner regions a valid cross must reach.
- Define diagonal continuity, stroke, intersection, and tolerance requirements
  without requiring perfect student drawing.
- Define what proportion and spatial distribution make a correction box fully
  painted rather than merely crossed or scribbled.
- Support black and blue ink on the frozen grey-box form.
- Classify ordinary empty, ordinary filled, crossed empty, crossed previously
  filled, fully painted after cross, and ambiguous/incomplete states.
- Combine correction evidence deterministically across credible registered
  frames.
- Add stable correction measurements, decisions, uncertainty reasons, and
  question-level effects to the authoritative TypeScript analyzer.
- Reuse current-sprint full-box crops, recording/replay, configuration
  evaluation, physical split discipline, and held-out validation workflow.
- Preserve exact selected-set grading after correction state resolves to the
  effective selected/unselected bubble state.

## Out of scope until this ticket begins

- Partial implementation in the current reliability sprint.
- Changing the printed grey-box geometry after current-sprint calibration.
- Eraser interpretation, overwritten answers outside the box, ticks, dots,
  circles, arbitrary scribbles, or pencil.
- Learned classification without a separate evidence-backed decision.

## Required physical fixtures

- Both required devices and the frozen current/dense layouts.
- At least two black and two blue pens, including available ballpoint and gel.
- Crosses over empty and previously filled bubbles.
- Crosses with natural variations in angle, stroke width, edge reach, and
  intersection placement.
- Fully painted boxes over ordinary fills and visible crosses.
- Near-boundary incomplete crosses and incompletely painted boxes for explicit
  uncertain behavior.
- Marks distributed across page regions and supported lighting/shadow classes.
- Physically separate calibration and untouched validation sheets with truth
  declared before scanning.

## Acceptance criteria

- [ ] A qualifying cross using the designated grey box edges resolves to
      invalidated/unselected on held-out supported fixtures.
- [ ] A fully painted box resolves to selected and overrides an underlying
      qualifying cross.
- [ ] Ordinary empty/filled behavior from the current sprint does not regress.
- [ ] Ambiguous or incomplete correction evidence is uncertain rather than
      silently selected or unselected.
- [ ] Black and blue correction behavior is reported separately and together.
- [ ] Cross-frame disagreement remains explicit and localized.
- [ ] Mobile and offline replay use the same TypeScript evidence-session seam.
- [ ] No correction threshold is accepted without frozen-baseline comparison
      and physically held-out validation.
- [ ] The established 1.5-second evidence and 3-second P95 result budgets are
      revalidated with correction analysis enabled.

## Validation evidence

- Versioned correction-state schema and diagnostic contract.
- Synthetic geometry and boundary fixtures.
- Physical calibration and untouched validation manifests.
- Confusion matrices by correction state, ink, device, lighting, region, and
  layout.
- Mobile/replay parity and cross-device timing reports.
- Failure gallery showing ambiguous and rejected correction evidence.

## Handoff notes

Do not reduce the correction to darkness inside the original bubble ROI. A
cross over an already filled bubble can look filled there, and a fully painted
box must override the cross. The complete box-area structure and precedence are
the behavior being calibrated.

