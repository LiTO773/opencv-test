# 03 — Phase 0B: Lock the canonical crop contract

**What to build:** Use the canonical width and height established through the schema-workbench review to make every accepted iPhone capture produce exactly the same pixel dimensions and physical content boundaries. The hardcoded app schema and scanner must agree on this contract, and no automatic resizing may conceal a mismatch.

**Blocked by:** 02 — Phase 1: Build the visual schema workbench.

**Status:** ready-for-agent

- [ ] Before implementation begins, the user-reviewed canonical width and height replace the global TODO values; the agent does not invent these values.
- [ ] The hardcoded schema declares the same canonical width and height used by perspective correction.
- [ ] The final crop is rendered directly into the canonical dimensions rather than first producing a dynamic result and silently stretching it later.
- [ ] The canonical aspect ratio matches the intended physical crop so printed circles remain circular.
- [ ] The marker-corner mapping and marker-free boundaries from Ticket 01 remain unchanged.
- [ ] Repeated accepted captures at different reasonable camera distances produce identical image dimensions.
- [ ] A canonical image whose dimensions disagree with the hardcoded schema is rejected with an explicit contract error rather than resized.
- [ ] QR decoding, automatic 180-degree correction, clean-image display, and sharing continue to work.
- [ ] The displayed and shared image report the canonical dimensions accurately.
- [ ] Manual iPhone verification confirms consistent content boundaries across repeated captures and confirms that marker pixels are absent.
- [ ] Existing TypeScript, lint, and iOS production-bundle checks pass.
- [ ] Work stops after the canonical capture contract is proven; bubble analysis is not started.
