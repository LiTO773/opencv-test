# 07 — Phase 3B: Add visual question review

**What to build:** Make the mobile grading result visually inspectable. The teacher must be able to switch between the clean canonical crop and an annotated view, relate colored bubble decisions to a question-by-question result, and understand detected versus correct answers without changing any answers.

**Blocked by:** 06 — Phase 3A: Grade a captured sheet in the mobile app.

**Status:** ready-for-agent

- [ ] The clean canonical crop remains available as an unannotated view.
- [ ] A separate annotated view renders schema-aligned bubble overlays without modifying the clean JPEG.
- [ ] Correct selections/questions use a consistent success color, incorrect selections/questions use an error color, needs-review regions use a warning color, and unselected bubbles remain visually subordinate.
- [ ] Overlays remain aligned when the image is fitted or zoomed in the result interface.
- [ ] The question list displays question identity, detected answer labels, correct answer labels, awarded points, pending points, confidence, and status.
- [ ] Single-choice and multiple-choice results are understandable without reading raw bubble IDs.
- [ ] Selecting or inspecting a question makes its corresponding bubble regions easy to locate on the annotated image.
- [ ] Needs-review questions show concise human-readable reasons while retaining structured reason codes for diagnostics.
- [ ] The clean share action always shares the unannotated JPEG, never the diagnostic overlay.
- [ ] The interface remains usable for approximately 50 questions on the target iPhone.
- [ ] Review is display-only; no manual answer correction, persistence, or backend behavior is added.
- [ ] Existing TypeScript, lint, and iOS production-bundle checks pass.
- [ ] Work stops after visual review is demoable; full raw diagnostic logs remain for Ticket 08.
