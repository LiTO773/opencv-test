# 07 — Benchmark bounded candidate-frame strategies

**Status:** Ready for agent and owner collaboration  
**Type:** Measurement spike  
**Blocked by:** 02, 06  
**Blocks:** 08, 13

## Objective

Choose the smallest useful evidence resolution and frame-count strategy that
fits the hard 1.5-second collection window on both required devices. Do not
assume that marker-preview resolution is sufficient for bubble grading.

## Scope

- Benchmark candidate resolutions, color representations, frame counts, and
  sampling cadence on iPhone 15 Pro/iOS 26 and Pocophone F1/MIUI Android 10.
- Measure acquisition, canonical normalization, pixel readback, analysis,
  recording, and total cost separately.
- Measure usable bubble detail, focus/exposure settling, and evidence diversity,
  not only throughput.
- Confirm the chosen evidence resolution preserves usable pixels for the
  complete grey correction box around each bubble, not only its interior.
- Evaluate early completion only if a measurable minimum credible-evidence
  condition exists on both devices.
- Evaluate available focus/exposure stabilization as an experiment; keep it
  only if physical evidence shows a net improvement.
- Record torch state but never enable it automatically.
- Allow device-adaptive frame throughput while keeping identical grading
  semantics.

## Out of scope

- Threshold tuning, aggregation, or a native rewrite.
- Landscape and front-camera behavior.
- Treating development-recording time as release performance.

## Acceptance criteria

- [ ] Every tested strategy reports stage timing, usable-frame count, evidence
      resolution, memory pressure, and diagnostic bundle size.
- [ ] Both required devices stop candidate collection no later than 1.5 seconds
      after marker lock.
- [ ] The chosen strategy retains sufficient detail for the dense fixture's
      bubble measurements and full correction-box crops.
- [ ] Release and diagnostic measurements are separated.
- [ ] Any early-stop rule is deterministic, measurable, and cross-device tested.
- [ ] Focus/exposure intervention is either evidence-backed or omitted.
- [ ] The decision report identifies the selected strategy and rejected
      alternatives with measurements.

## Validation evidence

- Automated timing instrumentation tests where feasible.
- Owner-run physical benchmark bundles from both required devices.
- A comparison table containing median, P95, and worst observations.
- A written capture-strategy decision consumed by tickets 08 and 13.

## Handoff notes

The agent prepares the benchmark workflow and inspects exported results. The
owner performs the physical-device runs. If neither strategy fits, report the
measured bottleneck; do not pre-authorize native work.
