# 05 — Add white-reference and correction-box schema contracts

**Status:** Ready for agent  
**Type:** Generator/analyzer contract  
**Blocked by:** 01  
**Blocks:** 06, 08, 11

## Objective

Allow the generator to declare guaranteed unprinted white regions and the final
grey correction-box geometry around every production-intent bubble without
breaking older schemas.

## Scope

- Add optional `whiteReferenceRegionsPx` data with stable region IDs and
  canonical rectangle geometry.
- Add an outer correction-box rectangle and versioned border-style reference to
  every production-intent bubble. The style declares intended grayscale value
  and canonical stroke width.
- Require each correction box to contain its bubble with positive clearance and
  include the complete printed stroke inside its declared outer bounds.
- Permit correction-box metadata to be absent for legacy schemas, while marking
  it mandatory for current-sprint calibration and validation schemas.
- Validate duplicate IDs, numeric/integer requirements, positive size, minimum
  white-reference size, canonical bounds, correction-box containment/style,
  and prohibited overlap.
- Return all simultaneous schema errors with stable paths and codes.
- Compute a deterministic spatial coverage description/score that distinguishes
  margin-only references from distributed references.
- Preserve schema behavior when the field is absent.
- Document the exact handoff the owner must implement in the generator.
- Keep detector quality thresholds outside the generator-owned schema.

## Out of scope

- New visible white patches or marks.
- Choosing or interpreting handwritten cross/painted-box thresholds.
- Requiring interior regions when only margins are available.
- Illumination correction itself, which belongs to ticket 11.

## Acceptance criteria

- [ ] Schemas without white references remain valid and behaviorally compatible.
- [ ] Legacy schemas without correction boxes remain analyzable, but cannot be
      mistaken for current physical calibration schemas.
- [ ] Every current-sprint bubble has valid box geometry and a valid frozen
      printed-style reference.
- [ ] Valid minimum, preferred-size, margin-only, and distributed references are
      accepted.
- [ ] Invalid geometry returns complete stable error lists.
- [ ] Coverage calculation is deterministic and tested.
- [ ] The contract explicitly permits margin-only references.
- [ ] References cannot overlap printed/interactive regions according to the
      available schema geometry.
- [ ] Correction boxes outside bounds, not containing their bubble, referencing
      invalid styles, or overlapping white-reference regions are rejected.
- [ ] A concise generator handoff lists fields, units, invariants, examples, and
      expected validation errors.

## Validation evidence

- Focused schema fixtures for every accepted and rejected case.
- Backward-compatibility fixture using the current schema.
- Correction-box geometry/style fixtures covering valid and invalid cases.
- Coverage fixtures for top/middle/bottom and left/center/right distributions.

## Handoff notes

The prototype owner will make generator changes. The agent must make the
contract exact enough to implement without guessing and must not require ugly
new visible calibration regions. The grey correction box is an interaction
affordance already required by the product, not a calibration mark.
