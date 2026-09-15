# Post-recovery Ordinary Startup Reclamation

## Goal and causal scope

Whole-branch review of `eef9f6c4..f28cf447` found that a successfully recovered
normal spawner cannot restart after a crash leaves its singleton lock. Main
admits authenticated settled-ready history, but stale-file reclamation rejects
every non-absent cold journal. Permanent historical evidence makes that refusal
permanent. This is a recovery/idempotency acceptance gap within the standing
owner-authorized goal, not permission to delete historical evidence.

## Decision

Keep default ordinary reclamation absent-only. Add a private normal-ready
cleanup owner before singleton acquisition, limited to the two existing fixed
startup paths. It must authenticate the same current normal-ready operation,
source and terminal transport chain, and exclude original cold/direct startup
file identities and historical process IDs. An ambiguous reused historical PID
must refuse. Settled history alone never grants deletion authority.

Deleting the historical journal would destroy evidence. Globally accepting
settled state in the existing reclaimer would grant excessive authority. A new
persistent recovery schema is unnecessary: existing authenticated history and
private process-local ownership can supply the required proof.

## Authority and race boundaries

The terminal observer may expose immutable startup exclusion evidence and a
non-enumerable read-only synchronous `assertStable` closure. The closure checks
original terminal history, not current readiness, and grants no process effect.
Preserve existing enumerable proof fields and persisted records. The cold
history reader can return its private parsed claim separately while its public
census remains byte-for-byte unchanged.

The private spawner owner pins exact readiness/status records and locators,
their physical parent chains, and the stale candidate before final asynchronous
full admission reobservation. Its synchronous final tail checks current source,
readiness pins, terminal history, unchanged cold witness, exact candidate bytes,
inode/UID/mode/link/parent identities, and definite process death immediately
before unlink. There is no await between final checks and unlink. A replaced
file, historical identity/PID, live owner, permission-denied liveness probe,
missing readiness, or changing evidence refuses without deleting the candidate.

Every acquired descriptor has one retained cleanup owner, including the inner
stale-file reader. Register before the first descriptor observation and record
the actual opened identity separately from the pre-open pathname witness.
Stop cleanup immediately when the singleton owner is live; do not proceed to
an unrelated stale PID candidate. Closing a read-only
authority pin never removes its file. Existing startup cleanup remains
identity-bound and cannot remove a replacement owner's file. Failure does not
become permission for normal producers, another dispatch, or journal repair.
An uncertain close is never repeated: observed EBADF settles it, a changed
descriptor is preserved, and a same-inode or still-open ambiguous slot retains
its refusal fence. Test-only explicit closure may demonstrate terminal cleanup;
production cannot infer that a thrown close happened before its effect.

## File map

- `src/spawner.ts`: private authenticated post-ready cleanup and main integration.
- `src/internal-production/baseline-restart-authority-retirement-v1.ts`:
  existing terminal reader's exclusion evidence and synchronous read-only fence.
- `tests/internal-production/owner-admission-v1.test.ts`: actual main
  crash/restart regression and adversarial cleanup ownership tests.
- `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`:
  actual terminal proof exclusion/fence behavior, preserving existing cases.
- Existing cold-recovery plan and this design: scope, sequence and evidence.

No new runtime export/file, frozen source tuple, persisted schema, database
mutation, runtime override, broad deletion or live process intervention.

## Acceptance

First demonstrate actual main creating its startup files and exiting without
cleanup; its next normal-ready startup must currently fail with
`COLD_BOOTSTRAP_NOT_ABSENT`. Implement only after this RED. Prove the later
ordinary dead residue is reclaimed and all original historical/replaced/live
files are preserved. Test readiness/terminal/source drift across the final
await, close failures, exact bytes and parent replacement. Retain existing
absent-only and cold/direct startup refusal tests. Run focused tests, no-emit,
contracts, independent review and final clean-checkpoint adjacent/full P3.

Separate adjacent preflight failure on `f28cf447` is not evidence for this bug:
its cold-history setup lost its test child before process observation. Diagnose
that independently; do not weaken production liveness checks to make it pass.
