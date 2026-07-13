# Product Compiler v3 Activation Design

Date: 2026-07-13

Status: approved architecture, implementation-ready

Depends on:

- `SETFARM_SYSTEM_AUDIT.md`
- `2026-07-12-product-compiler-contract-revision-spine-design.md`
- draft PR #44 (`feat/product-compiler-contract-revision-spine`)

## Context and authorization

The audit selected one target architecture: Product Compiler v3, a
revision-fenced execution/recovery ledger, canonical operational projections,
and a three-product-class convergence eval. Phase 1 implemented the dormant
contract/revision spine. The operator has now authorized the remaining program,
including additive migrations, controlled service restarts, Mission Control
changes, clean canary runs, and release verification.

This design does not reinterpret that authorization as permission to rescue old
generated projects, weaken gates, rewrite live run state, or convert an existing
legacy run into v3. Old runs remain evidence. New runs are the only activation
unit.

Live state at design time:

- no active Setfarm run or open claim;
- Setfarm source is on the Phase 2 branch based on Phase 1 commit `75bf717`;
- spawner PID `80622` runs build `9d63803a` from the canonical checkout;
- `SETFARM_PROTOCOL` is unset, therefore behavior is legacy;
- the additive `execution_attempts` table already exists and contains zero rows;
- Mission Control, Setfarm dashboard, and OpenClaw are healthy;
- data volume has about 5 GiB free, so artifact capacity is an activation gate.

## Problem to solve

Phase 1 can represent and validate a complete product packet and can observe a
legacy attempt. It does not yet make those artifacts authoritative. Current
runtime still has these independent truths:

1. plan/PRD prose;
2. Stitch HTML, generated screen registries, and inferred control IDs;
3. stories/setup context assembled by several consumers;
4. claim log plus mutable story/step state;
5. PR comments and gate prose;
6. Mission Control classifiers.

Activation must replace those competing authorities in dependency order. Merely
turning on the Phase 1 shadow recorder would record rejected legacy packets and
would not improve implementation quality. Merely passing a packet to the agent
would still allow a stale claim, repeated finding, or historical supervisor pass
to corrupt the result.

## Considered approaches

### Direct v3 cutover

Switch all new and existing runs to packet enforcement, fenced attempts,
structured retries, and canonical projections in one deployment.

Rejected. It has no safe attribution boundary, would make rollback ambiguous,
and could strand active legacy runs on schemas they never produced.

### Packet-only activation

Generate a Product Build Packet and render it into the current prompt while
leaving claim, retry, evidence, supervisor, and Mission Control behavior intact.

Rejected. It improves initial context but does not prevent unchanged-source
retry, stale completion, prose-derived recovery, or false completion.

### Stacked vertical activation

Land a sequence of backward-compatible vertical slices. Every slice writes
canonical state before any consumer becomes authoritative. Protocol is pinned
per run. Legacy remains available until v3 passes the full convergence gate.

Selected. This is the only approach that makes each transition measurable and
rollbackable without weakening product invariants.

## Core decisions

### 1. Protocol belongs to the run

`SETFARM_PROTOCOL` is a run-creation default, not a process-wide decision for
already-created work.

The `runs` table gains:

```text
protocol                 legacy | shadow | v3
protocol_version         integer
compiler_release_sha     git object ID
packet_hash              nullable SHA-256
```

Rules:

- existing rows are adopted as `legacy`, version `1`;
- run creation resolves and stores protocol once in the same transaction as the
  run and steps;
- resume/retry reads the stored protocol and ignores a changed process default;
- `v3` creation additionally requires an explicit enable flag and a successful
  activation preflight;
- a legacy or shadow run can never be resumed as v3;
- rollback changes the default for future runs only.

### 2. The packet is sealed after setup-build

The pipeline keeps its user-facing stage order, but producers write immutable
typed artifacts as their stages finish:

```text
plan          -> ProductSpec candidate
design        -> raw Stitch provenance + declared surface mapping
stories       -> semantic StoryPlan candidate
setup-repo    -> repo identity and initial topology
setup-build   -> final BuildTopology + DesignInteractionGraph
compiler      -> sealed ProductBuildPacket + per-story ImplementationSlice
implement     -> consumes exactly one slice
```

`setup-build` is the first point where actual files, commands, stack
capabilities, converted controls, story ownership, and source revision coexist.
Therefore implementation cannot claim work until packet compilation is sealed.

The legacy prose outputs remain compatibility projections during shadow. They
are not parsed back to produce v3 authority.

### 3. Producers are typed first

New producers return schema values and render legacy prose from those values.
They do not create JSON by parsing their own rendered prompt/output.

- PLAN produces `ProductSpecV1` and renders the current PRD as a compatibility
  view.
- DESIGN records the exact requested Product Surface for each Stitch generation
  target. Exact returned-screen provenance is preserved. Title/label similarity
  may be diagnostic, never a sealed binding.
- the Stitch converter preserves `data-action`, stable generated local ID,
  source locator, and selector on the same control.
- STORIES partitions existing ProductSpec/DesignGraph refs. It cannot invent a
  renamed ACT or guess a control from a label.
- SETUP derives path ownership, entrypoints, commands, and capability refs from
  actual repo state and stack contracts.

Any missing or ambiguous relation rejects packet sealing and returns ownership
upstream. It is not sent to implementation as a warning.

### 4. Artifact metadata is indexed, payloads remain content-addressed

Canonical JSON payloads live in the existing filesystem artifact store. The DB
stores small immutable metadata and references:

```text
semantic_artifacts
product_packets
run_artifact_refs
```

Every reference is verified by hash on read. Operational timestamps and paths
are metadata, not semantic hash input.

Capacity controls:

- maximum canonical artifact payload: 4 MiB;
- artifact root soft quota: 512 MiB for the activation period;
- minimum free data-volume space before a new shadow/v3 run: 1 GiB;
- immutable artifacts referenced by a packet, attempt, evidence bundle, or eval
  result cannot be garbage-collected;
- Phase 2 implements reporting and fail-closed admission, not automatic
  deletion.

### 5. Attempt reservation and story ownership are one transaction

For v3, there is no `running` story without an active execution attempt.

Reservation transaction:

1. lock `(run, step, story)`;
2. validate run protocol, packet, slice, dependency readiness, and current story
   state;
3. increment generation;
4. insert attempt and fence;
5. update story/step ownership;
6. insert legacy `claim_log` projection;
7. commit once.

Worktree provisioning happens after reservation under `attempt_id`. Provision
failure closes the attempt and releases story ownership through the same fenced
transition service.

Completion/failure requires:

```text
attempt_id + generation + fence_token + packet_hash + slice_hash
```

Affected-row count must be exactly one. A stale output is stored as a
superseded diagnostic and cannot mutate story/step/run state.

Temporary input/output files are attempt-scoped. One attempt can never find or
delete another attempt's files.

### 6. Finding and recovery identity replace retry prose

All product retry decisions use:

```text
{story_id, finding_set_hash, source_revision, packet_hash}
```

Tables/artifacts:

- `finding_sets` and `findings`;
- `recovery_cases` and `recovery_decisions`;
- `evidence_bundles`.

Gate/build/test/runtime/security/QA code emits typed findings directly.
GitHub review prose is stored as source evidence. It becomes a structured
finding only when an adapter can bind it to a known invariant and current source
revision without interpreting prose as code truth. Otherwise it is explicitly
`unstructured_review` and supervisor-owned.

Retry policy:

- first current-revision typed finding may authorize one implement repair;
- the same tuple cannot authorize a second implement attempt;
- a changed source revision receives one evidence-only verification before any
  new repair decision;
- `already_satisfied` is valid and produces resolution evidence without a fake
  edit;
- inconclusive/unstructured/no-progress opens a supervisor-owned RecoveryCase;
- supervisor may authorize at most one bounded repair and one evidence-only
  attempt;
- active RecoveryCase disables historical-evidence auto-pass;
- packet semantics can be changed only by a new upstream packet revision.

Legacy retry classifiers remain only for legacy runs. v3 never invokes them.

### 7. Evidence is derived from the product contract

`EvidenceBundleV2` binds every verdict to packet, source, attempt, invariant,
action/control, runner version, and artifact hashes.

The evidence planner compiles required predicates from ProductSpec and
DesignGraph. It may use stack capabilities for browser interaction, HTTP,
command execution, local persistence, database inspection, or game timing.

Rules:

- required unsupported capability blocks packet sealing or the release; it does
  not become skipped success;
- a child fail/inconclusive cannot aggregate to pass;
- snapshot-only evidence cannot satisfy a control action, navigation, state
  transition, or persistence round trip;
- evidence must use the source revision under review;
- PR thread state is external workflow evidence, not behavioral truth.

### 8. Mission Control consumes one canonical read model

Setfarm owns `RunEvidenceModelV2`. It is projected only from run protocol,
packet refs, attempts, findings, recovery cases, evidence bundles, eval results,
and external PR identity.

Mission Control:

- proxies and renders the canonical model;
- uses typed findings for `/errors`;
- uses eval results for benchmark/release views;
- shows agent/step prose in a narrative panel only;
- never derives owner, retryability, product success, or evidence coverage from
  prose regex;
- validates project identity by exact run UUID, repo identity, and source URL;
- tombstones delete requests instead of cascading evidence deletion.

Legacy runs remain visible through an explicitly labelled legacy projection.
Missing canonical evidence appears as unknown, never as inferred success.

### 9. Eval is a release gate, not a demo

`product-convergence-v1` contains three product-neutral classes:

1. local-persistence utility;
2. multi-entity CRUD/operations application;
3. browser game/canvas.

Each case pins task hash, expected semantic contract, stack pack, required
invariants, model/provider, compiler SHA, runner version, and environment hash.

Release requires two clean repetitions per class on the same Setfarm SHA: six
new runs total. A run counts only when:

- packet sealed with no unresolved/heuristic-only binding;
- all stories verified on the release source revision;
- required action/control/state/persistence/navigation evidence is complete;
- build/test/security/QA/final-test pass;
- deployment/Projects transfer is required and verified for web products;
- no unchanged retry tuple, stale output, active lease, or claimed-by residue;
- supervisor repairs are at most one per case;
- Mission Control projection matches ledger hashes exactly.

Manual generated-project edits invalidate the eval result.

## Migration design

### Migration journal

Add `setfarm_schema_migrations` with version, name, checksum, applied timestamp,
and release SHA. Migration execution uses a PostgreSQL advisory lock plus local
lock/statement timeouts.

Commands:

```text
npm run db:contract-spine:plan
npm run db:contract-spine:apply
npm run db:contract-spine:verify
```

The planner is read-only. Apply is explicit for production. Startup verifies
required schema; v3 admission fails if a migration is pending or checksum
differs.

The already-existing empty `execution_attempts` table is adopted only after its
columns, constraints, and indexes exactly match migration v1. Adoption never
drops or rewrites it.

### Additive tables and pointers

Migration sequence:

1. migration journal and adoption verifier;
2. run protocol/pointer columns and artifact metadata;
3. packet refs and attempt lifecycle metadata;
4. finding/recovery/evidence tables;
5. eval result and project tombstone tables;
6. read-model indexes.

No migration deletes legacy columns or historical rows. Large content is not
stored in PostgreSQL.

### Rehearsal

Before live apply:

1. create an isolated DB using the existing strict test DB naming rule;
2. clone the live schema and representative row counts without private payload
   content where possible;
3. apply and verify twice to prove idempotency;
4. run legacy CRUD/status smoke against the migrated schema;
5. inject lock timeout and checksum mismatch failures;
6. verify rollback by running with future-run default `legacy` while preserving
   new tables;
7. report relation/index sizes and apply duration.

## Activation sequence

### Release A: migration and shadow parity

- land Phase 1;
- apply/verify additive migrations;
- deploy with run default `legacy`;
- enable `shadow` only after capacity and health preflight;
- start one clean shadow run only after no active legacy claim exists;
- compare legacy claim/story outcomes with packet/attempt shadow diagnostics;
- shadow errors never alter workflow decisions.

Exit gate: no migration drift, no orphan attempt, no legacy behavior delta, and
all expected shadow artifacts/observations are queryable.

### Release B: sealed packet and slice consumers

- enable typed producers;
- require sealed packet for explicit v3 canaries only;
- render ImplementationSlice as the sole v3 agent context;
- enforce attempt fencing and attempt-scoped I/O;
- keep legacy path unchanged for non-v3 runs.

Exit gate: at least one offline and one clean canary per supported stack has
complete packet/slice/source identity and no context reparse.

### Release C: recovery and evidence authority

- enable FindingSet/RecoveryCase routing;
- disable v3 prose classifiers and first-delta policy;
- make supervisor bounded RecoveryCase owner;
- enable EvidenceBundleV2 release aggregation.

Exit gate: #1925/#1894/#847 replays and injected current-source/no-progress
cases converge without repeated tuple or false pass.

### Release D: canonical Mission Control

- ship Setfarm canonical endpoint;
- ship Mission Control canonical API/UI;
- keep labelled legacy fallback;
- verify identity conflicts and tombstones.

Exit gate: DB/artifact hashes and MC output match for legacy, shadow, v3,
blocked, failed, verified, and deployed examples.

### Release E: convergence eval and general decision

- run the three classes twice each from clean state;
- fix only systemic compiler/stack/recovery/evidence defects;
- stop after the same root cause repeats three times;
- rerun the full suite after any release-affecting fix;
- switch general default to v3 only if all six runs pass on one release SHA.

## Rollback

Rollback is forward-only and evidence-preserving:

- stop creation of new v3 runs;
- do not resume v3 runs through legacy; mark them `blocked_protocol` with a
  reconciliation report;
- set future-run default to `legacy` or `shadow`;
- keep packets, attempts, findings, evidence, and eval results immutable;
- if Mission Control projection fails, switch its read flag to labelled legacy
  projection without altering operational state;
- if evidence runner fails, block release rather than convert fail to pass;
- if fencing is suspect, pause claims and reconcile before restarting.

No rollback truncates or down-migrates the new ledger.

## Test strategy

Required before each activation boundary:

- strict schema/hash/artifact quota unit tests;
- migration plan/apply/verify/adoption/checksum tests;
- two-transaction reservation, crash, stale fence, same-story-different-run,
  and attempt-file isolation tests;
- producer and cross-artifact reference tests;
- exact Stitch action/control provenance tests;
- packet/slice determinism and source revision tests;
- finding dedupe, recovery budget, and supervisor ownership tests;
- evidence aggregation and unsupported-capability tests;
- canonical API and Mission Control UI/build tests;
- offline historical replay;
- six clean release eval runs.

Every runtime or projection change also runs the existing focused suites, full
`npm test`, clean build, and service HTTP smoke. Build/runtime guards are not
bypassed.

## Operational invariants

1. No active claim while restarting spawner or changing protocol defaults.
2. One writing branch per repo.
3. No generated project rescue inside an eval.
4. No project identifier in generic compiler/recovery/evidence code.
5. No same tuple dispatched twice to implementation.
6. No story running without one active fenced attempt in v3.
7. No source verdict from PR prose.
8. No required evidence skipped/advisory/snapshot-substituted.
9. No canonical owner/status derived from narrative prose.
10. No general v3 default before the six-run convergence gate.

## Delivery decomposition

This program is intentionally implemented as stacked, independently reviewable
changes:

1. migration, run protocol pinning, capacity preflight, shadow parity;
2. typed upstream producers, packet sealing, slice handoff;
3. authoritative attempt transitions and attempt-scoped I/O;
4. findings, evidence, recovery, supervisor ownership;
5. Setfarm canonical projection;
6. Mission Control canonical consumer;
7. eval runner, six-run release evidence, legacy retirement decision.

Only one stack is actively edited at a time. Each item is frozen before work on
the next item, so review fixes do not mix unrelated state-machine changes.

## Acceptance

The activation program is complete only when all audit success criteria hold:

- implementation receives one complete, contradiction-free slice before code;
- every Stitch surface/control/action/link/state/persistence/evidence relation is
  traceable;
- unchanged source/finding/packet is never sent twice;
- retry requests only proven deltas and supervisor owns bounded recovery;
- new product classes do not require project-specific guards;
- three materially different classes pass twice from clean state;
- Mission Control shows canonical operational evidence rather than agent prose;
- rollback rehearsal and release evidence are recorded and reproducible.
