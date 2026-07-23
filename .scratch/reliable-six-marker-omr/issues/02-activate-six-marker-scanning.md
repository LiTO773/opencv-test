# 02 — Add backend six-marker validation to the four-guide scanner

**What to build:** The mobile scanner must keep the existing four-corner alignment experience while silently requiring the complete six-marker page layout for automatic capture and independent still validation. The user must never be asked to align the two middle markers.

**Blocked by:** 01 — Build the six-marker page-layout contract.

**Status:** ready-for-agent

- [ ] The active preview detector searches for all six stable marker identities internally using the six-marker page-layout contract.
- [ ] User-facing preview overlays show only the four outer corner search regions and their matches without exposing middle-marker alignment targets.
- [ ] Scanner status and marker counts present only the four outer markers and never exceed `4/4`; this sprint imposes no language requirement on new or changed messages.
- [ ] Once the four outer markers are aligned, the UI uses a neutral hold-steady or validating state while backend six-marker validation completes.
- [ ] Automatic capture requires the configured number of consecutive preview analyses containing a coherent six-marker layout.
- [ ] Four outer markers without both middle markers never trigger automatic capture, but the UI does not instruct the user to align missing middle markers.
- [ ] The accepted still photograph is physically oriented and independently re-detected for all six markers; no preview coordinates are reused.
- [ ] Failed still validation resets capture state, disposes temporary native resources, returns to scanning, and provides a clear failure message.
- [ ] The outer inward marker corners still produce the established 875 × 1280 marker-free canonical crop.
- [ ] QR recognition, upside-down correction, torch behavior, camera lifecycle handling, and diagnostic-only QR identifiers continue to work.
- [ ] The camera preview remains live during capture, still validation, perspective correction, QR recognition, and grading.
- [ ] Preview and final-still detection exercise the same six-marker validity rules for equivalent evidence.
- [ ] Technical diagnostics and offline scanner visualization may expose all six marker regions, matched markers, complete layout, and outer crop for backend verification.
- [ ] Automated UI behavior verifies that a user sees four guides and at most a `4/4` count while internal capture readiness still depends on six markers.
- [ ] Existing and new automated checks pass without leaking image, frame, Skia, or OpenCV resources across repeated success and failure paths.
