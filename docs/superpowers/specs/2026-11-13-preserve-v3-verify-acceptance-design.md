# Preserve V3 acceptance through verification

The real fb2 game implementation and first supervision passed 9/9, and VERIFY merged the exact candidate. VERIFY then replaced the canonical story acceptance with its 12-byte status report. Final supervision correctly rejected it. Original RCA: `.superpowers/sdd/2026-11-13-final-supervise-compiler-worktree/currentfb2-final-supervise16-readonly-rca-v1.md`.

## Decision and scope

Fix `verifyStory`, using persisted `runs.protocol`, so V3 verification changes status/timestamp but leaves story output byte-for-byte unchanged. Verification reports already belong to the step/completion records. Legacy/shadow runs retain nonempty verifier replacement and stale-failure cleanup. Missing/malformed V3 acceptance must remain invalid; preserving output does not certify it. Do not infer protocol from a JSON prefix or caller argument.

Alternatives rejected: relaxing the authority reader would remove authentic acceptance checks; a new report column adds a migration for data already retained by completion records. Preserve the reader and existing schema.

This causal root fix is necessary to the authorized working Setfarm objective, not a new feature. No current/historical row repair, generated-code edits, authority weakening, live service changes or new case admission in the source task. Use the existing sole writer; retain all evidence.

## Acceptance

Actual persisted V3 accepted native fallback output survives `verifyStory(id, nonemptyReport)` and native authority remains readable after normal worktree cleanup. Story status becomes verified. Non-V3 replacement and stale cleanup continue. Protocol routing uses actual SQL, not a mocked protocol. An invalid V3 output stays unchanged and rejected. Focused real Postgres regression must fail on old writer and pass on the small fix, plus legacy controls/typecheck and clean build. Independent reviews before delivery; no full-workflow PASS from these local tests.

## File Map

- `src/installer/repo.ts`: protocol-aware verification writer only.
- `tests/execution-attempts/native-implementation-join.integration.test.ts`: actual persisted writer/native authority regression and legacy controls in maintained fixture.
- `tests/steps/07-verify.test.ts`: existing pure legacy controls, unchanged unless necessary.
- This spec and its plan: bounded requirements and verification record.
