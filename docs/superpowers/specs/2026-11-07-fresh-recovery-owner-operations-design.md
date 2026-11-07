# Fresh recovery owner operations

Status: Source implementation candidate; independent whole-diff review and Root production qualification pending. Base `637a793a63aa12be8a4759664dbe6d4da06102af`, branch `fix/fresh-recovery-owner-operations-20261107`, existing sole writer. Root owns delivery and all operational effects.

## Actual cause and bounded objective

Real game run2 `a3558554-2b6d-4b7c-ad72-2c6528df04eb` passed PLAN, DESIGN, STORIES, setup and actual build/test. Its immutable canonical bundle `63f31d85e330096808d0f72e235261edc3bcecd7752797687183e0fac0f27c5a` failed three observable/persistence predicates. The genuine platform blocker is RCR `RCR_e91454b5-8e9b-4129-8006-e4971fe30997`: processing/owner_committed, recovery.coordinate quarantined3, `permission denied for table finding_sets`. Story US-001 is failed; its runtime is drained, not released. Preserve all these records and generated files; never replay/reset the run manually.

The required root fix is a complete owner-mediated recovery lane, including the proven next delivery writers. Coordinate alone cannot repair software: its completion lease settles before later delivery claim/reservation/running/heartbeat/closure. Frozen lifecycle/transaction reports supply that finite map; this is not a new security or service framework.

## Trust and transport

Current compiled setrox control plane is trusted and already technically administrative. Compromise of that parent is outside this patch's threat scope; same-UID0600 is not isolation. Existing model SDK/no-fork, native custody, installation/source/activation and runtime-role guards remain unchanged. The stashed eight-file security draft is not resumed or a prerequisite of this fix.

Create one private max1 owner writer pool through the existing local PostgreSQL Unix peer endpoint. Derive actual OS user/UID, fixed canonical local socket directory and selected cluster port/DB identity, never an input/env/admin URL. Pin socket/ancestor identity and verify actual session_user/admin role OID, selected system identifier/database OID/name, role/catalog/origin/source/activation. No password, TCP fallback, service-file lookup, credential publication or runtime pool retarget. Explicit options prevent inherited PG* overrides. Ordinary getSql remains the genuine restricted pool; independent restricted heartbeats remain available while owner children run.

Prepare only after actual compiled spawner operational entry and held service custody; add assertCurrent to that existing custody object over the original process/lock/PID pins. Store admission/operation/transaction handles in private WeakMaps. Clones, parsed objects, caller Booleans, fabricated ALS or role strings confer no authority. On drift/shutdown fence the owner executor before service release and retain actual uncertain owners. No SQL/pool/user callback escapes.

## Finite fixed operation family

Private `FreshRecoveryOwnerOperationsV1` exposes these domain operations and close, with existing schema-typed inputs/results. Requests identify durable work; privileged data/policy is reloaded internally.

| Fixed operation | Actual selected implementation and authority |
| --- | --- |
| coordinateCurrentEffect | spawner effect branch -> v3-recovery-effect/coordinator + finding/delivery repositories. Actual completion ALS plus DB request/effect generation, manifest, hashes, owner/lease and drained-runtime tuple. Includes existing GitHub review-resolution branch through real trusted observer; no caller verdict. |
| acquireNextRecoveryWork / acquireRecoveryClaim | work-router -> claim-authority.acquireRecoveryClaim; current case/revision/dispatch class, actual caller owner identity, DB-clock lease and exact continuation. Do not wire unused delivery.leaseNext. |
| reserveRecoveryAttempt | existing native reserveRecovery outer transaction -> attempt reservation and delivery attempt_reserved binding plus artifact refs. Preserve atomicity and original native Git/source/publication custody. No separate owner delivery UPDATE after runtime attempt INSERT. |
| markRecoveryRuntimeRunning | existing runtime-session transaction atomically validates start authority and marks session/attempt/delivery running with the exact recovery fence. |
| heartbeatRecoveryOwner / relinquishRecoveryOwner | existing owner-lease operations; rejoin original runtime/attempt/delivery/claim, generation/fence and live DB-clock leases. Preserve terminal evidence-heartbeat semantics; never revive an attempt. |
| runEvidenceOnlyRecovery | existing evidence-only worker/runtime: acquire, publication/reserve, running, quarantine, native success settlement and direct coordinator call. Use its genuine terminal-child/delivery authority; no fabricated model RCR. |
| reconcileRecoveryLifecycle | existing selected reconciler and fixed candidate transaction: expired lease reset, unreserved publication rollback, running advance and expired model/evidence blocking. Actual candidate/drain/completion observations authorize it; not an already-settled coordinate-effect lease. |
| settleRefusalRecoveryLineage | existing exact refusal effect -> completeDelivery + transitionRecoveryCase, retaining prior lineage/target equality and replay checks. |
| transitionRunRecoveryTerminal | existing run-terminal transaction + terminal recovery chain reached by termination, step advancement and completeRun. Keep drained termination/bootstrap/replay authority and full-chain locks. Successful completion still refuses active recovery residue. |

These are fixed compiled implementations, not a public operation-string SQL dispatcher. Executor owns its repositories and private writer; named owner constructors select required opaque access mode. Ordinary/nonlocking decision reads keep restricted readSql. Only the listed actual owner mutation BEGINs receive private writer access; do not retarget an entire compiler/service or duplicate its authorization state machine. Reuse existing domain fences and row joins rather than building a second parallel policy framework. Existing lexical repository BEGIN callbacks are trusted compiled code. No new exported privileged callback/begin interceptor, arbitrary SQL handler or registration API is introduced. Keep ordinary constructors/paths unchanged. Private owner access cannot fall back to ordinary mode.

## Transaction contract

Every actual owner BEGIN performs genuine SET LOCAL ROLE to the selected NOLOGIN schema/table owner, fixed LOCAL timeouts/search_path, then verifies actual session_user/current_user OIDs, role attributes/membership, database/catalog/origin and held process/source selection. No GUC authorization, SECURITY DEFINER bypass, replication-role change or runtime grant.

Reuse existing canonical locks/fences; add explicit owner entry/live/precommit calls within the existing callback bodies. Completion-coordinate order remains canonical story -> run -> termination -> original runtime -> attempt -> delivery -> claim -> request -> effects -> ledger/case suffix. Delivery/native/lifecycle/terminal operations retain their own stronger existing canonical order; do not force completion locks onto later noncompletion actions. Revalidate actual authority after target waits BEFORE each first possible write, including writes inside publication/reservation helpers, and immediately before every commit/early-return. Final checks use fresh same-transaction DB wall clock and acquire no new prefix locks. Expiry/takeover/drift during waits rolls back the entire child transaction.

Retain coordinate's outer decision advisory on restricted readSql, without holding authority rows across sequential owner child transactions. Every child remains idempotent through existing hashes/CAS/dedupe; a lost reply cannot create a second repair budget or pretend prior commits rolled back. Existing compatibility findCurrentRevision can write: selected owner reader is strict/read-only and refuses legacy rehydration rather than silently writing. GitHub observation stays outside SQL, bound privately to actual source/PR/head/thread evidence before its fixed put/resolve mutations.

## Source File Map

Create:
- `src/recovery/fresh-recovery-owner-operations-v1.ts`: private peer pool, actual startup custody, finite domain operations/close; no generic SQL/callback API.
- `src/recovery/v3-owner-recovery-authority-v1.ts`: opaque operation/actual transaction bindings and explicit entry/live/precommit fences; no client export.
- `tests/findings/fresh-recovery-owner-operations-v1.test.ts`: fixed API/refusal/real repository body unit regressions.
- Lifecycle entry/lease-expiry components are kept in the owner-operations test; no separate lifecycle fixture file is created.

Modify only the existing selected seams:
- `src/server/fresh-installation-service-controls-v1.ts` (held assertCurrent).
- `src/spawner.ts` (prepare/route/close fixed owner operations; retain ordinary getSql, effects/heartbeats/continuation).
- `src/recovery/finding-recovery-repository.ts`.
- `src/recovery/recovery-delivery-repository.ts`.
- `src/recovery/v3-recovery-coordinator.ts`.
- `src/recovery/v3-recovery-effect.ts`.
- `src/findings/github-review-resolution-evidence-repository.ts`.
- `src/recovery/v3-recovery-work-router.ts`.
- `src/recovery/v3-recovery-claim-authority.ts`.
- `src/recovery/v3-recovery-owner-lease.ts`.
- `src/recovery/v3-recovery-lifecycle-reconciler.ts`.
- `src/recovery/v3-evidence-only-worker.ts`.
- `src/recovery/v3-evidence-only-runtime.ts`.
- `src/recovery/v3-evidence-only-publication.ts` (actual reserve/running/native settlement BEGINs and delivery DML, preserving terminal-child/native proofs).
- `src/recovery/v3-terminal-recovery-chain.ts`.
- `src/execution/attempt-repository.ts`.
- `src/execution/v3-native-implementation-attempt.ts`.
- `src/execution/runtime-session-repository.ts`.
- `src/execution/runtime-completion.ts` (narrow existing chain/type export only).
- `src/execution/run-terminal-transition.ts`.
- `src/execution/run-termination.ts`.
- `src/installer/step-ops.ts` (recovery routing/refusal only).
Read-only preserved callers: `src/installer/step-advance.ts` and `src/installer/repo.ts`. step-advance owns an outer BEGIN (line90), locks run (94) and calls terminal-in-transaction (183). Keep its zero-recovery successful path unchanged/restricted; active recovery residue still refuses. Never enter a nested owner BEGIN under that run lock. Owner-mediated failed/cancelled closure enters the fixed whole terminal transaction before its BEGIN through the existing run-termination route.
- `tests/installation/fresh-installation-terminal-recovery-locks.integration.test.ts` (maintained real restricted/owner SQL contract only; no author DB lane or new isolated setup).
- This spec and matching plan.

Next-rollout transport only: `src/installation/fresh-installation-v1.ts` plus `tests/installation/fresh-installation-unix-peer-v1.test.ts`. Actual maintenanceUrl currently permits only TCP loopback and forbids query sockets; after verified HBA hardening ordinary admin TCP bootstrap is unavailable. Add only an explicit local-unix-peer transport alternative to that existing provisioning controller, fixed socket/OS peer identity and explicit options; preserve the default URL branch and all create/genesis/source checks. This author performs no provisioning. No upgrade API or arbitrary connection options.

No db-pg default-client edit, schema/grant/ALWAYS-guard/migration, model report acceptance, security executor, service/IPC/account/framework or generated-project edit. Additional production leaves require Root's causally supported File Map refinement before editing.

## Acceptance

Original live permission error is the genuine production RED. Focused regressions must execute the actual owner repository/lifecycle bodies with correct fixed transaction entry, then prove ordinary/runtime and forged paths cannot acquire owner authority. Cover lock-wait expiry/takeover, precommit rollback, atomic attempt/runtime delivery binding, terminal-child evidence, lost-reply replay/budget, legacy rehydration refusal and shutdown source/process drift. No actor-supplied clock or fabricated ALS may satisfy the fence.

Author runs Source-unit fixtures, no new deployment/PG cluster/database/model/service or replay of game2. Unit receipts do not prove PostgreSQL engine privilege enforcement. No isolated deployment/cluster is required or authorized. Root establishes genuine SET LOCAL ROLE/current_user, commit/rollback role reset and direct restricted DML denials with bounded ROLLBACK-only checks on the actual selected production installation, then a genuine production run after delivery. Unit receipts never substitute for those actual checks. Existing observed denial is not waived. Root later owns reviewed delivery, clean-main stock build and a new bounded actual run; old game2 remains evidence.

## Finite rollout and preserved old run

New Source must not relabel immutable Source48 installation82, unquarantine/replay its case manually, or waive its mandatory-effect/zero-owner stop guards. The supported Source-bound preparation path is the existing real fresh-production installer with the narrow peer transport alternative above, not a disposable test deployment or upgrade framework. Source review/unit/noEmit and later clean-main build may complete before operational cutover. Actual public service transition still requires the existing guarded stop/admission path to succeed; current processing/quarantined effect is a documented limitation, not permission to bypass it. Root owns that finite operational decision and a new production run only after genuine guards/role checks pass. This Source patch does not claim old run2 recovered or factory admission complete.

Root-approved causal seam: `src/execution/v3-implementation-attempt.ts` forwards the private optional owner access only through the selected native recovery/evidence reservation convenience calls. Existing artifact preparation and ordinary restricted defaults remain unchanged.

## Author qualification boundary

Root approved two causal File Map additions: `src/execution/v3-implementation-attempt.ts` for internal native owner-access forwarding, and `src/db/contract-spine-migration-digests.generated.ts` for the real v33 semantic closure change caused by claim-authority edits. Existing `scripts/check-contract-spine-migration-digests.ts --write` computes the latter; no migration body, existing journal or origin changes. Other migration digests remain unchanged.

The existing work-router candidate-admission callback remains a nonprivileged policy callback before owner BEGIN. It receives only candidate identities; no writer/access/transaction is passed. Private lexical operation callbacks are fixed compiled implementations, never facade arguments. SDK/authenticated-read/markStarting code remains ordinary: actual runtime UPDATE(updated_at) privilege already permits delivery row locks, as Root proved, while semantic DML remains denied.

Author fixtures execute full actual repository/controller/authority bodies with inert SQL/admission/external-effect boundaries. They prove ordinary denial versus owner case/evidence publication and replay, post-lock custody loss before first case write, claim transaction owner entry, pinned-delivery precommit expiry refusal, and fixed peer bootstrap options/refusal. They do not prove real PostgreSQL privileges, full native reservation, full lifecycle/terminal SQL outcomes, live service startup/shutdown or an end-to-end repair. Those remain Root qualification, using the already selected real engine and a legitimate new Source-bound namespace/run; author performed no DB/provisioning/model/service effects. Existing DB integration tests are not run or relabeled as units.

Accepted review deltas before freeze: terminal-child finishing transactions pin their genuine locked original lease deadlines, checking fresh DB time after waits and before commit while retaining their own allowed terminal transition. Pending native-success settlement pins the original delivery deadline; succeeded replay remains unchanged. Only terminalize enters the owner terminal lane; ordinary termination claim/heartbeat/markDrained/quarantine stay restricted. Startup failure before drain registration closes the private owner pool; ancestor directory pins ignore mutable link count while socket identity remains exact.

Root-approved final File Map additions: `src/installation/fresh-installation-activation-v1.ts` for the same closed peer alternative needed by actual next activation, and `tests/installation/fresh-installation-spawner-retention.test.ts` for the affected existing inert fixture ports/retention assertions. Activation retains its runtime/source/catalog/genesis checks and default URL branch. No actual create or activation runs in author tests.
