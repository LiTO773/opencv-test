# 02 — Record and export baseline evidence bundles

**Status:** Ready for agent  
**Type:** Development instrumentation  
**Blocked by:** 01  
**Blocks:** 03, 07, 14

## Objective

Make intermittent single-frame behavior reproducible before changing detector
parameters. A development scan must produce a locally stored bundle whose
artifacts can be joined by one stable scan ID and safely exported.

## Scope

- Add explicitly enabled development-only recording.
- Record device/OS, app revision, schema, configuration, fixture, pen, lighting,
  shadow, torch state, available camera metadata, geometry, QR, diagnostics,
  ground truth, and per-stage timings.
- Retain the original/canonical evidence needed to reproduce measurement.
- Record schema/template identity, including the grey correction-box style when
  present. Physical baseline bundles used for calibration must use the final
  grey-box fixtures from ticket 06; older forms may test recording mechanics
  only and cannot support threshold decisions.
- Record the selected visual frame and current result.
- Version and validate the bundle manifest.
- Provide local listing, export, and narrowly scoped clear operations.
- Keep normal release capture from retaining the diagnostic corpus.
- Measure recording overhead and bundle size separately from release behavior.

## Out of scope

- Production persistence, accounts, cloud upload, or real student records.
- Threshold changes.
- Full multi-frame bundle parity, which belongs to ticket 14.

## Acceptance criteria

- [ ] Every artifact in a scan bundle carries or resolves to the same scan ID.
- [ ] A complete bundle round-trips through serialization and parsing.
- [ ] Unsupported bundle versions fail explicitly rather than being guessed.
- [ ] Export includes every replay-critical artifact and a manifest checksum or
      equivalent integrity check.
- [ ] Clear removes only bundles selected through the development workflow.
- [ ] Release mode does not retain full diagnostic evidence.
- [ ] Development and release timings are distinguishable.
- [ ] The baseline configuration is recorded without tuning it.

## Validation evidence

- Automated manifest and serialization tests.
- One exported baseline bundle from each required device when the owner can
  perform physical capture.
- A bundle-size and recording-overhead summary.
- Evidence that a clear operation leaves unrelated local data intact.

## Handoff notes

Physical capture is a manual handoff. The implementing agent must provide a
precise capture checklist and a way to verify bundle completeness before asking
the owner to export evidence.
