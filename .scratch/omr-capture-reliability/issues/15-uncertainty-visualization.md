# 15 — Expose uncertainty and best-scan evidence

**Status:** Ready for agent  
**Type:** Prototype result presentation  
**Blocked by:** 12, 13  
**Blocks:** 18

## Objective

Show the strongest scan result at the bounded deadline and identify exactly
where credible evidence is uncertain or inconsistent.

## Scope

- Present the strongest provisional score and unchanged exact-set question
  results.
- Show the deterministic best canonical frame as the primary visual reference.
- Identify affected bubbles and questions for cross-frame disagreement,
  insufficient evidence, or legitimate uncertain fill.
- Provide question-level visual crops sufficient for prototype inspection.
- Distinguish the single visual frame from the multi-frame numerical evidence.
- Use concise user-facing language while retaining technical reason codes in
  diagnostics.
- Ensure one local uncertainty does not visually imply whole-page rejection.

## Out of scope

- Handwritten correction recognition/workflows, manual grade editing, official
  grade state, or production persistence. Printed grey boxes remain visible as
  part of the calibrated form.
- Hiding uncertainty to make the result appear cleaner.
- Generic warnings for printer settings.

## Acceptance criteria

- [ ] The result always shows the strongest available scan after the bounded
      session when a graded outcome exists.
- [ ] Every uncertain result points to its affected bubble and question.
- [ ] The visible crop corresponds to the reported canonical coordinates.
- [ ] Users can distinguish uncertainty from a rejected/failed analysis.
- [ ] The UI does not claim that the best visual frame is the only evidence.
- [ ] A local shadow or quality issue remains localized in presentation.
- [ ] Confident scans remain uncluttered by unnecessary warnings.

## Validation evidence

- UI/state fixtures for confident, uncertain fill, disagreement, insufficient
  evidence, local shadow, and failed analysis.
- Coordinate/crop mapping tests.
- Representative screenshots on both platforms.
- Accessibility and long-question/7-choice layout checks appropriate to the
  existing prototype.

## Handoff notes

Do not invent new grading semantics in presentation code. The authoritative
analyzer supplies decisions, affected IDs, reasons, and visual references.
