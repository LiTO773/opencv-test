# 13 — Integrate the bounded mobile evidence session

**Status:** Ready for agent  
**Type:** Mobile integration  
**Blocked by:** 07, 12  
**Blocks:** 14, 15, 16

## Objective

Replace immediate first-still grading with one bounded internal evidence
session. The user aligns once; the scanner collects and combines credible
frames for no more than 1.5 seconds.

## Scope

- Preserve marker detection and marker lock as the entry gate.
- Start a candidate evidence session at marker lock.
- Apply ticket 07's chosen resolution, cadence, frame cap, and any proven
  early-stop rule.
- Normalize candidates, invoke the authoritative analyzer, and return the
  strongest available result at the deadline.
- Continue geometry observations during collection.
- Handle cancellation, camera interruption, timeouts, insufficient evidence,
  and analysis failure deterministically.
- Record acquisition and release-analysis timing separately.
- Keep portrait orientation and manual torch behavior.

## Out of scope

- Asking the user to repeat automatically.
- Extending collection beyond 1.5 seconds because evidence disagrees.
- Landscape/front-camera behavior or production grade persistence.

## Acceptance criteria

- [ ] Marker lock begins evidence collection instead of immediate final-still
      grading.
- [ ] Collection stops no later than 1.5 seconds after marker lock.
- [ ] At the deadline, the strongest result is returned even if some questions
      remain uncertain.
- [ ] Disagreement is retained; it is never converted into false confidence.
- [ ] The session cannot emit two competing final results for one scan ID.
- [ ] Cancellation and camera interruptions leave no active orphan session.
- [ ] Both platforms invoke the same evidence-session semantics.
- [ ] Existing successful marker behavior is not redesigned.

## Validation evidence

- State-transition tests using a controllable clock and candidate stream.
- Deadline, early-stop, cancellation, interruption, and empty-evidence cases.
- Owner-run device traces confirming the 1.5-second hard cap.
- A regression demonstration that marker acceptance remains stable.

## Handoff notes

The 1.5-second window is the user's maximum waiting budget for evidence, not a
development convenience. Inconsistency produces explicit uncertainty, not a
longer hidden scan.

