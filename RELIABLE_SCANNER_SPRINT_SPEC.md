# Reliable Six-Marker OMR Scanner

## Problem Statement

Portuguese teachers use the mobile OMR prototype to grade printed tests more quickly. The current scanner performs well under ideal lighting but becomes unreliable when exposure, illumination, or contrast changes slightly.

The active scanner recognizes only the four outer black page markers even though the printed sheet contains three markers in each margin. It therefore ignores the two middle markers that could strengthen page-layout validation and contribute calibration evidence.

The current bubble detector estimates local paper brightness from a circular ring immediately outside each bubble. The printed answer layout now surrounds bubbles with grey-bordered boxes, so that ring is no longer guaranteed to contain only unprinted paper. Grey borders can contaminate the background measurement, center search, focus evidence, and ultimately the filled/unfilled decision.

The sheet already provides stable page-wide reference material: six black markers and guaranteed blank paper in the vertical spaces between adjacent markers. The scanner does not currently measure or use those references to normalize the canonical image or bubble measurements.

The sprint must make scanning materially more reliable by requiring and validating all six markers, deriving page-wide black and white calibration evidence from the accepted still photograph, and making bubble analysis aware of grey-bordered answer cells.

## Solution

The scanner will recognize the complete six-marker page layout: top, middle, and bottom markers in both margins. A coherent six-marker layout will be required both in consecutive preview analyses and during independent validation of the captured still photograph. The outer four marker corners will continue to define the marker-free canonical crop, while the middle markers will improve whole-page validation and calibration.

After the accepted still photograph has been physically oriented and all six markers have been detected, the scanner will measure the interiors of the black markers and robustly sample guaranteed blank-paper corridors between adjacent markers. These measurements will be associated with their page-relative locations and used to construct a low-complexity page-wide illumination model. Bubble darkness will be expressed relative to the expected local paper and black levels instead of relying on raw grayscale exposure.

White-reference regions will be derived from the detected marker geometry and the invariant printed-page layout. They will belong to the scanner's page-calibration contract, not to each bubble-grading schema. The canonical answer crop will remain marker-free at 875 × 1280 pixels, so calibration evidence will be gathered from the accepted still before the marker columns are excluded.

The bubble schema will describe the canonical rectangle of every answer cell in addition to its bubble geometry. Bubble analysis will exclude the grey cell border and printed bubble outline from fill and background evidence. The circular background ring will no longer be the source of truth for paper brightness. The page-wide illumination model will supply the expected white level at each bubble.

Calibration failures will fail safely. A still with missing reference regions, insufficient black-to-white range, clipping, severe disagreement, contamination, blur, or an invalid six-marker layout will not produce a confident grade. The app will return to scanning with a useful explanation or mark affected results for review when the evidence permits grading but not a confident decision.

All processing will remain on-device. QR metadata will remain diagnostic-only and will not select the grading schema or answer key.

## User Stories

1. As a Portuguese teacher, I want the scanner to work across ordinary classroom lighting, so that I can grade tests without arranging ideal lighting.

2. As a Portuguese teacher, I want the scanner to reject an unreadable photograph, so that it does not confidently assign an incorrect score.

3. As a Portuguese teacher, I want automatic capture to occur only when the complete printed marker layout is visible, so that the captured sheet is geometrically trustworthy.

4. As a Portuguese teacher, I want clear guidance when calibration fails, so that I know whether to adjust the sheet, lighting, focus, or framing.

5. As a Portuguese teacher, I want the same marked sheet to produce the same answer decisions under reasonable exposure changes, so that grading is consistent.

6. As a Portuguese teacher, I want grey answer-cell borders to be ignored during mark detection, so that printed form decoration is not mistaken for an answer.

7. As a Portuguese teacher, I want uncertain answers to remain pending for review, so that weak evidence does not silently alter a student's score.

8. As a Portuguese teacher, I want a failed final quality check to return automatically to scanning, so that I can retry without resetting the app.

9. As a Portuguese teacher, I want the camera preview to remain responsive during final recognition, so that the app does not appear frozen.

10. As a Portuguese teacher, I want upside-down sheets to continue being recognized and corrected, so that page orientation does not interrupt grading.

11. As a Portuguese teacher, I want QR identifiers to remain visible in diagnostics even when calibration or grading fails, so that a failed scan can still be traced to its sheet.

12. As a Portuguese teacher, I want the result screen to distinguish scanning failures from uncertain bubble measurements, so that I understand whether to rescan or review an answer.

13. As a form designer, I want all six printed page markers to participate in page recognition, so that the scanner uses the complete layout contract.

14. As a form designer, I want the two middle markers to validate column alignment and row consistency, so that unrelated black shapes are less likely to form a false page.

15. As a form designer, I want the outer markers to continue defining the marker-free answer crop, so that existing canonical bubble coordinates remain stable.

16. As a form designer, I want blank calibration corridors to be derived between adjacent markers, so that individual grading schemas do not repeat invariant scanner geometry.

17. As a form designer, I want calibration sampling to stay away from marker edges, so that toner bleed and perspective interpolation do not bias the white measurement.

18. As a form designer, I want answer-cell rectangles recorded in canonical coordinates, so that grey borders can be excluded deterministically.

19. As a form designer, I want cell geometry to be explicit now, so that future whole-cell marking can be introduced without redesigning the page coordinate model.

20. As a developer, I want marker matches to have stable top/middle/bottom and left/right identities, so that detection, calibration, overlays, and diagnostics use the same ordering.

21. As a developer, I want marker selection to score a complete six-marker hypothesis, so that no single region independently chooses a QR finder pattern or unrelated square.

22. As a developer, I want QR contour-hierarchy protection preserved, so that adding six-marker support does not reintroduce QR false positives.

23. As a developer, I want preview detection and still-photo validation to use the same six-marker layout rules, so that capture readiness and final acceptance cannot drift.

24. As a developer, I want calibration to use the accepted still rather than preview pixels, so that grading is calibrated against the exact photograph being graded.

25. As a developer, I want calibration samples associated with normalized page positions, so that expected paper brightness can be interpolated at each bubble.

26. As a developer, I want robust white and black statistics instead of single-pixel samples, so that dust, print defects, and sensor noise do not dominate calibration.

27. As a developer, I want contaminated calibration tiles excluded when enough clean evidence remains, so that one small defect does not necessarily invalidate the sheet.

28. As a developer, I want the scan rejected when too little valid calibration evidence remains, so that missing data cannot produce a fabricated normalization.

29. As a developer, I want calibration quality and dynamic range recorded in diagnostics, so that exposure failures can be distinguished from mark-classification failures.

30. As a developer, I want filled/unfilled evidence expressed on a normalized scale, so that detector thresholds are less dependent on raw camera exposure.

31. As a developer, I want grey cell borders excluded by known geometry, so that detection does not depend on heuristically rediscovering boxes in every photograph.

32. As a developer, I want bubble-center adjustment to remain bounded to the expected bubble outline, so that nearby cell borders cannot pull the measurement away from the answer.

33. As a developer, I want focus evidence to avoid conflating printed grey borders with answer marks, so that a sharp border cannot hide a blurred bubble interior.

34. As a developer, I want schema validation to reject missing, invalid, overlapping, or out-of-bounds cell rectangles, so that malformed layouts fail before analysis.

35. As a developer, I want the mobile scanner and offline workbench to use the same calibration and grading contracts, so that desktop diagnostics reproduce device decisions.

36. As a developer, I want deterministic fixture results for lighting normalization, so that threshold and geometry changes produce reviewable test failures.

37. As a developer, I want existing canonical dimensions and bubble coordinates preserved where the printed form has not moved, so that reliability work does not silently change scoring layout.

38. As a developer, I want pipeline timings to include calibration work, so that increased reliability can be evaluated against capture latency.

39. As a developer, I want stable calibration and reason codes, so that diagnostics and UI explanations remain comparable across builds.

40. As a developer, I want native resource cleanup to remain guaranteed on success and failure, so that repeated scans do not leak image or OpenCV buffers.

41. As a product owner, I want reliability improvements to be measurable independently of future backend work, so that this sprint can be accepted as an on-device scanner improvement.

42. As a product owner, I want the scanner to prefer an explicit retry or review over a confident false grade, so that teacher trust is protected.

## Implementation Decisions

- The active four-marker scanner will evolve into the six-marker scanner. The dormant six-marker implementation is prior art for column spacing, alignment, size balance, row parallelism, and portrait-page validation, but it will not be reactivated wholesale.

- The active scanner's QR finder-pattern hierarchy rejection, multi-candidate page scoring, still-photo revalidation, orientation handling, canonical crop contract, on-device grading, and structured diagnostics will be preserved.

- Marker identity will be explicit and stable: top-left, middle-left, bottom-left, top-right, middle-right, and bottom-right. Any public marker count, overlay, capture-readiness state, and diagnostic record will use six as the complete layout.

- A valid automatic capture requires a coherent six-marker layout across the configured number of consecutive analyzed preview frames. Four outer markers without the two middle markers are not sufficient for capture.

- The accepted still photograph will be independently analyzed for all six markers. Preview coordinates will never be reused for final calibration, cropping, QR recognition, or grading.

- Six-marker layout validation will cover vertical ordering, approximate even spacing within each margin, column alignment, marker-size consistency, corresponding row geometry, left/right span consistency, convexity, portrait-page proportions, and minimum page area.

- Several plausible marker candidates will be retained per search region. The winning result will be selected as one complete six-marker page hypothesis instead of selecting the strongest square independently in each region.

- QR finder-pattern contour families will remain ineligible as page markers. Shallow nesting penalties and inward-displacement penalties may continue to contribute to candidate scoring where appropriate.

- The outer markers' inward-facing corners will continue to define the marker-free crop. The middle markers will validate geometry and contribute calibration but will not change the canonical crop boundary.

- The canonical crop contract remains 875 × 1280 pixels with a top-left origin and four pixels per millimetre. Existing answer coordinates remain valid unless the printed answer layout itself has changed.

- Blank-paper reference regions will not be added to every bubble-grading schema. They are an invariant part of a new page-calibration layout contract owned by the scanner.

- White-reference regions will be derived from the detected geometry of the top-to-middle and middle-to-bottom marker gaps on both margins. This produces four principal calibration corridors: upper-left, lower-left, upper-right, and lower-right.

- Each corridor will be inset from both adjacent markers and from unsafe corridor boundaries. It will be divided into multiple small sampling tiles rather than treated as one unqualified rectangle.

- Calibration sampling will operate on the accepted, physically oriented still photograph at sufficient resolution. It will occur before the marker columns are excluded from the marker-free canonical crop.

- Marker interiors will provide black-reference evidence. Sampling will avoid marker edges to reduce the effects of toner spread, blur, antialiasing, and perspective resampling.

- White and black samples will use robust aggregate statistics such as medians or trimmed means. A single pixel or single minimum/maximum value will not define calibration.

- Calibration evidence will retain page-relative positions so that a low-complexity illumination field can estimate expected white and black levels at any canonical bubble location.

- The illumination field will use bounded linear or piecewise-linear interpolation across the page. It will not use a high-order fit that can oscillate between the limited reference regions. Values outside the central reference rows will be clamped or conservatively extrapolated according to the calibrated layout contract.

- Normalized bubble darkness will be based on the measured bubble interior relative to the interpolated local white and black levels. Raw grayscale brightness will remain diagnostic evidence but will no longer be the primary exposure-dependent classification scale.

- The scanner will validate reference completeness, black-to-white dynamic range, clipping, left/right disagreement, vertical inconsistency, and sample dispersion before accepting calibration.

- Individual contaminated tiles may be rejected when sufficient clean samples remain. Calibration will fail when a corridor lacks enough valid tiles or when the remaining samples cannot support a trustworthy page-wide model.

- A final-still calibration failure is a capture-quality failure. The app will dispose of temporary resources, reset capture state, return to scanning, and show a concise explanation. This sprint imposes no language requirement on new or changed messages.

- The bubble schema will be extended with explicit canonical answer-cell rectangles. Cell geometry will be validated alongside bubble geometry.

- The grey cell border, printed bubble outline, labels, and other declared printed regions will be excluded from fill and paper measurements. The detector will not attempt to infer paper brightness from the existing circular background ring.

- Bubble fill measurement will remain limited to the declared bubble interior. Whole-page circle detection will not be introduced.

- Bubble-center adjustment will remain a small, bounded search around the expected center and will score the bubble outline without allowing the grey cell border to dominate.

- Focus evidence will be measured from declared safe geometry. Printed cell borders may provide general sharpness evidence, but they will not be allowed to substitute for readable answer-interior evidence.

- Grey-bordered cells are supported as permanently printed form geometry only. A cell whose interior has been deliberately painted remains outside this sprint's recognition semantics.

- QR recognition will continue to search only declared upright and 180-degree regions. An upside-down canonical image will continue to be rotated before grading.

- QR metadata remains diagnostic-only. It will not choose, modify, accept, or reject the hardcoded grading schema.

- The camera preview will remain active through final detection, calibration, perspective correction, QR recognition, and bubble grading. It will pause only after the complete structured result is available.

- All calibration results required for grading will be passed explicitly into the platform-neutral bubble analyzer. The analyzer will not depend on hidden global image state.

- Scan diagnostics will include valid/invalid calibration status, sampled reference locations, accepted and rejected tile counts, robust white and black values, dynamic range, interpolation evidence at each bubble, normalized darkness, calibration timing, and stable reason codes.

- User-facing technical diagnostics will explain calibration reason codes in clear language while retaining stable machine-readable codes for tests and comparisons. This sprint imposes no language requirement on those explanations.

- The detector configuration will remain separate from generator-owned form geometry. Thresholds and quality limits will retain an identifiable calibration version.

- The offline pipeline visualizer and schema preview tooling will be updated to represent six markers, calibration corridors, grey answer-cell rectangles, excluded borders, interpolated page-wide references, and normalized bubble evidence.

- No external service, upload, persistence layer, or browser fallback will be introduced.

## Testing Decisions

- Tests will assert externally observable behavior rather than private helper implementation. A good test describes a sheet image, layout, calibration condition, and expected scan or grading outcome without asserting which internal loop, interpolation helper, or OpenCV call produced it.

- The primary high-level seam will be the existing deterministic, platform-neutral grading boundary. It will accept a validated canonical image, schema, and explicit page-calibration evidence and return structured bubble, question, score, quality, and diagnostic results.

- A second focused seam is necessary for page acquisition because native preview processing cannot be exercised through the platform-neutral grading boundary. Pure six-marker candidate-layout selection will accept grouped candidates and return either a complete ordered page layout or no layout.

- Existing schema-preview and mobile-grading tests are prior art for the primary seam. They already verify exact canonical dimensions, deterministic diagnostics, representative bubble decisions, question grading, uncertainty, mobile/offline result parity, and bounded work for a large sheet.

- Existing four-point layout and contour-hierarchy tests are prior art for the page-acquisition seam. They already verify coherent whole-page selection, portrait-page rejection, and QR finder-pattern protection.

- Existing schema validation tests will be extended to cover required answer-cell rectangles, cell bounds, bubble containment, safe measurement masks, grey-border exclusions, and overlapping measurement regions.

- A valid six-marker fixture must return stable marker identities, a valid marker-free crop quadrilateral, and calibration corridors derived between the correct adjacent markers.

- A layout containing only the four outer markers must not become capture-ready.

- A layout with a missing, displaced, badly sized, unevenly spaced, or incorrectly ordered middle marker must be rejected even when the four outer markers appear plausible.

- A nearby QR finder square with a better local appearance score must still lose to the coherent six-marker page hypothesis.

- A six-marker layout with perspective distortion inside accepted bounds must remain valid and produce the expected outer crop.

- A non-convex, landscape, implausibly narrow, implausibly wide, curved beyond supported tolerance, or internally inconsistent layout must be rejected.

- Preview readiness tests and final-still acceptance tests must exercise the same layout contract and produce consistent validity decisions from equivalent evidence.

- Calibration tests will cover clean uniform exposure, globally dim exposure, globally bright exposure, smooth left-to-right gradients, smooth top-to-bottom gradients, and combined bounded gradients.

- Equivalent marked sheets under supported exposure transformations must produce the same filled, unfilled, or uncertain decisions and the same awarded or pending points.

- Calibration tests will cover clipped whites, washed-out blacks, insufficient dynamic range, a missing corridor, too few accepted tiles, contaminated tiles, excessive sample dispersion, and implausible left/right disagreement.

- A small number of contaminated tiles must not invalidate otherwise sufficient calibration evidence. The same contamination must cause a safe failure once the minimum evidence requirement is no longer met.

- Grey-box tests will compare equivalent bubbles with no border, a normal grey border, a darker permissible grey border, and small perspective-resampling changes. The printed border must not change the answer decision.

- Grey border pixels must not contribute to measured bubble fill ratio or page-white evidence.

- Empty, clearly filled, borderline, faint, blurred, and low-contrast bubbles will remain covered. Their expected outcomes will be expressed using normalized calibration evidence.

- Center-adjustment tests will verify that small bubble displacement is corrected while a nearby grey box edge cannot pull the measured center outside the declared tolerance.

- Focus tests will verify that a sharp grey border does not make an unreadable bubble interior appear confidently readable.

- Question-level tests will preserve exact selected-set equality for single- and multiple-answer questions. Clear extra selections remain incorrect, while outcome-changing uncertainty retains pending points.

- Orientation tests will verify that upright and upside-down sheets produce equivalent calibrated grading results and that calibration locations rotate consistently with the page.

- Mobile/offline parity tests will verify that the workbench and mobile analyzer produce the same structured decisions and stable diagnostic values from the same canonical pixels and calibration evidence.

- Diagnostics tests will verify stable reason codes, clear explanations, reference counts, dynamic range, normalized values, and the separation between capture-quality failure and bubble uncertainty.

- Performance tests will retain the representative approximately 50-question, 250-bubble fixture and assert bounded region-of-interest work. Calibration timing will be recorded separately so regressions remain visible.

- Static verification will continue to include TypeScript checking, linting, and the complete schema/detection/grading test suite.

- Physical corpus collection, threshold selection, and final device calibration will be performed by the user. The implementation will expose sufficient diagnostics and stable configuration identifiers to support that work.

## Out of Scope

- Collecting, labeling, or running the user's physical calibration corpus.

- Claiming production accuracy or marking provisional detector thresholds as production-calibrated.

- Per-bubble or per-answer-cell white-reference normalization. This sprint uses page-wide references derived from the page margins.

- Recognizing the future behavior in which a user paints or shades the entire grey-bordered answer cell to reuse an answer.

- Supporting arbitrary marker counts, arbitrary marker placement, or forms that print content inside the guaranteed calibration corridors.

- Correcting genuinely non-planar sheets with curved-page dewarping. Sheets bent beyond the supported planar tolerance will be rejected.

- Recovering image information lost to severe clipping, glare, occlusion, or blur.

- OCR, handwritten-text recognition, erasure interpretation beyond existing uncertainty handling, or recognition of marks outside supported bubble interiors.

- Persistence, scan history, manual score correction, backend integration, remote schema lookup, schema selection from QR metadata, uploads, or account management.

- Changing the canonical crop dimensions, pixel density, scoring rules, answer key, or QR payload contract.

- Broad Android polish, app-store delivery, or unrelated user-interface redesign.

## Further Notes

- Reliability in this sprint means making supported lighting changes less influential while failing safely when evidence is inadequate. It does not mean forcing every photograph to produce a grade.

- The page-wide references are valid because the printed-page contract guarantees blank paper between adjacent margin markers. If future form designs place content in those gutters or change marker placement, the page-calibration layout contract must become versioned or schema-specific.

- The canonical crop intentionally excludes the marker columns. Calibration must therefore be measured before the marker-free crop is finalized and carried forward as structured evidence.

- Margin references model smooth page-wide illumination. A small localized shadow in the centre of the answer area may not be fully represented. Such cases should be caught by contrast, focus, dispersion, or uncertainty quality gates rather than assigned a confident answer.

- The two middle markers improve redundancy and reveal geometry inconsistent with a planar page, but six markers do not by themselves correct page curvature.

- The dormant six-marker detector provides useful geometric prior art. The active scanner remains the architectural base because it contains the newer QR protection, still-photo validation, canonical crop, grading, and diagnostics pipeline.

- The existing detector thresholds are provisional. New calibration thresholds and reason codes must remain explicit and versioned so the user's later physical corpus work can tune them without changing generated form geometry.
