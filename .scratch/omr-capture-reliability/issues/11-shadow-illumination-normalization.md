# 11 — Implement illumination and shadow normalization

**Status:** Ready for agent  
**Type:** Vision reliability  
**Blocked by:** 05, 06, 08, 09  
**Blocks:** 12, 17

## Objective

Support realistic broad, soft, and moderate shadows by calibrating against the
sheet while keeping sharp shadow-boundary ambiguity local to affected bubbles.

## Scope

- Build a spatial paper/illumination model from declared white regions, robust
  white-paper samples, bubble-local paper rings, and registered frames.
- Use page-wide references for broad gradients and local rings outside the
  complete grey correction box for each bubble.
- Measure intra-ROI and ring asymmetry/gradients so a shadow edge is not
  mistaken for pen ink.
- Record white-reference coverage and whether references adequately span the
  bubble field.
- Treat margin-only references as valid but lower-coverage evidence.
- Exclude printed content and likely ink from paper-reference estimation.
- Treat the declared grey box border as expected printed content, not shadow or
  student ink.
- Distinguish correctable broad illumination from genuinely ambiguous local
  boundaries.

## Out of scope

- Direct sunlight as a supported condition.
- Global rejection merely because one side of a page is darker.
- Promising that every sharp shadow remains confidently gradeable.
- Final parameter selection before ticket 17.

## Acceptance criteria

- [ ] Broad supported gradients preserve local filled/unfilled evidence when
      local contrast is adequate.
- [ ] A sharp boundary crossing one ROI affects only relevant bubble/question
      evidence unless a measured global quality failure exists.
- [ ] White-reference absence remains backward compatible.
- [ ] Margin-only and distributed reference coverage are distinguished.
- [ ] Paper samples contaminated by print or probable marks are rejected
      deterministically.
- [ ] Expected grey borders do not bias local-paper brightness or shadow-edge
      evidence.
- [ ] Shadow/illumination measurements and exclusions are replayable.
- [ ] No fixed device-specific illumination threshold is introduced.

## Validation evidence

- Synthetic broad-gradient and sharp-boundary fixtures.
- Physical calibration bundles for diffuse artificial, window, mixed,
  moderate-shadow, directional-boundary, and bright/glare conditions.
- Locality tests proving unaffected questions remain unaffected.
- Reports grouped by shadow class and page region.

## Handoff notes

White regions improve the broad model but are not sufficient by themselves.
Local paper rings and spatial evidence remain authoritative near each bubble.
