# 03 — Build TypeScript bundle validation and offline replay

**Status:** Ready for agent  
**Type:** Developer tooling  
**Blocked by:** 01, 02  
**Blocks:** 04, 10, 14

## Objective

Replay saved pixels through the same authoritative TypeScript analyzer used by
mobile capture so an experiment never requires recapturing a sheet and never
uses a second interpretation of the pipeline.

## Scope

- Import and validate recorded development bundles.
- Resolve schema, detector configuration, evidence, metadata, and optional
  ground truth by stable identity.
- Re-run per-frame analysis and the evidence-session analyzer.
- Compare replayed measurements, decisions, diagnostics, and grading with the
  recorded mobile output.
- Declare numeric tolerances only where exact equality is technically
  impossible and report every tolerance breach.
- Produce machine-readable and human-readable parity results.
- Run as a normal TypeScript project command suitable for CI and agent use.

## Out of scope

- Jupyter, Python analysis notebooks, or independent formulas.
- Candidate threshold selection and metric dashboards, which belong to 04.
- New image-processing behavior.

## Acceptance criteria

- [ ] Valid recorded evidence can be replayed without camera access.
- [ ] Invalid manifests, missing artifacts, and incompatible versions produce
      exact actionable errors.
- [ ] Replay uses the evidence-session seam from ticket 01.
- [ ] Recorded mobile measurements and combined outputs reproduce exactly or
      within documented field-specific tolerances.
- [ ] Parity failures identify scan, frame, bubble, field, expected value, and
      replayed value.
- [ ] The workbench is entirely TypeScript-driven.
- [ ] A CI-safe synthetic bundle proves the replay path without physical data.

## Validation evidence

- Round-trip and corruption tests.
- A committed synthetic replay fixture.
- Parity reports for exported physical baseline bundles when available.
- Documentation of any unavoidable numeric tolerances and their rationale.

## Handoff notes

Replay equality is a gate for every later measurement ticket. Do not paper over
systematic drift with broad tolerances.

