# Real-time document detector

A mobile-only Expo SDK 57 prototype that detects a marked A4 document directly in the live camera feed. It adapts the OpenCV pipeline from Łukasz Kurant's real-time document-detection article to the current VisionCamera 5 packages.

Each valid page has three evenly spaced black squares in each vertical margin. Sampled frames are resized on the GPU, converted into an adaptive binary image, and searched for square contours. A page is accepted only when six candidates form two aligned, evenly spaced triplets with consistent cross-page rows and A4-like proportions. The first successful detection freezes processing and uses the inward-facing corners of the four outer markers to create a standalone, perspective-corrected JPEG from the camera's stable CPU snapshot. The camera then pauses while the crop is displayed in a zoomable full-screen modal. Closing the modal starts a fresh scanning session.

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

Static checks do not validate the native JSI/worklet boundary. Before production, test on representative iOS and Android hardware with varied page sizes, backgrounds, lighting, shadows, glare, and camera orientations. Detection thresholds live in `src/features/document-scanner/document-detection.ts`.
