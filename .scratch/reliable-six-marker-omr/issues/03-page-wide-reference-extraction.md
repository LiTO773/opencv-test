# 03 — Extract and validate page-wide calibration references

**What to build:** Every accepted still must yield trustworthy page-wide calibration evidence by measuring all six black marker interiors and robustly sampling blank paper between adjacent markers. Unusable calibration must fail safely before a confident grade is produced.

**Blocked by:** 02 — Activate six-marker scanning and still validation.

**Status:** ready-for-agent

- [ ] Calibration sampling uses the accepted, physically oriented still photograph rather than preview pixels.
- [ ] Sampling occurs before the marker columns are excluded from the marker-free canonical crop.
- [ ] All six black references are sampled inside marker interiors with sufficient edge insets to avoid toner spread, blur, antialiasing, and perspective-resampling artifacts.
- [ ] The four derived white corridors are divided into multiple inset sampling tiles rather than represented by a single pixel or unqualified rectangle.
- [ ] White and black reference values use robust aggregate statistics such as medians or trimmed means.
- [ ] Calibration evidence retains normalized page positions so later grading can estimate expected reference levels at canonical bubble locations.
- [ ] A bounded number of contaminated or outlying tiles can be excluded while sufficient clean evidence remains.
- [ ] Calibration fails when a corridor lacks the minimum valid evidence or when marker interiors cannot provide sufficient black evidence.
- [ ] Calibration validates clipping, black-to-white dynamic range, tile dispersion, vertical consistency, and left/right disagreement.
- [ ] Failure reasons are represented by stable machine-readable codes and clear human-readable explanations with no required message language.
- [ ] A final-still calibration failure disposes temporary resources, resets automatic-capture state, and safely returns to scanning.
- [ ] Structured scan diagnostics expose sampled regions, accepted and rejected tile counts, robust white and black values, dynamic range, quality findings, and calibration duration.
- [ ] The offline workbench displays the six black samples, four white corridors, accepted/rejected tiles, and calibration quality outcome using the same contract as mobile.
- [ ] Deterministic fixtures cover clean references, mild tile contamination, excessive contamination, clipped whites, washed-out blacks, insufficient dynamic range, missing corridors, and implausible reference disagreement.
- [ ] Existing grading behavior remains unchanged until explicit calibration evidence is consumed by the following ticket.
