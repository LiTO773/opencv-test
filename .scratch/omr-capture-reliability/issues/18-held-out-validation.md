# 18 — Run untouched held-out validation

**Status:** Ready for agent and owner collaboration  
**Type:** Final sprint gate  
**Blocked by:** 04, 06, 14, 15, 16, 17  
**Blocks:** Nothing

## Objective

Run the frozen TypeScript analyzer and configuration exactly once through the
predeclared, physically separate held-out matrix and decide whether the sprint's
reliability claim is supported.

## Preconditions

- Ticket 17 has frozen configuration, analyzer revision, and evaluation rules.
- Validation sheets have never appeared in calibration or screening evidence.
- The owner has not used validation outputs to influence thresholds.
- Both required devices and all required supported condition classes are ready.

## Scope

- Capture the held-out physical matrix on iPhone 15 Pro/iOS 26 and Pocophone
  F1/MIUI Android 10.
- Use the current and dense layouts, supported pens/ink, fill classes, page
  regions, lighting, supported shadow conditions, and the same frozen grey-box
  template contract used during calibration.
- Leave correction boxes free of handwritten crosses and fully painted-box
  states; those are next-sprint validation inputs.
- Replay and evaluate with the frozen analyzer/configuration only.
- Report decision stability, mark behavior, uncertainty/warnings, parity,
  timing, and dense-sheet performance against every sprint criterion.
- Produce failure gallery, known limitations, final configuration identity,
  and bounded reliability statement.

## Pass criteria

- Zero silent score changes across repeated scans of the same supported valid
  fixture.
- Every accepted fixture uses the final frozen grey correction-box geometry and
  expected border does not contaminate ordinary fill decisions.
- Zero supported-condition confident filled ↔ confident unfilled flips for one
  physical bubble.
- Every credible disagreement is attached to affected bubbles and questions.
- At least 95% of supported scans finish without a stability warning.
- Full supported blue and black fills remain confident under supported light
  and ordinary shadows.
- Approximately 70% fixtures meet agreed filled behavior.
- Approximately 40% fixtures are never silently promoted to confident filled.
- Evidence collection ends by 1.5 seconds.
- Release result appears within 3 seconds at P95 on both devices, including the
  dense fixture.
- Saved evidence reproduces recorded mobile measurements and combined results.

## Failure protocol

If any pass criterion fails, do not tune against the same set and then call it
held out. Record the failure, move the exposed validation evidence into the
calibration corpus, diagnose it through the existing ticket chain, freeze a new
candidate, and prepare a new physically separate held-out set for the next
validation attempt.

## Acceptance criteria

- [ ] Validation uses exactly the frozen revisions and configuration.
- [ ] Validation sheets use the frozen grey-box template and contain no
      handwritten correction states.
- [ ] Sheet-identity checks prove no calibration/validation leakage.
- [ ] Every pass criterion has a traceable report section and saved evidence.
- [ ] Mobile/replay parity is confirmed for held-out bundles.
- [ ] Timing reports separate release and development modes.
- [ ] A pass produces the final known-limitations and reliability report.
- [ ] A failure follows the failure protocol without post-hoc threshold edits.
- [ ] Claims remain limited to the two devices and supported sprint conditions.

## Validation evidence

- Immutable held-out manifest and exported bundles.
- TypeScript evaluator report tied to frozen revisions.
- Cross-device timing report and failure gallery.
- Final pass/fail decision with explicit criterion-by-criterion evidence.

## Handoff notes

An agent prepares commands, verifies identities, evaluates exported bundles,
and writes the report. The owner performs the physical scans. The sprint is not
complete merely because code is merged; it completes only when this evidence
gate passes or the remaining failure is explicitly documented.
