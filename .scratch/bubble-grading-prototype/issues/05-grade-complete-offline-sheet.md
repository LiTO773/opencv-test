# 05 — Phase 2B: Grade the complete offline sheet

**What to build:** Turn bubble diagnostics into a complete offline grading result. Questions must be graded by exact selected-set equality, uncertain measurements must produce review-pending points with explicit reasons, and both the overlay and machine-readable result must explain the complete score.

**Blocked by:** 04 — Phase 2A: Measure bubbles and emit diagnostics.

**Status:** ready-for-agent

- [ ] Bubble decisions are grouped into the questions and answer identities declared by the validated schema.
- [ ] Single-choice and multiple-choice questions both use exact set equality against `correctBubbleIds`.
- [ ] A clear exact match is correct and receives the question's integer points.
- [ ] A clear missing selection, blank response, or clear extra selection is incorrect and receives zero points.
- [ ] A clearly filled unexpected extra bubble is incorrect rather than needs review.
- [ ] Any uncertain bubble capable of changing a question outcome makes that question needs review with explicit contributing reasons.
- [ ] Review-pending points are reported separately from graded points and are not silently awarded or zeroed.
- [ ] The grading result includes maximum points, awarded graded points, pending-review points, and correct/incorrect/review counts.
- [ ] Every question result includes detected filled IDs, correct IDs, status, awarded points, pending points, confidence, and reasons.
- [ ] `result.json` contains the complete scan, bubble, question, and score result without losing Ticket 04's raw diagnostics.
- [ ] `output.png` displays question-level correct, incorrect, or needs-review status alongside bubble measurements.
- [ ] Tests cover exact single answers, exact multiple answers, blanks, missing answers, extra answers, multiple uncertain bubbles, and provisional score totals.
- [ ] A representative schema of approximately 50 questions and up to roughly 250 bubbles completes with recorded timing and without pathological memory use.
- [ ] Existing TypeScript and lint checks pass.
- [ ] Work stops after the offline grading result is reproducible; the mobile app is not modified in this ticket.
