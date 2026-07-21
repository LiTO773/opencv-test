# 06 — Phase 3A: Grade a captured sheet in the mobile app

**What to build:** Connect the canonical iPhone capture to the same hardcoded schema and grading behavior proven offline. After a successful scan, the teacher must see the identified student and a complete summary of the exact-set grade, including provisional points when review is required.

**Blocked by:** 05 — Phase 2B: Grade the complete offline sheet.

**Status:** ready-for-agent

- [ ] The mobile app uses one hardcoded schema conforming to the shared validated contract.
- [ ] The schema is validated before mobile grading and all validation failures are presented explicitly.
- [ ] The canonical captured image must exactly match the schema dimensions; no silent resizing is introduced.
- [ ] The mobile analysis produces the same diagnostic and grading-result shape as the offline workbench.
- [ ] The result identifies the student from QR `studentId` when available.
- [ ] `sheetId`, `testId`, and `schemaVersion` remain available in diagnostics but do not retrieve schemas or reject the prototype scan.
- [ ] The first mobile grading result shows maximum points, awarded graded points, pending-review points, and correct/incorrect/review counts.
- [ ] Exact single and multiple selections receive the same outcomes as the offline grader.
- [ ] A globally blurry or low-contrast image remains visible as a provisional result with explicit review reasons.
- [ ] Grading failures do not destroy the clean canonical image or QR metadata needed for diagnosis.
- [ ] Closing the result returns to a fresh scan; no grade is persisted.
- [ ] Mobile result behavior is exercised with deterministic grading-result fixtures in addition to manual camera testing.
- [ ] Existing TypeScript, lint, and iOS production-bundle checks pass.
- [ ] Work stops after the end-to-end mobile score summary is demoable; detailed visual review and expandable logs remain for later tickets.
