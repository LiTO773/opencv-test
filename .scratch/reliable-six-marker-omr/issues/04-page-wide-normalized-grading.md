# 04 — Grade bubbles using page-wide illumination normalization

**What to build:** Bubble grading must consume explicit page-calibration evidence and classify marks on an exposure-normalized scale, producing stable answer decisions under supported page-wide exposure and illumination changes while preserving safe uncertainty behavior.

**Blocked by:** 03 — Extract and validate page-wide calibration references.

**Status:** ready-for-agent

- [ ] The deterministic grading boundary accepts validated page-calibration evidence explicitly and does not depend on hidden camera or image state.
- [ ] A bounded linear or piecewise-linear illumination model estimates expected white and black levels at every canonical bubble location.
- [ ] Interpolation does not use an unstable high-order fit; behavior outside the central reference rows is bounded by the calibration contract.
- [ ] Bubble darkness is expressed relative to interpolated local white and black levels instead of raw grayscale exposure.
- [ ] Raw interior brightness and reference values remain available as diagnostic evidence even though they no longer control the primary exposure-dependent decision.
- [ ] Classification thresholds and calibration quality limits remain versioned detector configuration rather than generator-owned form geometry.
- [ ] Invalid or incomplete calibration cannot produce a confident graded result.
- [ ] Equivalent marked fixtures under supported uniform brightening, uniform dimming, left-to-right gradients, top-to-bottom gradients, and combined bounded gradients produce equivalent filled, unfilled, or uncertain decisions.
- [ ] Clipping, insufficient dynamic range, or unsupported illumination disagreement produces a safe capture-quality failure or review outcome rather than a confident false answer.
- [ ] Exact selected-set grading remains unchanged for single- and multiple-answer questions, including clear extra selections and outcome-changing uncertainty.
- [ ] Upright and upside-down forms produce equivalent calibrated grading results after orientation correction.
- [ ] Bubble, question, scan, and score diagnostics include interpolated reference levels, normalized darkness, confidence, reason codes, and calibration timing.
- [ ] Mobile and offline grading produce the same structured result from the same canonical pixels, schema, and calibration evidence.
- [ ] The representative approximately 50-question, 250-bubble fixture retains bounded region-of-interest work and records the added calibration/interpolation timing.
- [ ] Static checks and the complete detection, schema, grading, diagnostic, and workbench test suite pass.
