# Cutover refusal context and cleanup provenance

Root is the sole writer; agents are read-only reviewers. This is a causal
follow-up to the sampled-process-absence delivery, not a new admission path.

## Evidence and invariant

Clean-main host inspection at `f1ffcb082cc971ba0808dbddf63f08a5ee7b133d`
refused at `postqualify` with `cleanupFailed:true`. A bounded read-only audit
showed the six environment candidates stayed absent while the pinned
`.openclaw/setfarm` ancestor kept its inode but changed `mtime`/`ctime` on a
roughly 30 second cadence. The absence holder correctly invalidated that held
evidence. Its later `close()` threw solely because the evidence was invalid,
so the owner incorrectly reported an observed cleanup failure.

Preserve the exact-candidate ABA guard and every fail-closed recheck. Never
turn ancestor timestamp drift into accepted absence. `cleanupFailed:true`
continues to mean an actual close/drain failure only.

## Design

- Add one finite `ownerContext` diagnostic field. During owner conjunction
  checks it is one of `account`, `selected`, `retained`, `absence`, `launcher`,
  or `bind`; otherwise it is null. Bootstrap accepts only the exact five-field
  own-data schema and fixed allowlist. No path, message, stack, cause, env data,
  or arbitrary value is exposed.
- Separate evidence invalidation from close/drain failure in the returned
  selected-build, finalized-build, retained-profile, and env-absence holders.
  Evidence drift remains sticky and fail-closed; consuming descriptors after
  drift succeeds unless a close operation itself fails. Actual close failure
  remains sticky and throws.
- Keep existing acquisition uncertainty semantics: an unreturned holder cannot
  certify cleanup. Do not add authority, alter success observations, or change
  service/database state.

## TDD and delivery

- [x] RED: owner and bootstrap exact-schema tests attribute postqualify absence
  drift and reject malicious/unknown context values.
- [x] RED: each affected holder proves drift drains cleanly without presenting
  cleanup loss; existing real close-loss/retry tests stay green.
- [x] GREEN: smallest implementation in the four holders, owner, and bootstrap.
- [x] Focused owner/bootstrap/holder/composed tests, broader cutover gates,
  TypeScript no-emit, manifest/contracts, and diff check.
- [ ] Independent read-only review, scoped PR, exact-head review, merge.
- [ ] Clean-main normal build and one fresh sanitized host epoch. Treat an
  `ownerContext:"absence"` refusal as evidence of the preserved ABA guard, not
  permission to weaken it or retry blindly.

## Verification ledger

RED reproduced missing `ownerContext` in owner/bootstrap diagnostics and
evidence-invalid holders throwing from otherwise successful close/drain paths.
GREEN: owner52/52, env-absence25/25, selected close/drift12/12,
retained-profile32/32, composed15/15, bootstrap84/84, broader cutover342/342,
and serial genuine39/39. TypeScript no-emit, exact source manifest18/18,
English1568, path892, migration digests, Mission Control contracts12, and
diffcheck passed. Independent read-only review reported no findings and ready.
