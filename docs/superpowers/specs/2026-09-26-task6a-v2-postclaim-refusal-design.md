# Task6A V2 post-claim continuation refusal design

## Decision

An ordinary `spawnAgentNow()` can pass its prespawn samples, await
`claimStep()`, and resume after a fixed current-entry operation appears.
`claimStep()` itself may already have performed filesystem and database work;
the sampled V2 gate cannot undo it. On a found claim, resample the existing
no-write V2 assertion before post-claim summary, handoff, runtime publication
or child startup. Recheck shutdown after the await.

If either check refuses, remove only the in-memory `claimingSpawns` marker and
return outside the existing post-claim `try/finally`. Do not call
`releaseUntransferredPostClaimOwnership()`, quarantine, delete files, or
otherwise mutate the claim/runtime on this refusal path. Retain an in-memory
shutdown exemption only if `claimStep()` returned the exact new runtime
session/owner/claim identity. After joining in-flight spawns, shutdown may
leave that session unmodified only if its DB row still matches the tuple, is
strictly `reserved` without a PID, process start time/group or process identity,
and the exact open claim is
read-only confirmed. Report retained sessions as an incomplete shutdown, not
successful release. Any mismatch follows the existing fail-closed quarantine.
An unbound/mismatched found claim receives no exemption and contributes to a
nonzero shutdown exit even if no runtime row is visible; a registered exact
session missing from the shutdown sample also prevents a zero exit.

An idempotent legacy loop may return `found:true` without a runtime session.
It receives no shutdown exemption and no automatic recovery claim: this
pre-existing open claim remains an explicit nonzero-shutdown diagnostic blocker
for later inspection. Ordinary exact reservations can enter age/quiescence-gated
recovery when admission resumes; V3 recovery reservations may instead be
terminalized at bounded lease expiry. No-work claims retain their existing
fast path. Log fixed, bounded diagnostics without claim IDs or private errors.

This remains sampled refusal, not continuous exclusion; already-running
`claimStep()` and later async post-claim boundaries require separate treatment.
Direct/cold bootstrap and the current-entry authority classifier are unchanged.

## File Map and verification

- `src/spawner.ts`: no-write V2 post-claim assertion and shutdown return
  between the found-claim branch and the post-claim release `try/finally`;
  exact reserved-session retention in shutdown after the in-flight join.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN source-extracted found/no-work, deny/permit/shutdown, legacy
  no-runtime exception, exact shutdown-retention and no-write tests.
- `docs/superpowers/plans/2026-09-26-task6a-v2-postclaim-refusal.md`:
  scoped delivery steps.

Run focused, pure/cutover, relevant spawner tests, TypeScript/source contracts
and independent read-only review. Root is sole writer; preserve all retained
worktrees and the selected historical build/link.
