# 02 — Phase 1: Build the visual schema workbench

**What to build:** Give the PDF-generator developer a watch-mode visual workbench that proves a generated canonical-pixel schema against a real shared scan. Editing the TypeScript schema or replacing the fixed input image must immediately regenerate a bright overlay showing exactly where every declared region lands. The same work introduces the shared schema contract and an exhaustive validator used later by both the app and grader.

**Blocked by:** 01 — Phase 0A: Produce and share a marker-free crop.

**Status:** ready-for-agent

- [ ] A shared schema model describes a format version, test identity and version, canonical image metadata, QR region, global bubble style, questions, selection mode, integer points, correct bubble identifiers, labels, and bubble centers.
- [ ] Schema image coordinates use a top-left origin and canonical crop pixels only.
- [ ] The schema contains no PDF points, millimetres, page margins, crop anchors, or marker locations.
- [ ] The global bubble style declares ROI radius, fill radius, background-ring inner radius, background-ring outer radius, and center-search tolerance.
- [ ] A reusable runtime validator returns every discovered problem in one result rather than stopping at the first failure.
- [ ] Validation covers supported format version, positive integer image dimensions, top-left origin, positive and logically ordered radii, non-negative search tolerance, integer points, supported selection modes, unique IDs, valid correct-answer references, image bounds, complete ROI bounds, overlapping measurement regions, and QR bounds.
- [ ] The workbench consumes fixed `input.jpg` and `schema.ts` inputs and produces `output.png` without requiring positional command-line arguments.
- [ ] `pnpm schema:preview --watch` stays running and regenerates when either the input image or imported TypeScript schema changes.
- [ ] Until canonical dimensions are finalized, the workbench can use the actual input-image dimensions for visual iteration while making the unresolved global dimensions explicit.
- [ ] The bright overlay draws the QR region, bubble ROI, printed circumference, fill-measurement disk, local-background ring, center crosshair, question/answer label, correct-answer indicator, and source pixel coordinates.
- [ ] Different questions are visually distinguishable without hiding the underlying scan.
- [ ] Crop anchors are not drawn because the input is already the marker-free crop.
- [ ] Invalid schemas print every validation error with an understandable schema location and do not silently produce a misleading successful preview.
- [ ] The existing schema-preview capability is evolved rather than replaced with a second competing format.
- [ ] External behavior is verified with at least one valid schema and fixtures containing multiple simultaneous validation errors.
- [ ] Existing TypeScript and lint checks pass.
- [ ] Work stops once the developer can visually iterate on generator output; bubble fill detection is not started.
