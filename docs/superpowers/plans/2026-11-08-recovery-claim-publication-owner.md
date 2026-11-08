# Recovery claim publication owner implementation plan

> Execution: sole delegated source author in the existing writer; Root owns review, delivery and all live effects. Apply the TDD and writing-good-tests workflow inline.

**Goal:** Publish an already authorized fresh recovery claim/runtime through the existing authenticated owner transaction instead of opening a restricted runtime transaction after router admission.

**Cause:** Actual run72a02 reached a normal authorized repair after TypeScript failure. The routed owner transaction closed before `publishLoopClaimAndRuntime` opened `publishLoopClaimRuntime(getSql(), ...)`. Its publication-ledger `SELECT ... FOR UPDATE` and eventual `INSERT` require owner privileges. Runtime SELECT-only ACLs are intentional; no grant or schema change is appropriate.

**Architecture:** Add an optional `OwnerRecoveryAccessV1` argument to the real loop publisher, accepted only with a recovery handoff. Authenticate it through the existing WeakMaps, use its writer for BEGIN and enter the existing owner role/identity/catalog/entry fence. Wrap the existing body so early returns and successful/replayed publication all cross the same before-commit fence. Preserve lock order, exact handoff checks, CAS, immutable publication bytes and ordinary behavior. Pin the authenticated recovery delivery before claim mutation; keep current owner/lease checks at mutation boundaries, including replay adoption.

## File Map

- `src/execution/claim-runtime-publication.ts`: optional opaque owner argument, owner BEGIN/entry, canonical delivery pin, mutation and final fences around the unchanged publication body.
- `src/recovery/fresh-recovery-owner-operations-v1.ts`: fixed input-only `publishRecoveryClaimRuntime(input)` facade; reject missing handoff, reuse `operation("claim", ...)`; no SQL, pool or callback escape.
- `src/installer/step-ops.ts`: select the facade only when both fresh selection and recovery handoff exist; ordinary/legacy/non-recovery call the existing publisher directly.
- `tests/findings/fresh-recovery-owner-operations-v1.test.ts`: full real publisher module and actual owner WeakMap fixture; inert SQL models only external PostgreSQL effects.
- This plan: causal scope and evidence.

## Regression contract

The regression must fail if publication opens the ordinary client despite genuine owner access. It must reach the real publication-ledger row lock, then its real INSERT on the passing owner path; stubbed success from a publisher is insufficient. Independent literal SQL-state expectations: ordinary lock/INSERT deny, owner publication commits exact claim/runtime identity once, invalid/closed access and expired lease roll back without committed publication. Ordinary non-recovery retains its client and early-return behavior. Replay must use the stored exact handoff and retain the final fence.

## Steps

- [x] Extend the existing fixture for real publisher SQL, preserving real handoff schemas, canonical checks and owner WeakMaps. Add a genuine owner publication expectation and capture RED at permission denial, not import/setup failure.
- [x] Implement the optional owner argument and fixed facade/selected call-site route. Keep all current validation/locking/early-return rules; fence all owner returns and publication mutations.
- [x] Run the focused existing owner test file, including ordinary control, invalid/closed owner, closure after a SQL await, delivery loss before commit, exact replay and early return. Capture original PID/argv/times/raw output/exit privately.
- [x] Run TypeScript noEmit and diff check. Freeze the three production files, existing test and plan for independent review; do not build dirty, stage, commit, push or touch services/DB/generated artifacts.

## Limits

No new privilege kind, grant, role, access schema, retry/repair framework, DB namespace or production effect. SQL doubles do not qualify actual PostgreSQL permissions; Root retains the original ACL/failure evidence and owns any production validation after delivery.

## Verified author evidence

Private captures under `.superpowers/sdd/2026-11-04-subscription-operational-integration/`:

- `root-recovery-claim-publication-red-v1`: original Node PID94113 exit1 at the real publication-ledger permission denial before production changes.
- `root-recovery-claim-publication-green-v1`: original Node PID96554 exit0 for the first real owner publication regression.
- `root-recovery-claim-publication-focused-v1`: original Node PID99083 exit0, all27 existing/added owner tests pass. Covers independent ordinary row-lock and INSERT denial, forged/closed/missing-handoff owner refusal, pre-mutation closure, rollback after completed INSERT on owner/lease loss, early-return final fencing, exact replay and full step-module selected routing.
- `root-recovery-claim-publication-noemit-v1`: original Node PID99084 exit0, TypeScript noEmit.
- `root-recovery-claim-publication-diffcheck-v1`: original Git PID172 exit0.

The full publisher and real authority WeakMaps execute. The SQL engine, producer reservation persistence, compiler-story admission and runtime-session storage are disclosed inert external boundaries; these unit results are not PostgreSQL ACL or live rollout qualification. No build, DB connection, service, model, generated artifact or delivery effect was performed by the source author.

## Actual terminal snapshot refinement (same run/release)

After normal cancellation of the same run, all nine active-owner counts reached0 and the RTR terminalized, but the dashboard operational-snapshot endpoint returned500. Its schema required both lease fields for every non-authorized dispatch. Canonical terminal retirement clears both fields and privately retains prior owner evidence; ordinary completion legitimately retains both fields. The public projector is faithful and must not synthesize ownership or expose private terminal_result.

Additional File Map: `src/server/schemas/run-operational-snapshot-v1.ts` changes only the custom lease-pair refinement; `tests/run-operational-snapshot.test.ts` adds filtered pure public-row-schema regressions. No production export, projector, write path or data mutation is needed. Authorized requires0 fields; active leased/attempt_reserved/running requires2; terminal succeeded/failed/blocked/superseded allows0 or2. One field always refuses. Existing attempt, execution-slice, terminal timestamp/reason and identity checks remain intact.

TDD: first observe the actual superseded/null row fail the real public schema, then apply the narrow predicate and run terminal0/2 and partial/active/authorized controls. Run the actual Mission Control contract artifact --check comparison; a superRefine-only change must not require generated artifact rewrites. Keep the reviewed publisher/facade/step-helper and owner-test hashes unchanged.

Refinement verification: `root-recovery-claim-publication-snapshot-red-v1` original PID6580 exit1 reproduced the exact custom lease-projection error on a literal superseded/null row. `root-recovery-claim-publication-snapshot-green-v1` original PID7220 exit0 passed all5 pure schema tests, including every terminal0/2 shape, all active/authorized controls, both partial-pair refusals in all8 states, and retained attempt/slice/timestamp/reason/identity/strict-key checks. `root-recovery-claim-publication-mc-artifacts-v1` original PID7219 exit0 ran the actual --check comparison and verified all12 committed Mission Control artifacts without writes. The previous3 production files and owner-test hashes remain exactly frozen; prior27/27 and noEmit99084 exit0 remain valid for that unchanged fix. No repeated full noEmit was needed for the two-line custom predicate; the new schema is executed by both focused tests and the real artifact generator, and Root's clean stock build remains required before rollout.
