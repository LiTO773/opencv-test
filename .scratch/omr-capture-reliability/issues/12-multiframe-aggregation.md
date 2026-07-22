# 12 — Implement deterministic multi-frame aggregation

**Status:** Ready for agent  
**Type:** Decision logic  
**Blocked by:** 08, 09, 10, 11  
**Blocks:** 13, 14, 15, 17

## Objective

Combine credible observations from several registered frames so one poor frame
cannot dominate, while preserving uncertainty whenever credible evidence
crosses a decision boundary.

## Scope

- Group per-frame measurements by stable schema bubble ID.
- Ignore globally or locally excluded contributions and retain their reasons.
- Implement deterministic, order-independent robust statistics, initially
  median and median absolute deviation or an equivalently justified method.
- Record contributing frames, exclusions, combined values, spread, confidence,
  per-frame decisions, and disagreement reasons for every bubble.
- Require credible evidence to remain on the same side of a calibrated boundary
  for a confident combined decision.
- Distinguish legitimate uncertain fill from insufficient credible evidence and
  cross-frame disagreement.
- Run unchanged exact-set question grading from combined bubble decisions.
- Select a deterministic best visual frame independently of numerical
  aggregation.

## Out of scope

- Averaging scores alone.
- Hiding disagreement by majority vote.
- Resolving handwritten correction states; inputs in this sprint are ordinary
  bubble decisions from grey-box forms whose surrounding boxes are unmarked.
- User-interface presentation.
- Final aggregator/threshold acceptance before ticket 17.

## Acceptance criteria

- [ ] Reordering identical candidate frames cannot change any serialized
      decision or diagnostic.
- [ ] One excluded or extreme frame cannot overturn several consistent credible
      observations.
- [ ] Credible evidence spanning filled/unfilled or uncertainty boundaries
      remains uncertain.
- [ ] Each combined bubble identifies all contributing and excluded evidence.
- [ ] Insufficient evidence and an uncertain physical fill have different
      reasons.
- [ ] Best visual selection is deterministic and clearly separate from the
      combined numerical evidence.
- [ ] Exact-set grading regressions pass unchanged.
- [ ] One-frame sessions preserve compatible baseline behavior.

## Validation evidence

- Order-permutation, repeated-call, outlier, exclusion, boundary-crossing, and
  insufficient-evidence fixtures.
- Exact-set grading fixtures using combined decisions.
- Replay parity through the shared evidence-session seam.
- A rationale for the initial robust statistic and every configuration field.

## Handoff notes

Multi-frame agreement does not prove correctness. Ticket 17 must compare the
combined decisions with ground truth before confidence thresholds are frozen.
