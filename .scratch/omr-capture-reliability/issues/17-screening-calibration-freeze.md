# 17 — Calibrate and freeze a candidate configuration

**Status:** Ready for agent and owner collaboration  
**Type:** Calibration gate  
**Blocked by:** 04, 06, 10, 11, 12, 14, 16  
**Blocks:** 18

## Objective

Use only the declared calibration sheets to identify dominant failure causes,
compare controlled configuration changes, meet the calibration gates, and
freeze one immutable candidate before held-out validation.

## Scope

- Run a small screening matrix first to expose instrumentation or implementation
  defects cheaply.
- Capture repeated calibration-sheet scans across both devices, layouts, black
  and blue pens, required lighting, shadow classes, fill coverage, and regions.
- Use only the frozen final grey-box template; leave correction boxes unmarked
  outside the ordinary declared bubble fill.
- Establish the frozen single-frame baseline report before evaluating changes.
- Diagnose one dominant cause at a time: registration, quality, illumination,
  color, aggregation, or decision thresholds.
- Change one conceptual parameter area per candidate and record the hypothesis.
- Replay the complete calibration corpus for every serious candidate.
- Compare candidate and baseline by bubble, question, sheet, warning rate,
  device, ink, lighting, shadow, coverage, and region.
- Freeze configuration ID, corpus manifest, analyzer revision, and report once
  the predeclared calibration gates are satisfied.

## Stop conditions

Calibration stops only when all are true:

- No known calibration case shows a silent score change across supported
  repeated scans.
- No supported physical bubble flips between confident filled and confident
  unfilled.
- Full supported blue and black fills remain confident.
- Approximately 70% fixtures meet the agreed filled behavior.
- Approximately 40% fixtures are never silently confident filled.
- Credible disagreement is localized and explicit.
- At least 95% of supported calibration scans finish without a stability
  warning.
- Ticket 16's timing gates are satisfied.

## Out of scope

- Looking at held-out validation scans, images, labels, or aggregate results.
- Calibrating handwritten crosses or fully painted correction boxes.
- Changing several conceptual areas in an untraceable batch.
- Per-device grading thresholds or learned models.

## Acceptance criteria

- [ ] Ground truth predates every included scan.
- [ ] Every included sheet uses the frozen correction-box style, geometry, and
      template revision.
- [ ] Calibration and held-out physical sheet IDs are proven disjoint.
- [ ] Every candidate has an immutable ID and written hypothesis.
- [ ] Every accepted parameter change has a full baseline comparison report.
- [ ] Regressions cannot be hidden by aggregate bubble accuracy.
- [ ] The stop conditions above are all supported by saved evidence.
- [ ] One configuration is frozen with analyzer, corpus, and schema revisions.
- [ ] No configuration changes occur after freeze and before ticket 18.

## Validation evidence

- Screening and full calibration manifests.
- Baseline and candidate reports from the TypeScript evaluator.
- Failure gallery with scan/bubble IDs and reason categories.
- Frozen configuration artifact and freeze record.
- Owner confirmation of physical capture conditions and labels.

## Handoff notes

If behavior appears perfect during a small run, continue the predeclared matrix;
intermittent camera behavior is the reason repeated evidence exists. Do not stop
because one session looks good.
