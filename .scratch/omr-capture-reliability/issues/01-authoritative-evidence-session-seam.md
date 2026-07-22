# 01 — Establish the authoritative evidence-session seam

**Status:** Ready for agent  
**Type:** Architecture and regression safety  
**Blocked by:** Nothing  
**Blocks:** 02, 03, 05, 08, 09

## Objective

Introduce one platform-neutral TypeScript contract through which both mobile
capture and offline replay analyze a registered evidence session. Freeze the
current single-frame behavior as the comparison baseline before reliability
changes begin.

## Scope

- Define validated inputs for schema, detector configuration, canonical frame
  evidence, frame identity, and optional ground truth.
- Define outputs for per-frame measurements, combined bubble decisions,
  question grading, quality, disagreement, timings, and best visual reference.
- Ensure the evidence contract can carry the complete registered correction-box
  area and template identity without introducing correction decisions yet.
- Preserve the existing single-frame analyzer as a lower-level primitive or
  backward-compatible path.
- Make detector parameters an immutable, versioned configuration identified in
  every result.
- Preserve exact selected-set grading and existing high-level graded/failed
  outcomes.
- Establish a versioned diagnostic contract and stable reason-code categories.

## Out of scope

- New thresholds or threshold tuning.
- Multi-frame aggregation behavior beyond contract placeholders.
- Camera acquisition, persistence, UI, or native acceleration.

## Acceptance criteria

- [ ] Mobile and replay callers can invoke the same evidence-session analyzer.
- [ ] One credible frame with no new quality issue reproduces the frozen
      single-frame result.
- [ ] Identical inputs and configuration produce byte-for-byte equivalent
      serializable decisions and diagnostics, excluding explicitly documented
      runtime metadata.
- [ ] Every result names schema, configuration, and diagnostic format versions.
- [ ] Existing reason codes remain stable or have an explicit migration.
- [ ] Exact selected-set grading regression tests remain unchanged and pass.
- [ ] No device-specific grading semantics are introduced.

## Validation evidence

- Contract tests for valid and invalid session inputs.
- Golden single-frame fixtures comparing legacy and evidence-session results.
- Determinism tests using repeated calls with identical inputs.
- A short architecture note identifying the sole authoritative seam.

## Handoff notes

Do not duplicate analysis logic for convenience in later mobile or offline
callers. If the seam lacks required data, extend and version the seam rather
than creating a second implementation.
