# 02 — Activate six-marker scanning and still validation

**What to build:** The mobile scanner must visibly find and require all six printed page markers before automatic capture, then independently require the same coherent six-marker layout on the accepted still photograph while preserving the existing canonical crop and grading pipeline.

**Blocked by:** 01 — Build the six-marker page-layout contract.

**Status:** ready-for-agent

- [ ] The active preview detector searches for and reports all six stable marker identities using the six-marker page-layout contract.
- [ ] Preview overlays communicate the six search regions, individual matches, and the complete page hypothesis without reintroducing QR false positives.
- [ ] Scanner status and marker counts use six as the complete layout; this sprint imposes no language requirement on new or changed messages.
- [ ] Automatic capture requires the configured number of consecutive preview analyses containing a coherent six-marker layout.
- [ ] Four outer markers without both middle markers never trigger automatic capture.
- [ ] The accepted still photograph is physically oriented and independently re-detected for all six markers; no preview coordinates are reused.
- [ ] Failed still validation resets capture state, disposes temporary native resources, returns to scanning, and provides a clear failure message.
- [ ] The outer inward marker corners still produce the established 875 × 1280 marker-free canonical crop.
- [ ] QR recognition, upside-down correction, torch behavior, camera lifecycle handling, and diagnostic-only QR identifiers continue to work.
- [ ] The camera preview remains live during capture, still validation, perspective correction, QR recognition, and grading.
- [ ] Preview and final-still detection exercise the same six-marker validity rules for equivalent evidence.
- [ ] Offline scanner visualization represents the same six marker regions, matched markers, complete layout, and outer crop used by mobile scanning.
- [ ] Existing and new automated checks pass without leaking image, frame, Skia, or OpenCV resources across repeated success and failure paths.
