# Manual orphan Task1 strict DTO contract v1

## Root adoption and execution boundary

Root adopts this specification/plan on2026-10-21 for the existing Setfarm completion objective. The missing dead-evaluator administrative transition currently blocks a fresh full8 run and reviewed MC rollout. Active sole writer is branch `fix/manual-orphan-retirement-20261021` from reviewed SF161; native branch8d2149aa remains preserved separately. Existing user authorization covers ordinary causal Source/test/docs work and reviewed delivery; it grants no bypass of current runtime/material/authority gates.

Task1 is the pure prepublication record/request/settlement/evidence schema, exact historical joins, eligibility proof and released-record derivation. Its DTO contract in the companion specification is normative. All runtime inputs are reparsed and bounded even when TypeScript types say they are validated. Task1 adds no effect capability, publication, live observer exception, old-journal event, or retirement. Sidecar/replay/postpublication schemas and serialization are defined and tested in Task4; do not create permissive or placeholder implementations for them in Task1. Root executes and captures tests; Source-only workers author only their assigned files and spawn no agents.

Reservation history is GLOBAL; valid prior released jobs remain. Preserve exact nonpromoting finalization and repeated cancellation-mapping rules from the strict DTO contract. Existing schema extraction tests consume real new pure schema exports while retaining their owned-child assertions. No new test is considered passing because a module is missing or a fixture fails. Actual live retirement and rollout remain unperformed until separately verified code, source/build, private material, DB/native and closure gates all pass.


This is the normative prepublication Task1 refinement of specification `2026-10-21-manual-orphan-retirement-v1.md` and plan `../plans/2026-10-21-manual-orphan-retirement-v1.md`. The initial external drafts were corrected before Root adoption. No implementation, test, module, native capture, DB call, private material read or retirement is claimed by this contract.

Root reports the same sole writer now clean on `fix/manual-orphan-retirement-20261021`, Source `161297ffca6adf2851918a93d492e1c9a77ce59d`; native-work Source8d2149aa is retained on its original branch. Source anchors below refer to unchanged inspected files. MC producer anchors are relative to `/Users/setrox/ai/setrox/.worktrees/mission-control-auth-order-test-20261021-v1`; its two control producer files previously compared equal to live4a845831.

## 1. Contract boundary and concrete corrections

The DTOs below are **data**. A complete synthetic fixture can pass pure proof. It can never grant a filesystem/DB/native capability or prove that the runtime adapter actually observed the facts. Only the separately authenticated M/T adapter collects current facts and grants private operation authority. No `authenticated:true`, `closed:true`, `idle:true`, arbitrary SQL callback, root override, ignore list or proof-success boolean substitutes for the defined records and joins.

Every declared object has exact keys and is strict at every nesting level. A nullable field is required and may contain null; it is not optional. Missing/extra keys refuse. Existing schema aliases retain their exact optional fields/refinements rather than silently normalizing them. No `Record<string,unknown>`, `any`, unparsed JSON payload or arbitrary predicate survives the parser.

Three corrections are load-bearing:

1. Reservation history is GLOBAL. `manual-test-admission-v1.ts:299-322` validates contiguous global revisions and pending-after-prior-released job transitions. Current job need not own1–6. Journal acquired refers to its actual acquired active revision; canary_bound refers to its later bound revision. The mandatory fixture is old job1pending/2active/3released, current job4pending/5active/6bound, journal acquired5/canary_bound6. Revision6 has phase active, not a new `bound` phase.
2. Nonpromoting finalization is compatible with settling. `convergence-runner.ts:1125-1155`, `manual-test-worker-v1.ts:302-304,453-481` show candidate → finalizing → boundary → cancelled_final or final_without_promotion → settling before release. Rejecting every finalization_boundary/final artifact would reject the valid target class. Reject promotion_confirmed and continue+go; validate actual nonpromoting artifact ancestry and release_go census. `manual-test-admission-v1.ts:762` forbids finalization only for a **start-child insertion proof**; do not reuse that ban for retirement.
3. Receipt snapshots can reuse a prior mapping. MC `control-jobs.ts:416,658-662` writes a newly revised cancellation receipt with `e.frames.at(-1)` unchanged. The mapping ACK embeds its original receipt, not necessarily the newer outer cancellation receipt. Validate mapping against its original snapshot and cancellation ancestry. Never require every outer receipt to equal the repeated mapping ACK receipt.

## 2. Primitive vocabulary and exact reused schemas

Notation below is a declarative TypeScript contract. `Readonly` applies recursively. Each named type must have one concrete strict schema; use `z.infer` for implementation types rather than duplicate structural type definitions.

- `Hash`: exactly64 lowercase hexadecimal characters. `Source`: exactly40 lowercase hex for control identities. `GitHash`: the existing `GitObjectHashSchema` for Source authority fields, retaining its supported lengths.
- `UUID`: lowercase canonical UUID accepted by the existing control Id schema.
- `Count`: safe nonnegative integer; `Positive`: safe integer≥1; `Pid=Positive`; parent/process-group census IDs can be Count.
- `UTC`: finite canonical `new Date(value).toISOString() === value` timestamp. All DB `Date` values are converted once by the private collector to UTC strings; the pure parser accepts no Date, bigint, function, class instance or coercible string-number.
- `Absolute`: canonical normalized absolute string,1..4096 bytes/characters under existing control path rules, no control characters. `Relative`:1..4096 normalized slash path, no absolute path, backslash, empty/dot/dotdot segment or control character. Each document additionally has a recomputed exact allowed locator; relative syntax alone does not authorize a read.
- `RunId`: existing worker journal RunId (`[A-Za-z0-9_.:-]+`,1..200). `Task`: string0..1MiB UTF-8 (empty is syntactically retained but cannot satisfy a nonempty matching admitted task unless the existing admission really names it). `Ref`: existing owner-admission canonical-ref predicate, normal max4000; terminalOwnerRef retains max12519. No generic URL validator.
- `Decimal`: `0|[1-9][0-9]*`, max30 digits, used only to detach filesystem integer metadata; compare exact decimal values, never float conversions.

Use these exact existing pure schemas/types:

| Local alias | Existing schema/validator |
| --- | --- |
| `Owner` | `ObservedControlWorkerOwnerV1Schema`, `src/execution/schemas/manual-control-worker-channel-v1.ts` (same seven fields as manual OwnerSchema). |
| `Selection` | `ControlSelectionIdentityV1Schema`, `src/execution/schemas/manual-control-job-v1.ts:16`. |
| `Receipt`, `Intent`, `ReportRefs` | `ControlJobReceiptV1Schema`, `ControlPrivateIntentV1Schema`, `ControlReportRefsV1Schema`, same file. |
| `JournalRecord`, `JournalHead` | `WorkerJournalRecordV1Schema`, `WorkerJournalHeadV1Schema` and byte parsers, worker-channel file:181–207. |
| `Admission` | `V3ReleaseAdmissionV1Schema`, `src/execution/v3-release-admission.ts`; retain content-derived admissionHash. |
| `Close` | `validateInternalProductionOwnerReservationCloseV1`, `src/internal-production/owner-admission-v1.ts:2613`; exact12 fields and content-derived closeRef/hash. |
| `FindingSet`, `Finding` | `FindingSetV1Schema`, exported `FindingV1Schema`, `src/findings/finding-set.ts`; retain hash/order/status refinements. |
| `EvalResult`, `RunResult`, `Gate` | `ConvergenceEvalResultVersionedSchema`, `ConvergenceEvalRunResultVersionedSchema`, `src/evals/result-schema-v2.ts:203-213`; `ConvergenceReleaseGateV1Schema`, `src/evals/release-gate.ts:37`. |

Import the pure schema files, never `report.ts` or `v3-release-admission-repository.ts` for parsing: those modules import filesystem/selection concerns. The owner close validator's import closure must be checked for import-inertness before reuse; the pure core cannot import DB modules for their types at runtime.

Source authority is exactly `{branch:"main",clean:true,sha:GitHash,treeHash:GitHash,buildHash:Hash,originMainSha:GitHash}` with sha=originMainSha (`baseline-post-handoff-receipt-v1.ts:124,1496`). This is a strict data projection in Task1; do not import that operational observer to parse it.

## 3. Canonical file data and file-pin projection

```ts
type Bytes = { base64: string; byteLength: Count; sha256: Hash };
type FileStat = {
  dev: Decimal; ino: Decimal; mode: Decimal; nlink: Decimal;
  uid: Decimal; gid: Decimal; size: Decimal; mtimeNs: Decimal; ctimeNs: Decimal;
};
type ParentStat = {
  dev: Decimal; ino: Decimal; mode: Decimal; nlink: Decimal;
  uid: Decimal; gid: Decimal; size: Decimal; mtimeNs: Decimal; ctimeNs: Decimal;
};
type ParentPinData = { relative: string; before: ParentStat; after: ParentStat };
type FileData = {
  relative: Relative; bytes: Bytes;
  descriptorBefore: FileStat; descriptorAfter: FileStat; namedAfter: FileStat;
  parents: ParentPinData[];
};
type Document<T> = { file: FileData; value: T };
```

`ParentPinData.relative` is `""` for the approved root or a `Relative`;1..32 ordered ancestor pins, no gaps/duplicates. Decode base64 strictly (roundtrip must reproduce exact encoding), match byteLength/hash/size and cap before JSON parsing. Require equal relevant before/after/named metadata, regular single-link file mode0600 and private directory0700/uid/gid matches captured installation policy. These data comparisons do not replace the adapter's actual held descriptor rechecks. Source/build and native executable files have their own target verifier policy and are not misclassified as0600 private records.

For each `Document<T>`, parse original bytes into T and require exact semantic equality with `value`; forbid parser stripping unknown keys. Check original serialization where the producer defines it:

- Reservation/revisions: original `JSON.stringify(RecordSchema.parse(value))+"\n"` key order (`manual-test-admission-v1.ts:122,292`).
- Journal/head: existing canonical byte parsers. MC intent/channel/receipt/index/settlement: canonical sorted JSON plus newline (`MC control-evidence.ts:6-13`).
- Start-child proof: canonical sorted JSON plus newline (`manual-test-admission-v1.ts:800`).
- Eval artifacts: existing store writes pretty JSON plus newline, but `get` validates parsed payload/content hash rather than exact pretty bytes (`evals/report.ts:61,86-109`). Pin byte SHA256 separately; do **not** equate semantic resultHash/gateHash with SHA256(fileBytes).

Private file caps: reservation65536; intent32768; channel16384; receipt32768; settlement16384; journal record65536/head1024; index8MiB; eval artifact16MiB; start-child65536; closure32768. New caps stricter than unknown historical sizes are fail-closed proposed limits, not claims that private target material already fits. Whole detached snapshot decoded bytes≤128MiB and JSON nesting≤64; reject oversize before allocation. These limits do not raise existing file-specific limits.

## 4. Reservation and global history DTOs

Extract existing schemas without altering fields/serialization:

```ts
type Acquire = {
  jobId: UUID; kind: "activation_preflight" | "convergence_full8";
  selectionHash: Hash; sourceSha: Source; suiteHash: Hash | null;
};
type Reservation = Acquire & {
  revision: Positive;
  phase: "pending" | "active" | "cancelling" | "ownership_unknown" | "released";
};
type Slot = { admissionHash: Hash; slotHash: Hash; caseHash: Hash; taskHash: Hash; repetition: 1 };
type RecordData = {
  schema: "setfarm.manual-evaluation-record.v1"; reservation: Reservation;
  owner: Owner; intentHash: Hash; nonceDigest: Hash;
  admissionHash: Hash | null; slots: Slot[]; executionMode: "preflight" | "execute";
};
type Closure = Acquire & {
  schema: "setfarm.manual-control-custody-closed.v1";
  executionMode: "preflight" | "execute"; intentOrigin: "mission_control" | "direct";
  intentHash: Hash; nonceDigest: Hash; owner: Owner;
  closure: { kind: "never_reserved" }
    | { kind: "reservation_released"; revision: Positive; recordHash: Hash };
};
type StartChild = {
  schema: "setfarm.manual-start-child.v1"; reservation: Reservation;
  intentHash: Hash; owner: Owner; child: Owner; parentPid: Pid;
  journal: { revision: Positive; hash: Hash }; slot: Slot;
  caseId: string; workflowId: string;
};
```

Slots0..8, journal ref1..1024, caseId/workflowId1..128. Retain Closure's original recipe refinement (`manual-test-admission-v1.ts:35-45`). History contains exactly global revisions1..6 for this prepublication profile; each path must be `evals/manual-controls/revisions/<20-digit revision>.json`; head path is `evals/manual-controls/reservation.json` relative to selected runtime. Global history has no missing file, duplicate current job segment or identity drift. Only current segment slots participate in current canary proof. Prior jobs must have intact closure provenance if their retained intent exists; never ignore them merely because their reservation phase is released.

Acquired journal references the actual current segment active record immediately following its pending record. This record has no bound slots yet. Each canary_bound references a later actual active revision that contains precisely that event's stored contexts; compare immutable identity, slot contents and admission. Current revision6 has all8 distinct slots. No requirement that reservation revision equal journal revision; the two counters are unrelated.

## 5. MC channel, mapping, receipt and index DTOs

```ts
type Channel = {
  schema: "mission-control.control-channel.v1";
  jobId: UUID; intentHash: Hash; channelId: UUID;
  originalChild: Owner; readyFrameHash: Hash;
};
type Ack = {
  schema: "setfarm.manual-control-worker-channel.v1";
  jobId: UUID; channelId: UUID; intentHash: Hash;
  direction: "broker_to_worker"; sequence: Positive;
  body: { type: "ack"; workerSequence: Positive; workerFrameHash: Hash;
    receiptRevision: Count; receipt: Receipt };
  mac: Hash;
};
type ReceiptMapping = { sequence: Positive; hash: Hash; ack: Ack };
type ReceiptSnapshot = { receipt: Receipt; mapping: ReceiptMapping | null };
type CancelAlias = { keyHash: Hash; expectedRevision: Positive };
type IndexCancel = { keyHash: Hash; requestId: UUID; receipt: Receipt; aliases: CancelAlias[] };
type IndexEntry = { keyHash: Hash; intentHash: Hash; published: boolean;
  receipt: Receipt; frames: ReceiptMapping[]; cancel: IndexCancel | null };
type IndexHistory = { id: Hash; selectionHash: Hash; sourceSha: Source; refs: ReportRefs };
type IndexData = { schema: "mission-control.control-index.v1";
  revision: Positive; jobs: IndexEntry[]; history: IndexHistory[] };
type CancelRecord = {
  schema: "mission-control.control-cancel.v1"; jobId: UUID; intentHash: Hash;
  channelId: UUID; requestId: UUID; idempotencyKeyHash: Hash;
  acceptedReceiptRevision: Count; requestedAt: UTC;
};
type CancelReplay = CancelAlias & { requestId: UUID; receipt: Receipt };
type McEvidence = {
  index: Document<IndexData>; channel: Document<Channel>;
  receipts: Document<ReceiptSnapshot>[];
  cancel: Document<CancelRecord> | null; cancelReplays: Document<CancelReplay>[];
  settlement: Document<Settlement>;
};
```

Bounds: index jobs≤10000 (existing), history≤10000 (new bounded fail-closed ceiling), frames≤64, aliases/replays≤32; target receipts1..4096, complete numbered receipt1..current revision, no duplicate file/revision. MC aliases have strict keys even though the historical reader's alias check is less explicit. Selected job exactly once, published=true. Retain other index jobs for namespace/selection checks; do not manufacture an index containing only target.

Mappings: mapping.sequence=ack.body.workerSequence, mapping.hash=ack.body.workerFrameHash, ack.body.receiptRevision=ack.body.receipt.revision; job/channel/intent exactly match Channel/Intent. Unique worker-sequence mappings increase in first-occurrence order; repeated mapping must be byte/semantic-identical. ACK envelope sequence may have gaps because custody/cancel messages also increment broker sequence; do not require it equals workerSequence. Index.frames is exactly the final64 mapping history entries (deduplicated by worker sequence), not necessarily the whole history. Channel.readyFrameHash joins the first worker mapping, sequence1, with original ready-produced receipt in retained snapshots. The raw original ready envelope is not stored by this producer; do not require one or reconstruct an invented MAC.

First receipt equals intent.receipt with mapping null. A snapshot where a new mapping first appears equals its ack.body.receipt. A cancellation snapshot may retain the old mapping while its outer receipt advances; require the actual CancelRecord/index cancel receipt join and unchanged old mapping. No unexplained receipt transition, dangling repeated mapping or receipt-file/index disagreement is eligible. The pure core validates recorded broker provenance and consistent hashes; neither the hash nor the retained ACK MAC is fresh cryptographic authentication without the original nonce. Do not recover the nonce or claim HMAC replay.

`Receipt.state` is the stored state. MC `projection()` can dynamically return ownership_unknown without persisting that state (`control-jobs.ts:402-411`). Do not require stored receipt.state=ownership_unknown merely because the observed public job is UNKNOWN. The resulting retirement receipt still preserves unknown worker custody.

## 6. Original worker settlement DTO

```ts
type ExitTuple = { code: number | null; signal: string | null };
type StreamEnd = { endObserved: boolean; closeObserved: boolean };
type Settlement = {
  schema: "mission-control.control-original-worker-settlement.v1";
  subject: "original_fixed_node_worker";
  jobId: UUID; kind: "activation_preflight" | "convergence_full8" | "ui_regression";
  channelId: UUID; intentHash: Hash; selectionHash: Hash; sourceSha: Source;
  mcSourceSha: Source; mcBuildHash: Hash; executableHash: Hash; brokerPid: Pid;
  originalChild: Owner | null; ownerHash: Hash | null;
  exit: ExitTuple | null; processClose: ExitTuple | null;
  stdout: StreamEnd; stderr: StreamEnd;
  errors: ("CHILD_ERROR" | "STDOUT_ERROR" | "STDERR_ERROR" |
    "STDOUT_LOG_ERROR" | "STDERR_LOG_ERROR" | "OWNER_BINDING_ERROR")[];
  observedFactsComplete: boolean; recordedAtUTC: UTC;
};
```

Source: MC `control-worker-settlement.ts:5-22,65-126`. Exit code, when nonnull, is a safe integer; signal nonnull is1..128 noncontrol characters; exactly one of code/signal is nonnull. Error array unique,≤6, producer enumeration order. Syntax retains incomplete/null facts for negative tests. Eligibility recomputes completeness and requires exact code1/signalnull for both exit and processClose, all4 stream booleans true, errors[], nonnull originalChild/ownerHash. Join originalChild to reservation/channel/acquired owner and recompute hash. Context joins expected broker build/Node pins, target selection, job/channel/intent. brokerPid is historical producer identity and must not be tested as if it were the original worker PID. This producer does not persist broker processStartedAt/PGID/full command identity; do not claim that it does or construct a synthetic broker Owner from brokerPid. If effect admission needs that stronger historical identity, require a separately pinned genuine record or refuse; this DTO cannot recover it. The producer does not record original stdout/stderr bytes or hashes: no synthetic bytes are added to Settlement.

## 7. DB activity, findings and slot DTOs

The activity object contains **exactly** these16 keys (`manual-test-admission-v1.ts:379-399`), each Count; eligible iff all16 zero:

```ts
type Activity = {
  active_runs: Count; open_claims: Count; active_attempts: Count;
  active_attempt_binding_conflicts: Count; active_runtimes: Count;
  active_runtime_completions: Count; active_completion_effects: Count;
  active_recovery_cases: Count; active_recovery_deliveries: Count;
  active_termination_requests: Count; active_compilations: Count;
  active_publications: Count; active_publication_batches: Count;
  active_outbox: Count; active_operational_deliveries: Count;
  active_owner_reservations: Count;
};
type FindingParent = {
  finding_set_hash: Hash; finding_set_id: FindingSet["findingSetId"];
  run_id: FindingSet["runId"]; story_id: FindingSet["storyId"];
  packet_hash: Hash; slice_hash: Hash; source_sha: GitHash; source_tree_hash: GitHash;
  finding_ids: Finding["findingId"][]; payload: FindingSet;
};
type FindingChild = {
  finding_set_hash: Hash; finding_id: Finding["findingId"];
  origin: Finding["origin"]; classification: Finding["classification"];
  invariant_ref: Finding["invariantRef"]; status: Finding["status"];
  source_fingerprint: Hash; payload: Finding;
};
type AdmissionRow = { payload: Admission; expires_at: UTC; expired: boolean };
type ClaimRow = {
  run_id: RunId | null; consumed_at: UTC | null; admission_hash: Hash;
  admission_kind: "convergence_canary"; case_hash: Hash; task_hash: Hash;
  repetition: 1; selector_hash: Hash;
};
type RunRow = {
  id: RunId; status: "completed" | "failed" | "cancelled";
  protocol: "v3"; protocol_version: 1; compiler_release_sha: Source;
  release_admission_hash: Hash; task: Task;
};
type CanonicalRunIdentity = { category: "run"; ownerKey: RunId; ownerRef: Ref; ownerHash: Hash };
type ClosedOwnerRow = {
  state: "closed"; close_ref: Ref; close_hash: Hash;
  canonical_owner_identity: CanonicalRunIdentity;
};
type TerminalPair = {
  runOwnerReservationRef: Ref; runOwnerReservationHash: Hash;
  terminalAuthorityRef: Ref; terminalAuthorityHash: Hash;
};
type SlotEvidence = {
  slot: Slot; admissionRows: AdmissionRow[]; claimRows: ClaimRow[];
  runRows: RunRow[]; ownerRows: ClosedOwnerRow[];
  terminalPair: TerminalPair | null; close: Close | null;
};
type ReleaseGoRow = {
  admission_hash: Hash; kind: "release_go"; release_sha: GitHash; suite_hash: Hash;
  result_hash: Hash; result_ref: string; gate_hash: Hash; gate_ref: string;
  expires_at: null; payload: Admission;
};
type DatabaseEvidence = {
  observedAtStartUTC: UTC; observedAtEndUTC: UTC;
  databaseName: string; currentUser: string; sessionUser: string;
  ownerOid: Positive; runtimeOid: Positive; backendPid: Pid;
  activityRows: Activity[]; findingParents: FindingParent[]; findingChildren: FindingChild[];
  slots: SlotEvidence[]; releaseGoRows: ReleaseGoRow[];
};
```

Bounds: activityRows0..2 (require1); admission/claim/run/owner arrays0..2 (require exact cardinality as below); findingParents≤4096/findingChildren≤65536/finding_ids≤5000; slots exactly8; releaseGoRows≤4096. Collector queries LIMIT cap+1 and rejects overflow, rather than truncating to the DTO cap. DB names/role names1..63 UTF-8 bytes, no NUL; identities bind fixed target verifier output. `backendPid` is actual DB-returned session data, not the original worker/native child PID; pool/epoch authority remains private adapter state.

For each slot require one canary admission row and one claim row. Admission kind must be convergence_canary; expires_at=payload.expiresAt; expired must be boolean but **expiry may be true** because terminal proof calls admission with requireUnexpired=false (`manual-test-admission-v1.ts:691,879`). Require selector/case/task/source/suite/repetition and derived slot hash joins. The bound journal's private token can be hashed to verify selector without exporting token.

Unconsumed: claim.run_id=null AND consumed_at=null, runRows/ownerRows empty, pair/close null. Consumed: both nonnull, one RunRow, one ClosedOwnerRow, nonnull TerminalPair/Close, matching run/record/admission/task. Recompute canonical run identity using existing pure creator; validate Close with its exact existing validator; match reservationRef/hash and closeRef/hash; derive terminal authority pair from canonical owner + terminalOwnerRef/hash and match actual old resolver result. An asserted `canonicalClosed:true` or terminal status alone is invalid. Resolver-produced data is still data; adapter must actually call fixed old resolver in same fenced transaction.

FindingParent/Child shape is exact SQL projection at manual admission401-409 and `finding-publication-v1.ts:11-68`. Reject duplicate parents, child duplicates/orphans, oversize and every immutable relation mismatch; use `requireFindingPublicationV1`. Open historical finding status is allowed when publication is coherent; do not demand issue closure.

`ReleaseGoRow` matches actual repository SELECT columns (`v3-release-admission-repository.ts:555-562`). Its artifact refs must equal `convergenceArtifactRef(hash)`, payload kind=release_go and every redundant column must match payload. Collect all release_go rows for the exact target Source (fixed predicate and bounded count), not just rows whose supplied JSON looks related. Refuse any row whose result/gate hashes intersect this journal's candidate/final hashes; unrelated authenticated release_go rows are not evidence this job promoted. Recheck after publication. This is an additional read-only census; it grants no normal write or promotion authority.

Invalid nonterminal/wrong-protocol DB rows can fail at parser `MALFORMED` rather than semantic `SLOTS`; tests must assert refusal, not force malformed rows into a narrowed success type.

## 8. Native capture DTO — raw completion and rows, never an absence boolean

```ts
type CaptureStream = {
  bytes: Bytes; dataBytesObserved: Count;
  endObserved: boolean; closeObserved: boolean;
};
type NativeCapture = {
  captureId: UUID; collector: Owner;
  executable: "/bin/ps"; argv: string[]; cwd: Absolute;
  executorPid: Pid; executorParentPid: Pid;
  invokedAtUTC: UTC; spawnObservedAtUTC: UTC | null;
  exitObservedAtUTC: UTC | null; closeObservedAtUTC: UTC | null;
  exit: ExitTuple | null; processClose: ExitTuple | null;
  stdout: CaptureStream; stderr: CaptureStream;
  errors: ("SPAWN_ERROR" | "CHILD_ERROR" | "STDOUT_ERROR" |
    "STDERR_ERROR" | "TIMEOUT" | "OUTPUT_LIMIT")[];
};
type IdentityCapture = {
  subject: "collector" | "dashboard" | "spawner";
  expected: Owner;
  before: NativeCapture; comm: NativeCapture; after: NativeCapture;
};
type ServiceRecord = {
  schema: "setfarm.fresh-service-process.v1";
  service: "dashboard" | "spawner"; installationDirectory: Absolute;
  sourceSha: Source; executable: Absolute; script: Absolute;
  ownerIdentity: { schema: "setfarm.process-identity.v1";
    pid: Pid; processStartedAt: UTC; processGroupId: Pid; source: "observed_os" };
};
type ServiceObservation =
  | { service: "dashboard" | "spawner"; status: "absent" }
  | { service: "dashboard" | "spawner"; status: "present";
      lock: Document<ServiceRecord>; pidFile: FileData; identity: IdentityCapture };
type NativeSnapshot = {
  snapshotId: UUID; observedAtStartUTC: UTC; observedAtEndUTC: UTC;
  collector: Owner; census: NativeCapture; collectorIdentity: IdentityCapture;
  services: ServiceObservation[];
};
type ProcessRow = { pid: Pid; parentPid: Count; processGroupId: Count; command: string };
```

`ProcessRow` is the pure parser's **derived result**, not a caller-supplied array that could disagree with capture stdout. Census argv exactly `['-ww','-axo','pid=,ppid=,pgid=,command=']`; identity before/after exactly `['-ww','-p',String(expected.pid),'-o','lstart=','-o','pgid=','-o','args=']`; comm exactly `['-ww','-p',String(expected.pid),'-o','comm=']` (`manual-test-admission-v1.ts:164-190`). No other command/argv variant accepted. argv≤16 elements, each≤4096; stdout≤4MiB, stderr≤64KiB; process census≤65536 rows; command≤1MiB under whole stream cap. errors unique≤6.

Production collector for this new DTO uses owned asynchronous child handles so both exit/close events and both stream end/close observations are actual facts. It must not fill these fields from `spawnSync.status`; existing native helper's spawnSync result is a different evidence shape. Task1 parses detached examples only and does not force the existing helper to pretend it observed async events. A synchronous implementation would require a separately reviewed discriminated evidence contract before implementation, not synthetic values in this DTO.

Eligibility: exit/processClose both0/null, timestamps nondecreasing within capture/snapshot intervals, spawn/exit/close observations nonnull, all stream end/close facts true, dataBytesObserved=bytes.byteLength, stderr empty, errors[]. Reparse full newline-terminated census with exact current Source rules and reject duplicates/malformed rows/cycles. Its actual executorPid must appear as `/bin/ps <exact argv>`, parent must be collector.pid and PGID match collector's census row. Exclude only this capture's exact executor row; all other rows remain. Verify collector identity triple, not just supplied Owner.

Require original worker PID absent entirely (including reused PID); each retained target StartChild.child PID absent; no original owned PG residue when owner.pgId=owner.pid; no descendant chain to original owner/start child; no other selected worker/direct evaluator Source or dist argv mention, no malformed selected reference. The current maintenance process exception is exactly the verified collector script/argv/identity/profile, never a general list. Existing known dashboard/spawner may remain only after ServiceRecord/pidFile/native identity matches. services has exactly one entry for each service; absence must match independently collected namespace listings. Identity before/after raw stdout equal; comm final executable spelling must agree with adapter-pinned realpath/Node. Census cannot prove universal absence of an unrecorded fully reparented process that dropped all selected references; do not make that claim.

NativeSnapshot is collected twice bracketing each evidence read cycle (`nativeBefore`, `nativeAfter`). Those are both real prepublication observations in the first proof. A fresh second cycle runs after publication. Never put future capture data in an immutable prepublication sidecar.

## 9. Namespace inventory, artifacts and complete Evidence DTO

```ts
type DirectoryListing = { relative: string; names: string[] };
type DirectIntent = Acquire & {
  schema: "setfarm.manual-direct-evaluation-intent.v1";
  kind: "convergence_full8"; suiteHash: Hash;
  executionMode: "preflight" | "execute"; owner: Owner; nonceDigest: Hash;
};
type OtherIntent =
  | { origin: "mission_control"; jobId: UUID;
      intent: Document<Intent>; closure: Document<Closure> | null }
  | { origin: "direct"; jobId: UUID;
      intent: Document<DirectIntent>; closure: Document<Closure> | null };
type NamespaceEvidence = {
  directories: DirectoryListing[];
  otherIntents: OtherIntent[]; closures: Document<Closure>[];
  startChildren: Document<StartChild>[];
  mutationFiles: FileData[]; retirementFiles: FileData[];
  buildMaintenanceFiles: FileData[]; unexpectedFiles: FileData[];
};
type Artifact =
  | { kind: "eval_result"; document: Document<EvalResult> }
  | { kind: "run_result"; document: Document<RunResult> }
  | { kind: "release_gate"; document: Document<Gate> };
type TargetData = {
  selection: Selection; source: SourceAuthority;
  databaseName: string; runtimeRole: string; ownerRole: string;
  ownerOid: Positive; runtimeOid: Positive;
  nodeExecutable: Absolute; nodeExecutableHash: Hash;
  mcSourceSha: Source; mcBuildHash: Hash;
};
type ManualOrphanEvidenceV1 = {
  schema: "setfarm.manual-control-orphan-evidence.v1";
  request: ManualOrphanRequestV1;
  maintenanceSource: SourceAuthority; maintenanceOwner: Owner;
  target: TargetData;
  history: Document<RecordData>[]; reservation: Document<RecordData>;
  intent: Document<Intent>; mc: McEvidence;
  journal: Document<JournalRecord>[]; journalHead: Document<JournalHead>;
  database: DatabaseEvidence; artifacts: Artifact[];
  namespace: NamespaceEvidence;
  nativeBefore: NativeSnapshot; nativeAfter: NativeSnapshot;
};
```

`SourceAuthority` is the exact six-field Source data shape in §2. `ManualOrphanRequestV1` retains exactly these six fields from the plan: `requestId,jobId,expectedRevision,expectedRecordHash,expectedJournalHeadHash,expectedSettlementHash`, with expectedRevision literal6. Request hashes are byte hashes: expectedJournalHeadHash hashes the head file bytes, not its internal recordHash; expectedRecordHash hashes revision6/head bytes; expectedSettlementHash hashes original settlement bytes.

Namespace bounds: directory listings≤4096; each listing names≤4096 and names are unique single basenames; otherIntents/closures≤4096; startChildren≤8 for exact target (other jobs' start-child directories remain accounted for by inventory, not accepted as current children); blocking file arrays≤4096 and eligibility requires all four blocking arrays empty. retirementFiles is empty for this **prepublication** Task1 core; completed replay is the separate sidecar classifier. Relative root is selected runtime except buildMaintenanceFiles, whose fixed target-source `.setfarm` prefix is explicitly tagged in the collector's private mapping; it never accepts arbitrary paths. Unknown names or unexplained absent/missing files refuse even if arrays claim empty. Enumerated names must bijectively match supplied documents/known allowed directory entries. Ordinary closure parser/joins are unchanged for other retained selected intents; unknown unclosed ones block. UI-only intents retain the existing separate-kind treatment after strict validation, not arbitrary exclusion.

Before the first retirement effect, manual-controls root retains the original six-name grammar and even an existing empty `retirements` directory is residue requiring refusal. Do not claim an empty file array proves the directory was absent. After publication, current head is7 and the operation's marker/sidecar are intentionally present: that state is not a `ManualOrphanEvidenceV1` eligible prepublication snapshot. Task4 must validate an explicitly distinct postpublication phase binding prior archived6, current7, exact sidecar and its privately owned marker plus fresh DB/native/material observations. Never rewrite head7 as6, strip the marker from the snapshot, or add a public ignore flag to reuse this Task1 verdict. The separate postpublication/replay contract must be fixed before Task4 tests; it is not silently represented by this prepublication DTO.

artifacts≤64, uniquely keyed by semantic artifact hash/kind; multiple journal references to the same artifact share one document. Each locator derives from its actual semantic hash under fixed `evals/results/sha256/<prefix>/<hash>.json` mapping. Validate every `run_result_stored` and `artifacts_stored` reference; no unreferenced arbitrary artifact may confer authority. Data byte caps remain §3.

The outer parser must not infer a default missing nativeAfter, zero-fill counts, coerce timestamps, discard unknown keys, treat an omitted row as unconsumed, or accept a caller-produced boolean instead of namespace enumeration. Eligibility remains separate from parse success. Frozen source/profile checks confine production effect to I5/SF161/the actual requested job; pure fixtures can use synthetic UUIDs/paths without opening those paths.

## 10. Exact nonpromoting finalization and journal semantic rules

Require full chain1..20 and head20 for this operation, first record acquired, last record `{type:'phase',phase:'settling',currentCaseId:null,completedCases:n}`. Parse every event with existing JournalRecord schema. Validate one current acquired, exactly one eight-context canary_bound for this bounded class, case/start/run links and no duplicate consumed run. No `released`, `closed`, `promotion_confirmed`, `CONTROL_PROMOTION_UNCERTAIN` or continue+go boundary is eligible. A fault event/ownership_unknown phase before terminal settling is rejected by this bounded v1 until an explicit new profile is reviewed; do not ignore it. Public UNKNOWN is not a journal fault requirement.

For result/finalization events, ignore only legitimate intervening `cancel_latched` for ordering comparison; no later canary/start/run/binding/publication branch may cross the finalization boundary:

1. One candidate artifacts_stored event names a real EvalResult/Gate pair, with matching Source/suite, execute, planned8, actual runs, resultStatus/gateDecision and recomputed gate via `evaluateConvergenceReleaseGate`.
2. A finalizing phase follows candidate and its completedCases equals count of prior distinct run_result_stored events. Each run_result_stored names a bound consumed run and an actual RunResult matching case/run. Do not equate completedCases with passed cases; a cancelled run can have a stored result and increment completion count.
3. Exactly one boundary follows finalizing and repeats candidate resultHash/gateHash/gateDecision. Its decision must be cancel, or continue with no_go. A cancel branch can safely cancel a previously go candidate only if actual final cancelled result/gate is proven no_go and there is no matching promotion; the continue+go path is categorically ineligible.
4. Cancel branch requires cancelled_final event after boundary, final status blocked and EVAL_CANCEL_REQUESTED in actual final result, exact derived no_go gate. If candidate already contained that blocker, candidate and final may be the SAME content hashes; do not demand a new artifact. Otherwise compare result payload against candidate: only schema-derived hash, status→blocked and sorted blockerCodes addition change in the producer path (`convergence-runner.ts:1133-1140`). Final refs cannot be fabricated.
5. Continue+no_go branch requires final_without_promotion event with the SAME candidate resultHash/gateHash/status/no_go. No new successful result is synthesized.
6. Settling follows the selected nonpromoting final event; all result/gate hashes are absent from related release_go rows. DB global idle and closed consumed owner proof remain separately necessary.

`cancel_latched` may occur before or during finalization/settling according to `manual-test-worker-v1.ts:325-331`; operator source requires requestId and matching retained MC cancellation; channel_lost has null requestId and must agree with retained unknown broker provenance without fabricating an operator cancel. Journal head20 means no appended later cancel/fault is hidden. `stop_observed:already_terminal` need not have prior stop_requested (`manual-test-worker-v1.ts:437-439`). Requested/refused stop requires one prior stop_requested and terminal DB closure before retirement; a historical refused stop is not itself a current unclosed run proof.

Do not require phases globally monotonic: case_start/case_running/case_collect repeat for different cases. Instead validate each case identity against canary contexts, bound run association, event-specific predecessors and nondecreasing completedCases; no more than8. Do not reuse `startJournalV1` wholesale because it intentionally rejects cancellation/finalization needed here.

## 11. Mandatory Task1 tests and finite limits

Positive fixture must include previous job1pending/2active/3released with its real synthetic closure, current4pending/5active/6bind, acquired5/canary_bound6, eight slots/seven unconsumed/one cancelled closed run, complete original code1 settlement, consistent first ready mapping plus cancellation snapshot carrying prior mapping, candidate→cancel boundary→cancelled_final(no_go)→settling20 and no related release_go. A second positive uses continue+no_go/final_without_promotion. A third reuses identical candidate/final bytes where cancel blocker was already present.

Negative tests change exactly one relation at a time: all16 missing/extra/nonzero/invalid counts; current acquired wrongly6; current job forced across released prior; prior intent without closure; mapping ack/outer cancellation wrongly conflated; ACK seq gaps wrongly assumed contiguous; absent raw ready frame not invented; public UNKNOWN incorrectly demanded persisted; close payload hash/canonical identity/terminalpair crossed; one-null claim; expired canary still terminal-proof-valid; missing final artifact; byteSHA mistaken for semantic artifactHash; promotion_confirmed, continue+go, matching release_go without journal confirmation; wrong original owner/context; native incomplete exit/close/streams, child/PID/PG residue, unknown namespace entry; parse input and proof output mutations.

The new Task1 proof/parser tests execute no native commands, open no DB, load no operational selection and read no private material. Their native and DB fixtures are synthetic strict data; successful core proof is not evidence of runtime observations. Separately, unchanged owned native regression assertions in the existing owner-observation test must still run in the established regression test lane during implementation validation. Task2–4 must prove actual fixed collectors, complete file pinning, native capture event semantics, old/new Source bootstrap, DB epoch/fence, publication/crash/replay and current private original provenance. Current native census cannot prove every historical unrecorded descendant after total reparenting. Newly chosen caps may reject the actual target and must remain refusal, never silently expanded to make a case pass.

Schema extraction has two necessary adjacent test edits. `tests/execution-attempts/manual-test-admission-v1.test.ts:313` extracts Hash/AcquireSchema/OwnerSchema/ClosureSchema into `new Function`; `tests/execution-attempts/manual-control-owner-observation-v1.test.ts:33` extracts Hash/OwnerSchema for processOwnerV1. Imported production aliases would be unbound in those components. Add the latter file to Task1's File Map, import the actual extracted pure schema exports in both tests and explicitly inject those schemas into the component constructors, retaining only the required remaining Source function bodies. Preserve all assertions and real owned-child checks; do not replace schema behavior, mock source/runtime readiness or skip either test. The main plan has been updated with this exact causal adjustment.

Task1 acceptance is a stable strict schema and pure inference contract, not retirement eligibility of the real job. Source-only drafting has not inspected its payloads and has not retired it.
