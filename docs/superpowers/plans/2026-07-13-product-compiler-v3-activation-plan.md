# Product Compiler v3 Activation Implementation Plan

Date: 2026-07-13

Design:
`docs/superpowers/specs/2026-07-13-product-compiler-v3-activation-design.md`

Base:

- Phase 1 commit: `75bf717`
- Phase 1 draft PR: #44
- Phase 2 branch: `feat/product-compiler-v3-activation`

## Delivery rules

1. Work in dependency order and keep each commit independently testable.
2. Write failing tests before runtime changes.
3. Keep legacy behavior available until the complete eval gate passes.
4. Pin protocol at run creation; never reinterpret an existing run.
5. Do not use a generated-project identifier in generic code.
6. Do not resolve PR threads or edit old generated projects for activation.
7. Do not restart a service while a run or claim is active.
8. Stop and report if one root cause repeats three times after a platform fix.
9. Do not bypass build/runtime guards.
10. Freeze each stacked release before starting the next repo-writing branch.

## Release A — Migration, run protocol, capacity, shadow parity

### Task A1: Migration journal and exact adoption

Files:

- add `src/db/contract-spine-migrations.ts`
- add `scripts/contract-spine-migrate.ts`
- add `tests/execution-attempts/migrations.test.ts`
- modify `src/db-pg.ts`
- modify `package.json`

Tests first:

- empty isolated DB plans migrations without mutation;
- apply creates the journal and required relations;
- second apply is byte/logically idempotent;
- verify fails on a missing migration;
- verify fails on checksum mismatch;
- an existing empty Phase 1 `execution_attempts` table is adopted only when
  columns, constraints, and indexes match;
- malformed existing table is rejected without destructive repair;
- concurrent apply uses one advisory lock owner;
- lock timeout is bounded and classified;
- migration never connects to a DB outside the injected URL.

Implementation:

1. Define immutable migration descriptors with version, name, SQL checksum,
   preflight, apply, and verify functions.
2. Add `setfarm_schema_migrations`.
3. Move Phase 1 attempt DDL ownership from monolithic startup code to migration
   v1 while preserving exact schema.
4. Implement exact catalog verification for adoption.
5. Expose plan/apply/verify CLI modes. Plan emits canonical JSON.
6. Keep base legacy schema initialization unchanged.
7. Make shadow/v3 startup verify migrations; explicit apply happens before
   production restart.

Verification:

```bash
npm run test:execution-attempts
npm run db:contract-spine:plan -- --database <isolated-url>
npm run db:contract-spine:apply -- --database <isolated-url>
npm run db:contract-spine:verify -- --database <isolated-url>
```

Commit: `feat(db): journal contract spine migrations`

### Task A2: Run-pinned protocol

Files:

- add `src/execution/run-protocol.ts`
- add `tests/execution-attempts/run-protocol.test.ts`
- modify `src/product-compiler/protocol.ts`
- modify `src/installer/run.ts`
- modify `src/cli/cli.ts`
- modify `src/db/contract-spine-migrations.ts`

Tests first:

- missing/default configuration creates legacy run;
- explicit `--protocol shadow` creates shadow run;
- v3 creation fails unless activation flag and preflight pass;
- protocol/version/release SHA are inserted atomically with run/steps;
- resume reads stored protocol after environment changes;
- legacy/shadow run cannot be upgraded to v3;
- invalid protocol fails before run-number or DB mutation;
- existing rows migrate to legacy/version 1.

Implementation:

1. Migration v2 adds run protocol/pointer columns and constraints.
2. Resolve default and explicit protocol before `pgNextRunNumber`.
3. Store compiler release SHA with the run.
4. Add `--protocol legacy|shadow|v3` to run CLI and usage.
5. Return protocol in run creation/status models.
6. Make shadow hooks consume the stored run protocol, not the current process
   default.

Verification:

```bash
node --import tsx --test tests/execution-attempts/run-protocol.test.ts
npm run test:execution-attempts
```

Commit: `feat(runtime): pin protocol to each run`

### Task A3: Artifact capacity and activation preflight

Files:

- add `src/execution/activation-preflight.ts`
- add `src/product-compiler/artifact-capacity.ts`
- add `tests/execution-attempts/activation-preflight.test.ts`
- add `tests/product-compiler/artifact-capacity.test.ts`
- modify `src/product-compiler/artifact-store.ts`
- modify `src/runtime-config.ts`
- modify `src/installer/run.ts`

Tests first:

- artifact over 4 MiB is rejected before temp-file publication;
- root quota and minimum free-space failures are distinct;
- existing identical artifact can be reused at quota without new allocation;
- preflight checks migrations, disk, DB, artifact root, protocol, and active
  claim/run policy;
- shadow failure is advisory only where specified;
- v3 failure blocks run creation before DB mutation;
- diagnostics contain no secret URL or absolute private payload.

Implementation:

1. Add injected/stateless capacity calculation.
2. Add payload, root quota, and free-space configuration.
3. Implement canonical preflight report.
4. Store preflight hash/ref on new shadow/v3 runs.
5. Do not auto-delete immutable artifacts.

Commit: `feat(runtime): gate compiler activation capacity`

### Task A4: Shadow parity projection

Files:

- add `src/execution/shadow-parity.ts`
- add `tests/execution-attempts/shadow-parity.test.ts`
- modify `src/execution/shadow-attempt-recorder.ts`
- modify `src/installer/step-ops.ts`
- modify `src/installer/step-fail.ts`
- modify `src/server/dashboard.ts`

Tests first:

- a shadow run writes one attempt for one legacy claim;
- legacy run creates no attempt/artifact dependency;
- completion/failure uses the run-pinned mode;
- shadow diagnostics become structured observations;
- parity report detects missing, duplicate, stale, and terminal-active attempts;
- parity calculation cannot mutate legacy story/step/run state.

Implementation:

1. Pass stored protocol into every shadow hook.
2. Record bounded structured `run_observations` alongside logs.
3. Add read-only parity endpoint/report for claims vs attempts.
4. Include attempt/process/workflow dispositions separately.

Commit: `feat(execution): report shadow attempt parity`

### Task A5: Rehearse and activate shadow

Operational sequence:

1. full focused tests;
2. create isolated rehearsal DB;
3. copy live schema shape and representative counts;
4. plan/apply/verify twice;
5. run legacy DB/status smoke;
6. record size/duration/lock evidence;
7. confirm zero active claims/runs;
8. apply and verify live migration;
9. clean build and restart Setfarm services;
10. keep default legacy for first smoke;
11. set new-run default shadow and restart once more;
12. start one clean shadow run;
13. monitor to terminal state and generate parity report;
14. if a root failure repeats three times, stop the run loop and classify it.

No Phase B code begins until migration drift is zero and shadow cannot alter
legacy decisions.

Evidence commit: `docs(runtime): record shadow activation evidence`

## Release B — Typed producers, packet sealing, slice handoff

### Task B1: Typed ProductSpec producer

Files:

- add `src/product-compiler/producers/product-spec.ts`
- add `src/product-compiler/renderers/legacy-prd.ts`
- add `tests/product-compiler/product-spec-producer.test.ts`
- modify `src/installer/steps/01-plan/preclaim.ts`
- modify `src/installer/steps/01-plan/guards.ts`

Requirements:

- typed value is produced before prose;
- legacy PRD is rendered from the typed value;
- every action has surface, input, state, persistence, and evidence refs;
- unsupported/ambiguous semantics reject the candidate;
- no rendered-prose round trip creates authority;
- utility, operations, and game fixtures are covered.

Commit: `feat(compiler): produce typed product specs`

### Task B2: Exact design target provenance

Files:

- add `src/product-compiler/producers/design-graph.ts`
- add `tests/product-compiler/design-producer.test.ts`
- modify `src/installer/steps/02-design/preclaim.ts`
- modify `scripts/stitch-to-jsx.mjs`
- modify converter tests

Requirements:

- generation request target surface and response screen identity are linked;
- converter preserves same-element `data-action` + generated local ID;
- title/label/token matching is diagnostic only;
- every interactive control has an exact disposition;
- ambiguous/missing control semantics reject sealing.

Commit: `feat(stitch): emit exact design graph provenance`

### Task B3: Topology and StoryPlan producers

Files:

- add `src/product-compiler/producers/build-topology.ts`
- add `src/product-compiler/producers/story-plan.ts`
- add producer tests
- modify `src/installer/setup-handoff.ts`
- modify `src/installer/steps/03-stories/preclaim.ts`
- modify setup certificate integration

Requirements:

- path refs come from actual source/tree and stack contracts;
- commands are argv arrays, never shell prose;
- stories partition exact product/design refs once;
- ownership overlap and unresolved dependencies reject sealing;
- setup finalizes topology after actual files exist.

Commit: `feat(compiler): produce topology and story contracts`

### Task B4: Runtime packet orchestration

Files:

- add `src/product-compiler/runtime-packet-compiler.ts`
- add `src/product-compiler/artifact-index.ts`
- add integration tests
- modify `src/installer/steps/05-setup-build/module.ts`
- modify migration v3 for artifact/packet refs

Requirements:

- all child artifacts are stored/indexed;
- compiler seals exactly one packet revision or stores rejection report;
- run packet pointer updates by CAS;
- packet cannot change after first v3 attempt;
- shadow records candidate/rejection without changing workflow decisions.

Commit: `feat(compiler): seal runtime product packets`

### Task B5: ImplementationSlice is sole v3 context

Files:

- add `src/product-compiler/slice-renderer.ts`
- add `src/product-compiler/dependency-signatures.ts`
- modify `src/installer/steps/06-implement/context.ts`
- modify `src/spawner-prompt.ts`
- modify `src/installer/setup-handoff.ts`
- add context parity/integration tests

Requirements:

- slice is compiled against current source before claim;
- file hashes/dependency signatures must match;
- v3 prompt contains exact slice identity and no parallel semantic context;
- prompt is a view and is never parsed back;
- shadow publishes legacy-vs-slice completeness report.

Commit: `feat(implement): consume sealed story slices`

## Release C — Authoritative attempts, findings, recovery, evidence

### Task C1: Atomic attempt transition service

Files:

- add `src/execution/transition-service.ts`
- add `src/execution/attempt-files.ts`
- modify `src/installer/repo.ts`
- modify `src/installer/step-ops.ts`
- modify `src/installer/step-fail.ts`
- modify CLI complete/fail commands
- add real PG barrier/crash/stale-output tests

Requirements:

- story reservation, attempt, generation, step ownership, and claim projection
  commit atomically;
- provisioning failure is fenced and reversible;
- completion requires exact envelope identity;
- stale completion has zero operational mutation;
- attempt files cannot cross-select/cross-delete;
- two runs with `US-002` cannot affect each other.

Commit: `feat(execution): enforce fenced transitions`

### Task C2: FindingSet storage and adapters

Files:

- add `src/findings/schemas/finding-set-v1.ts`
- add `src/findings/repository.ts`
- add `src/findings/github-adapter.ts`
- add `src/findings/gate-adapter.ts`
- add tests and migration v4

Requirements:

- canonical finding identity includes packet/source/invariant;
- stale external findings are superseded;
- GitHub prose never decides source satisfaction;
- unstructured review is explicit and supervisor-owned;
- #1925 poison-token fixture is preserved.

Commit: `feat(findings): store revision-bound findings`

### Task C3: EvidenceBundleV2 planner and aggregator

Files:

- add `src/evidence/schemas/evidence-bundle-v2.ts`
- add `src/evidence/planner.ts`
- add `src/evidence/aggregator.ts`
- modify `src/installer/implement-evidence.ts`
- modify runtime evidence runner
- add #847 and action/persistence tests

Requirements:

- evidence derives from contract predicates;
- required unsupported capability blocks;
- child fail/inconclusive cannot aggregate pass;
- snapshot cannot substitute for interaction/state/persistence;
- every result pins packet/source/runner/environment.

Commit: `feat(evidence): bind verdicts to product contracts`

### Task C4: RecoveryCase and bounded supervisor ownership

Files:

- add `src/recovery/schemas/recovery-case-v1.ts`
- add `src/recovery/repository.ts`
- add `src/recovery/policy.ts`
- modify `src/installer/step-ops.ts`
- modify `src/spawner.ts`
- modify supervisor prompt/output contract
- add recovery state-machine tests

Requirements:

- same tuple cannot dispatch a second implement repair;
- changed source gets evidence-only evaluation;
- no-progress/inconclusive/unstructured transfers ownership once;
- active case prevents deterministic supervisor auto-pass;
- supervisor has one repair and one evidence budget;
- first-delta/must-edit is absent in v3.

Commit: `feat(recovery): enforce bounded recovery ownership`

### Task C5: v3 runtime cutover tests and canary

- run historical replay and fault injection;
- run one explicit v3 canary per currently supported stack;
- verify packet, attempt, finding, recovery, and evidence ledger;
- do not change general default.

Evidence commit: `docs(runtime): record v3 canary evidence`

## Release D — Canonical Setfarm and Mission Control projection

### Task D1: Setfarm RunEvidenceModelV2

Files:

- add `src/server/run-evidence-model-v2.ts`
- add endpoint tests
- modify `src/server/dashboard.ts`
- adapt legacy operational model with explicit label

Requirements:

- projection reads only canonical ledger/artifacts for v3;
- narrative prose cannot alter owner/status/retry/evidence;
- legacy unknowns remain unknown;
- row limits cannot silently hide open blockers.

Commit: `feat(server): expose canonical run evidence`

### Task D2: Mission Control canonical API and UI

Mission Control branch starts only after D1 is frozen.

Files:

- add `server/services/run-evidence-model-v2.ts`
- add `server/services/project-identity.ts`
- add `server/routes/evidence.ts`
- add `src/types/run-evidence-v2.ts`
- add `src/components/RunEvidence/*`
- modify run detail, pipeline, projects, errors, benchmark routes/views

Requirements:

- one canonical endpoint powers run owner/status/blockers/evidence;
- errors are typed findings;
- benchmarks are eval results;
- failed/cancelled/blocked projects remain visible;
- project detail works for materialized Setfarm runs;
- mixed identities produce hard diagnostic/quarantine;
- delete creates tombstone and preserves evidence.

Verification:

```bash
npm run build
curl -fsS http://127.0.0.1:3080/api/health
curl -fsS http://127.0.0.1:3080/api/projects
```

Commits are split server model, API, then UI.

## Release E — Convergence eval and decision

### Task E1: Versioned suite/result schemas

Files:

- add `src/evals/suite-schema.ts`
- add `src/evals/result-schema.ts`
- add `evals/suites/product-convergence-v1.json`
- add tests and migration v5

Cases:

- local-persistence utility;
- multi-entity operations CRUD;
- browser game/canvas.

### Task E2: Clean-run eval runner

Files:

- add `src/evals/convergence-runner.ts`
- add `src/evals/release-gate.ts`
- add `src/evals/report.ts`
- add package scripts/tests

Requirements:

- creates fresh protocol-pinned runs only after capacity/health preflight;
- stores task/expected spec/model/provider/stack/runner/environment hashes;
- monitors DB, claims, observations, GitHub, and HTTP;
- invalidates manual generated-project edits;
- emits append-only eval result;
- stops on three repeats of one root cause.

### Task E3: Six clean runs

Run each class twice on one Setfarm SHA. After every run:

1. verify terminal disposition;
2. verify packet completeness;
3. verify evidence coverage;
4. verify no duplicate tuple/stale ownership;
5. verify Mission Control exact projection;
6. classify any failure at the owning layer;
7. fix only systemic defects and rerun the entire release suite when code SHA
   changes.

### Task E4: General v3 decision and legacy retirement

General default can become v3 only if all six results pass. Legacy classifiers,
second context, first-delta, historical supervisor auto-pass, and prose-derived
Mission Control owner logic are removed only when their replacement invariants
have fixture, canary, and canonical projection evidence.

## Full verification at every stacked PR

Setfarm:

```bash
npm run test:product-compiler
npm run test:execution-attempts
npm run test:steps
npm run test:scripts
npm run eval:contracts
npm test
npm run build
```

The build runs from a clean allowed branch/checkout; runtime guards are not
bypassed.

Static checks:

- no generated project IDs in generic source;
- no secret/token/private payload in fixtures or docs;
- no product compiler import of PR prose classifier;
- no v3 operational decision from shadow result;
- no cross-run update by textual story ID;
- no active claim before restart;
- no leftover isolated test DBs or temp artifact roots.

## Final deliverables

- merged/reviewed Setfarm release train;
- merged/reviewed Mission Control canonical projection;
- migration, shadow, v3 canary, rollback, and six-run evidence documents;
- updated audit decision with exact release SHAs;
- canonical Mission Control views for packet/attempt/finding/recovery/evidence;
- explicit GO/NO-GO for general v3 default.
