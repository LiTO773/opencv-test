# Bubble Grading Prototype Sprint Specification

> Performance refinement: the mobile result JPEG, image sharing, and annotated
> mobile image were removed from the capture hot path after the prototype. The
> app now retains structured grading results only and keeps the live preview
> active until recognition completes. The offline workbench remains visual.

## Problem Statement

Teachers need to grade custom bubble-answer sheets generated from the layout of each test. Traditional bubble graders assume a fixed vendor-owned form, but this product owns the PDF generator and can therefore know the exact location, size, question, answer label, and correct state of every bubble before scanning begins.

The current mobile prototype can detect four outer markers on a six-marker sheet, capture a still photograph, correct perspective, crop the page, decode QR metadata, and display the result. It does not yet guarantee a canonical marker-free crop, provide a convenient way to share that crop, validate a plug-and-play grading schema, measure filled bubbles, grade exact answer sets, or explain uncertain decisions.

The PDF generator lives in a separate repository. During this prototype sprint, the developer needs a visual schema workbench that makes generator output understandable without manually guessing coordinates. A real scanned crop and a TypeScript schema must produce an immediately refreshed diagnostic image showing exactly where every schema element lands.

The prototype must favor transparency over silent guesses. Bubble measurements, thresholds, confidence, review conditions, and grading decisions must remain inspectable in both offline diagnostics and the mobile app.

## Solution

Build the prototype in four sequential phases.

Phase 0 will make the existing four-point capture produce a fixed-size, upright, perspective-corrected, marker-free canonical image. The sheet contains six markers in three rows along the two sides, but only the four outer markers will control capture. The crop will exclude both marker columns while preserving the full vertical span. The clean canonical JPEG will be shareable from the iPhone for use as the schema workbench input.

Phase 1 will establish a shared plug-and-play pixel schema and an exhaustive runtime validator. A watch-mode schema workbench will consume fixed `input.jpg` and `schema.ts` inputs and regenerate `output.png` whenever either changes. The output will use bright overlays to show the QR region, bubble geometry, centers, labels, coordinates, measurement regions, and correct answers. The PDF generator will perform all PDF-to-canonical-pixel conversion; neither the mobile app nor OpenCV will understand PDF units.

Phase 2 will extend the same workbench with bubble measurements. OpenCV will inspect only the small regions declared by the schema, compare bubble-interior darkness with nearby known-white paper, classify each bubble as filled, unfilled, or uncertain, annotate `output.png`, and write a machine-readable `result.json` containing measurements and explicit reasons.

Phase 3 will integrate the same grading behavior into the mobile app. Answers will be graded using exact set equality. Uncertain measurements will produce a provisional score and a needs-review result. The app will show the student identity, score, per-question decisions, clean crop, colored diagnostic overlay, and expandable logs. The prototype will not persist results or allow manual correction.

## User Stories

1. As a teacher, I want the app to scan my custom answer sheet, so that I am not restricted to a vendor-owned fixed form.
2. As a teacher, I want the app to identify the student from the QR code, so that I know whose answers are being graded.
3. As a teacher, I want to see the total score and maximum score, so that I can understand the result immediately.
4. As a teacher, I want to see counts of correct, incorrect, and needs-review questions, so that I can assess result quality quickly.
5. As a teacher, I want grading to require an exact answer-set match, so that extra or missing selections are not incorrectly accepted.
6. As a teacher, I want clearly filled extra bubbles to make an answer incorrect, so that the grader follows the same rule as the answer key.
7. As a teacher, I want uncertain marks to be identified rather than guessed, so that automation does not silently introduce grading errors.
8. As a teacher, I want a provisional score when questions need review, so that uncertain points are not silently treated as zero.
9. As a teacher, I want each review condition explained, so that I can understand why the app lacked confidence.
10. As a teacher, I want to inspect detected and correct answers question by question, so that I can verify the grading logic.
11. As a teacher, I want colored bubble overlays on the captured sheet, so that I can visually connect grading decisions to marks on paper.
12. As a teacher, I want the clean crop to remain available separately from diagnostics, so that I can retain or share an unannotated scan.
13. As a teacher, I want to share the clean canonical JPEG, so that I can use it in the schema workbench and other prototype workflows.
14. As a teacher, I want an entirely blurry or low-contrast scan to remain visible with explicit warnings, so that prototype diagnostics are not discarded.
15. As a teacher, I want blank answers to be worth zero, so that unattempted questions follow the grading rules.
16. As a teacher, I want single-choice and multiple-choice questions supported, so that generated tests can contain both forms.
17. As a teacher, I want multiple-choice answers to match the complete correct set, so that partial selections are not accepted.
18. As a teacher, I want integer point values in the prototype, so that scoring remains simple and predictable.
19. As a PDF-generator developer, I want to export bubble coordinates directly in canonical crop pixels, so that the app can consume the schema without layout conversion.
20. As a PDF-generator developer, I want a TypeScript schema during development, so that generator output is typed and easy to edit or replace.
21. As a PDF-generator developer, I want to place a real shared scan at a fixed input filename, so that testing the generator requires no command-line argument setup.
22. As a PDF-generator developer, I want the preview command to run in watch mode, so that coordinate changes are visible immediately.
23. As a PDF-generator developer, I want the preview to regenerate when either the schema or input image changes, so that both layout and capture iterations remain fast.
24. As a PDF-generator developer, I want a bright output overlay, so that incorrect coordinates are visually obvious.
25. As a PDF-generator developer, I want every bubble center and circumference displayed, so that I can confirm generator placement precisely.
26. As a PDF-generator developer, I want the fill-measurement disk displayed, so that I can see which interior pixels OpenCV will score.
27. As a PDF-generator developer, I want the local-background ring displayed, so that I can ensure it samples clear white paper.
28. As a PDF-generator developer, I want the complete bubble ROI displayed, so that I can verify labels and nearby lines do not contaminate analysis.
29. As a PDF-generator developer, I want question and answer labels displayed beside bubbles, so that I can detect ordering or identity mistakes.
30. As a PDF-generator developer, I want correct-answer indicators displayed, so that I can validate answer-key generation.
31. As a PDF-generator developer, I want original pixel coordinates printed on the overlay, so that I can relate visual errors back to generator output.
32. As a PDF-generator developer, I want the QR region displayed, so that I can validate its canonical location.
33. As a PDF-generator developer, I want every schema validation problem returned together, so that I can correct a batch of generator errors in one iteration.
34. As an app developer, I want one shared schema contract, so that the app, validator, preview tool, analyzer, and grader interpret generator output consistently.
35. As an app developer, I want malformed schemas rejected before grading, so that invalid coordinates do not produce plausible but incorrect results.
36. As an app developer, I want duplicate question and bubble identifiers rejected, so that grading results remain unambiguous.
37. As an app developer, I want unknown correct-answer identifiers rejected, so that an invalid answer key cannot enter grading.
38. As an app developer, I want out-of-bounds and overlapping measurement regions rejected, so that OpenCV never reads invalid or contaminated image regions.
39. As an app developer, I want canonical image-dimension mismatches rejected, so that broken crop/schema contracts are not hidden by automatic resizing.
40. As an app developer, I want bubble analysis limited to known small regions, so that processing remains fast enough for approximately 50 questions on an iPhone.
41. As an app developer, I want all bubbles to share one declared visual style, so that the initial detector remains simple and consistent.
42. As an app developer, I want local paper brightness measured around each bubble, so that shadows and illumination differences affect grading less.
43. As an app developer, I want a small declared center-search tolerance, so that tiny printing and crop offsets do not cause false results.
44. As an app developer, I want fill thresholds centralized outside the generated schema, so that camera-dependent calibration does not leak into the PDF generator.
45. As an app developer, I want the offline and mobile graders to emit the same structured diagnostics, so that they never explain the same mark differently.
46. As an app developer, I want a machine-readable grading result, so that detector behavior can be compared and debugged reproducibly.
47. As an app developer, I want timing data available when needed for a page containing up to roughly 250 bubbles, so that performance regressions can be understood.
48. As an app developer, I want the final still photograph to re-detect the capture markers, so that the crop is based on the actual saved image rather than stale preview coordinates.
49. As an app developer, I want the diagnostic logs to include raw measurements and triggered reasons, so that threshold tuning is evidence-based.
50. As a student, I want my clearly filled answers interpreted consistently, so that camera distance and page perspective do not change my grade.

## Implementation Decisions

- The sprint is a prototype with no fixed timebox. Work proceeds by phase until the agreed external behavior is complete.
- The prototype targets the user's current iPhone. Android proof is not required.
- Each sheet contains exactly one page and six fixed black markers: top, middle, and bottom on both side margins.
- Live scanning continues to use only the four outer markers. Each marker is detected independently inside a forgiving region of interest.
- The two middle markers do not participate in the initial detector or crop calculation.
- Marker numbering will not be used to describe crop geometry because it proved ambiguous. Named marker corners are authoritative.
- The canonical crop corners are the top-right corner of the top-left marker, top-left corner of the top-right marker, bottom-left corner of the bottom-right marker, and bottom-right corner of the bottom-left marker.
- This crop removes both marker columns, including the two middle markers, while retaining the vertical span from the outer top marker edges to the outer bottom marker edges.
- The final still photograph re-detects the markers. If the saved image no longer contains a valid four-marker arrangement, the app returns to scanning instead of using preview coordinates.
- Every accepted crop is perspective-corrected to fixed canonical pixel dimensions. Dynamic output dimensions are not used for grading.
- Canonical crop width and height remain explicit global TODO values until the schema workbench helps establish the correct generator-to-crop contract.
- Pixel density begins at 4 pixels per millimetre and remains a centralized global setting that can change later.
- Unknown physical crop measurements do not block the schema workbench. Before canonical dimensions are finalized, the workbench uses the actual `input.jpg` dimensions for visual iteration.
- The physical aspect ratio of the final crop must be preserved so that printed circles remain circles rather than becoming ellipses.
- The clean canonical image is upright, contains no diagnostic overlays, and does not show marker pixels.
- The clean image is shareable as JPEG through the native share sheet. Its preferred filename uses `sheetId`, with a timestamp fallback.
- QR payloads contain `sheetId`, `studentId`, `testId`, and `schemaVersion`.
- The prototype uses `studentId` for presentation. The other QR fields are retained in diagnostics but do not select or retrieve schemas and do not reject the scan.
- The app uses one hardcoded schema during this sprint. Production schema delivery, lookup, and backend concerns are deliberately ignored.
- The schema workbench uses a TypeScript module exporting one schema object. Production JSON is not part of this sprint.
- The PDF generator owns all conversion from PDF layout coordinates into canonical crop pixels.
- The schema consumed by the app contains no PDF points, millimetres, page margins, crop anchors, or marker locations.
- Canonical schema coordinates use a top-left origin and are expressed directly in pixels of the final fixed-size crop.
- The schema declares a format version, test identity and version, canonical image dimensions, pixel density metadata, QR region, global bubble style, questions, selection mode, integer point values, correct bubble identifiers, labels, and bubble centers.
- All initial bubbles share one radius, printed outline width, measurement geometry, and surrounding clear-white halo.
- The global bubble style declares the ROI radius, fill-measurement radius, local-background ring inner and outer radii, and center-search tolerance.
- The ROI radius defines the small patch extracted around a bubble.
- The fill radius defines the interior disk scored for student ink and excludes the permanently printed outline.
- The local-background ring measures nearby paper brightness and must lie in generator-guaranteed clear whitespace.
- The center-search tolerance permits only a small local adjustment for minor printing and cropping errors; it does not turn grading into whole-page bubble discovery.
- The generated schema does not contain filled/unfilled thresholds. Those values depend on cameras, lighting, paper, and pen behavior and remain centralized detector configuration.
- Runtime schema validation returns every discovered error in one result rather than throwing only the first error.
- Validation covers supported format version, positive integer image dimensions, top-left origin, positive and logically ordered bubble radii, non-negative search tolerance, unique IDs, valid correct-answer references, integer points, supported selection modes, coordinates within the image, complete ROIs within the image, non-overlapping measurement regions, and QR bounds.
- The app and workbench both run the same validator before analysis.
- Invalid schemas block grading. Image-dimension mismatches are rejected rather than silently resized.
- The schema workbench uses fixed input names: `input.jpg` and `schema.ts`; it writes `output.png` and later `result.json`.
- The workbench is run through `pnpm schema:preview --watch` and regenerates when either the TypeScript schema or input image changes.
- Phase 1 overlay output includes the QR region, bubble ROI, printed circumference, fill disk, background ring, center crosshair, question/answer label, correct-answer indicator, and source pixel coordinates.
- Phase 1 does not display crop anchors because its input is already the canonical crop and the marker geometry is intentionally absent from the schema.
- Phase 2 extends the same workbench instead of introducing a competing coordinate-preview format.
- Bubble analysis does not search the page for circles and does not initially use Hough circle detection. Known schema positions are the primary registration mechanism.
- Each bubble patch is converted to grayscale and locally normalized or thresholded. The detector measures interior darkness, dark-pixel ratio, nearby background brightness, contrast, and confidence.
- The detector produces three bubble states: filled, unfilled, and uncertain.
- Decision configuration uses a clearly-unfilled band, a clearly-filled band, and an uncertain band between them. Exact numeric thresholds remain TODOs until manual physical-sheet testing supplies evidence.
- A score close to a decision boundary, poor local contrast, excessive blur, or incomplete measurement region triggers needs review with explicit reasons.
- A clearly filled unexpected extra bubble is not uncertain. It produces a confidently incorrect exact-set answer.
- The offline analyzer writes `result.json` containing scan diagnostics, bubble measurements, bubble decisions, question decisions, scores, confidence, timing, and review reasons.
- The offline diagnostic overlay prints fill score, local background score, filled/unfilled/uncertain decision, confidence, and question-level result or needs-review state.
- Grading uses exact set equality for both single-choice and multiple-choice questions.
- Blank answers receive zero points.
- Partial credit is not supported. Points are integers.
- A needs-review question does not silently receive zero. The displayed score separates graded points from points pending review.
- The mobile result presents student identity, total and maximum score, correct/incorrect/review counts, clean crop, colored diagnostic overlay, question-by-question detected and correct answers, and expandable diagnostics.
- In-app diagnostics show bubble identity, pixel center, measurement radii, interior brightness, background brightness, dark-pixel ratio, contrast, thresholds, confidence, final decision, timing where useful, and every triggered review reason.
- The annotated mobile view may be rendered as an overlay rather than encoded as a second file. Only the clean crop must be shareable.
- A globally poor-quality image remains visible during the prototype and receives explicit provisional/review diagnostics rather than being discarded immediately.
- The intended page size is approximately 50 questions, potentially around 250 bubble patches depending on answer count. Analysis must remain ROI-based and avoid unnecessary whole-image passes.

## Testing Decisions

- Tests will prioritize external behavior and stable data contracts rather than OpenCV call order, internal helper functions, exact morphology operations, or UI implementation details.
- The primary automated seam will accept a canonical image and validated schema and return one complete grading result containing bubble measurements, question decisions, score, and diagnostics. This is the highest-value seam because the offline tool and mobile app must agree at this boundary.
- Canonical capture is a separate hardware-facing seam: a captured still should yield either a valid fixed-size marker-free scan with QR metadata or a documented rejection that returns to scanning.
- The schema workbench is an integration seam: fixed image and schema inputs should produce either an overlay plus diagnostic result or an exhaustive validation report.
- Mobile result presentation is tested against complete grading-result fixtures rather than by invoking OpenCV through the UI.
- Schema validator tests cover valid schemas and multiple simultaneous failures so the complete error list is observable.
- Schema validation cases include duplicate IDs, missing correct answers, unknown correct-answer IDs, unsupported selection modes, fractional points, invalid radii ordering, negative tolerance, QR or bubble bounds outside the image, overlapping measurement regions, and image-dimension mismatch.
- Grading behavior tests cover exact single selections, exact multiple selections, missing selections, clear extra selections, blanks, uncertain bubbles, and questions containing multiple uncertain bubbles.
- A clear extra selection is asserted as incorrect rather than needs review.
- Provisional score tests assert that review-pending points are reported separately rather than awarded or silently zeroed.
- Diagnostic-result tests assert the presence of measurements, thresholds, confidence, timing when enabled, and explicit reason codes without relying on exact prose formatting.
- Workbench tests verify that overlay output contains all schema-defined regions and that the generated result uses the same bubble/question identities as the schema.
- Watch behavior is verified at the command level by changing both schema and image inputs and observing regenerated output.
- Capture acceptance is manually verified on the target iPhone with repeated camera distances and perspectives. Every accepted image must have identical pixel dimensions and consistent marker-free content boundaries.
- Sharing is manually verified through the iOS share sheet, including the preferred QR-derived filename and timestamp fallback.
- Bubble quality testing and threshold calibration are performed manually by the user during the sprint.
- Manual sheets should cover empty bubbles, clearly filled pen circles, different fill densities, extra selections, blank questions, uneven light, shadows, blur, and slightly shifted printing.
- A representative 50-question page is used to assess grading latency, diagnostic rendering, and expandable-log responsiveness on the target iPhone.
- Existing prior art includes the current Sharp-based schema overlay generator, the QR metadata parser, still-photo perspective correction, TypeScript checking, Expo linting, and iOS Metro export. The repository does not currently provide an automated test runner, so adding one is permitted only if required to exercise the agreed high-level seams.
- Manual quality testing remains the acceptance authority for computer-vision accuracy in this prototype; automated checks protect deterministic schema, grading, and diagnostic behavior.

## Out of Scope

- Production schema retrieval, APIs, backends, authentication, or synchronization.
- Publishing the spec or implementation work to GitHub or any issue tracker.
- Persistent grade history or local result storage.
- Manual answer correction or teacher overrides.
- Android validation or Android-specific polish.
- Multiple-page tests.
- Partial-credit scoring.
- Decimal point values.
- Student identification methods other than QR metadata.
- Rejecting scans because QR `testId` or `schemaVersion` differs from the hardcoded schema.
- Embedding or retrieving the answer key through the QR code.
- Tick, cross, checkmark, erasure, handwriting, or arbitrary pen-mark recognition beyond filled circles.
- OCR or handwriting recognition.
- Whole-page bubble discovery for unknown layouts.
- Dynamic or per-test marker placement.
- Using the two middle markers for initial capture, curvature correction, or non-linear page dewarping.
- Production-grade anti-tampering or QR signature validation.
- Automated collection or labeling of a computer-vision quality dataset.
- Guessing the final canonical crop dimensions before the schema workbench provides enough evidence.
- Changes to the external PDF-generator repository as part of this codebase's implementation.

## Further Notes

- The schema workbench is a core product-development deliverable, not an optional test utility. Its purpose is to let a human visually understand and validate the external PDF generator's coordinate output without guessing.
- Canonical crop width and height are intentionally unresolved global TODOs. Their absence must not block Phase 1 visual schema development.
- The first workbench iteration reads the actual `input.jpg` dimensions. Once generator output and crop geometry are understood, those dimensions become the canonical fixed values used by both the hardcoded app schema and Phase 0 crop.
- Initial fill thresholds are also explicit TODOs. The diagnostic scores and manual physical-sheet testing will determine them.
- The app remains fully on-device during the prototype.
- The clean shared crop is the handoff artifact from mobile capture to the schema workbench.
- This specification records planning decisions only. It does not authorize implementation; implementation begins only after an explicit user request.
