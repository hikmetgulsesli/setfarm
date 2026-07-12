# Product Compiler Contract & Revision Spine Implementation Plan

Date: 2026-07-12
Design: `docs/superpowers/specs/2026-07-12-product-compiler-contract-revision-spine-design.md`
Audit: `../SETFARM_SYSTEM_AUDIT.md`
Starting revision: `5840ae3`
Design commit: `487283a`

## Intent

Implement the approved first vertical slice of Setfarm Product Compiler v3:
an offline-first, content-addressed Product Build Packet compiler and a
revision-fenced execution-attempt ledger that can observe legacy work without
changing legacy workflow decisions.

This plan is deliberately not a #1925 regex fix. It establishes the contract
and identity spine needed to replace project-specific guards, prose
classification, and repeated unchanged-source retries in later migrations.
The first outcome is:

> Given historical source artifacts and an exact source revision, Setfarm can
> deterministically compile or reject one immutable Product Build Packet,
> produce an exact implementation slice, and identify duplicate attempts
> without using agent or GitHub prose as product truth.

## Authorized Scope

This plan authorizes Phase 1 code and tests from the approved design:

- strict versioned contract schemas;
- canonical JSON and content-addressed artifacts;
- legacy source snapshot and provenance-preserving adapters;
- semantic converter projection and exact design linking;
- packet and implementation-slice compilation;
- additive attempt-ledger DDL and repository logic tested only in an isolated
  PostgreSQL database;
- protocol-gated shadow recorder hooks whose default `legacy` mode has zero
  side effects;
- historical, redacted, offline replay fixtures and eval command.

It does not authorize:

- setting `SETFARM_PROTOCOL=shadow` or `v3` on the live host;
- restarting Setfarm, Mission Control, OpenClaw, or the spawner;
- starting a Setfarm run;
- connecting migrations/tests to the operational `setfarm` database;
- changing a generated repository, GitHub PR/thread, claim, run, story, or
  observation row;
- changing retry budgets, review classifiers, supervisor decisions, current
  guards, Mission Control, or spawner behavior;
- treating shadow output as a workflow decision;
- pushing or opening a PR without a later explicit handoff decision.

## Non-Negotiable Invariants

1. `SETFARM_PROTOCOL` unset or `legacy` executes no compiler or attempt hook.
2. `shadow` may observe and write only compiler artifacts/attempt rows; it may
   not block, pass, retry, merge, supervise, or complete legacy work.
3. `v3` throws `PROTOCOL_NOT_IMPLEMENTED` before runtime work starts.
4. Compiler core modules have no PostgreSQL, GitHub, OpenClaw, process, service,
   or absolute-host-path dependency.
5. Only `exact` and `derived_with_provenance` fields can enter a sealed packet.
6. Labels, filenames, prose tokens, component names, and ordinals cannot create
   semantic control/action bindings.
7. A packet is sealed only after every cross-artifact reference resolves and
   every required action has reachable control and evidence coverage.
8. Artifact hashes cover semantic bytes only. Timestamps, hosts, PIDs, random
   IDs, absolute paths, and run identity remain operational metadata.
9. Attempt completion is fenced by `attempt_id + generation + fence_token`.
10. Attempt evidence has no cascading foreign key to `runs`.
11. Legacy prose is never promoted to a canonical finding merely to make a
    dedupe key.
12. Checked-in fixtures may contain historical project identifiers; generic
    implementation code may not.

## Delivery Strategy

Implement in small dependency-ordered commits. Every task follows the same
cycle:

1. add the narrow failing test or fixture expectation;
2. run the focused command and record the expected failure;
3. add the minimum implementation for the approved architecture;
4. run the focused command to green;
5. inspect the diff for project-specific logic, hidden live state, and semantic
   instability;
6. commit the coherent unit before starting the next task.

No `npm run build` is run while the worktree is dirty. Focused source tests run
before commits; the full clean-worktree build runs after all code commits.

## Task 0: Freeze Safety and Test Entry Points

### Goal

Make the new nested test suites and offline eval explicit without changing any
runtime behavior.

### Files

- Modify: `package.json`
- Modify: `package-lock.json` only when Task 1 installs Zod
- Add: `tests/product-compiler/protocol.test.ts`
- Add: `evals/fixtures/README.md`

### Steps

1. Add the first package script:

   ```json
   {
     "test:product-compiler": "node --import tsx --test tests/product-compiler/*.test.ts"
   }
   ```

2. Extend `test` so the compiler suite runs in addition to current root, step,
   and script tests. Task 8 adds the execution suite only after its first real
   tests exist; Task 10 adds the eval command with its entry point. Do not add a
   glob that has no matching tests, and do not hide it behind a silent skip.
3. Add the first red protocol test that imports the intended module and fails
   because it does not exist yet. Do not add a vacuous passing assertion.
4. Document that fixtures are redacted, deterministic, network-free evidence;
   they are not generated-project templates.

### Verification

Run:

```bash
npm run test:product-compiler
```

Expected before Task 1: failure resolving
`src/product-compiler/protocol.js`. This proves the nested suite is actually
executed.

### Commit Boundary

Task 0 and Task 1 may share one commit because Task 0 intentionally cannot be
green on its own. Target commit:

```text
feat(compiler): establish protocol and schema core
```

## Task 1: Protocol, Diagnostics, and Strict Schema Foundation

### Goal

Add the single runtime validation dependency and the stable common vocabulary
used by every later compiler pass.

### Files

- Modify: `package.json`
- Modify: `package-lock.json`
- Add: `src/product-compiler/protocol.ts`
- Add: `src/product-compiler/diagnostics.ts`
- Add: `src/product-compiler/schemas/common-v1.ts`
- Add: `src/product-compiler/schemas/compilation-report-v1.ts`
- Add: `tests/product-compiler/protocol.test.ts`
- Add: `tests/product-compiler/schemas.test.ts`

### Tests First

Cover:

- unset and `legacy` resolve to `{ mode: "legacy" }`;
- `shadow` resolves exactly;
- `v3` throws `PROTOCOL_NOT_IMPLEMENTED`;
- an unknown or whitespace-only nonempty value throws a typed configuration
  error instead of falling back;
- every object schema rejects unknown keys;
- stable diagnostic codes, severity, artifact/ref provenance, and suggested
  candidates are structured fields;
- compilation reports can represent rejected and sealed outcomes but cannot
  claim both;
- non-finite numeric fields and malformed SHA-256 values are rejected.

Run and expect failure:

```bash
npm run test:product-compiler
```

### Implementation

1. Install exact package-manager-selected `zod` through `npm install zod`.
2. Derive TypeScript types with `z.infer`; do not maintain duplicate
   handwritten interfaces.
3. Use `.strict()` on every object and explicit enums for diagnostic category,
   severity, confidence, and packet status.
4. Keep protocol parsing pure. It must not read the artifact store or connect to
   PostgreSQL.
5. Export a singleton runtime parser only if it is lazy; importing compiler
   utilities in tests must not read live configuration as a side effect.

### Verification

```bash
npm run test:product-compiler
```

Expected: all protocol and schema-foundation tests pass.

### Acceptance

- No compiler hook exists yet.
- `legacy` is the explicit and implicit default.
- No permissive `passthrough`, `catchall`, or unknown-field stripping exists.
- `zod` is the only new runtime dependency.

### Commit

```text
feat(compiler): establish protocol and schema core
```

## Task 2: Canonical JSON and Content-Addressed Artifact Store

### Goal

Make semantic contract bytes stable, verifiable, and independent of machine or
run identity.

### Files

- Add: `src/product-compiler/canonical-json.ts`
- Add: `src/product-compiler/artifact-store.ts`
- Add: `tests/product-compiler/canonical-json.test.ts`
- Add: `tests/product-compiler/artifact-store.test.ts`

### Tests First

Canonical JSON tests:

- object keys use JavaScript UTF-16 lexical order at every depth;
- arrays preserve input order;
- Unicode strings preserve exact code points and are not normalized;
- `-0` serializes as `0`;
- non-finite numbers, `undefined`, bigint, functions, symbols, sparse arrays,
  and cycles throw typed errors;
- canonical bytes have no trailing newline;
- repeated serialization and hash operations are byte-identical.

Artifact-store tests using a temp root:

- store path is `<root>/<sha256>.json` and cannot escape the injected root;
- stored bytes exactly equal canonical hash input;
- repeat put returns the existing hash without rewriting semantic bytes;
- an existing same-name file with different bytes returns
  `ARTIFACT_HASH_COLLISION_OR_CORRUPTION` and is not overwritten;
- a corrupted read fails hash verification;
- two concurrent puts of identical content converge on one valid file;
- producer envelope rejects timestamp, absolute-path, PID, and unknown fields.

Run and expect failure:

```bash
node --import tsx --test \
  tests/product-compiler/canonical-json.test.ts \
  tests/product-compiler/artifact-store.test.ts
```

### Implementation

1. Write a recursive validator/normalizer that rejects unsupported JSON before
   serialization. Do not depend on `JSON.stringify(value, sortedKeys)` because
   it does not provide the required recursive semantics by itself.
2. Hash UTF-8 bytes with SHA-256.
3. Implement same-directory temporary write, file `fsync`, atomic no-replace
   publication, and parent-directory `fsync` where supported. Use a
   same-filesystem hard link followed by temporary unlink because Node's
   `rename()` may overwrite an existing immutable hash target.
4. On publication races, verify the final target rather than overwriting it.
5. Make the store root constructor-injected. Runtime defaults are added only in
   Task 9.

### Verification

```bash
node --import tsx --test \
  tests/product-compiler/canonical-json.test.ts \
  tests/product-compiler/artifact-store.test.ts
```

### Commit

```text
feat(compiler): add canonical artifact store
```

## Task 3: Versioned Product Contract Schemas

### Goal

Represent the full product/design/topology/story/slice contract with strict,
typed, referenceable artifacts before any legacy adapter attempts inference.

### Files

- Add: `src/product-compiler/schemas/product-spec-v1.ts`
- Add: `src/product-compiler/schemas/design-interaction-graph-v1.ts`
- Add: `src/product-compiler/schemas/build-topology-v1.ts`
- Add: `src/product-compiler/schemas/story-plan-v1.ts`
- Add: `src/product-compiler/schemas/product-build-packet-v1.ts`
- Add: `src/product-compiler/schemas/implementation-slice-v1.ts`
- Add: `tests/product-compiler/contract-schemas.test.ts`
- Add: `tests/product-compiler/fixtures/minimal-valid-contract.ts`

### Tests First

Create one minimal valid product with one route, surface, form control, save
action, state delta, persistence effect, story, owned source path, build
command, and evidence predicate. Then mutate one dimension per test:

- invalid stable ID prefix or malformed hash;
- action references absent route/state/persistence/evidence;
- interactive control has zero or two dispositions;
- story renames or invents an action;
- story omits required ownership or graph dependency;
- topology path is absolute, escapes the repo, or has conflicting owners;
- command/capability pair is inconsistent;
- packet manifest contains `sealedAt` or operational metadata;
- implementation slice omits source revision or includes unknown fields.

At schema level, local structure should fail early. Cross-artifact foreign keys
that require multiple artifacts are asserted in Task 7.

### Implementation

1. Define stable ID schemas once in `common-v1.ts` and import them everywhere.
2. Model action input, preconditions, state delta, navigation, persistence,
   outcomes, and evidence as structured objects, never free-form completion
   prose.
3. Model each control disposition as a discriminated union:
   `action | external | disabled | informational`.
4. Require raw design artifact hashes and provenance on derived control IDs.
5. Require stack pack version/content hash, repo base SHA/tree hash, typed
   commands, capabilities, ownership, and grants.
6. Sort set-like lists by stable ID in producers; schemas validate uniqueness
   but do not silently reorder user input.

### Verification

```bash
node --import tsx --test \
  tests/product-compiler/schemas.test.ts \
  tests/product-compiler/contract-schemas.test.ts
```

### Commit

```text
feat(compiler): define versioned product contracts
```

## Task 4: Redacted Historical Fixtures and Legacy Source Snapshot

### Goal

Turn the audited failures into immutable offline evidence and make source
capture explicit without inference or live runtime dependencies.

### Files

- Add: `src/product-compiler/legacy-source-snapshot.ts`
- Add: `evals/fixtures/1925-task-chip/fixture.json`
- Add: `evals/fixtures/1925-task-chip/sources/*`
- Add: `evals/fixtures/1925-task-chip/expected/*`
- Add: `evals/fixtures/1894-branch-continuity/fixture.json`
- Add: `evals/fixtures/1894-branch-continuity/sources/*`
- Add: `evals/fixtures/847-required-evidence/fixture.json`
- Add: `evals/fixtures/847-required-evidence/sources/*`
- Add: `evals/fixtures/vibe-control-id/fixture.json`
- Add: `evals/fixtures/vibe-control-id/sources/*`
- Add: `evals/fixtures/1887-action-state/fixture.json`
- Add: `evals/fixtures/1893-persistence/fixture.json`
- Add: `tests/product-compiler/legacy-source-snapshot.test.ts`
- Add: `tests/product-compiler/historical-fixtures.test.ts`

### Fixture Rules

1. Copy only the minimum audited artifact fragments required to reproduce the
   contract relationship. Never copy credentials, `.env`, full transcripts,
   private user data, or mutable worktree metadata.
2. Every `fixture.json` records:
   schema version, case ID, provenance description, source commit/DB evidence
   locator, each copied file hash, redaction statement, expected packet status,
   expected diagnostics, and expected exact bindings.
3. Fixture acquisition is read-only. Use existing `git show`, audited file
   snapshots, or literal minimal excerpts. Do not checkout, edit, or recover the
   historical generated repositories.
4. Generic code cannot branch on fixture/run/project IDs.

### Tests First

- fixture manifests validate strictly and copied hashes match;
- paths are normalized relative locators and cannot escape fixture root;
- missing plan, generated index, setup certificate, or story source is reported
  explicitly rather than inferred;
- operational `runId` and absolute read root do not enter child semantic hashes;
- identical source bytes from two temporary roots produce identical refs;
- #1925 retains both `ACT_SAVE_RECORD` and `save-changes-7` on the same source
  control while guessed IDs remain separate evidence;
- #1894 contains distinct correct-head and later-base revisions;
- #847 contains required child evidence failure;
- Vibe contains the exact `menu-btn`/`main-menu-btn` mismatch.

### Implementation

Implement snapshot reading as a pure filesystem adapter with injected absolute
read root. It hashes files and returns normalized refs; it performs no semantic
guessing and does not store artifacts by itself.

### Verification

```bash
node --import tsx --test \
  tests/product-compiler/legacy-source-snapshot.test.ts \
  tests/product-compiler/historical-fixtures.test.ts
```

### Commit

```text
feat(compiler): capture legacy replay sources
```

## Task 5: Provenance-Preserving Legacy Adapters

### Goal

Convert legacy plan, Stitch, story, and setup artifacts into typed candidates
without laundering heuristic guesses into sealed contract facts.

### Files

- Add: `src/product-compiler/adapters/legacy-plan.ts`
- Add: `src/product-compiler/adapters/stitch.ts`
- Add: `src/product-compiler/adapters/legacy-stories.ts`
- Add: `src/product-compiler/adapters/setup-topology.ts`
- Add: `tests/product-compiler/legacy-adapters.test.ts`

### Tests First

- direct stable references are `exact`;
- deterministic lossless projections are `derived_with_provenance` and include
  source hash/locator/range;
- zero/multiple targets are `missing`/`ambiguous`;
- current token/label/filename guesses are
  `heuristic_legacy_only` diagnostics only;
- an adapter cannot upgrade confidence to satisfy a schema;
- plan action references survive with their original stable IDs;
- stories partition existing actions and cannot mint renamed IDs;
- topology distinguishes owned paths, dependency paths, and shared grants;
- absolute host paths and operational run IDs do not enter candidates.

### Implementation

Return `AdapterResult<T>` consistently. Diagnostics must include stable code,
artifact ref, source locator, confidence, and bounded suggestions. Avoid generic
catch-all parsing; each source family has one responsible adapter.

### Verification

```bash
node --import tsx --test tests/product-compiler/legacy-adapters.test.ts
```

### Commit

```text
feat(compiler): add provenance-aware legacy adapters
```

## Task 6: Preserve Semantic Action IDs in Stitch Projection

### Goal

Stop the converter from discarding an ACT/local-control join that exists in
generated source. This changes projection data, not runtime gate strictness.

### Files

- Modify: `scripts/stitch-to-jsx.mjs`
- Verify: `tests/stitch-to-jsx.test.ts`
- Add: `tests/product-compiler/converter-projection.test.ts`

### Tests First

Add converter fixtures asserting:

- a source control containing both `data-action="ACT_SAVE_RECORD"` and
  `data-action-id="save-changes-7"` projects both `actionRef` and
  `generatedLocalId` into `SCREEN_INDEX`;
- source locator and control kind remain attached;
- a local ID without semantic action remains unresolved, not guessed;
- semantic action without local ID remains explicit and diagnostic;
- label text such as `Description`, `task-title`, or `task-desc` is never emitted
  as a required ID;
- current consumers remain compatible with additive fields.

Run and expect failure:

```bash
node --import tsx --test tests/product-compiler/converter-projection.test.ts
```

### Implementation

1. Extend the converter's structured index shape with additive semantic fields.
2. Preserve the same-element provenance; do not recover action IDs through
   neighboring text or regex token lists.
3. Keep legacy fields during this migration.
4. Do not modify `pr-comments.ts`, review guards, or generated-project source.

### Verification

```bash
node --import tsx --test \
  tests/stitch-to-jsx.test.ts \
  tests/product-compiler/converter-projection.test.ts
```

### Commit

```text
feat(stitch): preserve semantic action bindings
```

## Task 7: Exact Linker, Packet Compiler, and Slice Compiler

### Goal

Build the pure compiler path from typed candidates to either one stable
rejection report or one sealed packet and deterministic story slice.

### Files

- Add: `src/product-compiler/design-linker.ts`
- Add: `src/product-compiler/packet-compiler.ts`
- Add: `src/product-compiler/slice-compiler.ts`
- Add: `tests/product-compiler/design-linker.test.ts`
- Add: `tests/product-compiler/packet-compiler.test.ts`
- Add: `tests/product-compiler/slice-compiler.test.ts`
- Add: `tests/product-compiler/1925-integration.test.ts`

### Tests First: Linker

- precedence is structured semantic/local index, same-element legacy source,
  exact SCREEN_MAP/DESIGN_MANIFEST, then unresolved;
- an explicit stable design control ID wins over a derived ID;
- derived ID exactly equals
  `CTRL_<sha256(rawHash + NUL + selector + NUL + kind)[0:16]>`;
- label/filename/component/token/ordinal matches appear only as suggestions;
- each interactive control receives exactly one disposition;
- required actions are reachable or compilation rejects;
- state, payload, persistence, route, and evidence references remain attached
  to an action binding.

### Tests First: Packet

- all candidate schemas parse before cross-reference validation;
- missing/duplicate/wrong-type references reject with stable diagnostic IDs;
- story ownership is complete and dependency graphs are acyclic;
- topology paths, grants, commands, and capabilities are consistent;
- required actions without supported evidence reject;
- failed compilation writes child/report artifacts but no packet manifest;
- successful compilation stores each child then one packet manifest;
- packet manifest contains no timestamp or operational identity;
- repeated compilation produces the same report/packet hashes.

### Tests First: Historical Integration

- #1925 exact `ACT_SAVE_RECORD <-> save-changes-7` binding is recovered;
- #1925 overall packet still rejects unresolved `SURF_INSIGHTS` and renamed
  actions; exact local success cannot conceal unrelated incompleteness;
- guessed zero-overlap mappings are rejected and poison prose tokens never
  become controls;
- #847 required evidence failure cannot aggregate to sealed PASS;
- Vibe control-ID mismatch remains an exact link failure;
- #1887/#1893 missing state/persistence relations emit generic stable
  diagnostics, not project-specific codes.

### Tests First: Slice

- same packet/story/source SHA/tree yields the same slice hash;
- changed packet, story, source SHA, or source tree changes the slice hash;
- slice contains only its graph partition plus declared dependency signatures
  and grants;
- missing owned source path or foreign ref rejects;
- commands and evidence predicates come from packet artifacts, never prompts.

### Implementation

1. Keep linker and validators pure and deterministic.
2. Sort diagnostics by stable tuple before writing reports.
3. Store artifacts only after validation of their schema; store packet manifest
   only after all passes succeed.
4. Never mutate candidates during validation.
5. Expose a single compile result discriminated union:
   `sealed | rejected`.

### Verification

```bash
node --import tsx --test \
  tests/product-compiler/design-linker.test.ts \
  tests/product-compiler/packet-compiler.test.ts \
  tests/product-compiler/slice-compiler.test.ts \
  tests/product-compiler/1925-integration.test.ts
```

### Commit

```text
feat(compiler): compile sealed product packets
```

## Task 8: Execution Schemas, Attempt DDL, and Fence Repository

### Goal

Give each observed implementation attempt stable revision identity and
transactional duplicate/lease handling without touching legacy workflow state.

### Files

- Add: `src/execution/schemas/execution-attempt-v1.ts`
- Add: `src/execution/schemas/output-envelope-v1.ts`
- Add: `src/execution/output-envelope.ts`
- Add: `src/execution/lease-fence.ts`
- Add: `src/execution/attempt-repository.ts`
- Modify: `package.json`
- Modify: `src/db-pg.ts`
- Add: `tests/execution-attempts/test-database.ts`
- Add: `tests/execution-attempts/schemas.test.ts`
- Add: `tests/execution-attempts/repository.test.ts`
- Add: `tests/execution-attempts/concurrency.test.ts`

### DDL Requirements

Add only the approved `execution_attempts` table, checks, and indexes through
the existing additive `pgMigrate()` convention:

- no cascade and no foreign key to `runs`;
- CHECK constraints for attempt class and disposition;
- partial unique active-fence index for `claimed|running` by
  `run_id, step_id, story_id`;
- partial unique dedupe index only where `dedupe_key IS NOT NULL`;
- lookup indexes for run/story, lease expiration, and packet/source/finding;
- all DDL is idempotent.

Do not run this migration against live PostgreSQL in this phase.

Add and include the execution suite only now that real tests exist:

```json
{
  "test:execution-attempts": "node --import tsx --test tests/execution-attempts/*.test.ts"
}
```

### Isolated Database Harness

1. Read the administrative URL from test-only environment/config, connect to a
   maintenance DB, and create a name matching
   `setfarm_contract_spine_test_<pid>_<random>`.
2. Refuse any database name that does not match that exact prefix pattern.
3. Set `SETFARM_PG_URL` before dynamically importing `src/db-pg.ts`.
4. Close all clients and drop only the generated test DB in teardown.
5. Fail explicitly if isolated PostgreSQL is unavailable. Never silently skip
   the architecture concurrency suite.

### Tests First

Schema/unit:

- exact product attempts require packet, report, source, and typed finding to
  compute dedupe;
- initial, rejected-packet, prose-only, infrastructure, and evidence-only
  attempts have null dedupe;
- dedupe hash includes run/step/story/packet/source/finding;
- output envelope validates attempted slice/source identity and bounded
  structured outputs.

Database/concurrency:

- two concurrent reservations produce one active fence;
- same exact dedupe tuple inserts once, then returns `duplicate`;
- same story/source in two runs does not collide;
- expired active attempt is atomically superseded;
- unexpired owner returns `active_conflict`;
- completion with stale generation/fence affects zero rows and returns
  `stale_fence`;
- terminal update with exact fence affects exactly one row;
- rejected packet records report hash with null packet/slice/dedupe;
- hard-deleting a test legacy run does not delete attempt evidence;
- repository methods do not update `stories`, `steps`, or `claim_log`.

### Verification

```bash
npm run test:execution-attempts
```

Expected: suite creates and removes only its uniquely named test DB. Verify the
operational database name is never present in emitted DDL/drop logs.

### Commit

```text
feat(execution): add revision-fenced attempt ledger
```

## Task 9: Runtime Artifact Root and Shadow Recorder

### Goal

Add a narrow observational adapter and exact lifecycle hooks while preserving
zero default behavior and all legacy decisions.

### Files

- Modify: `src/runtime-config.ts`
- Add: `src/execution/shadow-attempt-recorder.ts`
- Modify: `src/installer/step-ops.ts`
- Modify: `src/installer/step-fail.ts`
- Add: `tests/execution-attempts/shadow-recorder.test.ts`
- Add: `tests/execution-attempts/runtime-hooks.test.ts`

### Recorder Contract

- The recorder accepts already-known run, step, story, generation, branch,
  worktree, source revision, packet/report/finding refs, role, and agent.
- It does not parse rendered prompts, GitHub prose, agent output prose, or
  Mission Control JSON.
- Its dependencies are injected so unit tests use temp artifact roots and fake
  repositories.
- Every public observe call catches/returns bounded shadow diagnostics. It
  cannot throw into legacy decisions.
- Six-hour lease is diagnostic-only and injectable; no heartbeat ownership is
  claimed in this slice.

### Exact Hook Boundaries

1. Claim start in `src/installer/step-ops.ts`: immediately after worktree
   creation, actual branch discovery, `claim_log` insert, and story claim
   metadata update (current region around lines 5817-5936).
2. Successful story completion in `src/installer/step-ops.ts`: after Setfarm's
   commit/PR handling and story status update, before legacy claim-log close
   (current region around lines 8467-8473).
3. Failure/requeue in `src/installer/step-fail.ts`: a read-only prepare at
   `handleLoopStepFailurePG` entry captures source before cleanup; finalize runs
   after each existing state transaction and immediately before its return.

Only tiny adapter calls belong in the two god files. Compiler, SQL, hash,
classifier, and retry logic may not be added there. Do not modify
`src/spawner.ts` or `src/spawner-prompt.ts`.

### Tests First

- importing runtime with protocol unset creates no directory, artifact, or DB
  call;
- `legacy` hook functions return before dependency construction;
- unknown protocol and `v3` fail at explicit initialization tests;
- `shadow` claim observes exact branch/worktree/source-before identity;
- success observes source-after/output after status change but cannot alter it;
- failure prepare remains read-only and finalize uses captured pre-cleanup
  revision;
- fake compiler/repository failure emits `product_compiler.shadow_error` and
  legacy callback/result remains unchanged;
- duplicate/active/stale outcomes are observations only;
- source-level hook test prevents calls from moving before worktree/claim or
  after claim-log close;
- recorder never imports PR-comment classifier or supervisor modules.

### Runtime Config

Add `SETFARM_PRODUCT_ARTIFACT_DIR` with default:

```text
${runtimeConfig.setfarmDir}/product-compiler/artifacts/sha256
```

Resolve it lazily after protocol mode is known. Legacy mode must not create the
directory.

### Verification

```bash
node --import tsx --test \
  tests/execution-attempts/shadow-recorder.test.ts \
  tests/execution-attempts/runtime-hooks.test.ts
```

Then run the existing focused lifecycle suites that cover the touched paths:

```bash
node --import tsx --test \
  tests/claim-log-lifecycle.test.ts \
  tests/retry-feedback.test.ts \
  tests/failure-router.test.ts \
  tests/worktree-ops.test.ts
```

If an exact existing filename differs, select the nearest existing claim/fail
lifecycle tests with `rg --files tests | rg 'claim|fail|retry|worktree'` and
record the actual commands in the implementation commit message.

### Commit

```text
feat(execution): observe legacy attempts in shadow mode
```

## Task 10: Offline Contract Replay Eval

### Goal

Provide one deterministic command that demonstrates cross-project convergence
without a live run, provider, browser, GitHub, OpenClaw, or operational DB.

### Files

- Add: `src/evals/contract-replay.ts`
- Add: `src/evals/contract-replay-report.ts`
- Add: `tests/product-compiler/contract-replay.test.ts`
- Complete: `evals/fixtures/*/expected/compilation-result.json`
- Complete: `evals/fixtures/*/expected/attempt-result.json`
- Modify: `package.json`

### CLI Contract

Add the entry point together with its script, so no intermediate commit exposes
a command whose module does not exist:

```json
{
  "eval:contracts": "node --import tsx src/evals/contract-replay.ts --fixtures evals/fixtures"
}
```

`npm run eval:contracts`:

- discovers only fixture directories under the injected/default fixture root;
- validates fixture manifests and copied hashes before evaluation;
- uses a temp artifact store;
- uses an in-memory attempt decision model for fixture dedupe unless the
  command explicitly receives an isolated test DB URL;
- performs no network access;
- emits stable JSON plus a concise terminal table;
- exits nonzero on fixture drift, unexpected diagnostic, missing binding,
  nondeterministic hash, or expected-attempt mismatch;
- never writes expected snapshots automatically.

### Required Assertions

- #1925: exact save binding recovered, guessed/prose IDs rejected, unresolved
  product refs keep packet rejected, repeated exact tuple is duplicate.
- #1894: correct head and later base are distinct; continuity mismatch is
  `ATTEMPT_SOURCE_REVISION_CHANGED`.
- #847: failed required child evidence cannot aggregate PASS.
- Vibe: exact control-ID mismatch blocks completeness despite completion prose.
- #1887: control/value/state gap has a stable generic diagnostic.
- #1893: action/persistence gap has a stable generic diagnostic and unchanged
  exact tuple dedupes.
- Two runs with the same semantic product inputs may share artifact hashes but
  never share operational dedupe identity.

### Tests First

```bash
npm run eval:contracts
```

Expected before implementation: command fails because replay entry point or
expected outputs are absent.

### Verification

```bash
npm run eval:contracts
npm run eval:contracts
```

Both runs must produce byte-identical stable JSON results except for explicitly
separate terminal timing, which must not enter result hashes or snapshots.

### Commit

```text
test(evals): add product contract replay suite
```

## Task 11: Full Verification and Safety Audit

### Goal

Prove the slice is deterministic, regression-safe, and dormant by default
before any rollout discussion.

### Step 1: Clean-Tree Gate

Commit all intended source/test/fixture changes. Then require:

```bash
git status --short
```

Expected: no output. Do not bypass the clean-build guard.

### Step 2: Focused Suites

```bash
npm run test:product-compiler
npm run test:execution-attempts
npm run test:scripts
npm run eval:contracts
```

Expected: all pass. The PostgreSQL suite must state its isolated database name
and successful cleanup.

### Step 3: Full Regression and Build

```bash
npm test
npm run build
```

Expected: all tests and prebuild contracts pass from a clean worktree. If build
generates tracked version metadata, inspect it, commit only intended generated
source, return to clean, and rerun build. Never set
`SETFARM_ALLOW_DIRTY_BUILD=1` or `SETFARM_SKIP_RUNTIME_GUARD=1`.

### Step 4: Static Boundary Checks

```bash
rg -n "1925|1894|847|Vibe|1887|1893" src scripts --glob '!**/__tests__/**'
rg -n "pr-comments|supervisor|spawner" src/product-compiler src/execution
rg -n "Date\(|new Date|process\.pid|hostname|randomUUID|runId|/Users/" \
  src/product-compiler
git diff origin/main...HEAD -- src/spawner.ts src/spawner-prompt.ts \
  src/installer/steps/07-verify/pr-comments.ts
```

Expected:

- no historical project/run hardcode in generic runtime code;
- compiler core does not import prose classifier, supervisor, spawner, DB, or
  service modules;
- any operational nondeterminism is outside semantic envelopes;
- the three explicitly out-of-scope runtime files have no diff.

### Step 5: Dormancy Checks

With `SETFARM_PROTOCOL` unset in an isolated temp config environment:

- import/start the relevant runtime module in a test process;
- assert no product-compiler artifact directory is created;
- assert no attempt repository call occurs;
- assert legacy hook return values and state transitions match pre-change
  fixtures.

Do not query the live DB to prove row absence by running migration-bearing
Setfarm modules. If a read-only live check is later desired, use an independent
`psql` client and explicit approval; it is not required for this phase.

### Step 6: Diff Review

Review `origin/main...HEAD` for:

- accidental live paths, secrets, transcripts, or credentials;
- fixture provenance and redaction completeness;
- strict schemas and explicit version tags;
- canonical-byte stability;
- packet sealing only after complete validation;
- no hidden label/prose semantic binding;
- no cascade to runs;
- correct partial unique indexes;
- exact fence predicates on terminal updates;
- swallowed shadow errors without swallowed legacy errors;
- no decision branching on shadow results.

Fix findings in a dedicated final commit if necessary:

```text
fix(compiler): close contract spine review gaps
```

### Final Evidence Record

Append an implementation evidence section to this plan or a sibling delivery
note containing:

- final commit list;
- focused/full/build/eval commands and exit status;
- fixture result hashes;
- isolated PostgreSQL DB name and teardown confirmation;
- static-boundary results;
- known limitations;
- explicit statement that no live run, service restart, DB migration, PR
  mutation, or generated-project rescue occurred.

Do not edit the original audit's findings to make implementation appear
complete. Record deltas separately.

## Dependency Graph

```text
protocol + common schemas
          |
          +--> canonical JSON --> artifact store
          |
          +--> product contract schemas
          |          |
historical snapshot -+--> legacy adapters --> semantic converter projection
                                             |
                                             v
                                  exact linker + packet compiler
                                             |
                                             v
                                      slice compiler
                                             |
                  +--------------------------+------------------+
                  |                                             |
                  v                                             v
        attempt schemas + DDL/repository                 offline replay eval
                  |
                  v
           shadow recorder hooks
```

Tasks 1-7 are pure/offline except filesystem fixture reads and injected temp
artifact writes. Task 8 is isolated-DB only. Task 9 adds dormant runtime calls.
Task 10 proves historical behavior. Task 11 is the release boundary.

## Commit Sequence

1. `feat(compiler): establish protocol and schema core`
2. `feat(compiler): add canonical artifact store`
3. `feat(compiler): define versioned product contracts`
4. `feat(compiler): capture legacy replay sources`
5. `feat(compiler): add provenance-aware legacy adapters`
6. `feat(stitch): preserve semantic action bindings`
7. `feat(compiler): compile sealed product packets`
8. `feat(execution): add revision-fenced attempt ledger`
9. `feat(execution): observe legacy attempts in shadow mode`
10. `test(evals): add product contract replay suite`
11. Optional only if review finds defects:
    `fix(compiler): close contract spine review gaps`

Every commit must leave its focused suite green. The branch may remain ahead of
`origin/main`; it is not pushed in this plan.

## Stop Conditions

Stop implementation and report rather than expanding scope if any of these
occurs:

- historical evidence is unavailable or cannot be redacted without changing
  the claimed regression;
- the isolated PostgreSQL harness cannot prove it is disconnected from the
  operational database;
- implementing exact linkage requires project-specific runtime identifiers;
- dormant hooks alter a legacy state transition, return value, prompt, retry,
  or timing-sensitive decision;
- compiler output is nondeterministic across two offline runs;
- the same focused failure repeats three times after a fix attempt;
- the worktree contains unrelated user changes that overlap planned files;
- the slice would require changing supervisor/retry/PR-comment logic before its
  contract outputs exist.

These are blockers to this slice, not reasons to weaken gates or add a fallback
classifier.

## Phase-1 GO Criteria

Phase 1 is complete only when all are true:

- strict schema and reference validation can seal the minimal valid packet;
- #1925 exact save binding is retained while incomplete unrelated refs reject;
- #847 and Vibe false-completion evidence cannot become compiler PASS;
- #1887/#1893 semantic gaps produce stable generic diagnostics;
- #1894 source revision discontinuity remains visible;
- packet, report, slice, and replay hashes are deterministic;
- exact unchanged product-attempt tuples dedupe and cross-run tuples do not;
- concurrent reservations and stale fences behave correctly in isolated PG;
- protocol unset/legacy has zero compiler/attempt side effects;
- all focused suites, full tests, build, and offline eval pass on a clean tree;
- no live system or generated-project state was mutated.

Passing Phase 1 does not authorize shadow deployment. Phase 2 requires a
separate operator decision, live migration review, capacity check, deployment
procedure, observation window, and rollback rehearsal.
