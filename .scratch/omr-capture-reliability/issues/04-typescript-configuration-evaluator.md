# 04 — Build the TypeScript configuration evaluator

**Status:** Ready for agent  
**Type:** Calibration tooling  
**Blocked by:** 03  
**Blocks:** 17, 18

## Objective

Provide the sole mechanism for deciding whether a detector configuration is
better than the frozen baseline. Enforce calibration/validation separation and
make every parameter change measurable and reproducible.

## Scope

- Evaluate immutable configuration IDs against predeclared ground truth.
- Report confusion matrices and false-filled, false-unfilled, uncertain,
  question-error, silent-score-change, and stability-warning rates.
- Group reports by device/OS, pen, ink color, lighting, shadow class, physical
  coverage, page region, layout, template/correction-box style revision, and
  configuration.
- Compare a candidate directly with the frozen baseline on identical bundles.
- Split by physical sheet; optionally strengthen by person and pen when the
  corpus allows it.
- Reject overlapping calibration and validation identities.
- Rank or filter candidate configurations without mutating them.
- Record the dataset manifest and source revision in every report.

## Out of scope

- Automatic unbounded parameter search.
- A new analyzer implementation, Jupyter, or Python-owned decisions.
- Using the held-out validation set while developing candidate thresholds.

## Acceptance criteria

- [ ] One command produces machine-readable and readable comparison reports.
- [ ] Repeated frames or scans of the same physical sheet cannot cross the
      calibration/validation boundary.
- [ ] A split violation fails the evaluation.
- [ ] Every aggregate metric can be traced to individual scan and bubble rows.
- [ ] Black and blue ink are reported separately as well as together.
- [ ] Sheet/question metrics are present; bubble accuracy alone is insufficient.
- [ ] Configuration, corpus, schema, and code revisions are recorded.
- [ ] Identical inputs produce identical reports.

## Validation evidence

- Synthetic ground-truth cases for every error category.
- Tests proving split-leakage detection.
- A baseline-versus-baseline report with zero differences.
- A deliberately worse candidate showing localized regressions.

## Handoff notes

The evaluator measures candidates; it does not decide product trade-offs by
itself. Ticket 17 applies the predeclared sprint gates to the reports.
