# Manual evaluator orphan retirement — refined Source-only specification v2

## Root adoption and execution boundary

Root adopts this specification/plan on2026-10-21 for the existing Setfarm completion objective. The missing dead-evaluator administrative transition currently blocks a fresh full8 run and reviewed MC rollout. Active sole writer is branch `fix/manual-orphan-retirement-20261021` from reviewed SF161; native branch8d2149aa remains preserved separately. Existing user authorization covers ordinary causal Source/test/docs work and reviewed delivery; it grants no bypass of current runtime/material/authority gates.

Task1 is the pure prepublication record/request/settlement/evidence schema, exact historical joins, eligibility proof and released-record derivation. Its DTO contract in the companion specification is normative. All runtime inputs are reparsed and bounded even when TypeScript types say they are validated. Task1 adds no effect capability, publication, live observer exception, old-journal event, or retirement. Sidecar/replay/postpublication schemas and serialization are defined and tested in Task4; do not create permissive or placeholder implementations for them in Task1. Root executes and captures tests; Source-only workers author only their assigned files and spawn no agents.

Reservation history is GLOBAL; valid prior released jobs remain. Preserve exact nonpromoting finalization and repeated cancellation-mapping rules from the strict DTO contract. Existing schema extraction tests consume real new pure schema exports while retaining their owned-child assertions. No new test is considered passing because a module is missing or a fixture fails. Actual live retirement and rollout remain unperformed until separately verified code, source/build, private material, DB/native and closure gates all pass.


Status: Root-adopted Source specification; no successful test, retirement or rollout admission is claimed. Initial Source-only drafting preceded adoption. No repository files, runtime artifacts, original custody, journal, DB state, OS configuration, credentials, ACLs, or services were changed.

## Bounded objective and provenance

Retire the reservation for job `d756f305-338b-4613-a055-36773303628c` at installation `fdd9fe74-ccee-4673-a727-64fe57f68ad0`, preserving its failure and unknown historical custody. The target remains the immutable release with Source `161297ffca6adf2851918a93d492e1c9a77ce59d`. The separately reviewed new maintenance program must have its own clean-main stock build.

Root supplied these historical observations: original worker PID 21709, actual exit 1, process close 1, both streams complete, journal revision 20 ending in settling, active reservation revision 6, cancelled consumed run and sixteen zero activity counts. They identify the investigation. They confer no effect authority and are not fresh proof. Exact record, journal, settlement, installation and activation hashes must be read and revalidated by the eventual admitted code; none are invented here.

Source basis inspected read-only: Setfarm writer `/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`, HEAD `8d2149aa6717f71307c00d5e45d07e8c764ccf09`, clean at inspection; MC writer `/Users/setrox/ai/setrox/.worktrees/mission-control-auth-order-test-20261021-v1`, parent-reported HEAD `dfd9b4f6e28c18784e17f18db56af3926080b719`. Read-only Git comparison found no difference in MC `server/services/control-jobs.ts` and `control-worker-settlement.ts` versus live MC Source `4a8458316b9826545cdf8508bbab43e80f161f37`. This does not authenticate installed target bytes.

Current execution starting state, as subsequently reported by Root: the same sole writer is clean on `fix/manual-orphan-retirement-20261021` at `161297ffca6adf2851918a93d492e1c9a77ce59d`; the native-work branch at8d2149aa remains retained and unchanged. The initial8d source inspection above is historical provenance, not an instruction to resume native-work delivery. Task1's exact nested data contract is now frozen in companion `2026-10-21-manual-orphan-task1-dto-v1.md`; its explicit corrections supersede broader shorthand in this draft.

## Existing constraints that the implementation must preserve

| Source anchor in Setfarm writer | Consequence |
| --- | --- |
| `src/installation/fresh-installation-selection-v1.ts:24` | Selection derives repository from the importing module. A new repository's selection is not the old target selection. Environment is captured and subsequent drift refuses. |
| `src/installation/fresh-installation-entry-v1.ts:34,41,75` | Ordinary entry requires its own Source/build to match the activated origin. Keep it unchanged; do not add maintenance exceptions. |
| `src/db-pg.ts:191` | The selected DB verifier independently checks its code-relative Source, role, connection and activated schema. It need not establish manual evaluator idle. |
| `src/execution/manual-test-admission-v1.ts:612,680,1036` | Recorded custody, held reservation and normal release require the original actual live owner. They cannot release this dead worker. |
| `src/execution/manual-test-admission-v1.ts:324` | Root namespace accepts exactly six known children. An added `retirements` directory causes the old binary to refuse/return unknown. Preserve that conservative compatibility behavior. |
| `src/execution/manual-test-admission-v1.ts:351` | Existing protocol takes the workflow insertion fence and keeps a mutation marker across filesystem publication and DB transaction acknowledgement. Errors leave uncertainty. |
| `src/db-pg.ts:5757,5784`; `src/execution/run-persistence.ts:337` | The shared migration advisory transaction lock and exact migration-31 row check serialize run insertion. Use the actual old DB module's fence, never a guessed lock number. |
| `src/execution/manual-test-admission-v1.ts:379,411,878` | Sixteen strict counts plus immutable finding publication joins and terminal slot/run/canonical-owner ancestry are required. Zero active rows alone is insufficient. |
| `src/execution/manual-test-admission-v1.ts:447,573` | Selected evaluator processes, direct intents, unresolved MC intents, maintenance residue and infrastructure identities participate in exclusion. |

The old `mutateV1`, `recordedCustodyV1`, `heldV1`, `releaseSelectedManualEvaluationV1`, and `closeSelectedManualWorkerCustodyV1` are not maintenance entry points. No forged Custody or pretend PID 21709 can be supplied to them.

## Separate authorities resolve the Source circularity

There are two independent assertions, never one substituted for the other:

1. **Maintenance authority M:** the actual new compiled entry, actual Node executable/argv/cwd/environment and complete finalized Source/build come from reviewed clean `main`, with the existing code-relative full Source/build observer. Record M's own Source and build hash. Its Source must differ from the old target; it never claims to be SF161. Review evidence is a delivery prerequisite, not something a hash self-certifies.
2. **Target authority T:** the unchanged installed SF161 release, exact acknowledged activation, selection identity, installation I5, exact original role/DB namespace and actual owned DB client remain valid under the target's existing verifiers. Record the complete target authority separately.

The maintenance module must not statically import its own `fresh-installation-selection-v1`, `db-pg`, or ordinary operational entry. Those modules would capture a new-code-relative target and fail the correct old Source guard. Its own full Source/build observer is code-relative and suitable for M; its ordinary runtime guard is configuration-relative and must not be accidentally used as an M verifier with target environment values.

A private target adapter derives the canonical old release locator from the authenticated fixed installation's prepared/activated state, checks the operation profile's exact target Source/installation/job and finalized build identity, and imports exactly two fixed relative modules from that target: `dist/installation/fresh-installation-entry-v1.js` and `dist/db-pg.js`. The full old dependency/build closure must be pinned before imports and checked after each awaited boundary. Pinning only those two files is insufficient. No input accepts module names, paths, functions, SQL, observers, or an allowlist.

Only the old entry calls `prepareFreshInstallationOperationalEntryV1()`; only its associated old DB module supplies the private client, transaction, fence and canonical terminal resolvers. M's checks run independently before and after this preparation. Freeze the exact target environment before importing T; reject preload/hooks/Node options and conflicting selection/PG/Git/module-resolution inputs. Never rebind imported selection or mix new and old DB singletons. A private WeakSet-backed capability binds M, T, selected namespace, original job/pins and client epoch. Its implementation provides only typed observe and retire operations. No raw DB client or arbitrary callback escapes.

This is a maintenance **code role**, not a new OS or PostgreSQL role. Existing credentials remain private; no DDL, grants, ACL changes or new credentials occur. Internally importing a general old DB module is not an OS sandbox: restriction is enforced by the reviewed adapter's fixed call graph, private closure, strict CLI and negative tests. It must not expose or invoke unrelated normal writes.

Proof obligation: compile and exercise a genuine isolated old-target/new-maintenance pair before any live admission. A fake loader test does not prove coexistence. If the existing old target fails any current Source/activation/DB check, stop there. Do not relax a verifier to make the bridge work. No service restart or activation update is needed or permitted by this transition.

## Pure proof core and authority boundary

Create an import-inert strict schema module and pure proof module. They may import Zod, canonical JSON/hashing, and pure owner/journal/publication parsers only. No fs, subprocess, environment, SQL, selected installation, runtime guard, or module-loader imports.

The pure proof accepts a detached snapshot of actual records: all reservation revisions/head bytes, intent/channel/receipt-mapping/settlement bytes, journal bytes/head, normalized DB rows and terminal ancestry, native capture facts, and M/T identities. The adapter exclusively collects it. Parsing and a successful pure verdict are data, not effect capabilities; a caller can construct a synthetic valid snapshot for tests without gaining target access.

Proposed exact exported boundary:

```ts
parseManualOrphanEvidenceV1(input: unknown): ManualOrphanEvidenceV1
proveManualOrphanRetirementV1(input: ManualOrphanEvidenceV1): ManualOrphanVerdictV1
classifyManualOrphanReplayV1(input: unknown): ManualOrphanReplayV1
// Verdict: { status: "eligible", evidenceHash, priorRecordHash, releasedRecordHash }
//       | { status: "refused", code: ManualOrphanRefusalCodeV1 }
// Replay: { status: "complete", receipt: ManualOrphanRetirementReceiptV1 }
//       | { status: "absent" } | { status: "uncertain", code: ... }
```

The actual exported effect/read API accepts only:

```ts
type ManualOrphanRequestV1 = Readonly<{
  requestId: string; jobId: string; expectedRevision: 6;
  expectedRecordHash: string; expectedJournalHeadHash: string;
  expectedSettlementHash: string;
}>;
observeSelectedManualOrphanV1(): Promise<ManualOrphanObservationV1>
retireSelectedManualOrphanV1(request: ManualOrphanRequestV1): Promise<ManualOrphanRetirementReceiptV1>
```

These APIs invoke private compiled-entry authentication and fixed profile admission themselves. The observation returns safe hashes/status only; it is not a capability and cannot be supplied back as proof. Request hashes are CAS assertions, not caller authority. There is no `force`, `ignore`, generic job search, caller-supplied target, or authority injection option. The core remains generic over structurally valid evidence; the admitted v1 operation profile confines the effect to I5/SF161/the specified job/revision6-to7. It is not a project-name exception in a normal gate.

## Prerequisite proof

Every requirement below must hold together under the insertion fence before any publication:

- Stable private files: bounded sizes; canonical bytes; no symlinks, traversal or extra names; regular single-link files; 0600 files and 0700 private directories; expected uid/gid; descriptor and named dev/ino/mode/nlink/size/mtime/ctime plus parent identities; revalidated bytes and SHA256. No credential-bearing bytes appear in reports/stdout.
- Exact selected history: contiguous immutable GLOBAL revisions1–6, current head equals revision6 bytes, phase active, exact current job/kind `convergence_full8`/execute, selection/source/suite, nonce digest, old owner and admission. Prior jobs are legal only across normal pending-after-released boundaries. Filter the current job's contiguous segment for cumulative eight distinct slots; no slot removal, replacement or duplicate consumed run. Journal acquired.reservationRevision joins the actual acquired active revision, not automatically6; canary_bound joins the actual binding revision. The regression fixture uses prior job pending1/active2/released3 and current job pending4/active5/bind6, acquired journal5 and canary_bound6.
- Original authentication history: strict `intent.json` and `channel.json`, receipt history/index/mapping consistency, exact intent hash, channelId, nonce digest, ready-frame mapping/hash and original owner. MC `control-jobs.ts:476-481` writes channel only after authenticated ready and exact original-owner agreement. Use this persistent provenance and pinned producer Source; do not claim replayed HMAC validation without the original key. Missing or conflicting authenticated provenance refuses.
- Actual settlement contract: strict `mission-control.control-original-worker-settlement.v1`, subject `original_fixed_node_worker`; exact job/kind/channel/intent/selection/SF Source/MC Source/MC build/Node executable hash/broker identity context. `originalChild` is nonnull and exactly equals stored reservation/channel/acquired owner; `ownerHash` recomputes. Exit and processClose must each equal `{code:1,signal:null}` for this bounded operation; stdout and stderr both have `endObserved:true,closeObserved:true`; errors is empty; observedFactsComplete is true and independently recomputed; recordedAtUTC valid. This record contains no original stream byte hashes, so do not invent them. It is broker-owned original-handle evidence, not proof of the original worker's success or current absence.
- Full bounded journal: parse every record with existing canonical parsers, contiguous previousHash links, exact job/intent/ownerHash; head exactly names revision20; acquired owner/selection/source/suite/reservation agree; legal recorded event sequence ends in settling. Reject release, closed, promotion_confirmed, continue+go, impossible binding or an unaccounted final effect. Accept exact nonpromoting ancestry: candidate → finalizing → finalization_boundary(cancel) → cancelled_final(no_go), or candidate(no_go) → finalizing → finalization_boundary(continue,no_go) → final_without_promotion(no_go), then settling. Cancellation-latch events may interleave as the real producer permits. Validate actual content-addressed result/gate bytes and the bounded release_go DB census; nonpromoting artifact publication is not custody closure. Preserve all old bytes. Never copy the start-child validator's ban on finalization_boundary into retirement; that ban applies to new run insertion before finalization.
- DB: fresh exact sixteen fields, nonnegative safe integers, every field zero; complete bounded finding parent/child publication validation. For each slot require original admission/source/suite/selector/case/task/repetition, claim `run_id` and `consumed_at` both null or both nonnull. Consumed runs must be terminal with matching v3 protocol/version/compiler/release/task and canonical closed run owner plus terminal-close ancestry. Use actual old DB resolvers and `FOR UPDATE` row locks where current release does. No new DB row mutation, run cancellation, event draining or owner closure is part of retirement.
- Native evidence: new fixed code-owned captures identify their actual executor, argv, timestamps, completion, byte counts/hashes and transport facts. Require complete bounded process census, original PID absent, no reused ambiguous PID identity, no selected evaluator/process-group/direct-descendant residue or unexplained selected reference; verify persistent infrastructure exactly. This is fresh absence at observation points, not original process closure. Existing selected infrastructure stays excluded only after its normal exact validation.
- Other owners: all unrelated MC/direct intents, unexpected namespace entries, maintenance locks/temp residue and other maintenance processes block. The pending retirement path can exclude exactly its authenticated target intent only after the full proof; no general unknown-owner suppression or fake live `self` is accepted.

Repeat target epoch, Source/build/material/namespace pins, DB/slot and native checks after publication and before final acknowledgement. State observation start/end honestly. Do not claim a whole-guard timing bound from one Source-check duration.

Each collected proof snapshot has two native observations bracketing that snapshot's reads. Both prepublication observations must actually exist before eligibility is proved. After publication collect a second fresh bracketed snapshot; do not populate the first snapshot with future observations. The immutable sidecar binds the prepublication proof and intended released bytes, not a claim that a future DB acknowledgement or postpublication observation has already occurred. Marker removal is reserved for the later completed protocol.

## Administrative publication and replay

The sidecar schema is `setfarm.manual-control-orphan-retirement.v1`, separate from normal custody closure. Its body records request/profile, M and T authority hashes, original owner/intent/nonce digest, prior revision6 byte hash, intended released revision7 byte hash, original journal20 head/settlement/context pins, cumulative slot and DB/finding/native proof hashes, publication executor identity and timestamp. Do not embed secrets, slot tokens or raw logs. The safe returned receipt contains requestId/jobId/prior/released/sidecar/evidence hashes and disposition `administratively_retired`; worker outcome remains unknown with observed exit1.

1. Acquire actual T workflow insertion fence in the privately owned T transaction; re-read all CAS/pins/prerequisites. Existing mutation, conflicting sidecar/closure, changed revision/hash, or competing operation refuses.
2. Exclusively create this operation's mutation marker using the existing mutation namespace/protocol and an exact owned file pin. Start publication only after all prechecks succeed. Marker absence before this step permits clean refusal with no retirement effect.
3. Exclusively publish `runtime/evals/manual-controls/retirements/<jobId>.json`; fsync file/directory and read back. It is immutable and distinguishes administrative retirement from worker closure. A sidecar without a matching released head is incomplete and never grants exclusion.
4. Append immutable `revisions/00000000000000000007.json` using the existing record schema. Change only reservation.revision to7 and phase to released. Preserve the original owner, intent, nonce digest, admission, slots and every other reservation field. Do not add unrecognized administrative fields to the old record schema. Link semantics reside in the sidecar.
5. Publish current `reservation.json` via checked temporary file and atomic rename, with existing exact prior-file CAS and fsync/readback. Verify sidecar/prior/history/head join and post-publication fresh proof while marker is still present. Any temporary residue blocks observation.
6. Require actual DB transaction acknowledgement, revalidate M/T/client/pins and final fresh state while marker protects insertion, then remove only this operation's exact marker and sync/read back its absence. Never delete someone else's/stale marker. Return success only after all checks complete.

DB/filesystem publication is not an atomic transaction. Rollback, lost acknowledgement, exception, process loss, partial history, sidecar-only, head/history mismatch, marker/temp residue or drift is uncertain and blocks. No automatic completion, cleanup, rollback, retry publication or repair of partial states is allowed. If marker unlink/fsync or its result is uncertain, the running process latches refusal; the implementation must explicitly fault-test this boundary and may not infer successful retirement from revision7 alone.

An exact already-complete replay has the same request, target and prior/released/sidecar bytes, no marker/temp residue, intact immutable history and original evidence, and freshly authenticated M/T/native/DB state. It returns the original safe receipt without new revision, sidecar rewrite or new timestamp. A crash after the terminal committed state but before the response can be recognized only by that complete-state proof. Any partial/ambiguous state returns uncertain, never a repair. Changed request, later job/head or mismatched inputs refuses.

There is no rollback by deleting retirement/history. This transition changes admission meaning permanently for the exact old intent while preserving the audit record.

## Typed observer and future admission semantics

Introduce an administrative observation state that separates `reservationDisposition: administratively_retired` from `workerOutcome: ownership_unknown` and `observedExitCode:1`. A newly reviewed immutable controls observer/rollout evaluator may recognize exactly this sidecar/prior7 transition. It must report the old failed/partial evaluation and does not invent a closed journal, empty receipts, successful full8, qualification PASS, zero failures or permanent idle.

The old SF161 observer remains UNKNOWN because its namespace/custody rules do not recognize administrative retirement. New ordinary admission Source may allow exactly the validated retired intent in namespace ownership checks, reject that job's reuse, and retain all other process/intent/mutation checks. Ordinary operational Source guards remain unchanged, so it cannot simply run against SF161 activation. Until a separately admitted successor exists, use the fixed maintenance read observer for the old target. A rollout still needs its own current typed/native/DB/material/role/Source/custody and service-health gates.

## Unresolved actual-source/effect constraints

1. Source code was inspected, not installed SF161 compiled bytes or its complete dependency closure. The two-version bootstrap remains unproven until a genuine isolated test validates actual old exports, current Source checks, role permissions, fence/resolver behavior and environment coexistence.
2. No private material was read. Exact I5 locator/build/activation/catalog/record/channel/ready-receipt/journal/settlement hashes, broker provenance, original owner identity and complete finalization ancestry remain prerequisites for admission, not filled-in assumptions.
3. The MC settlement contract has a TypeScript producer type, not a shared strict parser. The new pure parser must reproduce the pinned old producer contract and be tested against synthetic producer records. Do not import the active MC server or run it to parse records.
4. Existing namespace/process helpers are private and coupled to live custody/selected globals. Extract pure validation and explicit read-only data models without exporting a bypassable `ignoreIntent` or general SQL capability. Genuine maintenance native census coverage must be tested beyond PID absence.
5. Before admitting an effect, verify exactly how all other writers intersect the insertion fence/marker and that post-ack rechecks cannot let a competing run birth slip through. Cleanup uncertainty and exact replay boundaries need explicit fault injection. No claims of cross-filesystem atomicity.
6. Existing test harnesses contain scoped readiness projection/adapters. They are not genuine production bootstrap proof. Keep pure tests independent and include a real old/new compiled isolated test under the current harness requirements, without reusing adapters as production authority.

Companion implementation plan: `../plans/2026-10-21-manual-orphan-retirement-v1.md`. Strict Task1 contract: `2026-10-21-manual-orphan-task1-dto-v1.md`. This report does not count the reservation as retired.
