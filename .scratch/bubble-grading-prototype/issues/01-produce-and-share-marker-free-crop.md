# 01 — Phase 0A: Produce and share a marker-free crop

**What to build:** Make the existing four-point scanner produce a clean, upright crop suitable for schema-development work. The sheet still contains six markers, but only the four outer markers control capture. The crop must exclude both marker columns while preserving the full vertical span, and the resulting JPEG must be shareable from the iPhone. This ticket deliberately does not guess or finalize the unresolved canonical dimensions.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The live scanner continues to detect only the top-left, top-right, bottom-left, and bottom-right markers independently inside their existing forgiving regions.
- [ ] The two middle markers do not participate in capture or crop calculation.
- [ ] The crop uses named marker corners as its authoritative geometry: top-right of the top-left marker, top-left of the top-right marker, bottom-left of the bottom-right marker, and bottom-right of the bottom-left marker.
- [ ] The resulting crop removes both side-marker columns, including the two middle markers, without shortening the intended vertical span.
- [ ] The final still photograph re-detects and validates all four outer markers; preview coordinates are not reused as final crop coordinates.
- [ ] A still photograph whose four-marker arrangement is no longer valid returns the user to scanning with an understandable error.
- [ ] QR decoding and automatic upside-down correction continue to work on the new crop.
- [ ] The result exposes `studentId` when the QR payload contains it while retaining the remaining QR fields in diagnostics.
- [ ] The result screen provides an iOS share action for the clean JPEG.
- [ ] The preferred shared filename uses `sheetId`; a timestamp is used when it is unavailable.
- [ ] The shared image is clean, upright, perspective-corrected, and contains no diagnostic overlay.
- [ ] Canonical crop width and height remain clearly identified global TODO values and are not guessed in this ticket.
- [ ] Existing TypeScript, lint, and iOS production-bundle checks pass.
- [ ] Work stops after this shareable marker-free crop is demoable; schema workbench or bubble grading work is not started.
