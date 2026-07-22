# OMR Capture Reliability Specification

**Status:** Ready for agent implementation  
**Artifact:** Repository Markdown specification  
**Scope:** Mobile OMR capture reliability, multi-frame evidence, calibration,
diagnostics, replay, and cross-device validation

## Problem Statement

Teachers need one scan of a valid answer sheet to produce a stable and
explainable result. The current prototype reliably detects the page markers and
creates the canonical crop, but repeated scans of the same sheet can produce a
different number of uncertain questions. The observed failures include poor
local contrast, locally adjusted bubble centers, and fill measurements moving
through the uncertain band. The behavior can improve or disappear when the
same sheet is tested again, making it difficult to reproduce and unsafe to fix
by guessing new thresholds.

The current capture path accepts the first photograph after the four outer
markers form a valid layout for two analyzed frames. Geometry is checked before
capture, but exposure stability, focus across the answer area, illumination,
shadow boundaries, glare, canonical registration residual, and bubble-decision
stability are not used to choose the grading evidence. Quality problems are
discovered only after the final still has already been selected. This allows
normal changes in indoor or window lighting and camera auto-exposure timing to
change bubble measurements between otherwise identical scans.

The prototype must become reliable without requiring a teacher to perform
several scans until one happens to work. Normal indoor shadows are realistic
and must be supported. The result must still be transparent: if credible
evidence remains inconsistent, the prototype must return the strongest result
available and identify exactly which bubbles and questions remain uncertain.

The implementation will be developed primarily by coding agents, with physical
capture and fixture preparation performed manually. The specification must
therefore define authoritative seams, contracts, sequencing, observable
behavior, test evidence, and completion gates precisely enough that agents do
not invent incompatible parallel solutions.

## Solution

After marker lock, the scanner will collect a bounded set of candidate frames
for at most 1.5 seconds instead of immediately grading the first available
still. Each candidate will be normalized into the shared 875 × 1280 canonical
crop and evaluated for geometry, registration, focus, exposure, glare,
illumination, shadow behavior, and usable bubble evidence.

The analyzer will preserve color long enough to extract useful evidence for
blue ink while retaining the existing explainable luminance, local-paper,
contrast, focus, and dark-pixel measurements. Generator-declared white regions,
the existing local paper rings, and the six physical page markers will provide
per-sheet calibration and spatial quality evidence without adding visible
calibration controls to the form.

The production-intent form geometry includes a grey bordered correction box
around every bubble. Those printed boxes are part of this sprint's template,
schema, fixtures, registration model, paper sampling, and calibration evidence.
This sprint grades only ordinary uncorrected bubble fills; it does not interpret
handwritten correction marks. The analyzer must nevertheless preserve the full
box-area evidence needed by the next sprint.

Credible measurements will be registered by schema bubble ID and combined with
deterministic, order-independent robust statistics. A poor frame will not be
allowed to overturn consistent good evidence. Evidence that crosses a decision
boundary will remain uncertain rather than being averaged into false
confidence. Exact selected-set grading remains unchanged.

One platform-neutral evidence-session analyzer will be the authoritative
behavioral seam. Mobile capture will produce its input, and the offline replay
workbench will consume the same input. The seam will return the combined bubble
analysis, question grading, best visual reference, quality record, disagreement
record, and reproducible diagnostics. This prevents the mobile and calibration
implementations from developing different definitions of a valid answer.

A development-only recording mode will persist reproducible scan bundles with
stable IDs, canonical evidence, device and camera metadata, per-frame
measurements, combined decisions, timings, configuration identity, and physical
ground truth. An offline evaluator will replay the same bundles, compare
candidate configurations on held-out evidence, and report errors by device,
pen, lighting, shadow, coverage, page region, and layout density.

The required physical acceptance devices are an iPhone 15 Pro on iOS 26 and a
Pocophone F1 on MIUI/Android 10. The implementation must handle up to 50
questions with 7 choices each, for a ceiling of 350 bubble ROIs. The current
TypeScript/worklet path will be benchmarked before any native rewrite is
approved.

## User Stories

1. As a teacher, I want one scan of a valid answer sheet to produce a stable result, so that I do not repeatedly reposition and rescan the same page.
2. As a teacher, I want repeated scans of the same sheet to detect the same filled bubbles, so that the grade does not depend on camera timing.
3. As a teacher, I want the scanner to work under normal artificial indoor light, so that I can grade papers in an ordinary classroom.
4. As a teacher, I want the scanner to work near a window, so that daylight does not unpredictably change the result.
5. As a teacher, I want the scanner to work under mixed artificial and window light, so that I do not need to control the room lighting precisely.
6. As a teacher, I want ordinary soft and moderate shadows to be corrected, so that my hand, phone, or surroundings do not invalidate the whole page.
7. As a teacher, I want a sharp shadow boundary to affect only genuinely ambiguous bubbles, so that one local lighting problem does not discard the entire scan.
8. As a teacher, I want normal printer scaling handled silently, so that I do not need to understand school printer settings.
9. As a teacher, I want the scanner to accept ordinary laser-printed forms, so that specialized paper and printers are unnecessary.
10. As a teacher, I want the scanner to support both blue and black ink, so that common classroom pens work reliably.
11. As a teacher, I want mostly filled bubbles to be recognized, so that harmless gaps in a student's fill do not cause a wrong result.
12. As a teacher, I want uncertain evidence identified by question, so that I can focus inspection where it is actually needed.
13. As a teacher, I want the strongest available result after the bounded scan window, so that the prototype remains useful even when some evidence is imperfect.
14. As a teacher, I want cross-frame disagreement exposed instead of hidden, so that the app never presents unstable evidence as certainty.
15. As a teacher, I want a visual crop of an uncertain question, so that I can relate the diagnostic decision to the physical mark.
16. As a teacher, I want the result to appear promptly after the page is aligned, so that reliability does not make grading feel slow.
17. As a teacher, I want torch control to remain manual, so that the app does not unexpectedly create glare or illuminate the room.
18. As a teacher, I want focus and exposure stabilization to occur automatically when useful, so that I do not need camera expertise.
19. As a teacher, I want technical capture failures described in terms of readable evidence, so that I am not blamed for unknown printer settings.
20. As a teacher, I want the scanner to remain portrait-only in this prototype, so that the interaction stays predictable and optimized.
21. As an iPhone user, I want the same grading behavior as an Android user, so that device choice does not determine student scores.
22. As an Android user, I want the older required device to complete scans within the timing budget, so that reliability is not limited to flagship hardware.
23. As a student using black ink, I want a completely filled answer to remain confidently filled across supported conditions, so that my grade is stable.
24. As a student using blue ink, I want the scanner to retain useful color evidence, so that blue marks are not weakened unnecessarily by immediate grayscale conversion.
25. As a student, I want a bubble with approximately 70% physical coverage to count as filled, so that a mostly complete mark is accepted.
26. As a student, I want a bubble with approximately 40% or less coverage not to be silently promoted to filled, so that weak or accidental marks do not become selections.
27. As a student, I want the scanner to distinguish image shadows from pen ink, so that lighting does not change my answer.
28. As a schema generator developer, I want to declare guaranteed white regions in canonical pixels, so that the scanner can calibrate illumination without visible control marks.
29. As a schema generator developer, I want white-reference declarations to be optional for older schemas, so that existing fixtures remain usable during migration.
30. As a schema generator developer, I want exact validation errors for invalid reference regions, so that malformed layouts cannot produce plausible calibration.
31. As a schema generator developer, I want margin white regions to remain acceptable, so that dense forms are not forced to reserve ugly interior controls.
32. As a schema generator developer, I want interior white regions exported when naturally available, so that the scanner can model illumination more accurately without changing the visible design.
33. As a schema generator developer, I want the maximum 50-question, 350-bubble layout represented in testing, so that generated forms remain within proven processing limits.
34. As a mobile vision developer, I want marker detection preserved as a stable subsystem, so that the sprint does not rewrite a part that is already working well.
35. As a mobile vision developer, I want marker lock to start a bounded evidence session, so that capture quality can stabilize without requiring another user attempt.
36. As a mobile vision developer, I want all six physical markers used diagnostically, so that the two middle markers provide independent alignment evidence.
37. As a mobile vision developer, I want every candidate frame normalized to the same canonical coordinates, so that bubble evidence can be compared by schema ID.
38. As a mobile vision developer, I want excessive registration residual to exclude a frame, so that a distorted frame cannot contaminate confident evidence.
39. As a mobile vision developer, I want aggregate bubble-outline alignment measured, so that systematic crop drift is visible beyond the four crop corners.
40. As a mobile vision developer, I want frame quality represented explicitly, so that blur, glare, shadows, and alignment are inspectable rather than hidden in one score.
41. As a mobile vision developer, I want page-wide illumination and local paper brightness measured separately, so that broad shadows and local boundaries are handled appropriately.
42. As a mobile vision developer, I want local paper rings divided into spatial evidence, so that a shadow edge crossing an ROI is not reduced to a misleading single mean.
43. As a mobile vision developer, I want color evidence relative to local paper, so that camera exposure changes do not make raw color values device-specific.
44. As a mobile vision developer, I want per-sheet calibration instead of fixed per-device thresholds, so that broader device support is possible.
45. As a mobile vision developer, I want multi-frame aggregation to be order-independent, so that scheduling differences cannot change the answer.
46. As a mobile vision developer, I want robust statistics instead of a simple mean, so that one poor frame cannot dominate the combined result.
47. As a mobile vision developer, I want every excluded frame to retain a reason, so that quality gates can be tuned from evidence.
48. As a mobile vision developer, I want each combined bubble to name its contributing frames, so that its decision is reproducible.
49. As a mobile vision developer, I want cross-frame boundary crossings to remain uncertain, so that averaging does not fabricate confidence.
50. As a mobile vision developer, I want the best canonical frame selected independently from numerical aggregation, so that the visual reference is clear without pretending it contains all evidence.
51. As a mobile vision developer, I want exact selected-set grading unchanged, so that reliability work does not alter scoring semantics.
52. As a mobile vision developer, I want old single-frame schemas and fixtures to remain analyzable, so that the migration can proceed incrementally.
53. As a diagnostics developer, I want a stable diagnostic format version, so that saved scan bundles remain interpretable after the analyzer evolves.
54. As a diagnostics developer, I want geometry, quality, color, shadow, and disagreement reasons recorded separately, so that one generic uncertainty code does not hide the cause.
55. As a diagnostics developer, I want development and release timings reported separately, so that recording overhead is not confused with user performance.
56. As a diagnostics developer, I want scan IDs to connect images, frames, measurements, and results, so that an intermittent failure can be reconstructed.
57. As a diagnostics developer, I want a safe local export mechanism, so that physical-device evidence can be analyzed offline.
58. As a diagnostics developer, I want a clear-local-data operation, so that large development bundles do not accumulate indefinitely.
59. As a calibration developer, I want recorded sessions replayed without another camera scan, so that threshold experiments use identical pixels.
60. As a calibration developer, I want ground truth defined before scanning, so that expected answers are not inferred from the prototype output.
61. As a calibration developer, I want configuration comparisons on held-out sheets, so that thresholds are not overfit to the calibration corpus.
62. As a calibration developer, I want false-filled, false-unfilled, uncertain, question-error, and silent-score-change rates, so that average bubble accuracy cannot hide harmful failures.
63. As a calibration developer, I want reports grouped by device, pen, lighting, shadow, fill coverage, page region, and layout, so that regressions are localized.
64. As a calibration developer, I want black- and blue-ink performance reported separately, so that an improvement for one color cannot hide damage to the other.
65. As a calibration developer, I want the detector configuration identified in every result, so that evidence always names the thresholds that produced it.
66. As a testing developer, I want synthetic boundary fixtures and real physical evidence, so that deterministic logic and camera behavior are both covered.
67. As a testing developer, I want the same evidence-session seam used by mobile and replay tests, so that test success represents production analysis behavior.
68. As a testing developer, I want a dense 350-bubble fixture, so that bounded work and timing are verified at the actual ceiling.
69. As a testing developer, I want saved mobile measurements compared with offline replay, so that platform implementations cannot drift silently.
70. As a testing developer, I want validation frames kept out of threshold selection, so that reported reliability measures generalization.
71. As a performance developer, I want acquisition, normalization, readback, measurement, aggregation, QR, and persistence timed separately, so that optimization targets the measured bottleneck.
72. As a performance developer, I want the current worklet path benchmarked before native work is approved, so that complexity is introduced only when necessary.
73. As a performance developer, I want the Pocophone F1 tested early, so that old-device constraints shape the design before the sprint is nearly complete.
74. As a performance developer, I want evidence resolution and frame count chosen empirically, so that the 1.5-second budget is used effectively.
75. As an agent implementing this sprint, I want one authoritative evidence-session contract, so that independently implemented work packages compose correctly.
76. As an agent implementing this sprint, I want completion gates for every work package, so that intermediate code is not mistaken for reliable behavior.
77. As an agent implementing this sprint, I want explicit non-goals, so that neural networks, handwritten correction recognition, and unrelated camera cases do not expand the sprint while the final printed grey-box geometry remains in scope.
78. As the prototype owner, I want failure evidence accumulated now, so that a larger future scan corpus can support better calibration or machine learning later.
79. As the prototype owner, I want a recommendation rather than an automatic native rewrite, so that architectural complexity follows profiling evidence.
80. As the prototype owner, I want the final reliability claim limited to tested conditions and devices, so that the prototype does not imply unsupported universality.
81. As a schema generator developer, I want every production-intent bubble to declare its grey correction-box geometry and printed style, so that calibration uses the final visible form rather than a temporary bubble-only design.
82. As a mobile vision developer, I want the expected grey border excluded from ink and local-paper measurements, so that the correction affordance does not become a false student mark.
83. As a diagnostics developer, I want the complete correction-box crop preserved for every bubble, so that the next sprint can calibrate correction recognition from the same evidence contract.
84. As a student, I want a cross using the grey box edges to invalidate a selected bubble and a fully painted box to select it again; this behavior is committed to the next sprint rather than partially implemented here.

## Implementation Decisions

### Authoritative behavioral seam

- Introduce one platform-neutral evidence-session analyzer as the primary seam.
  It accepts a validated grading schema, a detector configuration, and a set of
  registered canonical-frame evidence records. It returns the combined scan,
  bubble, question, quality, disagreement, timing, and best-visual-reference
  result.
- Mobile capture and offline replay must call the same evidence-session
  analyzer. Neither caller may implement its own aggregation or grading rules.
- Preserve the existing deterministic single-frame analyzer as a lower-level
  primitive and backward-compatible baseline. The evidence-session analyzer
  composes it or its extracted measurement primitives rather than duplicating
  its decisions.
- Exact selected-set question grading remains one shared pure operation and is
  not rewritten as part of capture reliability.

### Capture state and timing

- Marker detection remains the geometric entry gate because physical testing
  reports that it already performs well.
- Marker lock begins an evidence-collection state rather than immediately
  choosing the first photograph.
- Evidence collection has a hard maximum of 1.5 seconds after marker lock. It
  may finish earlier only after the implementation has a measured minimum
  credible-evidence condition that behaves consistently on both required
  devices.
- The release-build result must appear within 3 seconds of marker lock at the
  95th percentile on both required devices.
- Development recording overhead is measured separately and does not redefine
  release timing acceptance.
- The phone is always held in portrait orientation. No landscape state or guide
  geometry is added.
- Torch remains user-controlled. Its state is recorded, but the pipeline never
  activates it automatically.
- Automatic focus, exposure settling, or exposure locking may be added only
  when the current camera stack exposes the operation reliably and physical
  tests show a net improvement.

### Candidate-frame strategy

- Benchmark candidate resolutions and frame counts on both required devices
  before fixing the strategy. The marker-preview resolution is not assumed to
  contain sufficient bubble detail.
- Preserve enough color information to measure blue ink before producing any
  grayscale-only representation.
- Every candidate receives a stable frame ID, timestamp, geometry record,
  camera metadata where available, quality record, and eligibility state.
- Acquisition, canonical normalization, pixel readback, measurement,
  aggregation, QR decoding, recording, and total time are measured separately.
- The evidence representation must support exact or explicitly tolerance-bound
  offline replay. If compression is used, replay parity must be demonstrated.

### Geometry and registration

- The four outer markers continue to define the marker-free canonical crop.
- The two middle markers become diagnostic alignment references. They do not
  independently redefine scoring geometry without a separately validated
  design change.
- Ordinary uniform print scaling and fit-to-page shrinkage are corrected
  silently through canonical normalization.
- Each frame records marker movement, marker-size balance, crop geometry,
  middle-marker residual, and canonical registration residual.
- Expected printed bubble and grey correction-box outlines are modeled as
  known template geometry. Their aggregate alignment may estimate bounded
  residual translation, rotation, and scale after the marker warp, but expected
  grey print must never be treated as student ink.
- Registration correction is bounded. A frame outside the accepted residual
  range is excluded from confident aggregation instead of being arbitrarily
  deformed to match the schema.
- Center adjustment remains local and bounded. The distribution of adjustments
  across the page becomes scan-level evidence of systematic drift.

### Schema contract

- Extend the generator-owned schema with optional white-reference rectangles in
  canonical crop pixels.
- For every production-intent bubble, declare the outer grey correction-box
  rectangle in canonical pixels and reference a versioned printed-border style
  containing the intended grayscale value and stroke width. The rectangle
  includes the stroke and contains the complete bubble with positive clearance.
- Correction-box metadata may be absent only for legacy schemas. All fixtures
  calibrated or validated in this sprint use the final grey-box schema and one
  frozen template appearance.
- Each reference has a stable ID and a top-left rectangle. It must be guaranteed
  unprinted, free of text, borders, QR content, bubbles, and intended writing.
- A valid reference is at least 24 × 24 canonical pixels; 40 × 40 or larger is
  preferred.
- The validator checks finite integer geometry, positive dimensions, canonical
  bounds, unique IDs, valid correction-box containment/style references, and
  prohibited overlap between white references and QR, bubble, or correction-box
  measurement regions.
- The validator returns all discovered problems with stable paths and codes.
- The white-reference field is optional so existing schemas remain usable.
  Backward compatibility is required unless an evidence-backed migration later
  justifies a schema-format version change.
- The analyzer records spatial coverage rather than treating the presence of
  any one reference as complete page calibration.
- Margin-only references are valid but receive lower coverage than references
  distributed through the answer area.

### Illumination and shadow behavior

- Shadows are a supported condition. A frame is not rejected merely because
  one page region is darker.
- Build a spatial illumination model from declared white regions, robust
  unprinted-paper samples, local bubble paper rings, and registered multi-frame
  evidence.
- Use the page-wide model for broad gradients and a bubble-local paper ring
  lying outside the complete grey correction box as the most relevant paper
  reference near that bubble.
- Replace a single undifferentiated background-ring mean with spatial evidence,
  such as sectors or a bounded local background plane, so asymmetric shadow
  boundaries are visible.
- Record local gradient, ring-sector spread, and boundary evidence separately
  from student-mark darkness.
- Broad and soft shadows should normally be normalized. A sharp boundary that
  makes one ROI genuinely ambiguous affects only that bubble and its question.
- Direct sunlight and clipped specular conditions remain outside the supported
  acceptance matrix, but the prototype still returns its strongest result and
  reports the affected evidence.

### Frame-quality model

- Quality remains deterministic and inspectable; no neural model is introduced.
- Frame quality includes spatial focus, local ROI focus, exposure stability,
  white-reference distribution, clipped-highlight evidence, glare evidence,
  shadow/gradient evidence, registration residual, center-adjustment
  distribution, and usable bubble-evidence coverage.
- Quality is not reduced to a single opaque number. A ranking score may select
  the visual frame, but eligibility and reasons remain individually available.
- Thresholds controlling quality stay outside the generator-owned schema.
- Device-specific fixed grading thresholds are not accepted. Differences in
  frame throughput may be device-adaptive; definitions of filled, unfilled, and
  uncertain may not silently vary by device.
- A candidate frame can be excluded globally for severe quality failure or
  locally for particular bubble evidence. Exclusion scope and reasons are
  recorded.

### Bubble evidence

- Preserve the current expected-center, measured-center, outline, local-paper,
  interior-brightness, dark-pixel-ratio, contrast, focus, confidence, and reason
  diagnostics.
- Preserve a registered crop covering the complete grey correction box for each
  bubble. Keep separate masks for bubble interior, expected printed bubble
  outline, expected grey box border, box interior outside the bubble, and local
  paper outside the box.
- Exclude expected grey-border pixels from student-ink, dark-pixel, and
  local-paper statistics in this sprint.
- Continue using BT.709-style luminance where a grayscale value is required so
  mobile and replay behavior remain aligned.
- Add color distance between the bubble interior and its local paper reference.
- Add blue/chroma and saturation/channel-difference evidence normalized to the
  local background rather than raw camera RGB thresholds.
- The printed form is treated as black/grayscale on white paper. Color evidence
  exists to detect blue pen; it does not require color printing.
- A completely filled blue or black bubble must remain confident under
  supported conditions.
- Approximately 70% physical coverage is valid filled behavior.
- Approximately 40% or less physical coverage is never silently promoted to a
  confident filled selection.
- Physical coverage percentage and pixel decision metrics remain distinct
  concepts in diagnostics and calibration.
- Handwritten correction interpretation is deferred. Current-sprint supported
  fixtures leave the grey boxes unmarked except for the ordinary fill inside the
  bubble. Crosses, fully painted boxes, erased answers, ticks, dots, and circled
  answers do not participate in current-sprint calibration or acceptance.
- The next sprint will recognize a qualifying cross that uses the grey box edges
  as invalidated/unselected and a fully painted box as selected again. The
  intended precedence is `fully-painted box` over `valid cross` over ordinary
  bubble state; incomplete or ambiguous corrections remain uncertain.

### Multi-frame aggregation

- Group per-frame measurements by stable schema bubble ID after canonical
  registration.
- Aggregate only credible evidence. Globally or locally excluded frames cannot
  contribute silently.
- The first candidate aggregator uses robust, deterministic statistics such as
  median and median absolute deviation. A simple arithmetic mean is not the
  default.
- Aggregation is order-independent and deterministic for identical evidence.
- Every combined bubble records contributing frames, exclusions, per-frame
  measurements and decisions, robust combined values, spread, confidence, and
  disagreement reasons.
- A confident combined decision requires credible evidence to remain on the
  same side of the calibrated boundary. Evidence spanning a relevant boundary
  remains uncertain.
- One poor frame cannot overturn a consistent set of credible frames.
- The exact aggregator and thresholds are configuration-driven and selected
  from held-out physical validation, not intuition.
- Numerical aggregation may use multiple frames. The visual reference remains
  one selected canonical frame and is identified as such.

### Result and diagnostics contracts

- Preserve the existing high-level outcome distinction between graded and
  failed analysis.
- Extend the graded outcome with evidence-session quality, frame count,
  contributing/excluded frames, best visual frame, multi-frame bubble
  diagnostics, and cross-frame disagreement.
- Increment the diagnostic format version when the new persisted fields are
  introduced. Readers must reject or explicitly migrate unsupported versions.
- Keep existing reason codes stable. Add stable categories for frame-level
  blur, glare/highlight clipping, registration residual, illumination gradient,
  local shadow boundary, low white-reference coverage, insufficient credible
  evidence, and cross-frame disagreement.
- Center adjustment remains informational unless another quality condition or
  its scan-level distribution makes it material.
- The strongest provisional score and exact-set question results are returned
  at the end of the bounded window.
- Questions whose result could change because of uncertain combined bubbles are
  identified and include visual evidence sufficient for prototype inspection.
- Production definitions of official, final, persisted, or synchronized grades
  are not introduced.

### Development recording

- Add an explicitly enabled development recording mode. Normal release capture
  does not save the full diagnostic corpus.
- Every session uses a unique scan ID that joins all metadata, frames,
  canonical evidence, per-frame diagnostics, combined results, timings, and
  ground truth.
- A bundle records device and OS, build/source identity, schema identity,
  detector configuration, fixture, pen, lighting and shadow labels, torch
  state, available camera metadata, geometry, quality, QR, and performance.
- Persist the best canonical visual frame and sufficient contributing evidence
  to reproduce bubble analysis offline.
- Store test data locally, provide a development-only export mechanism, and
  provide an explicit clear operation.
- Measure bundle size and avoid retaining data that does not contribute to
  replay or failure analysis.
- Physical sprint fixtures avoid real student data.

### Offline replay and calibration

- Build one offline workbench that validates and replays recorded evidence
  bundles through the authoritative evidence-session seam.
- Ground truth is machine-readable and defined before scanning.
- Reports include confusion matrices and false-filled, false-unfilled,
  uncertain, question-error, silent-score-change, and scan-warning rates.
- Reports break results down by device, OS, pen, ink color, lighting, shadow
  class, fill coverage, page region, schema layout, and detector configuration.
- Calibration and held-out validation are split by physical sheet and, where
  possible, by person and pen. Repeated frames of one physical sheet cannot
  appear on both sides of the split.
- Threshold changes require a comparison report against the frozen baseline and
  held-out validation evidence.
- The workbench can compare grayscale-only and color-aware evidence on the same
  recorded pixels.
- Offline replay must reproduce recorded mobile measurements exactly or within
  explicitly documented numeric tolerances.

### Performance and implementation boundary

- Support up to 50 questions with 7 choices each: 350 bubble ROIs.
- Include a physical dense fixture in registration and timing acceptance.
- Benchmark the current TypeScript/worklet implementation on both required
  devices before proposing a native hot path.
- Profile acquisition, normalization, readback, measurement, aggregation, QR,
  persistence, memory, and total time independently.
- Keep the worklet path when it meets the release budget with reasonable
  margin.
- If it fails, identify the exact bottleneck and compare targeted native OpenCV
  or a dedicated JSI/Nitro measurement module. Native work is a separate
  evidence-backed decision, not an assumed sprint requirement.
- The number and resolution of candidate frames may vary by device to respect
  the fixed time budget, but the evidence and grading semantics remain shared.

### Implementation order and gates

- First freeze and record the single-frame baseline. Do not tune thresholds
  before reproducible evidence exists.
- Next build bundle validation and offline replay so every later change can be
  compared on identical evidence.
- Benchmark multi-frame capture resolution and count on both devices before
  choosing the acquisition design.
- Add registration and frame-quality evidence before multi-frame aggregation.
- Add color-aware bubble evidence and compare it against the grayscale baseline.
- Add deterministic aggregation and prototype uncertainty visualization.
- Run dense-sheet performance profiling before deciding the native boundary.
- Freeze a candidate configuration before running the held-out physical
  validation matrix.
- A work package is incomplete until its external behavior, diagnostics, and
  replay path are tested together.

## Testing Decisions

### Test philosophy

- Tests assert external behavior and stable contracts, not private helper
  structure or a particular mathematical implementation.
- The highest useful seam is the evidence-session analyzer: validated schema,
  registered canonical-frame evidence, configuration, and optional ground truth
  enter; combined grading outcome and diagnostics exit.
- Mobile and offline replay tests use the same seam. This is the primary defense
  against two implementations explaining the same sheet differently.
- Lower seams receive focused tests only where they already exist or where a
  failure cannot be diagnosed economically through the evidence-session seam.
- Synthetic fixtures establish deterministic boundaries; physical recorded
  bundles establish camera realism. Neither replaces the other.
- Tests must not assert that a specific internal threshold formula is used when
  the external classification, diagnostics, determinism, and calibration
  contract are sufficient.

### Existing seams and prior art

- Reuse the existing pure schema-validation seam and its pattern of returning
  all path-specific validation errors together.
- Reuse the existing pure bubble-analysis seam and deterministic grayscale
  fixture style for single-frame regression coverage.
- Reuse the existing exact selected-set grading seam and its single/multiple,
  blank, extra-selection, missing-selection, and uncertainty fixtures.
- Reuse the existing pure marker-layout scoring tests for candidate selection
  and invalid portrait-page geometry.
- Reuse the existing diagnostic-record builders as prior art for stable reason
  codes and human explanations.
- Extend the existing representative high-bubble-count bounded-work fixture
  from its previous density to the 350-bubble ceiling.

### Schema behavior

- Accept schemas without white-reference regions and preserve existing grading
  behavior.
- Accept legacy schemas without correction-box metadata, but require valid box
  geometry and a versioned style for every bubble in current-sprint calibration
  and validation schemas.
- Accept valid reference regions at the minimum and preferred sizes.
- Reject duplicate IDs, non-finite or non-integer geometry, non-positive sizes,
  out-of-bounds rectangles, and prohibited overlap.
- Return all simultaneous reference and existing schema errors with stable
  paths and codes.
- Compute spatial coverage consistently for margin-only and distributed
  references.
- Reject correction boxes that are out of bounds, fail to contain their bubble,
  reference an unknown style, have invalid style values, or overlap a declared
  white-reference region.

### Evidence-session behavior

- Produce the same combined result regardless of candidate-frame input order.
- Produce the same result on repeated calls with identical evidence and config.
- Preserve the single-frame result when a session contains exactly one credible
  frame and no new quality reason applies.
- Prevent one excluded or extreme frame from overturning several consistent
  credible frames.
- Mark a bubble uncertain when credible frame evidence spans a relevant
  filled/unfilled boundary.
- Keep a broad shadow correctable when local contrast remains adequate.
- Localize a sharp shadow-boundary uncertainty to affected bubbles.
- Exclude a severely blurred, clipped, or misregistered frame with explicit
  reasons.
- Distinguish insufficient credible evidence from a legitimate uncertain fill.
- Select a deterministic best visual frame without implying that it is the only
  numerical evidence source.
- Preserve exact-set question grading after aggregation.

### Color and mark behavior

- Verify deterministic luminance and color evidence for known black, blue,
  gray, and white pixel fixtures.
- Verify invariance to common exposure shifts when interior and local paper
  change together.
- Verify blue color evidence improves or preserves held-out blue-ink behavior
  without degrading black-ink behavior.
- Verify completely filled supported black and blue bubbles remain confident.
- Verify approximate 70% physical fixtures satisfy filled acceptance.
- Verify approximate 40% fixtures are never silently confident filled.
- Verify physical coverage labels remain separate from measured pixel ratios.
- Verify the expected printed grey border does not alter an unmarked bubble's
  fill decision or contaminate local-paper evidence.
- Do not assert cross or fully painted-box semantics in this sprint.

### Geometry behavior

- Preserve four-outer-marker canonical crop behavior.
- Record middle-marker residual without allowing a missing diagnostic middle
  marker to silently alter the crop contract.
- Correct ordinary uniform print scaling through canonical normalization.
- Detect bounded global residual alignment from known printed bubble and grey
  correction-box geometry.
- Exclude geometry outside the accepted correction range.
- Record the center-adjustment distribution and distinguish local adjustment
  from systematic page drift.

### Recording and replay behavior

- Round-trip a complete development bundle through serialization and parsing.
- Reject unsupported diagnostic/bundle versions explicitly.
- Join every artifact by one stable scan ID.
- Reproduce mobile per-frame and combined measurements offline within the
  declared tolerance.
- Confirm export contains all replay-critical evidence.
- Confirm clear removes only diagnostic bundles selected by the development
  workflow.
- Confirm normal release behavior does not retain the development corpus.

### Performance behavior

- Measure the full 350-bubble session on both physical required devices.
- Verify evidence collection stops by 1.5 seconds after marker lock.
- Verify the release result appears within 3 seconds at the 95th percentile.
- Report median, 95th percentile, and worst observed timings by stage.
- Measure memory and recording-bundle size in diagnostic mode.
- Run the same configuration on both devices and report differences rather than
  hiding them behind device-specific grading thresholds.
- Treat physical timing as a manual acceptance test supported by persisted
  telemetry; static tests cannot substitute for it.

### Physical validation behavior

- Use the current layout and a maximum-density 50-question/350-bubble layout.
- Use the final grey correction-box geometry and printed style on every
  calibration and validation sheet; no bubble-only physical sheet may support
  the sprint's reliability claim.
- Use at least two black and two blue pens, including ballpoint and gel when
  available.
- Include empty, full, alternating, approximate 70%, and approximate 40% marks
  distributed across the page.
- Include diffuse artificial, window, mixed, ordinary shadow, directional
  boundary, broad gradient, and representative bright/glare conditions.
- Leave correction boxes otherwise unmarked and exclude handwritten crosses,
  fully painted boxes, direct sunlight, and glossy/laminated material from
  supported-condition acceptance.
- Use a screening set while developing and a physically separate held-out set
  after configuration freeze.
- Prefer marks from multiple people; if unavailable, document the limitation
  rather than blocking the sprint.

### Acceptance criteria

- Every physical acceptance result comes from the final grey-box form geometry.
- Zero silent score changes across repeated scans of the same supported valid
  fixture.
- Zero flips between confidently filled and confidently unfilled for the same
  supported physical bubble.
- Every credible disagreement is attached to affected bubbles and questions.
- At least 95% of supported-condition scans finish without a stability warning.
- Fully filled blue and black bubbles remain confident under supported light
  and ordinary shadows.
- Approximate 70% fills meet the filled behavior.
- Approximate 40% or lower fills are never silently promoted to confident
  filled.
- Evidence collection ends within 1.5 seconds.
- Release result presentation completes within 3 seconds at the 95th
  percentile on both required devices, including the 350-bubble fixture.
- Saved evidence reproduces the recorded measurements and combined result
  offline.
- Every result identifies schema, configuration, diagnostic version, and
  contributing evidence.
- No threshold change is accepted without held-out comparison against the
  frozen baseline.

## Out of Scope

- Neural-network or learned bubble classification.
- Full-page neural inference.
- Training-data collection for an immediate production ML model.
- Interpreting handwritten student corrections in this sprint, including
  crossed-out selections, fully painted correction boxes, erasures, or
  overwriting. The printed grey correction-box geometry itself is in scope.
- Pencil marks, ticks, handwritten crosses, dots, or circles around answers as
  current-sprint detector inputs.
- Official/final grade state, production record retention, synchronization,
  accounts, backend integration, or classroom audit workflow.
- Production privacy and retention policy beyond keeping prototype fixtures
  free of real student data.
- Landscape scanning.
- Front-camera scanning.
- Automatic torch activation.
- Direct sunlight as a supported reliability condition.
- Glossy paper, laminated sheets, plastic sleeves, or heavily folded/damaged
  pages.
- Inkjet and photocopier reliability claims.
- Colored printed form content as a supported requirement.
- Forms larger than 50 questions or 350 bubble ROIs.
- New visible calibration bubbles, patches, or marks.
- Replacing the existing four-marker crop with a new page-finding design.
- Narrow device-specific grading thresholds.
- A universal-device compatibility claim based on the two acceptance devices.
- A native OpenCV/JSI/Nitro rewrite without a failed worklet benchmark and
  bottleneck report.
- Release optimization of development recording before replay completeness and
  reliability have been established.

## Further Notes

- The current marker detector is considered a strength. This sprint should add
  evidence around it rather than reopen it without a reproduced marker failure.
- `center_adjusted` is not independently a failure. It becomes material when
  adjustment magnitude or spatial distribution indicates registration drift,
  or when it combines with weak evidence.
- White references help model broad illumination but cannot alone explain a
  sharp shadow through a bubble. The local paper ring and intra-ROI spatial
  evidence remain essential.
- The grey correction boxes are an interaction affordance, not new calibration
  marks. Because they change the printed neighborhood of every bubble, their
  final geometry and style must be frozen before physical calibration begins.
- The next sprint is explicitly responsible for correction semantics: a valid
  cross reaching the designated grey box edges invalidates the bubble, while a
  fully painted box selects it again. That sprint will calibrate cross geometry,
  painted-box coverage, ambiguous states, and both supported ink colors using
  the full-box evidence preserved here.
- Multi-frame agreement does not prove correctness. A stable wrong result is
  possible, which is why ground truth, quality gates, and held-out validation
  precede confidence aggregation.
- The user-facing 1.5-second evidence window and 3-second release-result target
  are hard acceptance constraints. Development recording can be slower but
  must report its overhead separately.
- The future product may accumulate a much larger natural scan corpus. That
  corpus could later support a compact per-bubble classifier, but any learned
  model should be compared against this deterministic baseline through the same
  evidence-session and held-out evaluation contracts.
- The companion reliability sprint plan describes suggested work-package
  sequencing. The companion test-requirements document defines physical
  fixtures, ground truth, devices, pens, lighting, and recorded artifacts. This
  specification is authoritative for feature behavior and agent implementation
  boundaries if wording differs.
