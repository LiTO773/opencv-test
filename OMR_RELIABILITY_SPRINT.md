# OMR Capture Reliability Sprint

## Sprint objective

Make repeated scans of the same valid answer sheet produce the same bubble and
question decisions under normal indoor conditions on the required iOS and
Android devices.

The sprint addresses the observed intermittent combination of
`poor_local_contrast`, `center_adjusted`, and
`fill_score_in_uncertain_band`. Marker detection is not the current failure
area and should not be rewritten without new evidence.

The scanner must use the available camera evidence well on the first attempt.
It may observe multiple frames for up to 1.5 seconds after marker lock. When
credible evidence still disagrees, it returns the strongest available result
and identifies the affected bubbles and questions instead of silently changing
the score.

## Product boundary for this prototype

### Supported

- Portrait-only scanning.
- Plain white matte A4 paper, reasonably flat and unlaminated.
- Laser-printed black/grayscale forms.
- A frozen grey bordered correction box around every bubble as expected printed
  template geometry; the boxes remain handwritten-mark-free in this sprint.
- Ordinary printer scaling, including common fit-to-page shrinkage.
- Completely or mostly filled bubbles.
- Blue and black ink.
- Diffuse artificial light, window light, mixed indoor light, and ordinary soft
  or moderate indoor shadows.
- iPhone 15 Pro on iOS 26.
- Pocophone F1 on MIUI/Android 10.
- Up to 50 questions and 7 choices per question: 350 bubble ROIs.

### Explicitly outside this sprint

- Neural-network classification.
- Interpreting student correction marks, including crossed-out bubbles and fully
  painted correction boxes. These semantics are committed to the next sprint.
- Pencil, ticks, handwritten crosses, dots, or circles around answers as
  current-sprint detector inputs.
- Glossy paper, laminated sheets, plastic sleeves, and heavily folded pages.
- Direct sunlight on the sheet.
- Inkjet and photocopier acceptance claims.
- Landscape phone operation.
- Automatic torch control.
- Backend storage, synchronization, or production grade lifecycle.
- A universal-device claim based on only two physical devices.
- A native rewrite before the current hot path is benchmarked.

## Reliability principles

1. **Measure before tuning.** Preserve the current detector as the baseline and
   record failures before changing thresholds.
2. **Do not grade capture artifacts as student intent.** Blur, glare, exposure
   movement, or registration drift must reduce evidence quality.
3. **Use several frames, not several user attempts.** The camera receives a
   short internal evidence window; the user performs one scan.
4. **Aggregate measurements, not only scores.** Equal scores can hide the same
   repeated error. Compare per-bubble pixels, measurements, geometry, and
   decisions.
5. **Keep uncertainty explicit.** Cross-frame disagreement cannot become a
   confident decision through averaging alone.
6. **Keep decisions reproducible.** Every combined bubble result must name the
   contributing frames, measurements, thresholds, and reasons.
7. **Calibrate per sheet where possible.** Fixed device-specific thresholds are
   not an acceptable path to broader device support.
8. **Optimize only after profiling.** The Pocophone F1 and 350-bubble fixture
   decide whether native acceleration is necessary.

## Proposed end-to-end pipeline

### 1. Marker lock

Keep the current four-region marker detector and whole-page layout scoring.
Marker lock starts the evidence window; it does not immediately trigger the
first available still as the grading image.

Continue sampling geometry throughout the evidence window. Use all six
physical markers diagnostically:

- Four outer markers define the canonical crop.
- Two middle markers provide an independent residual/alignment check.
- Marker movement, size variation, and homography residual contribute to frame
  quality.

### 2. Bounded evidence window

Collect analyzable candidate frames for no more than 1.5 seconds after marker
lock.

The implementation spike must determine the highest useful resolution and
frame count that both required devices can process. It must not assume that a
420-pixel marker-preview frame contains enough detail for bubble grading.

Record, per candidate frame:

- Timestamp and frame sequence.
- Marker/crop geometry.
- Available exposure, ISO, shutter, focus, and white-balance metadata.
- Torch state.
- Global and spatial sharpness.
- Highlight clipping/glare evidence.
- White-reference brightness and spatial gradient.
- Canonical registration measurements.

Automatic focus or exposure stabilization may be used if the API exposes it
reliably and device tests show an improvement. Torch remains manual.

### 3. Canonical registration

Normalize every contributing frame into the fixed 875 × 1280 canonical space.

For each frame, verify registration using:

- Outer-marker geometry.
- Middle-marker residuals.
- Robust aggregate alignment of expected printed bubble and grey correction-box
  outlines.
- Declared white-reference regions when present.

Estimate and record global translation, rotation, scale, and residual error.
Apply only bounded corrections. A frame with excessive residual error is
excluded from confident aggregation rather than stretched until it appears to
fit.

### 4. Shadow and illumination normalization

Shadows are a supported capture condition. Do not use a single global
brightness threshold and do not reject a frame merely because one side of the
page is darker.

Build a spatial illumination model from:

- Generator-declared white-reference regions across the page.
- Local paper rings outside the complete grey correction box around each bubble.
- Robust white-paper samples that exclude printed content.
- Measurements from multiple registered frames.

Use the page-wide model to understand broad brightness gradients. Use the local
paper ring as the most relevant reference for an individual bubble. The
analyzer must additionally measure asymmetry or gradients within each ROI so a
sharp shadow boundary crossing a bubble is not mistaken for student ink.

A broad or soft shadow should normally be corrected. A sharp boundary that
leaves one bubble genuinely ambiguous should affect only that bubble and its
question, not invalidate the whole sheet.

### 5. Per-frame quality model

Build an explicit, inspectable quality record. It is a deterministic quality
model, not a neural network.

Candidate evidence includes:

- Focus across the answer area, not only one global Laplacian value.
- Local bubble ROI focus.
- White-reference brightness distribution.
- Local paper-ring brightness.
- Exposure stability between frames.
- Clipped highlight ratio and spatial glare.
- Shadow/illumination gradient.
- Registration residual.
- Center-adjustment distribution.

Quality thresholds must be derived from the recorded calibration corpus and
validated on held-out physical sheets.

### 6. Color-preserving bubble measurement

Do not discard camera color before extracting all useful evidence.

Retain the existing explainable measurements:

- Expected and measured center.
- Bubble-outline darkness.
- Local paper-ring luminance.
- Interior luminance.
- Dark-pixel ratio.
- Contrast.
- Focus.

Also preserve the complete registered correction-box crop and separate masks
for the bubble interior, expected printed bubble/box borders, box interior, and
paper outside the box. Expected grey-border pixels are excluded from ink,
dark-pixel, and local-paper statistics.

Add color evidence useful for blue ink:

- Color distance between the bubble interior and local paper.
- Blue/chroma evidence relative to the local background.
- Saturation and channel differences robust to exposure.

The form itself is assumed to be black/grayscale. Color evidence supplements
local luminance; it does not replace it or make the form depend on color
printing.

### 7. Per-sheet calibration

Extend the generator schema with optional guaranteed white-reference regions:

```ts
whiteReferenceRegionsPx: [
  { id: "white-1", x: 0, y: 0, width: 40, height: 40 },
]
```

The exact generator contract is defined in
`OMR_RELIABILITY_TEST_REQUIREMENTS.md`.

The generator must also declare the outer correction-box rectangle for every
production-intent bubble and a versioned border style containing its intended
grayscale value and canonical stroke width. Legacy schemas may omit this data,
but every physical sheet calibrated or validated in this sprint uses the frozen
grey-box contract.

Use references to estimate:

- Page brightness across the image.
- Exposure and white-balance movement across frames.
- Spatial illumination gradient.
- Whether margin references adequately cover the observed bubble field.

The field is optional for backward compatibility. Margin-only references are
valid but receive a lower coverage score. Local bubble background rings remain
authoritative near each bubble.

### 8. Multi-frame aggregation

Register measurements by schema bubble ID and combine only credible frames.

The initial deterministic candidate should use robust statistics such as the
median and median absolute deviation rather than a simple mean. The exact
aggregator is chosen from held-out validation results.

For every bubble, record:

- All eligible per-frame measurements.
- Excluded frames and exclusion reasons.
- Robust combined measurement.
- Measurement spread.
- Number and quality of contributing frames.
- Per-frame decisions.
- Combined decision and confidence.
- Cross-frame disagreement reasons.

A combined decision may be confident only when its credible evidence remains
on the same side of the calibrated decision boundary. Evidence spanning a
boundary remains uncertain.

### 9. Best visual reference

Select the strongest canonical frame as the visual reference using geometry,
focus, illumination, and local evidence coverage. The numerical result may use
multiple registered frames, but diagnostics must distinguish the visual frame
from the complete evidence set.

### 10. Question grading

Keep exact selected-set equality. Do not change scoring semantics while tuning
image measurement.

Return:

- Strongest provisional score.
- Combined per-bubble decisions.
- Questions affected by uncertain or disagreeing bubbles.
- Visual crops sufficient to inspect those questions in the prototype.

Production persistence and official/final score semantics remain outside this
sprint.

## Work packages

### WP1 — Freeze and measure the baseline

Deliverables:

- Versioned baseline detector configuration.
- Stable scan/session ID.
- Development recording mode.
- Baseline repeated-scan report on both devices.
- Bubble-level variance report grouped by reason code.

Do not tune thresholds in this work package.

Completion gate:

- The observed inconsistency can be reproduced or its absence is documented
  across the agreed screening matrix.
- Every result can be joined to its image and diagnostics.

### WP2 — Offline replay and calibration workbench

Deliverables:

- Import and validate recorded scan bundles.
- Re-run bubble measurement without recapturing sheets.
- Compare a candidate configuration against ground truth.
- Produce confusion matrices for `filled`, `unfilled`, and `uncertain`.
- Report false-filled, false-unfilled, uncertain, question-error, and silent
  score-change rates.
- Break results down by device, pen, lighting, fill coverage, page region, and
  layout density.
- Enforce calibration/validation separation by physical sheet and, where
  available, person.

Completion gate:

- A threshold change cannot be accepted without a held-out comparison report.

### WP3 — Multi-frame capture spike

Deliverables:

- Benchmark candidate resolution/frame-count combinations.
- Confirm the 1.5-second hard window on both devices.
- Measure frame acquisition, canonical normalization, readback, and storage
  costs separately.
- Determine whether focus/exposure stabilization improves evidence.
- Choose the smallest evidence representation that supports reproducible
  offline evaluation.

Completion gate:

- A documented capture strategy that meets the bounded window on both devices
  or a measured bottleneck with a next action.

### WP4 — Registration and frame-quality gates

Deliverables:

- Middle-marker residual diagnostics.
- Bubble and correction-box aggregate alignment.
- Spatial focus, glare, and illumination measurements.
- Broad-gradient correction and sharp local shadow-boundary evidence.
- Optional white-reference coverage and calibration.
- Per-frame eligibility and exclusion reasons.

Completion gate:

- Known blurred, clipped, misregistered, or glare-affected frames do not
  contribute confident evidence silently.

### WP5 — Color-aware bubble evidence

Deliverables:

- Preserve color until bubble evidence is extracted.
- Preserve the full correction-box crop and exclude expected grey print from
  student-ink and paper-reference measurements.
- Blue-ink color-distance/chroma measurements.
- Updated stable diagnostic format.
- Offline comparison against the grayscale baseline for black and blue pens.

Completion gate:

- Color evidence improves or preserves held-out blue-ink reliability without
  degrading black-ink reliability.

### WP6 — Robust multi-frame decisions

Deliverables:

- Bubble-ID-based per-frame aggregation.
- Combined confidence and disagreement reasons.
- Best visual reference selection.
- Exact-set question grading from combined bubble decisions.
- Prototype visualization of uncertain questions.

Completion gate:

- Cross-frame disagreement remains visible.
- Reordering identical input frames cannot change the result.
- One poor frame cannot overturn a consistent set of credible frames.

### WP7 — Dense-sheet performance

Deliverables:

- Physical 50-question/350-bubble fixture.
- Release and diagnostic build timings on both devices.
- CPU, memory, and saved-evidence size measurements.
- Worklet hot-path profile.

Decision gate:

- Keep the TypeScript/worklet implementation if it meets timing with margin.
- If it fails, profile the exact bottleneck and evaluate native OpenCV or a
  dedicated JSI/Nitro measurement loop.
- Do not approve a native rewrite based on assumption alone.

### WP8 — Reliability validation

Deliverables:

- Screening matrix followed by the agreed full repeated-scan matrix.
- Held-out results on both physical devices.
- Failure gallery with images and diagnostics.
- Final detector/configuration ID.
- Known-limitations report.

Completion gate:

- Every sprint acceptance criterion below is supported by saved evidence.

## Development recording bundle

Every diagnostic scan bundle must contain:

- Manifest with scan ID, device, OS, build revision, schema, detector config,
  fixture, pen, lighting label, and ground truth.
- Available camera metadata and torch state.
- Contributing frame geometry and quality.
- Canonical data sufficient for lossless/reproducible bubble replay.
- Best canonical visual frame.
- Per-frame bubble diagnostics.
- Combined bubble and question diagnostics.
- Timing and performance metrics.

Provide a development-only export mechanism and a safe way to clear local
bundles. Avoid real student data during this sprint.

## Test strategy

The physical evidence specification lives in
`OMR_RELIABILITY_TEST_REQUIREMENTS.md`.

Use two stages:

1. **Screening pass:** small repeated set used to expose failures quickly while
   implementing instrumentation and capture changes.
2. **Held-out validation pass:** untouched physical sheets and conditions used
   only after a candidate configuration is frozen.

Every physical sheet in both stages uses the final grey correction-box geometry
and style. Handwritten crosses and fully painted boxes are excluded from this
sprint's calibration and validation sets.

Do not repeatedly tune on the validation set. Do not report individual bubble
accuracy alone; a 350-bubble sheet amplifies small per-bubble error rates into
meaningful question and sheet error rates.

## Acceptance criteria

### Decision stability

- Zero silent score changes across repeated scans of the same supported valid
  fixture.
- Zero supported-condition flips between confidently `filled` and confidently
  `unfilled` for the same physical bubble.
- Credible disagreement is explicitly attached to affected bubbles and
  questions.
- At least 95% of supported-condition scans finish without a stability warning.

### Mark behavior

- Expected printed grey borders do not change ordinary bubble decisions or
  contaminate local-paper evidence.
- Fully filled blue and black bubbles remain confident under supported devices
  and lighting, including ordinary soft and moderate shadows.
- Approximately 70% physical coverage satisfies the agreed filled behavior.
- Approximately 40% physical coverage is never silently promoted to a
  confident filled selection.
- Exact-set question grading remains unchanged.

### Timing

- Evidence collection stops no later than 1.5 seconds after marker lock.
- Release-build result presentation completes within 3 seconds of marker lock
  at the 95th percentile on both required devices.
- Development and release timings are reported separately.
- The 350-bubble dense fixture is included in timing acceptance.

### Reproducibility

- Saved evidence reproduces recorded measurements and combined results
  offline.
- Every result identifies its schema and detector configuration.
- Candidate threshold changes include held-out comparison reports.

## Required tests in the repository

- Schema validation for optional white-reference regions and coverage.
- Schema validation for correction-box containment, style references, legacy
  compatibility, and white-reference separation.
- Deterministic fixtures proving expected grey-border pixels are excluded from
  mark and local-paper evidence.
- Deterministic color-to-evidence fixtures for black, blue, and white pixels.
- Multi-frame aggregation order invariance.
- Frame exclusion and disagreement fixtures.
- Boundary fixtures around empty, uncertain, and filled decisions.
- Exact-set grading regression tests.
- Backward compatibility for schemas without white references.
- Diagnostic serialization/version validation.
- Dense 350-bubble bounded-work fixture.
- Offline replay equality against recorded mobile measurements.

## Risks and safeguards

### Threshold overfitting

Safeguard: split by physical sheet, pen, person where available, device, and
lighting. Freeze validation data before tuning.

### Stable but wrong multi-frame consensus

Safeguard: quality and ground-truth validation precede consensus. Equal scores
alone do not establish correctness.

### Blue-ink regression

Safeguard: preserve color evidence and report black/blue metrics separately.

### Old-device performance

Safeguard: benchmark early on the Pocophone F1 and keep the native boundary as
a measured contingency.

### Diagnostic data volume

Safeguard: measure bundle sizes, retain only reproducibility-critical data, and
provide export/clear controls. Do not reduce evidence before confirming offline
replay remains possible.

### Scope expansion

Safeguard: keep neural classification, handwritten correction recognition,
unusual materials, direct sunlight, additional print technologies, and
production persistence out of this sprint. The printed grey-box geometry is
not scope expansion; it is the final template being calibrated.

## Sprint completion artifacts

- Versioned implementation and detector configuration.
- Development recording/export mode.
- Offline replay and threshold comparison report.
- Physical fixture and ground-truth definitions.
- Cross-device performance report.
- Held-out reliability report.
- Failure gallery.
- Updated generator schema contract.
- Frozen correction-box geometry and printed-style identity used by every
  physical calibration and validation fixture.
- Known-limitations document.
- Recommendation on whether native acceleration deserves a later sprint.

## Deferred opportunities

### Next sprint — student correction semantics

The next sprint will implement and calibrate correction recognition using the
full-box evidence preserved by this sprint:

1. An ordinary empty bubble is unselected.
2. An ordinary filled bubble is selected.
3. A qualifying handwritten cross extending to the designated grey box edges
   invalidates the bubble and makes it unselected.
4. A fully painted correction box selects the answer again, overriding a cross.
5. An incomplete or ambiguous correction remains uncertain.

The precedence is therefore `fully-painted box` over `valid cross` over
ordinary bubble state. That sprint must define geometric tolerances, painted
coverage thresholds, both supported ink colors, physical fixtures, replay
diagnostics, and held-out validation. It must not require changing the frozen
printed box geometry calibrated here.

The recorded corpus may later support a compact per-bubble classifier. If
explored, it should be compared against the deterministic detector on the same
held-out corpus and used inside the existing geometric, quality, multi-frame,
and diagnostic framework—not as a full-page black box.
