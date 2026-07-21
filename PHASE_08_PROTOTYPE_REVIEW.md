# Phase 08 prototype review

This phase ends the bubble-grading prototype. It does not add persistence,
manual correction, remote schema lookup, backend integration, OCR, Android
polish, or recognition of marks other than filled circles.

## Inspect diagnostics on the target iPhone

After a sheet is captured and graded, open **Diagnósticos técnicos** on the
result screen. It is collapsed by default. The scan record shows the measured
and expected canonical dimensions, QR identifiers, detector identity, global
quality findings, total analysis time, bubble count, and scan reason codes.

The nested **Bolhas** record shows the expected and measured center, applied
adjustment, every measurement radius, raw brightness/contrast/focus evidence,
the thresholds used, confidence, decision, timing, and stable reason codes for
each bubble. The nested **Perguntas** record shows detected and correct bubble
IDs, exact-set equality, status, awarded/pending/maximum points, confidence,
decision reasons, and the reasons contributed by affected bubbles. Every
stable code is displayed beside a Portuguese explanation.

## Tune provisional detector thresholds

The only detector thresholds are in
`src/features/bubble-grading/bubble-detector-config.ts`. They are deliberately
separate from generated schemas. Edit the exported
`PROVISIONAL_BUBBLE_DETECTOR_CONFIG`, reload the JavaScript bundle, recapture
the same physical sheets, and compare the diagnostic measurements and
decisions. Change the `id` whenever a calibration set changes so diagnostic
output can identify the exact configuration that produced it.

The current numeric values are seed values for physical calibration only. They
are not production-ready accuracy claims. Tune one variable at a time against
known examples of blank paper, clean empty bubbles, clearly filled bubbles,
borderline fills, uneven lighting, shadows, and blur:

- `darkPixelDelta` controls how much darker an interior pixel must be than its
  local paper ring before it counts as dark.
- `unfilledMaxDarkPixelRatio` is the upper edge of the clearly empty band.
- `filledMinDarkPixelRatio` is the lower edge of the clearly filled band. The
  gap between it and the empty limit remains the uncertain band.
- `minimumBackgroundBrightness` and `minimumMarkedContrast` guard poor local
  illumination and weak marks.
- `minimumFocusScore` guards blurred bubble regions.

Remaining calibration TODOs are to collect representative measurements on the
actual printer, paper, pens, and target iPhone; choose thresholds from that
evidence; repeat the exercise across lighting and capture distances; and decide
whether the provisional focus and contrast metrics are sufficient. Do not set
`provisional` to false as part of this prototype.

## Physical-iPhone verification checklist

Static checks cannot complete these hardware acceptance checks. Use a real
approximately 50-question sheet with up to roughly 250 bubbles and keep the
diagnostic section open while recording timing.

- Capture a sharp, normally lit sheet and confirm total analysis timing and all
  per-bubble timings are visible.
- Capture deliberately blurry and low-contrast sheets. Confirm the clean image,
  provisional score, affected questions, stable codes, and explanations remain
  visible.
- Include a clearly filled extra selection and confirm it is **incorrect** with
  `extra_selection`, not **needs review**.
- Repeat scans at several distances and perspectives. Confirm every accepted
  crop is 875 × 1280 px with stable marker-free boundaries.
- Confirm `studentId`, `sheetId`, `testId`, and `schemaVersion` match the QR and
  do not select or reject the hardcoded schema.
- Confirm score, correct/incorrect/review counts, clean and annotated views,
  per-question answers, and locate-on-image behavior.
- Share the clean JPEG and confirm the shared file contains no diagnostic
  overlay and uses the preferred sheet-derived filename when available.
- Repeat threshold changes only in the detector configuration file and confirm
  generated schema files remain untouched.

Record the device model, iOS version, detector `id`, page size, bubble count,
total analysis time, and any failed observation during the final sprint review.
