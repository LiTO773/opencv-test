# OMR Capture Reliability — Ticket Index

This directory contains the implementation tickets for the OMR capture
reliability sprint. The behavioral source of truth is
[`OMR_CAPTURE_RELIABILITY_SPEC.md`](../../../OMR_CAPTURE_RELIABILITY_SPEC.md).
Physical evidence requirements are defined in
[`OMR_RELIABILITY_TEST_REQUIREMENTS.md`](../../../OMR_RELIABILITY_TEST_REQUIREMENTS.md).

The implementation and calibration workflow is TypeScript-only. Mobile
capture, offline replay, configuration evaluation, and validation must use the
same authoritative evidence-session analyzer. Jupyter and independent analysis
implementations are not part of the sprint.

Every physical fixture in this sprint uses the final grey bordered correction
box around every bubble. The expected border is modeled and excluded from ink
and paper measurements, but handwritten corrections are not interpreted yet.
The committed follow-up is
[`NEXT-01 — Calibrate cross and filled-box corrections`](NEXT-01-cross-and-filled-box-corrections.md).

## Execution order

| ID | Ticket | Depends on | Primary result |
| --- | --- | --- | --- |
| 01 | [Establish the authoritative evidence-session seam](01-authoritative-evidence-session-seam.md) | — | Shared deterministic contract and frozen baseline |
| 02 | [Record and export baseline evidence bundles](02-baseline-evidence-recording.md) | 01 | Reproducible development scan bundles |
| 03 | [Build TypeScript bundle validation and offline replay](03-typescript-offline-replay.md) | 01, 02 | Replay parity on identical pixels |
| 04 | [Build the TypeScript configuration evaluator](04-typescript-configuration-evaluator.md) | 03 | Baseline/candidate comparison and split enforcement |
| 05 | [Add white-reference and correction-box schema contracts](05-white-reference-schema.md) | 01 | Backward-compatible generator/analyzer contract |
| 06 | [Define and produce the physical fixture pack](06-physical-fixture-pack.md) | 05 | Known templates and predeclared ground truth |
| 07 | [Benchmark bounded candidate-frame strategies](07-candidate-frame-benchmark.md) | 02, 06 | Evidence resolution and frame-count decision |
| 08 | [Add canonical registration diagnostics](08-registration-diagnostics.md) | 01, 05, 07 | Six-marker and bubble-field alignment evidence |
| 09 | [Implement inspectable frame-quality gates](09-frame-quality-gates.md) | 01, 08 | Explicit frame/local eligibility decisions |
| 10 | [Add color-preserving bubble evidence](10-color-preserving-bubble-evidence.md) | 03, 06 | Blue-ink evidence without black-ink regression |
| 11 | [Implement illumination and shadow normalization](11-shadow-illumination-normalization.md) | 05, 06, 08, 09 | Supported broad shadows and localized ambiguity |
| 12 | [Implement deterministic multi-frame aggregation](12-multiframe-aggregation.md) | 08, 09, 10, 11 | Robust combined bubble and question decisions |
| 13 | [Integrate the bounded mobile evidence session](13-mobile-evidence-session.md) | 07, 12 | One user scan with a 1.5-second evidence window |
| 14 | [Complete multi-frame recording and replay parity](14-multiframe-recording-replay.md) | 02, 03, 12, 13 | Reproducible combined mobile results |
| 15 | [Expose uncertainty and best-scan evidence](15-uncertainty-visualization.md) | 12, 13 | Strongest result plus affected locations |
| 16 | [Validate dense-sheet performance](16-dense-sheet-performance.md) | 06, 13, 14 | 350-bubble cross-device performance decision |
| 17 | [Calibrate and freeze a candidate configuration](17-screening-calibration-freeze.md) | 04, 06, 10, 11, 12, 14, 16 | Versioned frozen candidate from calibration data |
| 18 | [Run untouched held-out validation](18-held-out-validation.md) | 04, 06, 14, 15, 16, 17 | Evidence-backed sprint acceptance or documented failure |

## Workflow rules

- Agents may work in parallel only when the dependency table permits it.
- A dependency is satisfied only when its acceptance checklist and validation
  evidence are complete; merged code alone is insufficient.
- Thresholds must not be tuned before replay and ground-truth comparison exist.
- Physical sheets, capture sessions, and validation observations require the
  prototype owner; agents prepare exact manifests, commands, and reports.
- Calibration and validation are split by physical sheet. Frames or repeated
  scans of one sheet must never cross that boundary.
- Once ticket 17 freezes a candidate, no parameter may be changed before
  ticket 18 completes.
- A failed held-out set becomes calibration evidence. A new physically separate
  held-out set is then required for another validation attempt.
- Native acceleration is not authorized by these tickets. Ticket 16 may
  recommend a later native work item only after identifying a measured
  TypeScript/worklet bottleneck.
- Current-sprint agents must not implement partial correction recognition. They
  preserve full-box evidence and calibrate ordinary fills on the final grey-box
  template; `NEXT-01` owns correction semantics and validation.
