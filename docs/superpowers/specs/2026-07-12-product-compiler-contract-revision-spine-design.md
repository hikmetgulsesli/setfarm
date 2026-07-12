# Product Compiler Contract & Revision Spine Design

Date: 2026-07-12
Status: Ready for operator review
Scope: Setfarm offline/shadow contract compilation and revision identity only

## Context

`SETFARM_SYSTEM_AUDIT.md` establishes four coupled platform failures:

1. Plan, design, stories, setup, and implement context are versioned fragments,
   not one immutable and referentially complete Product Build Packet.
2. Product action IDs, Stitch controls, generated local action IDs, state,
   persistence, routes, and evidence are not joined by one exact graph.
3. Claims, source revisions, retry findings, and outputs do not share a fenced
   attempt identity.
4. Downstream guards and PR-comment classifiers compensate for those missing
   upstream contracts and revision boundaries.

The first architectural slice must prove that product truth and execution truth
can retain identity before any runtime gate is replaced. It must not rescue a
generated project, resolve a GitHub thread, start a Setfarm run, or change live
workflow decisions.

## Decision

Build a **Shadow Contract & Revision Spine** with two cooperating cores:

- A pure Product Compiler that snapshots legacy inputs, emits strict versioned
  artifacts, links exact semantic references, and seals a content-addressed
  Product Build Packet only when completeness invariants pass.
- A PostgreSQL-backed Execution Attempt ledger that can record and deduplicate
  packet/source/finding identity in explicit shadow mode without owning legacy
  story, step, claim, retry, or supervisor decisions.

The default protocol remains `legacy`. The first slice recognizes `shadow` only
for explicit offline/integration tests and later operator-controlled rollout.
`v3` is a reserved value and must fail with `PROTOCOL_NOT_IMPLEMENTED` in this
slice rather than silently enabling partial enforcement.

## Considered Approaches

### Direct v3 runtime cutover

This would wire packet sealing, attempt fencing, retries, supervisor ownership,
and Mission Control into live behavior at once. It provides fast visible change
but makes rollback and failure attribution unsafe. It is rejected.

### Contract compiler only

This would build schemas, hashes, and a linker without attempt identity. It is
safe but cannot prove that the same finding on unchanged source will stop being
redispatched. It leaves half of the audited causal chain intact. It is rejected
as the complete first slice.

### Shadow Contract & Revision Spine

This combines the pure compiler and attempt repository while keeping all live
decisions legacy by default. It proves both identities with fixtures and an
isolated PostgreSQL database. It is the selected approach.

## Goals

- Produce strict `ProductSpec`, `DesignInteractionGraph`, `BuildTopology`,
  `StoryPlan`, `ProductBuildPacket`, and `ImplementationSlice` artifacts.
- Make the same semantic inputs and producer versions produce the same hashes.
- Preserve exact `data-action="ACT_*"` to local `data-action-id` relationships.
- Reject missing, ambiguous, or heuristic-only references before packet seal.
- Record source and packet revision identity in a fenced attempt ledger.
- Detect the same story/finding/source/packet tuple without redispatching work.
- Replay #1925, #1894, #847, Vibe Breaker, #1887, and #1893 evidence offline.
- Leave current runtime behavior unchanged unless `SETFARM_PROTOCOL=shadow` is
  explicitly set.

## Non-Goals

- Do not make v3 artifacts authoritative for live workflow completion.
- Do not replace current implement context or prompts in this slice.
- Do not remove any legacy guard or PR-comment classifier yet.
- Do not change supervisor, QA, final-test, deploy, or Mission Control behavior.
- Do not automatically resolve GitHub review threads.
- Do not write to a generated repository during fixture replay.
- Do not start a clean canary run in this scope.
- Do not import historical SQLite data into the operational PostgreSQL database.
- Do not add project-specific identifiers to generic compiler or execution code.

## Safety Boundaries

- Setfarm and Mission Control services are not restarted during implementation.
- No live DB migration is manually invoked. Additive DDL lands as code only.
- Default `SETFARM_PROTOCOL` is `legacy`; missing configuration means no shadow
  artifact or attempt writes.
- Fixture replay accepts explicit input and output roots and never infers a live
  generated project path.
- PostgreSQL integration tests create and drop only a uniquely named test
  database. They never use the operational `setfarm` database.
- A shadow recorder error cannot change or block a legacy claim, story, or step.
- Existing generated repos, PRs, threads, claims, and observations are read-only
  evidence sources.

## Architecture

```text
LegacySourceSnapshot
        |
        v
strict legacy adapters -----> CompilationDiagnostic[]
        |
        v
typed candidates
        |
        v
exact DesignInteractionGraph linker
        |
        v
cross-artifact validator
        |
        +------ reject ------> ProductCompilationReport
        |
        v
sealed ProductBuildPacket
        |
        v
deterministic ImplementationSlice
        |
        v
shadow ExecutionAttempt recorder/dedupe
```

The compiler core has no PostgreSQL, GitHub, OpenClaw, process, or service
dependency. Legacy readers and the attempt repository are adapters around that
pure core.

## Module Boundaries

### Protocol configuration

`src/product-compiler/protocol.ts` parses `SETFARM_PROTOCOL`:

- unset or `legacy`: no compiler/attempt runtime hooks execute;
- `shadow`: hooks may write shadow artifacts and attempts but cannot return a
  workflow decision;
- `v3`: throw `PROTOCOL_NOT_IMPLEMENTED` during protocol initialization.

Unknown values are configuration errors. They do not fall back silently.

### Legacy source snapshot

`src/product-compiler/legacy-source-snapshot.ts` accepts an operational request
containing `runId` and absolute read root, then returns a semantic read-only
snapshot. Operational identity is not part of child artifact hashes:

```ts
interface LegacySourceSnapshotV1 {
  schema: "setfarm.legacy-source-snapshot.v1";
  task: SourceArtifactRef;
  plan: SourceArtifactRef;
  stitchArtifacts: SourceArtifactRef[];
  generatedScreenIndex?: SourceArtifactRef;
  generatedSources: SourceArtifactRef[];
  setupCertificate?: SourceArtifactRef;
  fileTreeManifest?: SourceArtifactRef;
  sharedGrants?: SourceArtifactRef;
  stories: SourceArtifactRef[];
  repo: { baseSha: string; treeHash: string };
}
```

`SourceArtifactRef` contains a content hash, media type, and normalized relative
locator. Absolute host paths are operational input metadata and are excluded
from semantic artifact hashes.

The snapshot reader performs no inference. It reports absent sources explicitly.
The runtime caller carries `runId` separately when recording compilation and
attempt rows, so equal product inputs in separate runs can still produce equal
semantic artifact hashes.

### Runtime schemas

Add `zod` as the single runtime validation dependency. Schema modules live in:

```text
src/product-compiler/schemas/
  common-v1.ts
  product-spec-v1.ts
  design-interaction-graph-v1.ts
  build-topology-v1.ts
  story-plan-v1.ts
  product-build-packet-v1.ts
  implementation-slice-v1.ts
  compilation-report-v1.ts
src/execution/schemas/
  execution-attempt-v1.ts
  output-envelope-v1.ts
```

Every object schema uses `.strict()`. Unknown fields, invalid references,
non-finite numbers, and unsupported unions fail parsing. TypeScript types are
derived with `z.infer`; a second handwritten interface is not maintained.

### Setfarm Canonical JSON v1

`src/product-compiler/canonical-json.ts` defines deterministic bytes:

- Objects are serialized with keys sorted in JavaScript UTF-16 lexical order.
- Arrays preserve declared order. Producers must sort set-like arrays by stable
  ID before canonicalization.
- Strings are preserved exactly; Unicode is not normalized silently.
- Numbers use JSON number serialization; non-finite numbers are rejected and
  negative zero serializes as `0`.
- `undefined`, bigint, functions, symbols, sparse arrays, and cyclic values are
  rejected.
- The hash input is UTF-8 canonical JSON without a trailing newline.
- Stored files may add no formatting or newline; their bytes equal the hash
  input exactly.

Canonicalization tests cover key order, nested objects, Unicode preservation,
array order, negative zero, unsupported values, and repeatability across writes.

### Content-addressed artifact store

`src/product-compiler/artifact-store.ts` accepts an injected root. The runtime
default is:

```text
${runtimeConfig.setfarmDir}/product-compiler/artifacts/sha256/<hash>.json
```

`SETFARM_PRODUCT_ARTIFACT_DIR` may override the root. Tests always inject a temp
directory.

The hashed semantic envelope contains:

```ts
interface SemanticArtifactEnvelopeV1<T> {
  schema: "setfarm.semantic-artifact-envelope.v1";
  artifactType: string;
  producer: {
    pass: string;
    codeSha: string;
    model?: string;
    promptHash?: string;
    toolVersions: Record<string, string>;
  };
  payload: T;
}
```

It contains no timestamp, host, PID, absolute path, or random ID. Operational
creation metadata belongs in PostgreSQL or the caller's report and is not part
of the semantic hash.

Writes use a same-directory temporary file, `fsync`, and atomic rename. If the
target exists, the store reads and verifies its bytes. Same hash with different
bytes returns `ARTIFACT_HASH_COLLISION_OR_CORRUPTION`; it never overwrites.
Reads recompute the hash before returning content.

### Legacy adapters

Adapters live in `src/product-compiler/adapters/` and return:

```ts
interface AdapterResult<T> {
  candidate?: T;
  diagnostics: CompilationDiagnosticV1[];
  provenance: ProvenanceRefV1[];
}
```

Allowed confidence/disposition values are:

- `exact`: the source contains the stable reference directly;
- `derived_with_provenance`: a deterministic and lossless projection;
- `ambiguous`: more than one valid source target exists;
- `missing`: required source information does not exist;
- `heuristic_legacy_only`: current legacy code guessed the value.

Only `exact` and `derived_with_provenance` values can enter a sealed packet.
The other values remain diagnostics. Adapters never upgrade confidence to make
validation pass.

Adapters are separated by source responsibility:

- `legacy-plan.ts`: task/plan to ProductSpec candidate;
- `stitch.ts`: Stitch artifacts and generated index/source to graph candidates;
- `legacy-stories.ts`: story rows to graph partitions, without renaming actions;
- `setup-topology.ts`: setup certificate, file tree, grants, commands, and Git
  revision to BuildTopology.

### Exact design linker

`src/product-compiler/design-linker.ts` owns the only semantic join. Binding
precedence is fixed:

1. A structured generated index entry that carries both semantic `actionRef`
   and local `generatedLocalId`.
2. Legacy generated source where the same control element contains both
   `data-action="ACT_*"` and `data-action-id="..."`.
3. Exact stable references in SCREEN_MAP or DESIGN_MANIFEST.
4. Otherwise unresolved.

Label, filename, component-name, token-overlap, or ordinal similarity may be
reported as a suggestion in diagnostics. They cannot create a binding.

The converter target is to project semantic action IDs into `SCREEN_INDEX`
directly. Parsing legacy TSX is a compatibility adapter for historical fixtures,
not the long-term producer.

Every interactive control must receive exactly one disposition:

- `action`, with exact ProductSpec action reference;
- `external`, with validated URL/download target;
- `disabled`, with an explicit reason;
- `informational`, proving it is not interactive behavior.

Every required ProductSpec action must be reachable from a control or an
explicit non-UI trigger. Every binding carries state, persistence, route, and
evidence references required by the action.

Stable control identity uses an explicit design control ID when present.
Otherwise the adapter may derive
`CTRL_<sha256(rawArtifactHash + NUL + normalizedSelector + NUL + kind)[0:16]>`
with provenance. Labels never participate in identity.

### Cross-artifact validator and packet compiler

`src/product-compiler/packet-compiler.ts` performs these passes in order:

1. Parse every candidate through its strict schema.
2. Verify all foreign references and reference types.
3. Verify surface/control/action reachability and control disposition coverage.
4. Verify story ownership is complete and dependency graphs are acyclic.
5. Verify topology paths, ownership, shared grants, entrypoints, commands, and
   stack capabilities.
6. Verify every required action has an evidence predicate supported by the
   selected stack capabilities.
7. Store child artifacts by content hash.
8. Seal and store the Product Build Packet manifest.

Validation never mutates a candidate. A failure produces
`setfarm.product-compilation-report.v1`; no sealed packet is returned.

The packet manifest contains only stable content:

```ts
interface ProductBuildPacketV1 {
  schema: "setfarm.product-build-packet.v1";
  packetVersion: 1;
  parentPacketHashes: string[];
  productSpecHash: string;
  designGraphHash: string;
  buildTopologyHash: string;
  storyPlanHash: string;
  compiler: { codeSha: string; version: string };
  validationIds: string[];
}
```

`sealedAt` is operational metadata and is excluded from the manifest hash.

### Implementation slice compiler

`src/product-compiler/slice-compiler.ts` projects one story from a sealed packet.
It does not read prompts or reconstruct fields from prose.

The slice contains:

- packet and story identity;
- base source SHA/tree hash;
- owned files with roles and known content hashes;
- dependency signatures and shared grants;
- exact surfaces, controls, bindings, actions, routes, state, and persistence;
- typed build/test/evidence commands;
- required evidence predicates and policies.

Given the same packet, story, and source revision, it produces the same slice
hash. A missing owned path, dependency, or reference is a compile failure.

### Compilation report

`setfarm.product-compilation-report.v1` records stable diagnostics:

```ts
interface CompilationDiagnosticV1 {
  code: string;
  severity: "error" | "warning" | "info";
  artifactType: string;
  sourceRef?: ProvenanceRefV1;
  invariantId: string;
  message: string;
  relatedRefs: string[];
  suggestion?: string;
}
```

Messages are for operators; `code`, `invariantId`, and exact refs are machine
authority. Report status is `sealed` or `rejected`. A warning cannot represent
a missing required reference.

## Contract Artifact Shapes

### ProductSpec v1

The schema requires:

- product identity, class, goals, and non-goals;
- entities and their fields;
- explicit application states;
- persistence policies and data ownership;
- routes and product surfaces;
- actions with trigger, input schema, preconditions, state delta, navigation,
  persistence effects, success/failure outcomes, and evidence references;
- acceptance evidence predicates;
- assumptions with provenance.

Each action ID is stable and matches `ACT_[A-Z0-9_]+`. Each route, surface,
state, persistence, and evidence reference must resolve exactly.

### DesignInteractionGraph v1

The schema requires:

- raw artifact hashes;
- stable design surfaces;
- controls with stable control ID, local generated ID, type, label/accessibility,
  surface reference, and source locator;
- interaction bindings with disposition, action/route/value/payload refs, state,
  persistence, and evidence refs;
- unresolved binding records, which force packet rejection.

### BuildTopology v1

The schema requires:

- stack pack ID, version, and content hash;
- repo ID, base SHA, and tree hash;
- role-to-path bindings;
- ownership and shared grants;
- entrypoints and mount points;
- typed commands and capabilities;
- build and source policies.

### StoryPlan v1

Stories are graph partitions. Each story lists exact dependency, surface,
control, action, state, persistence, ownership, and evidence refs. A story cannot
define a new action or rename a ProductSpec action.

## Execution Attempt Ledger

### Table

Add `execution_attempts` through the existing additive `pgMigrate()` convention
in `src/db-pg.ts`. The table contains:

```text
attempt_id              text primary key
run_id                  text not null
step_id                 text not null
story_id                text not null default ''
generation              integer not null
fence_token             text not null
attempt_class           text not null
packet_hash             text
compilation_report_hash text not null
slice_hash              text
source_before_sha       text not null
source_before_tree_hash text not null
source_after_sha        text
source_after_tree_hash  text
finding_set_hash        text
dedupe_key              text
role                    text not null
agent_id                text
branch                  text
worktree                text
lease_acquired_at       timestamptz not null
lease_expires_at        timestamptz not null
heartbeat_at            timestamptz not null
disposition             text not null
output_hash             text
evidence_refs           text not null default '[]'
created_at              timestamptz not null default now()
updated_at              timestamptz not null default now()
```

Allowed dispositions are `claimed`, `running`, `produced_delta`,
`already_satisfied`, `no_progress`, `inconclusive`, `failed`, `verified`, and
`superseded`. PostgreSQL CHECK constraints enforce dispositions and attempt
classes.

Allowed attempt classes are `product_implementation`, `evidence_only`,
`infrastructure_retry`, and `supervisor_repair`. This slice records current
developer work as `product_implementation`. Its dedupe key is populated only
when a sealed packet and exact finding identity exist. Initial implementation or
legacy prose-only retry may be observed with a null finding/dedupe key. A
rejected packet still creates a shadow row with its compilation report hash,
null packet/slice/dedupe fields, and cannot participate in product retry
deduplication.

For exact `product_implementation` attempts, the dedupe key is SHA-256 over
canonical:

```text
run_id + step_id + story_id + packet_hash + source_before_sha + finding_set_hash
```

This includes `run_id`; equal story IDs in different runs never collide.
`evidence_only`, `infrastructure_retry`, and attempts without an exact typed
finding have a null dedupe key. A partial unique index enforces uniqueness only
where `dedupe_key IS NOT NULL`. Legacy failure prose is never hashed and promoted
to canonical finding identity merely to enable dedupe.

The table deliberately has no cascading foreign key to `runs`. Hard-deleting a
legacy run must not erase attempt evidence. Application code validates run
existence when writing; indexes support run/story lookup.

### Repository and lease fencing

Execution modules live in:

```text
src/execution/
  attempt-repository.ts
  lease-fence.ts
  output-envelope.ts
  shadow-attempt-recorder.ts
```

Attempt reservation is one PostgreSQL transaction:

1. Mark expired active attempts for the same run/step/story as `superseded`.
2. Insert the new attempt with a random fence token and bounded lease.
3. Rely on a partial unique index for one active `claimed|running` attempt per
   run/step/story.
4. Return `duplicate` when the dedupe key already exists.
5. Return `active_conflict` when another unexpired fence owns the story.

The shadow lease defaults to six hours and is injectable in tests. This slice
does not modify `spawner.ts` to add heartbeats; `heartbeat_at` is initialized at
claim and updated at terminal observation. The lease is diagnostic-only in
shadow mode. A later v3 enforcement design must add process heartbeats before a
lease may own workflow decisions.

Completion and heartbeat updates include `attempt_id`, generation, and fence
token in the `WHERE` clause. An affected-row count other than one returns
`stale_fence`; it never updates legacy workflow state.

### Shadow integration

Runtime hooks are guarded before any side effect:

```ts
if (protocol.mode === "shadow") {
  await shadowRecorder.observe(...);
}
```

The recorder receives already-known runtime identity; it does not parse rendered
prompts. It may compile a packet/slice, reserve an attempt, observe source-after
revision, and emit shadow diagnostics.

In this slice:

- Shadow results are never used to allow, block, retry, merge, supervise, or
  complete work.
- Recorder failures are caught and logged as `product_compiler.shadow_error`.
- Legacy code continues even if shadow compilation or attempt recording fails.
- No prompt identity header or agent output requirement is made authoritative.
- An output envelope schema is implemented and replay-tested, but enforcement
  is deferred until v3 runtime cutover.

This preserves observability without creating a second workflow decision maker.

The exact hook boundaries are fixed:

- **Claim start:** `src/installer/step-ops.ts`, immediately after worktree
  creation, actual branch discovery, `claim_log` insertion, and story claim
  metadata update. At this point `claim_generation`, worktree, branch, and
  `source_before_sha` are all known. Worktree/bootstrap failures before this
  boundary do not create an execution attempt.
- **Successful story completion:** `src/installer/step-ops.ts`, after Setfarm's
  owned commit/PR handling and story status update, but before the legacy
  `claim_log` row is closed. The hook observes source-after SHA/tree and output
  hash; its result cannot change story status.
- **Failed or requeued story attempt:** `src/installer/step-fail.ts` uses a
  two-phase adapter. At function entry, a read-only prepare call captures the
  current branch/source revision before existing cleanup can remove the
  worktree. After each existing transactional story/step/claim update in
  `handleLoopStepFailurePG`, immediately before the branch returns, a finalize
  call records `failed`, `inconclusive`, or `superseded` according to the
  existing legacy outcome. Neither phase changes cleanup or workflow state.

All three call sites invoke only `shadow-attempt-recorder.ts`; compiler, hashing,
and SQL details never enter `step-ops.ts` or `step-fail.ts`.

## Data Flow

### Offline fixture replay

1. `eval:contracts` receives an explicit fixture directory and temp output root.
2. The fixture manifest verifies every copied evidence file hash.
3. Snapshot reader loads only files listed in the manifest.
4. Adapters emit typed candidates, diagnostics, and provenance.
5. Linker creates exact bindings or unresolved diagnostics.
6. Packet compiler validates and either stores a sealed packet or a rejected
   compilation report.
7. Slice compiler emits expected story slices only for sealed packets.
8. Attempt replay records supplied source/finding tuples in an isolated test DB.
9. The command emits a deterministic JSON result and exits non-zero when fixture
   expectations do not match.

### Explicit shadow runtime

1. Legacy claim selection remains authoritative.
2. Shadow hook snapshots existing artifacts and source revision.
3. Compiler produces a packet/report without changing the claim.
4. If sealed, the recorder tries to insert the attempt tuple.
5. Duplicate/conflict/stale outcomes become shadow diagnostics.
6. Legacy agent/spawner/verify flow continues unchanged.

## Error Model

Errors are separated into four layers:

### Source errors

Examples: missing plan, unreadable Stitch artifact, source hash mismatch. They
produce `SOURCE_*` diagnostics with exact source refs.

### Contract errors

Examples: unknown field, missing foreign ref, unsupported action input, story
renames an action. They produce `CONTRACT_*` diagnostics and reject the packet.

### Link errors

Examples: ambiguous control, required action unreachable, local ID without ACT,
ACT without control, interactive element without disposition. They produce
`LINK_*` diagnostics and reject the packet.

### Execution identity errors

Examples: duplicate tuple, active fence conflict, stale generation, source hash
changed, expired lease. They produce `ATTEMPT_*` outcomes. In shadow mode they
cannot fail legacy work.

All errors are bounded structured values. Stack traces may be logged separately;
they are not classifier input or workflow state.

## Historical Fixture Program

Fixtures live under `evals/fixtures/`. Product-specific identifiers are allowed
inside fixtures because fixtures are evidence; generic source code must not
contain them.

Each fixture has:

```text
fixture.json
sources/
expected/compilation-result.json
expected/attempt-result.json (when applicable)
```

`fixture.json` contains schema version, case ID, source provenance, copied file
hashes, redaction statement, expected packet status, expected diagnostics, and
expected exact bindings.

Required cases:

### #1925 task chip

- Legacy guessed generated action IDs have zero overlap with SCREEN_INDEX.
- `ACT_SAVE_RECORD` and local `save-changes-7` are recovered exactly from the
  same generated control.
- `SURF_INSIGHTS` and renamed actions remain unresolved.
- PR prose poison tokens never become DOM IDs or semantic bindings.
- Repeating the same finding/source/packet tuple returns `duplicate`.

### #1894 branch recovery

- Correct head and later base revision remain distinct.
- Source continuity mismatch produces `ATTEMPT_SOURCE_REVISION_CHANGED`.
- The compiler never claims that a deleted/unavailable head equals the base.

### #847 false completion

- Missing `close-1` behavior is represented as failed required evidence.
- An advisory wrapper cannot turn it into packet/release evidence PASS.

### Vibe Breaker ID mismatch

- `menu-btn` and `main-menu-btn` mismatch is detected by exact locator binding.
- An integration-complete claim cannot override the link failure.

### #1887 and #1893

- Input/control/state and persistence gaps produce stable generic diagnostics.
- Unchanged source/finding replay is deduplicated.

Raw private transcripts and credentials are not copied. A fixture may contain a
minimal redacted review body only when needed for regression evidence.

## Testing

### Unit tests

- Strict schema acceptance/rejection and unknown-field behavior.
- Canonical JSON and SHA-256 determinism.
- Artifact atomic write, collision/corruption, and read verification.
- Adapter confidence classification and provenance.
- Linker exact precedence and no label-created bindings.
- Cross-artifact foreign refs, reachability, disposition, story partition, and
  topology invariants.
- Slice determinism and source revision sensitivity.
- Attempt dedupe key, output envelope, and protocol parsing.

### Integration tests

- Full #1925 snapshot to rejected/sealed packet variants.
- Converter projection retains semantic and local IDs.
- Sealed packet to deterministic story slice.
- Compilation report remains stable across repeated runs.
- Artifact store never writes outside its injected root.

### PostgreSQL concurrency tests

Tests create a uniquely named database such as
`setfarm_contract_spine_test_<pid>_<random>`, set `SETFARM_PG_URL` before dynamic
imports, and drop only that database after `pgClose()`.

Required scenarios:

- two concurrent reservations produce one active fence;
- same dedupe tuple inserts once and returns duplicate thereafter;
- expired lease can be superseded atomically;
- stale generation/fence completion affects zero rows;
- identical `US-002` in two runs never cross-closes;
- recorder failure leaves test legacy story/claim rows unchanged.

If isolated PostgreSQL is unavailable, the concurrency suite fails explicitly in
the architecture verification command. It is not reported as PASS or silently
skipped.

### Verification commands

The implementation plan must provide focused commands, but the expected suite
shape is:

```bash
node --import tsx --test tests/product-compiler/*.test.ts
node --import tsx --test tests/execution-attempts/*.test.ts
npm run eval:contracts
npm run build
```

No live service restart or Setfarm run follows these commands in this slice.

## File-Level Scope

Expected new files:

```text
src/product-compiler/protocol.ts
src/product-compiler/canonical-json.ts
src/product-compiler/artifact-store.ts
src/product-compiler/legacy-source-snapshot.ts
src/product-compiler/diagnostics.ts
src/product-compiler/design-linker.ts
src/product-compiler/packet-compiler.ts
src/product-compiler/slice-compiler.ts
src/product-compiler/adapters/legacy-plan.ts
src/product-compiler/adapters/stitch.ts
src/product-compiler/adapters/legacy-stories.ts
src/product-compiler/adapters/setup-topology.ts
src/product-compiler/schemas/*.ts
src/execution/schemas/*.ts
src/execution/attempt-repository.ts
src/execution/lease-fence.ts
src/execution/output-envelope.ts
src/execution/shadow-attempt-recorder.ts
src/evals/contract-replay.ts
tests/product-compiler/*.test.ts
tests/execution-attempts/*.test.ts
evals/fixtures/*
```

Expected modified files:

- `package.json` and lockfile for Zod and eval scripts;
- `src/runtime-config.ts` for the artifact-root setting;
- `src/db-pg.ts` for additive attempt DDL/indexes;
- `scripts/stitch-to-jsx.mjs` and its tests for semantic action projection;
- `src/installer/step-ops.ts` for the claim-start and successful-completion
  shadow recorder calls;
- `src/installer/step-fail.ts` for post-transaction failure/requeue recorder
  calls.

Compiler logic may not be placed inside `step-ops.ts` or `step-fail.ts`; those
files only call the small recorder adapter. `spawner.ts` and
`spawner-prompt.ts` are not modified in this slice.

Explicitly out of scope:

- `src/installer/steps/07-verify/pr-comments.ts` behavior;
- supervisor and retry routing;
- Mission Control source;
- generated project source;
- workflow retry budgets;
- current guard removal.

## Rollout

### Phase 1: offline only

- Land schemas, canonicalization, store, adapters, linker, fixtures, repository,
  and tests.
- Keep default and deployed protocol `legacy`.
- Do not restart services or invoke migrations against live PG.

### Phase 2: operator-controlled shadow, separate approval

- Build and deploy the code on a clean Setfarm main revision.
- Allow additive table migration.
- Set `SETFARM_PROTOCOL=shadow` only after explicit operator approval.
- Observe packet/attempt diagnostics without changing workflow decisions.

### Phase 3: v3 enforcement, separate design/plan

- Requires stable shadow parity and the later FindingSet/RecoveryCase design.
- Existing legacy runs are never resumed under v3.
- No part of Phase 3 is authorized by this document.

## Rollback

- Before Phase 2, rollback is deleting/reverting the branch; no live state exists.
- In Phase 2, set protocol to `legacy` and restart through the normal operator
  procedure. Additive artifact and attempt rows remain for audit.
- Do not down-migrate or truncate attempt/artifact data.
- Invalid packet artifacts are immutable; a compiler fix creates new hashes.
- A shadow failure never triggers a generated project edit or legacy retry.

## Acceptance Criteria

The first slice is complete only when all conditions hold:

1. Strict schemas and canonical hashes are deterministic.
2. Artifact reads verify their hashes and atomic writes cannot overwrite
   conflicting bytes.
3. #1925 guessed IDs are rejected while the exact
   `ACT_SAVE_RECORD -> save-changes-7` binding is preserved.
4. Nonexistent `SURF_INSIGHTS`, action renames, and orphaned controls prevent
   packet seal.
5. Same packet/story/source yields the same slice hash; source change yields a
   new revision.
6. Same run/story/finding/source/packet tuple cannot create a second attempt.
7. Real PostgreSQL concurrency tests prove one active fence and stale-output
   rejection.
8. The offline #847 replay cannot count its required child evidence failure as
   satisfied merely because a later advisory wrapper says PASS. This is fixture
   verification only; runtime EvidenceBundle aggregation remains a later slice.
9. Core modules contain no generated project name, filename, action label, or
   product-specific literal.
10. `SETFARM_PROTOCOL` unset leaves existing runtime behavior observably
    equivalent: no compiler files, artifact rows, attempt rows, diagnostics, or
    workflow decisions are produced.
11. Focused tests, offline replay, and clean Setfarm build pass.
12. No new run, service restart, live DB/PR mutation, generated project rescue,
    or Mission Control change occurs.

## Design Review Checklist

- No placeholders or undecided alternatives remain.
- Product and execution identities are both represented.
- Pure compiler modules are isolated from runtime/process/DB dependencies.
- Heuristic information is diagnostic-only and cannot seal a packet.
- Volatile metadata is excluded from semantic hashes.
- Default legacy behavior and rollback boundaries are explicit.
- Concurrency proof uses isolated PostgreSQL, not the operational database.
- Runtime enforcement, guard removal, supervisor recovery, MC projection, and
  live canary are explicitly deferred.

## Final Design Judgment

This slice is deliberately more than a schema library and less than a runtime
cutover. It establishes the two identities the current system lacks:

- what exact product contract and design revision is being built;
- what exact source/finding revision an execution attempt owns.

Once these identities exist and are proven offline, later context, retry,
supervisor, evidence, and Mission Control work can consume canonical artifacts
instead of adding another prose parser or guard exception.
