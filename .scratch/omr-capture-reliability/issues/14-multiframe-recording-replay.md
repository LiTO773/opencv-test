# 14 — Complete multi-frame recording and replay parity

**Status:** Ready for agent  
**Type:** Reproducibility integration  
**Blocked by:** 02, 03, 12, 13  
**Blocks:** 16, 17, 18

## Objective

Extend development bundles and TypeScript replay so the complete mobile
evidence session—including exclusions, aggregation, visual selection, and
question results—can be reconstructed offline.

## Scope

- Record every candidate's stable frame ID, timestamp, geometry, available
  camera metadata, canonical evidence, quality, eligibility, and measurements.
- Record the correction-box geometry/style/template revision and retain each
  bubble's complete registered box crop or equivalent replay-complete pixels.
- Record per-bubble contributing/excluded frames and combined diagnostics.
- Record cross-frame disagreement, affected questions, best visual frame, QR,
  configuration, and stage timings.
- Re-run the complete session through the shared analyzer.
- Compare mobile and replay results at every stable contract field.
- Confirm that compression or evidence reduction preserves declared parity.
- Measure evidence size and remove only data proven irrelevant to replay.

## Out of scope

- Production storage or cloud synchronization.
- Recomputing results with a separate offline implementation.
- Optimizing away evidence before parity is proven.

## Acceptance criteria

- [ ] A multi-frame bundle fully reconstructs all candidate and combined
      decisions offline.
- [ ] Saved evidence is sufficient for the next sprint to replay full-box
      correction measurements without recapturing current-sprint sheets.
- [ ] Every combined bubble resolves to its contributing and excluded frames.
- [ ] The selected visual frame is present and distinct from the combined
      evidence set.
- [ ] Replay parity failures identify the exact scan/frame/bubble/field.
- [ ] The bundle format rejects unsupported versions explicitly.
- [ ] Export and clear behavior remain safe after the format extension.
- [ ] Recording overhead, release time, memory, and bundle size are separately
      reported.

## Validation evidence

- Complete synthetic multi-frame round trip.
- At least one physical calibration bundle from each device with parity report.
- Tampered/missing-frame and version-mismatch tests.
- Evidence-size analysis supporting any compression choice.

## Handoff notes

This ticket must complete before calibration. Otherwise a candidate could look
better offline while differing from the behavior that users actually receive.
