# Real-time document detector

A mobile-only Expo SDK 57 prototype that detects a marked A4 document directly in the live camera feed. It adapts the OpenCV pipeline from Łukasz Kurant's real-time document-detection article to the current VisionCamera 5 packages.

Each valid page has three evenly spaced black squares in each vertical margin. Sampled preview frames are resized on the GPU, converted into an adaptive binary image, and searched for square contours. A page is considered ready only when six candidates form two aligned, evenly spaced triplets, the detected corners remain within a small movement tolerance for five analyzed frames, and a Laplacian-based score says the central answer area is sharp. The preview coordinates are never reused for the final crop. Once ready, the app captures a QHD still photograph, applies its physical orientation, and detects the six markers and sharpness again on that exact photograph. A failed final quality check automatically returns to scanning.

The inward-facing corners detected in the accepted still photograph create a perspective- and rotation-corrected 840 × 1188 image (four pixels per A4 millimetre). A one-millimetre white edge masks any marker interpolation left at the boundary. The normalized image is then scanned locally for a QR code; JSON payloads are parsed while non-JSON payloads remain available as raw text. An upside-down page is automatically rotated 180 degrees using the QR orientation. The camera pauses while the result and metadata are displayed in a zoomable full-screen modal.

The QR describes the individual sheet only. Bubble positions and the answer key come from a separately preloaded `TestSchema` in `src/features/document-scanner/test-schema.ts`. Its coordinates use PDF points and explicitly declare whether the PDF origin is at the top-left or bottom-left.

## Preview a grading schema

Put a normalized OpenCV capture at `photo.png`, edit the hardcoded schema in `tools/schema-preview/schema.ts`, and run:

```bash
pnpm schema:preview
```

This creates `output.png` with bright overlays for the QR region, marker anchors, bubble outlines, centres, labels, point coordinates, and correct answers. You can also pass custom paths:

```bash
pnpm schema:preview -- path/to/photo.png path/to/output.png
```

`captureAnchorsPt` must contain the PDF positions of the four points represented by the OpenCV image corners in visual TL, TR, BR, BL order. This mapping is what makes whole-page PDF coordinates line up with a crop taken inside the black markers.

On devices with a torch, the glass flash control can illuminate the document while scanning. The torch is turned off while the camera is paused for the captured-content modal.

All image processing stays on the device. There is no web target, server, upload, or browser fallback.

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
```

Static checks do not validate the native JSI/worklet boundary. Before production, test on representative iOS and Android hardware with varied page sizes, backgrounds, lighting, shadows, glare, and camera orientations. Marker thresholds live in `src/features/document-scanner/document-detection.ts`; stability and sharpness thresholds live near the top of `src/features/document-scanner/document-camera.tsx`.
