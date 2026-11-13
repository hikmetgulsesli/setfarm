# Preserve V3 acceptance through verification

The real fb2 game implementation and first supervision passed 9/9, and VERIFY merged the exact candidate. VERIFY then replaced the canonical story acceptance with its 12-byte status report. Final supervision correctly rejected it. Original RCA: `.superpowers/sdd/2026-11-13-final-supervise-compiler-worktree/currentfb2-final-supervise16-readonly-rca-v1.md`.

## Decision and scope

Fix `verifyStory`, using persisted `runs.protocol`, so V3 verification changes status/timestamp but leaves story output byte-for-byte unchanged. Verification reports already belong to the step/completion records. Legacy/shadow runs retain nonempty verifier replacement and stale-failure cleanup. Missing/malformed V3 acceptance must remain invalid; preserving output does not certify it. Do not infer protocol from a JSON prefix or caller argument.

Alternatives rejected: relaxing the authority reader would remove authentic acceptance checks; a new report column adds a migration for data already retained by completion records. Preserve the reader and existing schema.

This causal root fix is necessary to the authorized working Setfarm objective, not a new feature. No current/historical row repair, generated-code edits, authority weakening, live service changes or new case admission in the source task. Use the existing sole writer; retain all evidence.

## Acceptance

A canonical acceptance text fixture persisted under an actual V3 run survives `verifyStory(id, nonemptyReport)` byte-for-byte. This writer test establishes preservation, not acceptance authenticity; existing strict reader tests separately retain canonical authority acceptance/output-drift rejection. Story status becomes verified. Non-V3 replacement and stale cleanup continue. Protocol routing uses actual SQL, not a mocked protocol. An invalid V3 output stays unchanged and rejected. Focused real Postgres regression must fail on old writer and pass on the small fix, plus legacy controls/typecheck and clean build. Independent reviews before delivery; no full-workflow PASS from these local tests.

## File Map

- `scripts/run-isolated-postgres-tests.ts`: one exact closed selector for the dedicated real-SQL verification writer scenario and exact two-file source-scope additions (`src/installer/repo.ts`, existing native integration test) necessary to project current edited bytes; existing six-cell grammar/security checks unchanged. Add focused parser acceptance/near-miss rejection coverage in `scripts/__tests__/isolated-postgres-command.test.js` (existing private pure parser seam).
- `src/installer/repo.ts`: protocol-aware verification writer only.
- `tests/execution-attempts/native-implementation-join.integration.test.ts`: dedicated actual persisted writer regression and legacy controls, without running unrelated full implementation lifecycle in maintained fixture.
- `tests/steps/07-verify.test.ts`: existing pure legacy controls, unchanged unless necessary.
- This spec and its plan: bounded requirements and verification record.
