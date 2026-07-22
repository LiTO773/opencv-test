# 08 — Add canonical registration diagnostics

**Status:** Ready for agent  
**Type:** Vision reliability  
**Blocked by:** 01, 05, 07  
**Blocks:** 09, 11, 12

## Objective

Ensure that measurements from separate candidate frames refer to the same
physical bubble. Preserve the successful four-marker crop while adding
independent evidence of residual page and bubble-field alignment.

## Scope

- Continue using the four outer markers to define the marker-free 875 × 1280
  canonical crop.
- Use the two middle physical markers as diagnostic residuals.
- Model expected printed bubble and grey correction-box outlines and measure
  their robust aggregate alignment without treating grey print as student ink.
- Record bounded global translation, rotation, scale, residual error, and the
  distribution of local center adjustments.
- Distinguish ordinary printer scaling from unacceptable residual distortion.
- Define explicit global and local eligibility outcomes with reason codes.
- Preserve evidence rather than stretching a severely misregistered frame into
  apparent alignment.

## Out of scope

- Replacing marker detection or the four-marker crop.
- Treating `center_adjusted` alone as a failure.
- Adding visible registration marks.
- Selecting final calibration thresholds without ticket 17.

## Acceptance criteria

- [ ] Current four-marker canonical crop regression fixtures remain unchanged.
- [ ] Middle-marker residual is recorded without independently redefining crop
      geometry.
- [ ] Ordinary uniform fit-to-page scaling normalizes silently.
- [ ] Systematic bubble-field drift is distinguishable from isolated local
      center adjustment.
- [ ] Expected correction-box geometry participates in template alignment or is
      explicitly masked without contaminating student-mark diagnostics.
- [ ] Excessive residual alignment excludes the relevant evidence explicitly.
- [ ] Registration records are serializable and replayable through ticket 03.
- [ ] Equivalent canonical evidence produces deterministic diagnostics.

## Validation evidence

- Synthetic translation, rotation, scale, and residual-distortion fixtures.
- Valid and invalid six-marker geometry cases.
- A high-density bubble-field fixture proving bounded aggregate alignment work.
- Before/after diagnostics on representative recorded calibration bundles.

## Handoff notes

Do not broaden this into marker-detector work unless a reproducible marker
failure appears. The reported problem begins after page acceptance.
