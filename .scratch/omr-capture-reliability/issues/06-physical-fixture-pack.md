# 06 — Define and produce the physical fixture pack

**Status:** Ready for agent and owner collaboration  
**Type:** Test design and manual fixture production  
**Blocked by:** 05  
**Blocks:** 07, 10, 11, 16, 17, 18

## Objective

Create known printed templates and machine-readable ground truth before tuning
the scanner. Agents define the fixture matrix and validate artifacts; the owner
updates the generator, prints, marks, labels, and captures physical sheets.

## Agent responsibilities

- Specify the current-layout and 50-question/7-choice dense-layout fixtures.
- Require the final grey correction box around every bubble and freeze its
  geometry, clearance, grayscale value, stroke width, style ID, and template
  appearance revision before printing.
- Assign stable layout, schema, fixture, printer, pen, sheet, and pattern IDs.
- Define which guaranteed white regions the generator exports.
- Define bubble-level physical coverage classes and expected detector classes
  before scanning.
- Produce machine-readable manifests and validation tooling.
- Minimize the number of manually prepared sheets while covering required page
  regions, ink, coverage, and alternating patterns.
- Clearly mark which physical sheets belong to calibration and which remain
  untouched for validation.

## Owner responsibilities

- Implement the declared generator contract.
- Generate and print the requested laser-printed A4 templates.
- Prepare marks using at least two black and two blue pens, including ballpoint
  and gel when available.
- Include empty, full, alternating, approximately 70%, and approximately 40%
  examples across top/middle/bottom and left/center/right.
- Apply ordinary marks only inside bubbles; leave the surrounding correction
  boxes free of handwritten crosses or painted-box corrections this sprint.
- Record printer and pen identities when known.
- Keep validation sheets physically separate and unscanned until ticket 18.

## Out of scope

- More than 50 questions or 350 bubbles.
- Interpreting corrections, ticks, handwritten crosses, fully painted correction
  boxes, dots, circled answers, inkjet guarantees, direct sunlight, glossy
  paper, or damaged sheets. Printed grey boxes themselves are required.
- Inferring truth from scanner output.

## Acceptance criteria

- [ ] Both required layouts have versioned schemas and printable artifacts.
- [ ] Every printed fixture uses the same frozen grey-box contract declared by
      its schema and template revision.
- [ ] Every physical bubble has a predeclared coverage class and expected
      detector class.
- [ ] Every question has a predeclared expected selected-answer set.
- [ ] The collective pack covers required pens, marks, page regions, and white
      reference distributions.
- [ ] At least one dense physical fixture contains 350 bubble ROIs.
- [ ] Calibration and held-out validation sheets have non-overlapping physical
      sheet IDs.
- [ ] Manifests validate without reference to scanner output.
- [ ] The owner receives an exact printing, marking, labeling, and storage
      checklist.
- [ ] No correction-mark fixture is mixed into current-sprint calibration or
      held-out acceptance evidence.

## Validation evidence

- Fixture matrix and manifest validation report.
- Checksums or stable identities connecting printable artifacts to schemas.
- A frozen correction-box style/geometry record and visual template check.
- Photographs or scans of calibration fixtures only when requested by later
  tickets.
- Written confirmation that held-out sheets remain untouched.

## Handoff notes

This is the primary collaboration ticket. An agent must never fabricate the
manual completion evidence. If exact 40%/70% physical fills are difficult, use
repeatable printed/marking guides and record the approximation method rather
than relabeling results after capture.
