# OMR Reliability Sprint — Test and Evidence Requirements

## Purpose

This document defines the physical materials, generated forms, devices,
lighting conditions, ground truth, and recorded evidence required to calibrate
and validate the OMR scanning prototype.

The goal is repeatable answer recognition across supported devices and normal
indoor lighting without asking the user to repeat a scan merely because the
camera selected an inconsistent frame.

This is a development-data specification. It does not define production grade
persistence, synchronization, or the lifecycle of an official result.

## Agreed prototype behavior

- Marker detection is already reliable and remains the geometric entry gate.
- After marker lock, the scanner may collect multiple frames for at most 1.5
  seconds.
- Multi-frame evidence may be combined to improve bubble accuracy.
- The strongest canonical frame must be retained as the visual reference.
- Per-frame evidence must remain available so a combined decision is
  explainable.
- At the end of the evidence window, the scanner returns the strongest result
  it can produce.
- Cross-frame disagreement must never be hidden. Affected bubbles and questions
  must be identified as uncertain.
- The target worst-case user-facing time from marker lock to displayed result
  is 3 seconds in a release build.
- Development builds may be slower when diagnostic recording is enabled.

## Required devices

The same core reliability and timing acceptance criteria apply to:

1. iPhone 15 Pro
   - iOS 26
2. Pocophone F1
   - MIUI
   - Android 10

Device-specific fixed grading thresholds are not acceptable. Calibration must
come from the captured sheet and recorded evidence. The number or resolution
of frames processed may vary by device to remain within the time budget.

Two devices do not prove universal compatibility. They are the required
physical acceptance devices for this sprint and the starting point for a
device-adaptive implementation.

The scanner is portrait-only on both devices.

## Printed-form contract

- Plain white A4 paper.
- Ordinary matte, unlaminated paper lying reasonably flat.
- Laser-printed forms for this sprint.
- Ordinary printer scaling, including common "fit to page" shrinkage, must be
  corrected silently when the observed geometry remains valid.
- The UI must not ask teachers to understand or change printer settings.
- Excessive clipping or distortion must be represented as unreliable image
  evidence, not diagnosed to the user as a printer-setting problem.
- The six existing solid margin markers remain the black and geometric
  references. No new visible calibration marks are requested.
- The two middle markers should be included in alignment and quality
  diagnostics rather than ignored.
- Every production-intent bubble is surrounded by its final grey bordered
  correction box. The box is an interaction affordance and expected template
  print, not a calibration mark.
- The correction-box geometry, grayscale value, stroke width, and style ID must
  be frozen before any physical calibration or held-out sheet is printed.
- Glossy paper, laminated sheets, plastic sleeves, and heavily folded or
  damaged pages are outside this sprint.

## Generator handoff

For every production-intent bubble, the generator-owned schema must expose the
outer correction-box bounds in canonical crop pixels and reference a versioned
printed style. The required information is equivalent to:

```ts
correctionBoxPx: { x: 100, y: 200, width: 34, height: 34 },
correctionBoxStyleId: "grey-box-v1",

correctionBoxStyles: [
  { id: "grey-box-v1", strokeGray8: 176, strokeWidthPx: 1 },
]
```

The numeric values above are illustrative; the generator owner chooses and
then freezes the actual values. `strokeGray8` uses `0` for black and `255` for
white. The rectangle represents the outer bounds including the stroke, must
contain the complete bubble with positive clearance, and must remain inside the
canonical crop. All bubbles on one template version should use the same style
unless a future contract explicitly supports more than one.

The analyzer will use this declaration to mask expected grey print, place local
paper samples outside the complete box, validate the printed template, retain a
full-box crop, and prepare next sprint's correction recognition. Legacy schemas
may omit correction-box data, but no legacy bubble-only physical sheet may be
used to calibrate or validate this sprint's final reliability claim.

The generator must declare guaranteed unprinted white areas in canonical crop
pixels for every layout:

```ts
whiteReferenceRegionsPx: [
  { id: "white-1", x: 0, y: 0, width: 40, height: 40 },
]
```

Requirements for a white reference region:

- Guaranteed plain white paper after printing.
- No text, line, border, shading, QR content, or bubble inside it.
- No overlap with a correction box or its local evidence margin.
- Not intended for student writing.
- Minimum 24 × 24 canonical pixels.
- Prefer 40 × 40 canonical pixels or larger.
- Prefer spatial coverage across the top, middle, and bottom of the page and
  both sides.
- Margin-only references are an acceptable worst case.
- Interior white regions should be exported whenever the generated layout has
  them.

The analyzer must record a coverage score. It must not assume margin-only
references accurately describe an interior shadow; every bubble's local
background ring outside the complete correction box and multi-frame evidence
remain necessary.

## Supported student marks for this sprint

- Blue or black ink.
- No pencil.
- A completely filled bubble must be confidently recognized under supported
  capture conditions.
- A bubble with approximately 70% or more of its interior visibly covered must
  be recognized as filled.
- A bubble with approximately 40% or less coverage must not be confidently
  recognized as filled.
- Coverage between those values may be classified as uncertain.
- The physical coverage percentage is not expected to equal the measured
  grayscale or color dark-pixel ratio.
- Grey correction boxes remain free of handwritten marks in this sprint; only
  the ordinary bubble interior receives the declared empty/partial/full marks.
- Ticks, handwritten crosses, fully painted correction boxes, dots, circles
  around answers, erasures, overwriting, and correction interpretation are
  outside this sprint's calibration and acceptance.
- The printed form is treated as black/grayscale on white paper. Camera color
  data may still be used as additional evidence for blue ink.

## Committed correction behavior for the next sprint

The next sprint will support and calibrate the following states using the final
grey boxes printed and modeled in this sprint:

1. Ordinary empty bubble: unselected.
2. Ordinary filled bubble: selected.
3. Qualifying cross reaching the designated grey box edges: invalidated and
   unselected, including when drawn over a previously filled bubble.
4. Fully painted correction box: selected again and takes precedence over an
   underlying cross.
5. Incomplete, malformed, or ambiguous correction: uncertain.

The next sprint must define exact cross-edge geometry, stroke/continuity
tolerances, painted-box coverage thresholds, blue/black pen fixtures,
diagnostics, multi-frame behavior, and held-out validation. Its precedence is
`fully-painted box` over `valid cross` over ordinary bubble state.

## Required pens

Provide at least:

- Two ordinary black pens with visibly different ink behavior.
- Two ordinary blue pens with visibly different ink behavior.
- Include ballpoint and gel examples when available.

Record the brand/model and type of each pen in the ground-truth manifest. The
prototype is not restricted to a single approved pen model.

## Required form layouts

At least two materially different generated layouts are required:

1. The current hardcoded layout.
2. A maximum-density layout with 50 questions and up to 7 choices for every
   question, for a worst case of 350 bubbles, distributed across the page.

The performance ceiling is therefore 50 questions and 350 total bubble ROIs.
At least one dense physical fixture must validate registration and on-device
timing at that scale. The complete physical calibration matrix does not need a
manually filled version of every possible dense pattern; recorded frames can be
replayed offline for threshold evaluation.

## Required physical mark patterns

The final printed fixture set must collectively contain known examples of:

- Completely empty bubbles.
- Completely filled bubbles.
- Alternating filled and empty bubbles, preventing a uniformly blank or dark
  region from hiding registration mistakes.
- Approximately 70% fills.
- Approximately 40% fills.
- Blue and black versions of the filled and partial patterns.
- Marks placed across the top, middle, bottom, left, center, and right portions
  of the page.

Every fixture listed above uses the final printed grey boxes. The boxes remain
handwritten-mark-free outside the ordinary bubble fill; correction examples are
reserved for the next sprint's separate fixture matrix.

Exact fixture count and which pattern appears on each layout remain to be
finalized. The generator developer should not create fixtures ad hoc; this
document will be updated with a printable matrix first.

## Required lighting conditions

The recorded corpus must include, on both physical devices:

- Diffuse artificial indoor light.
- Window or daylight illumination.
- Mixed artificial and window light.
- Ordinary soft and moderate indoor shadows across the sheet.
- A directional shadow boundary crossing part of the answer area.
- Broad illumination gradients across the sheet.
- A representative brighter condition capable of revealing glare behavior.

Direct sunlight falling on the paper is outside the supported-condition
acceptance matrix.

Shadows are a supported condition and must not automatically reject a frame or
force every covered bubble to uncertain. The corpus must distinguish broad,
correctable illumination gradients from sharp boundaries that cross a bubble
interior or its local paper ring. When a sharp boundary makes only one bubble's
evidence genuinely ambiguous, uncertainty should remain local to that bubble
and its question.

The page should remain flat. Folded pages and deliberate physical deformation
are not part of this sprint unless later added as an explicit robustness test.

## Required development recording mode

Every recorded scan session must have a unique scan ID connecting all of the
following artifacts:

- Device model and operating-system version.
- App build and source revision.
- Detector configuration ID and complete thresholds.
- Form/layout ID and printed fixture ID.
- Pen ID and declared physical fill pattern.
- Lighting-condition label.
- Timestamp.
- Available camera metadata, including exposure, ISO, shutter duration, focus,
  and white balance where the camera API exposes them.
- Marker candidates and selected marker/crop geometry for every contributing
  frame.
- White-reference measurements and spatial coverage.
- Original contributing frame data needed to reproduce the analysis.
- Canonical crop for every contributing frame.
- The selected best canonical frame.
- Per-frame bubble measurements, decisions, confidence, and reason codes.
- Cross-frame registration measurements.
- The combined per-bubble result and the frames that contributed to it.
- Cross-frame disagreement and the affected questions.
- QR result.
- Per-stage and total timings.
- Ground-truth comparison.

The dataset must remain local during the prototype. Test fixtures should avoid
real student data.

Torch control remains manual. Record its state in each scan session, but the
reliability pipeline must not activate it automatically. Automatic focus and
exposure stabilization may be evaluated when supported by the camera API and
justified by device measurements.

## Ground truth

Every physical fixture requires a machine-readable manifest containing:

- Fixture ID.
- Layout/schema ID and version.
- Correction-box style ID and frozen template appearance revision.
- Printer identifier when known.
- Pen identifier.
- Expected physical coverage class for every bubble: `empty`, `40-percent`,
  `70-percent`, or `full`.
- Expected detector class for every bubble: `unfilled`, `uncertain-allowed`, or
  `filled`.
- Expected selected-answer set for every question.
- Current-sprint correction state `none` for every bubble.

Ground truth must be defined before scanning. It must not be inferred from the
prototype's output.

## Provisional repetition matrix

The previously discussed reliability target uses repeated scans rather than a
single successful demonstration:

- Test every required physical device.
- Test every required layout class.
- Test both ink colors.
- Test all required lighting classes.
- Repeat identical-sheet scans enough times to expose camera auto-exposure,
  focus, and frame-selection variability.

The exact repetition count will be finalized after the maximum layout density
and physical fixture count are clarified. Twenty repetitions per primary
same-sheet condition remains the current upper-confidence target; a smaller
screening pass may be used before running the full matrix.

## Sprint acceptance criteria

- Every accepted physical result uses the final grey-box template geometry and
  frozen printed style.
- Expected grey borders do not change ordinary fill decisions or contaminate
  local-paper measurements.
- Zero silent score changes across repeated scans of the same valid fixture.
- Zero changes between confidently `filled` and confidently `unfilled` for the
  same valid physical bubble across supported conditions.
- Any credible cross-frame or cross-scan disagreement is explicitly flagged.
- At least 95% of supported-condition scans return without a stability warning.
- A fully filled supported blue or black bubble does not become uncertain due
  only to the supported device or lighting condition.
- Approximately 70% physical fills satisfy the agreed filled behavior.
- Approximately 40% physical fills are never silently promoted to confident
  filled selections.
- Multi-frame evidence collection finishes within 1.5 seconds of marker lock.
- Release-build result presentation finishes within 3 seconds of marker lock at
  the 95th percentile on both required devices.
- Development timing and release-build timing are reported separately.
- Saved evidence can reproduce the recorded bubble measurements and combined
  result offline.
- The current TypeScript/worklet measurement path is benchmarked with 350
  bubbles and multi-frame evidence on both required devices.
- If that path cannot meet the timing criteria, the benchmark report must
  identify the measured bottleneck and evaluate native OpenCV or a dedicated
  JSI/Nitro measurement module before an implementation boundary is chosen.

## Outstanding decisions

- Exact second-layout geometry.
- Exact correction-box dimensions, bubble clearance, grayscale value, and
  stroke width. These must be resolved and frozen before fixture production.
- Exact pen models available for the fixture set.
- Exact physical method used to produce repeatable 40% and 70% fill fixtures.
- Screening-pass and full-matrix repetition counts.
- Which camera metadata is available consistently through the current iOS and
  Android camera stack.
- Whether the final hot measurement loop remains in TypeScript/worklets or
  moves to native OpenCV/JSI/Nitro; decide only after cross-device benchmarks.
