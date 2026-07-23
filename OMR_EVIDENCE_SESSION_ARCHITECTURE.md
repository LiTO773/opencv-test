# Authoritative OMR evidence-session seam

## Sole behavioral entry point

`src/features/bubble-grading/evidence-session.ts` owns the platform-neutral
session contract and combined result. Mobile capture and offline replay must
both validate their inputs with `validateEvidenceSessionInput` and execute
`analyzeValidatedEvidenceSession`. Callers that do not have a separately
validated boundary may use `analyzeEvidenceSession`, which performs both
steps.

No caller may implement its own bubble combination or question grading.
`analyzeValidatedEvidenceSession` delegates single-frame measurement to the
existing `analyzeValidatedBubbleGradingImage` primitive. Exact selected-set
grading remains exclusively in `gradeBubbleDiagnostics`.

The current mobile entry points use the seam and unwrap its combined baseline
into the pre-existing `MobileGradingOutcome.result` shape. They also retain the
complete `evidenceSession` result. This preserves the current graded/failed UI
contract while exposing the versioned session diagnostics.

## Version 1 boundary

Contract version 1 intentionally accepts exactly one credible, already
registered canonical frame. Its combination strategy is
`single-frame-baseline-v1`. This freezes the current result before ticket 12
adds robust multi-frame aggregation. Multiple frames fail with
`multi_frame_aggregation_not_implemented`; they must never be silently reduced
to one frame by a caller.

The input already has extension points required by later tickets:

- stable session and frame identities;
- validated schema and immutable versioned detector configuration;
- explicit registered-canonical and credible-quality declarations;
- template ID/version and correction-box style identities;
- optional full `gray8` or `rgba8` registered correction-box crops;
- optional versioned physical ground truth with fixture, layout, template,
  printer/pen, per-bubble coverage/expected class, current-sprint correction
  state, and per-question selected-set declarations.

Correction-box pixels are evidence only. Version 1 does not infer handwritten
correction states.

## Stable output and reasons

Every result names the evidence contract, evidence diagnostic format, reason
category format, schema/test version, template version, and detector
configuration version/ID. Existing bubble reason codes are unchanged. The
session adds a stable category mapping:

- `center_adjusted` → `geometry`
- `poor_local_contrast`, `excessive_blur` → `quality`
- `fill_score_in_uncertain_band`, `measurement_region_incomplete` →
  `measurement`

Future geometry, quality, measurement, color, shadow, disagreement, and
session reasons extend this catalog; they do not rename baseline codes without
an explicit version migration.

For identical inputs, default analysis is byte-for-byte JSON deterministic.
When `recordTiming` is enabled, the following runtime metadata is explicitly
excluded from byte equality:

- `frames[*].analysis.scan.timing.durationMs`
- `frames[*].analysis.bubbles[*].timing.durationMs`
- `timings.durationMs`
- `timings.frameAnalysisDurationMs`

All decisions, measurements, identities, reason codes, quality records,
disagreement records, and best-visual selection remain deterministic.

## Caller handoff

Mobile acquisition should assign real scan/frame IDs and timestamps when
ticket 02 adds recording; the current compatibility caller uses deterministic
single-frame placeholders when QR sheet identity is absent. Offline replay
must reconstruct the same `EvidenceSessionInput` and call the same seam. If a
later ticket needs more evidence, it must extend and version this contract
instead of creating a second analyzer.
