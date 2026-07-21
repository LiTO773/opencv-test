# Real-time document detector

A mobile-only Expo SDK 57 prototype that detects a marked A4 document directly in the live camera feed. It adapts the OpenCV pipeline from Łukasz Kurant's real-time document-detection article to the current VisionCamera 5 packages.

Each valid page has three evenly spaced black squares in each vertical margin. Sampled preview frames are resized on the GPU, converted into an adaptive binary image, and searched for square contours. A page is considered ready only when six candidates form two aligned, evenly spaced triplets, the detected corners remain within a small movement tolerance for five analyzed frames, and a Laplacian-based score says the central answer area is sharp. The preview coordinates are never reused for the final crop. Once ready, the app captures a QHD still photograph, applies its physical orientation, and detects the six markers and sharpness again on that exact photograph. A failed final quality check automatically returns to scanning.

The inward-facing corners detected in the accepted still photograph create a perspective- and rotation-corrected 840 × 1188 image (four pixels per A4 millimetre). A one-millimetre white edge masks any marker interpolation left at the boundary. The normalized image is then scanned locally for a QR code; JSON payloads are parsed while non-JSON payloads remain available as raw text. An upside-down page is automatically rotated 180 degrees using the QR orientation. The camera pauses while the result and metadata are displayed in a zoomable full-screen modal.

The QR describes the individual sheet only. Bubble positions and the answer key use the shared schema contract in `src/features/bubble-grading/schema.ts`. All schema layout values use a top-left origin and pixels of the clean canonical crop; the app and OpenCV do not convert PDF units.

## Preview a grading schema

Put a clean shared scan at `tools/schema-preview/input.jpg`, edit the fixed TypeScript export in `tools/schema-preview/schema.ts`, and run:

```bash
pnpm schema:preview
```

This creates `tools/schema-preview/output.png` with bright, question-colored overlays for the QR region, bubble circles, centers, labels, source pixel coordinates, radii, and correct answers. Crop anchors are intentionally absent because `input.jpg` is already the marker-free crop.

```bash
pnpm schema:preview --watch
```

Watch mode stays running and refreshes whenever `input.jpg` or `schema.ts` changes. Invalid schemas print every discovered problem with its schema path and remove stale `output.png`. Until the canonical crop contract is finalized, `canonicalImage.dimensions.status` remains explicitly `unresolved` and the preview uses the actual JPEG dimensions. Once fixed, an input mismatch is rejected instead of resized.

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
pnpm schema:test
```

Static checks do not validate the native JSI/worklet boundary. Before production, test on representative iOS and Android hardware with varied page sizes, backgrounds, lighting, shadows, glare, and camera orientations. Marker thresholds live in `src/features/document-scanner/document-detection.ts`; stability and sharpness thresholds live near the top of `src/features/document-scanner/document-camera.tsx`.
