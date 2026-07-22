# Real-time document detector

A mobile-only Expo SDK 57 prototype that detects a marked A4 document directly in the live camera feed. It adapts the OpenCV pipeline from Łukasz Kurant's real-time document-detection article to the current VisionCamera 5 packages.

Each valid page has three evenly spaced black squares in each vertical margin. Sampled preview frames are resized on the GPU, converted into an adaptive binary image, and searched for square contours. A page is considered ready only when six candidates form two aligned, evenly spaced triplets, the detected corners remain within a small movement tolerance for five analyzed frames, and a Laplacian-based score says the central answer area is sharp. The preview coordinates are never reused for the final crop. Once ready, the app captures a QHD still photograph, applies its physical orientation, and detects the six markers and sharpness again on that exact photograph. A failed final quality check automatically returns to scanning.

The inward-facing corners of the four outer markers detected in the accepted still photograph create perspective- and rotation-corrected 875 × 1280 pixels. Those user-reviewed dimensions and their aspect ratio are shared by the perspective surface and the hardcoded grading schema. Any schema/image dimension mismatch is reported as a canonical-contract error. QR recognition inspects only the schema-declared upright and 180-degree regions, and an upside-down page is automatically rotated before grading. The camera preview remains active through final validation and recognition and pauses only after the complete structured result is ready. The mobile hot path no longer creates or retains a JPEG/base64 copy of the canonical crop.

The result screen grades the hardcoded schema by exact selected-set equality,
keeps uncertain points pending, provides question-by-question decisions, and exposes
an expandable technical diagnostic record that is collapsed by default. See
[`PHASE_08_PROTOTYPE_REVIEW.md`](./PHASE_08_PROTOTYPE_REVIEW.md) for the
provisional detector calibration workflow and final physical-iPhone checklist.

The QR describes the individual sheet only. Bubble positions and the answer key use the shared schema contract in `src/features/bubble-grading/schema.ts`. All schema layout values use a top-left origin and pixels of the clean canonical crop; the app and OpenCV do not convert PDF units.

## Preview a grading schema

Put a clean 875 × 1280 shared scan at `tools/schema-preview/input.jpg`, edit the fixed TypeScript export in `tools/schema-preview/schema.ts`, and run:

```bash
pnpm schema:preview
```

This creates `tools/schema-preview/output.png` with bright measurement and decision overlays for the QR region and every expected bubble. Crop anchors are intentionally absent because `input.jpg` is already the marker-free crop.

```bash
pnpm schema:preview --watch
```

The workbench validates the fixed canonical image contract, writes the bright
measurement overlay to `tools/schema-preview/output.png`, and writes the same
platform-neutral bubble diagnostics to `tools/schema-preview/result.json`.

Watch mode stays running and refreshes whenever `input.jpg` or `schema.ts` changes. Invalid schemas print every discovered problem with its schema path and remove stale `output.png` and `result.json`. The canonical dimensions are fixed at 875 × 1280; an input mismatch is rejected instead of resized.

On devices with a torch, the glass flash control can illuminate the document while scanning. The torch is turned off during capture, recognition, and the result modal.

All image processing stays on the device. There is no web target, server, upload, or browser fallback.

### QR finder-pattern protection

The active four-point scanner deliberately prevents the metadata QR from being
mistaken for a page marker. OpenCV retrieves the full contour hierarchy and
rejects the QR finder pattern's nested black/white/black square family. The
scanner then retains several plausible squares in every corner region and
selects the four that form the strongest complete portrait-page layout, with an
additional penalty for barcode candidates displaced inward from the real outer
markers. These are complementary safeguards: hierarchy recognizes why a square
is QR-like, while whole-page scoring prevents any one corner from deciding the
crop independently.

## Run

This app cannot run in Expo Go because the camera, OpenCV, Skia, Nitro, and worklet packages contain native code. After native dependencies are installed, launch a development build on a physical device:

```bash
pnpm install
pnpm ios
```

Or use `pnpm android`. After the native app exists, `pnpm start` is enough for JavaScript-only iterations.

## Verification

```bash
npx tsc --noEmit
pnpm lint
pnpm schema:test
```

Static checks do not validate the native JSI/worklet boundary. Before production, test on representative iOS and Android hardware with varied page sizes, backgrounds, lighting, shadows, glare, and camera orientations. Active four-point marker thresholds and QR hierarchy filtering live in `src/features/four-point/four-point-detection.ts`; pure whole-page candidate scoring lives in `src/features/four-point/four-point-layout.ts`.

## Live desktop pipeline visualizer

The standalone Python workbench shows all twelve stages of the current scanner
and answer-grading pipeline at once. It reads the TypeScript schema, canonical
crop contract, and detector thresholds directly from this repository.

```bash
python3 -m venv .venv-opencv
source .venv-opencv/bin/activate
python -m pip install -r tools/requirements-opencv.txt
python tools/live_pipeline_visualizer.py --camera 0 --fullscreen
```

Continuity Camera landscape frames are rotated clockwise to portrait by
default. Press `r` to cycle through rotation choices if the selected iPhone
camera reports a different physical orientation. Use `--camera 1` (or another
index) if Continuity Camera is not camera zero. The controls shown in the
window can pause the live feed, toggle full screen, or save both the dashboard
and the current canonical crop. A still image or recorded video can be used for
repeatable debugging with `--input path/to/file`.

The workbench deliberately runs the complete path on each displayed frame. The
mobile app samples marker detection every second preview frame, requires two
consecutive valid layouts, captures a still, and repeats marker detection on
that still before continuing. QR decoding is the only implementation swap in
the desktop workbench: Python OpenCV is used instead of the app's `jsQR`; QR
metadata does not select the grading schema or change the answer key.
