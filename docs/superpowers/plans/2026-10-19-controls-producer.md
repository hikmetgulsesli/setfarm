# Controls Setfarm Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root is the sole delivery owner; execute at most one implementation worker per repository at a time and return reviewed diffs to root without staging, committing, pushing, or deploying from a worker.

**Goal:** Supply the guarded Setfarm execution, durable evaluation exclusion, exact cancellation, and nonmutating evidence projection needed by the Controls UI.

**Architecture:** The existing selected release owns the six-check preflight and full8 evaluator. A fixed compiled worker validates its own entry and MC custody, then calls those source functions with a durable journal; a selected reservation and the already shared short DB insertion fence serialize evaluators and workflow starts. A separate source-owned reader validates hash-linked evidence without importing effectful runtime graphs.

**Tech Stack:** TypeScript ESM/Node, Zod, postgres.js, current Setfarm runtime and node:test.

**Spec:** `docs/superpowers/specs/2026-10-19-controls-manual-tests-design.md`; settled source architecture `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/controls-runner-architecture.md` including addendum sections 1–5.

## Global Constraints

- Existing English source/UI language remains binding; Turkish conceptual design labels use clear English product equivalents. Do not change or evade the source-language guard.

- The only job kinds are `activation_preflight`, `convergence_full8`, `ui_regression`; Setfarm executes the first two.
- Actual activation is the existing six unique checks `migration_shape`, `migration_attestation`, `database`, `artifact_capacity`, `activity`, `protocol_activation`. Convergence's eight preflight checks are separate.
- The full8 recipe is the selected release's committed `evals/suites/product-convergence-codex-v1.json`, eight exact case IDs, one repetition, protocol v3, `rootCauseRepeatLimit=3`, `runMs=21600000`, `pollMs=15000`; maximum planned case budget is 48 hours plus collection overhead. Preserve suite task/oracle/gate/provider/material/admission behavior.
- No source/DB/runtime/test guard bypass, shortened budget, broad permission, migration/repair, service kill, secret exposure, or fabricated GO. Root must finish the reviewed recovery-lock fix and serialize edits against the sole source writer before executing this plan.
- Selected worker ingress is standalone `dist/cli/control-test-worker-v1.js`, exact `--job-id <uuid>`, exact canonical self path/argv and inherited private nonce custody. Do not widen the selected CLI form allowlist.
- The existing `contractSpineMigrationLockKey` transaction fence supplies the short admission epoch. Add refusal policy only at the two run insertion functions, not inside `lockInternalProductionWorkflowRunInsertionFenceV1`, because terminal ownership also uses it.
- The public `mission-control.control-job.v1` receipt has only safe IDs/hashes/codes/counts and nullable unknown fields. A completed job does not mean a passing or qualified report.
- GET/read modules never mkdir, spawn, repair, publish, register historical artifacts, or infer latest from directory order. Existing mandatory MC global git probes are a documented separate exception.
- Run focused tests through the source-owned execution-attempt runner. Stock `npm run build` is performed only by root on a new immutable clean release from reviewed/merged `origin/main`, with the writer's eight archives retained; a merely clean feature writer is insufficient. Never set `SETFARM_ALLOW_DIRTY_BUILD=1` or runtime skip flags. DB transaction-order integration uses the existing protected P3 owned isolated-PG harness supplied by root.

## File Map and interfaces

All paths below are relative to `/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`. These are proposed new exports; existing exported signatures named here were checked in source.

| File | Responsibility |
|---|---|
| `src/execution/schemas/manual-control-job-v1.ts` (new) | Strict versioned private intent/custody, public receipt/ref and projection schemas. Exports `ControlJobKindV1`, `ControlReportRefsV1`, `ControlJobReceiptV1`, `ControlPrivateIntentV1`, `ControlWorkerCustodyV1` and their Zod schemas. No raw nonce in receipt. Also exports pure strict `ControlSelectionIdentityV1Schema`, its type and `hashControlSelectionIdentityV1` exactly as the spec Shared selected identity hash section. |
| `src/execution/manual-test-admission-v1.ts` (new) | Selected private reservation file/identity, complete activity census, existing DB fence transaction, exact canary exception and terminal release; the two spec-defined internal custody/direct-intent APIs live in this same mapped module. |
| `src/execution/run-persistence.ts` | Read/recheck reservation only after its existing fence at `persistWorkflowRunInTransaction` and private `persistRecoverySourceBootstrapRunInTransactionV1`; preserve insertion and canary consumption atomicity. |
| `src/execution/manual-test-worker-v1.ts` (new) | Actual preflight/full8 dispatch, durable admission/result/cancellation journal and canonical owned stop; fake effect ports are injectable only in tests. |
| `src/execution/manual-test-worker-channel-v1.ts` (new) | Explicit early inherited-fd3 handshake and uninterrupted private channel/sequence/cancel lifetime; no DB/evaluator/admission import or import-time effects. |
| `src/execution/schemas/manual-control-worker-channel-v1.ts` (new), `tests/execution-attempts/manual-control-worker-channel-v1.test.ts` (new) | Pure strict private frame/journal schema, canonical nonce HMAC helpers and internal fatal-control classifier; exact paired private ABI, no public DTO change. |
| `src/evals/result-schema.ts`, `src/evals/release-gate.ts` | Narrow exact EVAL_CANCEL_REQUESTED blocked-result and CONVERGENCE_CANCEL_REQUESTED/no_go rule, inherited by v2; preserve actual runs and all uncancelled validation. |
| `src/cli/control-test-worker-v1.ts` (new) | Fixed compiled self/argv/custody gate, selected entry and cleanup, then dispatch. |
| `src/evals/convergence-runner.ts` | Optional job control around existing `runConvergenceSuite`; direct evaluator CLI enrolls in same reservation. Existing default ports/store/gate/promotion remain authoritative. |
| `src/execution/activation-preflight.ts`, `src/execution/schemas/activation-preflight-report-v1.ts` (new) | Add only safe cooperative observation boundaries if needed; extract existing report schema into a pure module for read-only import without publisher/runtime graph. Keep `runDefaultActivationPreflight({protocol:'v3',compilerReleaseSha})` and publication semantics. |
| `src/evals/control-evidence-admission-reader-v1.ts` (new) | Private composed FS validation plus fixed read-only release_go query using MC captured selected SQL owner; no DB initializer/runtime graph or public DTO change. |
| `src/evals/control-evidence-reader-v1.ts` (new) | Selected nonmutating O_NOFOLLOW hash-linked reader, using source-owned schema and pure gate validator. |
| `tests/execution-attempts/manual-test-admission-v1.test.ts`, `manual-test-admission-v1.isolated-pg.test.ts`, `manual-test-worker-v1.test.ts`; `tests/installation/fresh-installation-control-worker-entry.test.ts`; `tests/evals/control-evidence-reader-v1.test.ts` (new) | Focused production-boundary regressions. Reuse actual `tests/execution-attempts/helpers/compiler-story-admission-fixture.ts` for `persistWorkflowRunInTransaction`, and extend `run-protocol.test.ts`, `run-terminal-transition.test.ts`, `run-termination.test.ts`, `tests/evals/convergence-eval.test.ts` and `convergence-runner-v2.test.ts` for changed seams. |
| `scripts/run-execution-attempt-tests.ts` | Register `manual-test-admission-v1.isolated-pg.test.ts` in `OWNER_BACKED_TESTS`; preserve current raw/owned P3 routing and ambient `SETFARM_PG_URL` removal. |

The cross-repository contract is fixed before implementation:

```ts
export type ControlJobKindV1 = 'activation_preflight' | 'convergence_full8' | 'ui_regression';
export type ControlReportRefsV1 = Readonly<{
  activationHash?: string; resultHash?: string; gateHash?: string; uiReportHash?: string;
}>;
export type ControlJobReceiptV1 = Readonly<{
  schema: 'mission-control.control-job.v1'; jobId: string; kind: ControlJobKindV1;
  revision: number; selectionHash: string; sourceSha: string;
  mcSourceSha: string; mcBuildHash: string; suiteHash: string | null;
  state: 'accepted' | 'starting' | 'running' | 'cancelling' | 'completed'
    | 'failed' | 'blocked' | 'cancelled' | 'ownership_unknown';
  requestedAt: string; startedAt: string | null; updatedAt: string;
  finishedAt: string | null; phase: string; code: string | null;
  currentCaseId: string | null; ownedRunId: string | null;
  completedCases: number; plannedCases: number; reportRefs: ControlReportRefsV1;
  cancelRequested: boolean;
}>;
export type ControlPrivateIntentV1 = Readonly<{
  schema: 'mission-control.control-intent.v1'; receipt: ControlJobReceiptV1;
  installationDir: string; releaseDir: string; nonceDigest: string;
  fixedSuiteRelativePath: 'evals/suites/product-convergence-codex-v1.json' | null;
}>;
export type ControlWorkerCustodyV1 = Readonly<{
  schema: 'mission-control.control-custody.v1'; jobId: string;
  selectionHash: string; sourceSha: string; mcBuildHash: string; nonce: string;
}>;
export type ControlEvidenceExpectedV1 = Readonly<{
  selectionHash: string; sourceSha: string; releaseSha: string;
  suiteHash: string | null; refs: ControlReportRefsV1;
}>;
export type ControlEvidenceAvailabilityV1 = Readonly<{
  state: 'available' | 'unconfigured' | 'missing' | 'invalid' | 'unsafe';
  code: string | null;
}>;
export type ControlEvidenceProjectionV1 = Readonly<{
  activation: { availability: ControlEvidenceAvailabilityV1;
    report: null | { hash: string; status: 'pass' | 'fail'; protocol: 'shadow' | 'v3';
      compatibility: 'current' | 'historical'; observedAt: string | null;
      checks: readonly { id: string; status: 'pass' | 'fail' | 'advisory';
        blocking: boolean; code: string }[] } };
  evaluation: { availability: ControlEvidenceAvailabilityV1;
    report: null | { resultHash: string; gateHash: string | null;
      compatibility: 'current' | 'historical';
      executionMode: 'preflight' | 'execute';
      resultStatus: 'planned' | 'pass' | 'fail' | 'blocked';
      gateDecision: 'go' | 'no_go' | null;
      qualification: 'qualified' | 'unqualified' | 'historical';
      preflightChecks: readonly { id: string; status: 'pass' | 'fail'; code: string }[];
      cases: readonly { caseId: string; repetition: 1;
        evidenceState: 'not_started' | 'recorded';
        disposition: 'completed' | 'failed' | 'cancelled' | 'timeout' | 'invalidated' | null;
        passed: boolean | null; runId: string | null; resultHash: string | null }[];
      completedCases: number; plannedCases: 8; blockerCodes: readonly string[] } };
}>;
export function readSelectedControlEvidenceV1(input: ControlEvidenceExpectedV1): Promise<ControlEvidenceProjectionV1>;
```

MC imports this schema/reader from a **fixed trusted compiled selected module**. These type names and property names are shared by the MC plan; actual Zod parsing is source-owned here. The receipt's `sourceSha` is the selected SF source SHA; `mcBuildHash` is loaded MC dist identity, never current checkout HEAD. `uiReportHash` is produced/read by MC, while Setfarm ignores it.

### Task 1: Exclusive evaluator reservation and insertion gate

**Files:** Create `src/execution/manual-test-admission-v1.ts` and `src/execution/schemas/manual-control-job-v1.ts`; modify `src/execution/run-persistence.ts`, `scripts/run-execution-attempt-tests.ts`; test `tests/execution-attempts/manual-test-admission-v1.test.ts`, `manual-test-admission-v1.isolated-pg.test.ts`, `run-protocol.test.ts`, `run-terminal-transition.test.ts`, `run-termination.test.ts`.

**Interfaces:** Consume existing `lockInternalProductionWorkflowRunInsertionFenceV1(sql)` and `pgBegin` semantics. Produce `acquireSelectedManualEvaluationV1(input: {jobId:string; kind:'activation_preflight' | 'convergence_full8'; selectionHash:string; sourceSha:string; suiteHash:string | null}): Promise<ManualEvaluationReservationV1>`, `bindSelectedManualCanaryV1(input: {reservation:ManualEvaluationReservationV1; admissionHash:string; slots:readonly BoundCanarySlotV1[]}): Promise<ManualEvaluationReservationV1>`, `observeSelectedManualEvaluationInTransactionV1(sql: PgTransactionSql): Promise<ManualEvaluationReservationV1 | null>`, `observeSelectedEvaluatorOwnersV1(): Promise<'none' | 'owned' | 'unknown'>`, `assertSelectedManualRunInsertionV1(sql, reservation, run): Promise<void>`, `assertNoSelectedManualRecoveryInsertionV1(sql): Promise<void>`, and `releaseSelectedManualEvaluationV1(reservation): Promise<void>`. Activation requires `suiteHash:null`; full8 requires the selected committed suite hash; UI regression never invokes this SF API. `BoundCanarySlotV1` has `caseHash`, `taskHash`, `slotHash`, `repetition`, `admissionHash`; no public selector token. `observeSelectedEvaluatorOwnersV1` uses exact selected executable/process-start identity and durable reservations, never substring process absence. `release` requires canonical terminal plus zero complete owner census, not mere process exit.

```ts
export type ManualEvaluationReservationV1 = Readonly<{
  jobId:string; kind:'activation_preflight' | 'convergence_full8';
  selectionHash:string; sourceSha:string; suiteHash:string | null;
  revision:number; phase:'pending' | 'active' | 'cancelling' | 'ownership_unknown' | 'released';
}>;
export type BoundCanarySlotV1 = Readonly<{
  admissionHash:string; slotHash:string; caseHash:string;
  taskHash:string; repetition:number;
}>;
```

- [ ] **Step 1: Write RED tests** around the *actual* `persistWorkflowRunInTransaction(sql: PgTransactionSql,input: PersistWorkflowRunInputV1)` export and the private recovery insertion function; preserve a separate real public `persistInternalProductionRecoverySourceBootstrapRunV1(input:{operationRef:string;operationHash:string})` authority-refusal test. Register `manual-test-admission-v1.isolated-pg.test.ts` in `OWNER_BACKED_TESTS` in this same step, before running RED. Use `tests/execution-attempts/helpers/compiler-story-admission-fixture.ts` to create the real selected run fixture. Put the following assertion in the owner-backed isolated-PG test; keep temp-file/schema-only cases in the raw test:

```ts
const held = await acquireSelectedManualEvaluationV1({
  jobId, kind:'convergence_full8', selectionHash, sourceSha, suiteHash,
});
await assert.rejects(
  () => persistWorkflowRunInTransaction(sql, ordinaryRunInput),
  /MANUAL_EVALUATION_RESERVED/,
);
// Component-only: execute the complete actual private insertion function
// with the real shared DB fence and an unusable downstream authority port.
// Separately assert the public wrapper retains its actual authority refusal.
await assert.rejects(
  () => executeActualPrivateRecoveryInsertionComponent(sql, held),
  /MANUAL_EVALUATION_RESERVED/,
);
assert.equal(await readReservationFile(), held.revision);
```

Add table cases for every known activity family (running/resuming/cancelling/failing runs; claims; attempts/binding conflicts; runtimes/completions; recovery cases/deliveries; termination; evaluator/other build/publication owner); missing/noninteger/negative data refuses. Two concurrent acquisition promises yield exactly one owner. A pending fsynced reservation after simulated transaction rollback remains blocking/unknown. A direct canary with exact stored admission/suite/slot/case/task/repetition and unconsumed claim is accepted; foreign/expired/consumed selector or raw matching `slotHash` is denied. Assert terminal transition still enters the shared fence under reservation.

Root fixture ruling: the existing P3 harness explicitly rejects global fresh selection. A **module-local test-only substitution of immutable selected locator/path/identity observations** may point the actual reservation module to an owned temp `runtime/evals`; retain the real P3 SQL/pgBegin/shared fence and actual normal persistence/canary repository. This is selected-filesystem plus real-DB component evidence, never actual fresh activation/public admission. Do not change P3 authority helpers or install new roles. The mandated compiler fixture creates running claims: use its canonical owned drain APIs or a separate pristine owned database before successful acquisition, never hide activity by weakening the census. There is no existing admitted recovery-operation fixture. For recovery, keep the real public wrapper authority-refusal test and execute the complete AST-extracted private insertion function as a component with real shared DB fence and an intentionally unusable downstream authority port; assert reservation refusal occurs before downstream authority access or business SQL. Do not fabricate a valid recovery operation/admission or claim a successful public recovery start. An actual activated public recovery journey remains a later operational gate.

- [ ] **Step 2: Run focused tests to observe RED.** `node --import tsx scripts/run-execution-attempt-tests.ts manual-test-admission-v1.test.ts manual-test-admission-v1.isolated-pg.test.ts` must fail for missing exports/absent refusal. The owner-backed test uses the existing P3 harness and root-provided protected PG input; no live PG URL is used.
Root owner/CAS rulings: ready persistent dashboard/spawner custody is not evaluator work; validate its actual custody separately without treating mere service presence as a job. SQL activity families use real schema/canonical terminal relations; evaluator/build filesystem owners use bounded read-only observations, never invented SQL aliases or missing-to-zero. Exact evaluator custody uses `observed_os` with exact process start/group equality, not the legacy tolerance. `bindSelectedManualCanaryV1` returns the refreshed reservation after CAS; Task2 must carry that new revision into later bind/release (or explicitly read and validate the exact current held record), never silently accept stale revisions. During first acquire, exclude only the independently proven current fixed selected control entry plus matching durable private intent/custody; direct evaluator enrollment must establish its own source-owned durable intent first. Thereafter self-exclusion requires the same exact process, job/selection/custody and held revision. All other evaluator/build/publication/child/work owners remain blocking; pending/unknown never releases. Public owner observation still reports owned while an unfinished reservation exists. No caller-provided boolean proves ownership. If an internal custody registration API is needed inside the mapped module, propose its exact source-owned signature/verification before implementation; do not widen public request inputs or CLI forms.


Root insertion-first fixture ruling: use two separately immutable module-local observation snapshots: a pre-worker observation for actual normal insertion, then an independently instantiated enrolled-worker observation after the insertion holds the actual shared fence. Synchronize using real transaction/fence progress, not a sleep alone. Keep actual DB/persistence and common durable reservation filesystem; no mutable identity observation, production boolean or fake admission. This is selected-filesystem/real-DB component ordering evidence only, not actual OS startup/public compiled-entry admission.

- [ ] **Step 3: Implement the narrow gate.** Create the selected reservation under the fixed selected `runtime/evals` child with 0700 parent/0600 file, exclusive/fsynced publication, revision/CAS and pinned inode/owner/mode. Enter the existing DB fence in short selected transactions on acquire/bind/release; publish pending before any effect and keep pending/unknown on rollback or lost connection. At normal insertion, observe immediately after the existing fence, before owner creation; recheck just before `INSERT` after `lockAndVerifyReleaseAdmission` validates the DB claim. At recovery insertion, observe immediately after its existing fence and deny active reservations. Do not change the fence helper, `db-pg.ts`, the normal canary `UPDATE`, or privileged recovery authority. Use an exact selected process/owner inventory; an unregistered or unreadable evaluator is unknown and refuses.
- [ ] **Step 4: Run GREEN focused tests** with `node --import tsx scripts/run-execution-attempt-tests.ts manual-test-admission-v1.test.ts manual-test-admission-v1.isolated-pg.test.ts run-protocol.test.ts run-terminal-transition.test.ts run-termination.test.ts`. Add `manual-test-admission-v1.isolated-pg.test.ts` to `OWNER_BACKED_TESTS` so the existing runner invokes `scripts/run-isolated-postgres-tests.ts` with its protected P3 capability and removes ambient `SETFARM_PG_URL`; do not invent a new data-directory or admin-role prerequisite. Root supplies the harness's existing protected input. Record two real transaction orderings: reservation-first denies ordinary insertion; insertion-first completes before reservation readiness check and causes evaluator refusal.
- [ ] **Step 5: Reviewer gate.** Review exact two `INSERT INTO runs` sites and confirm terminal settlement remains able to take the common fence. Return diff and test output to root; root handles commits/delivery.

### Task 2: Fixed worker, real six-check/full8, durable progress and exact cancel

**Files:** Create `src/execution/manual-test-worker-v1.ts`, `src/execution/manual-test-worker-channel-v1.ts`, `src/execution/schemas/manual-control-worker-channel-v1.ts`, `src/cli/control-test-worker-v1.ts`; modify only `processOwnerV1` executable observation in `src/execution/manual-test-admission-v1.ts` for the actual macOS truncation root fix; modify `src/evals/convergence-runner.ts`, `src/evals/result-schema.ts`, `src/evals/release-gate.ts`; test `tests/execution-attempts/manual-test-worker-v1.test.ts`, `manual-control-worker-channel-v1.test.ts`, new `tests/execution-attempts/manual-control-owner-observation-v1.test.ts` actual owned-child regression, `tests/installation/fresh-installation-control-worker-entry.test.ts`, `tests/evals/convergence-eval.test.ts`, `convergence-runner-v2.test.ts`. Activation cancellation uses invocation/return boundaries; no activation source edit is needed solely for cancellation.

**Interfaces:** Consume Task 1 reservation exports and `ControlPrivateIntentV1`, `ControlWorkerCustodyV1`. Keep existing `runConvergenceSuite(loaded, {releaseSha,execute}, ports): Promise<ConvergenceSuiteRun>` and `createDefaultConvergencePorts(outputRoot): Promise<ConvergenceRunnerPorts>`; extend the former's options with `control?: ConvergenceJobControlV1` only. Proposed control port:

```ts
export type BoundCaseIdentityV1 = Readonly<{
  caseId: string; caseHash: string; taskHash: string; repetition: number;
}>;
export interface ConvergenceJobControlV1 {
  beforeCase(value: BoundCaseIdentityV1): Promise<void>;
  onRunStarted(value: BoundCaseIdentityV1 & {admissionHash:string; slotHash:string; runId:string}): Promise<void>;
  onRunResult(value: BoundCaseIdentityV1 & {runId:string; resultHash:string}): Promise<void>;
  cancellationRequested(): Promise<boolean>;
  requestOwnedRunStop(value: BoundCaseIdentityV1 & {runId:string}): Promise<'requested' | 'already_terminal' | 'refused'>;
  onPhase(value:{phase:'preflight'|'admission'|'case_start'|'case_running'|'case_collect'|'publishing'|'finalizing'|'settling'; currentCaseId:string|null; completedCases:number}): Promise<void>;
  onPublication(value:{stage:'candidate'|'cancelled_final'|'promotion_confirmed'|'final_without_promotion'; resultHash:string; gateHash:string; resultStatus:'planned'|'pass'|'fail'|'blocked'; gateDecision:'go'|'no_go'}): Promise<void>;
  beforeFinalization(value:{resultHash:string; gateHash:string; gateDecision:'go'|'no_go'}): Promise<'cancel'|'continue'>;
}
export type ManualControlEffectPortsV1 = Readonly<{
  runPreflight: typeof runDefaultActivationPreflight;
  loadSuite: typeof loadConvergenceSuiteVersioned;
  createConvergencePorts: typeof createDefaultConvergencePorts;
  stopOwnedRun: (runId:string, expectedSnapshotHash:string) => Promise<void>;
}>;
export function runSelectedManualControlJobV1(
  intent: ControlPrivateIntentV1, custody: ControlWorkerCustodyV1,
  ports?: ManualControlEffectPortsV1,
): Promise<ControlJobReceiptV1>;
```

Root internal direct-entry refinement: export `runSelectedDirectConvergenceV1(loaded,{releaseSha,execute},ports):Promise<ConvergenceSuiteRun>` from the mapped worker for a dynamic import by selected runner main only. It reuses the same journal/full-slot bind/exact claim start resolver and owns zero-argument direct intent/acquisition before artifacts, latest reservation revision, settlement/release/closure while SQL remains open. It adds no caller authority, CLI flag or public API; unselected behavior and generic runner/default port signatures stay unchanged.

The optional `ports` overload is test-only; the compiled CLI entry calls the two-argument production path. Worker frame sequence, SF journal revision and MC public receipt revision are independent counters linked by a durable broker mapping; only MC writes receipts and ACKs after definite publication. The worker must send progress through the authenticated original-child channel and persist its own bound admission/run identity before each effect. Follow the paired spec private protocol; remove onAdmission because the actual createCanary wrapper owns one full-slot bind and retains the refreshed reservation. No selected runtime path comes from HTTP.

- [ ] **Step 1: Write RED production-path tests** using existing convergence fake SQL/HTTP/process/artifact/admission ports. Use the real committed suite loader and actual runner:

```ts
const loaded = await loadConvergenceSuiteVersioned(
  new URL('../../evals/suites/product-convergence-codex-v1.json', import.meta.url).pathname,
);
assert.deepEqual(loaded.suite.cases.map(c => c.caseId), [
  'utility-status-baseline','utility-preference-compositional',
  'operations-work-baseline','operations-queue-paraphrase',
  'game-start-baseline','game-restart-compositional',
  'negative-ambiguous-product','negative-unsupported-kernel',
]);
assert.equal(loaded.suite.repetitionsPerCase, 1);
assert.equal(loaded.suite.protocol, 'v3');
assert.equal(loaded.suite.rootCauseRepeatLimit, 3);
assert.deepEqual(loaded.suite.timeout, {runMs:21600000,pollMs:15000});
const completed = await runConvergenceSuite(loaded, {releaseSha,execute:true,control}, fakePorts);
assert.equal(completed.result.schema, 'setfarm.product-convergence-result.v1');
```

Instrument fake ports so preflight, canary admission, exact run binding, run result, gate and promotion are observed in order. Test cancel before first case, between cases, during exact run, after cases/before promotion, after durable promotion; denied/stale snapshot, terminal row with live owners, lost start output resolved only from consumed claim `run_id`, no retry, foreign run/PID/nonce, and unknown ownership. Preflight calls `runDefaultActivationPreflight` exactly once and retains fail report hash and six codes. Test direct evaluator CLI also enters the Task 1 reservation. Run exact worker-entry negative child tests with counters: source `.ts`, extra argv, wrong self path/symlink, missing/foreign selection, missing/wrong custody or nonce, changed intent inode/content, and direct shell entry must refuse before DB/eval/publication effects.
- [ ] **Step 2: Run RED:** `node --import tsx scripts/run-execution-attempt-tests.ts manual-test-worker-v1.test.ts` and `node --import tsx --test tests/installation/fresh-installation-control-worker-entry.test.ts tests/evals/convergence-runner-v2.test.ts` must show absent progress/cancel and ingress gate behavior.
- [ ] **Step 3: Implement minimal production orchestration.** CLI first checks canonical selected compiled own `import.meta.url`, exact `process.argv` form, no `execArgv`/loader injection, inherited IPC nonce and private intent identity/mode/inode; then calls `prepareFreshInstallationOperationalEntryV1` and `assertFreshInstallationOperationalEntryV1`, rechecking selection before effects. Use exact selected `paths.evals`, the existing `runDefaultActivationPreflight({protocol:'v3',compilerReleaseSha})`, and `createDefaultConvergencePorts(selected.paths.evals)` plus `runConvergenceSuite`. Enroll selected direct planning and execute CLI in the same reservation before any artifact preparation; unselected direct CLI behavior is unchanged. Journal admission before `startRun`, bind exact DB canary claim `run_id` when CLI output is lost, and never choose latest run or retry a lost start. On cancel, fetch fresh canonical snapshot and call existing `executeRunOperationalAction` with `action:'stop'`, exact bound run ID and `expectedSnapshotHash`; wait for canonical terminal **and** all owner families to settle before release. Leave refusal as `cancelling`/`ownership_unknown` with reservation intact. Observe cancel before `promoteReleaseGo`. Preserve partial evidence using existing result semantics and blocker `EVAL_CANCEL_REQUESTED`.
- [ ] **Step 4: Run GREEN** focused tests through `scripts/run-execution-attempt-tests.ts` for the execution-attempt files and direct node:test for evaluator/fresh-entry files. Root builds only a new immutable clean release from reviewed/merged `origin/main`, preserving the writer's eight archives, then inspects compiled worker topology and exact selected build identity. No live provider, DB or service action in this task.
- [ ] **Step 5: Reviewer gate.** Confirm no changed suite JSON, shortened timing, extra CLI form, generic runner, shared service kill, or unbounded output buffer; return diff/evidence to root.

### Task 3: Source-owned nonmutating hash-linked reader

**Files:** Create `src/evals/control-evidence-reader-v1.ts`, `src/evals/control-evidence-admission-reader-v1.ts` and pure `src/execution/schemas/activation-preflight-report-v1.ts`; move existing report Zod export/import from `src/execution/activation-preflight.ts` without changing runtime behavior; test `tests/evals/control-evidence-reader-v1.test.ts`, `tests/evals/control-evidence-admission-reader-v1.test.ts`, new `tests/execution-attempts/control-evidence-admission-reader-v1.isolated-pg.test.ts`; register only this new integration in mapped `scripts/run-execution-attempt-tests.ts` OWNER_BACKED_TESTS. Root runs protected P3.

**Interfaces:** Produce `readSelectedControlEvidenceV1(input: ControlEvidenceExpectedV1): Promise<ControlEvidenceProjectionV1>` exactly as in the File Map. Also export private `readSelectedControlEvidenceWithAdmissionV1(input:ControlEvidenceExpectedV1,sql:postgres.Sql):Promise<ControlEvidenceProjectionV1>` from the new admission reader, with postgres imported type-only. Follow paired spec Accepted two-level evidence qualification: FS-only current GO stays unqualified; only actual exact committed admission read can qualify. MC owns captured SQL, no HTTP/new database client/initializer. The function derives selected artifact and eval roots from the captured selected release. MC calls it from a fixed trusted compiled import; it never accepts a physical root/path from HTTP.

- [ ] **Step 1: Write RED temp-tree tests** with genuine source schema serialization and canonical hashes. Core checks:

```ts
const before = await snapshotTree(tempSelectedRoot);
const projected = await readSelectedControlEvidenceV1({
  selectionHash, sourceSha, releaseSha, suiteHash,
  refs: {activationHash, resultHash, gateHash},
});
assert.equal(projected.activation.availability.state, 'available');
assert.equal(projected.activation.report?.checks.length, 6);
assert.equal(projected.evaluation.report?.gateHash, gateHash);
assert.deepEqual(projected.evaluation.report?.cases.map(c => c.caseId),
  loaded.suite.cases.map(c => c.caseId));
assert.equal(projected.evaluation.report?.cases.filter(c => c.evidenceState === 'recorded').length,
  storedResult.runs.length);
assert.deepEqual(await snapshotTree(tempSelectedRoot), before);
```

Add wrong/missing gate, planned/partial/no-go, copied canonical hash on mutated bytes, duplicate activation ID, wrong release/suite/source, cross-linked gate, symlink parent/leaf, hardlink, nonregular file, oversized eval >16 MiB, ancestor swap during read and missing root. Assert `availability.state` and safe `code` distinguish `unconfigured`, `missing`, `invalid`, and `unsafe`; do not collapse them into null. For a valid partial report, assert all eight **catalog** case IDs appear in fixed suite order, only actual stored runs have `evidenceState:'recorded'`, and unstarted cases have null disposition/pass/run/hash. Planned `executionMode:'preflight'` is visible and cannot qualify. All eight actual convergence preflight check rows remain separate from activation's six. Spy on `mkdir`, spawn, publisher/store/evaluator constructors and assert zero calls from reader. Projection never includes task, oracle text, environment, selectors, private paths or raw log. No latest scan. Activation time is null unless a receipt publication observation supplies it; any file mtime is separately labelled filesystem time.
- [ ] **Step 2: Run RED:** `node --import tsx --test tests/evals/control-evidence-reader-v1.test.ts` fails for absent reader.
- [ ] **Step 3: Implement bounded O_RDONLY|O_NOFOLLOW opening**, parent/dev/ino/owner/mode/link/size pins before and after, fixed eval `sha256/<first-two>/<hash>.json` and activation envelope `<artifact-root>/<hash>.json` layouts, source-owned Zod/canonical hash/link checks and pure `evaluateConvergenceReleaseGate` consistency. Six activation IDs must be exactly unique. Keep schema imports pure; never instantiate `ContentAddressedEvalResultStore` on GET because its get path can mkdir. Build the eight catalog case rows from the pinned selected suite, match each actual stored `runs` row by exact case/repetition/hash identity, and mark absent rows `not_started` with null evidence fields; never manufacture pass rows. Return the exact eight convergence preflight checks, source executionMode/resultStatus, and explicit availability/reason codes. `qualified` requires compatible execute result plus linked stored GO gate/admission; completed count alone cannot qualify.
- [ ] **Step 4: Run GREEN** focused reader tests and import-graph check showing no publisher/evaluator runtime import. Root reviews the two plans together for schema/DTO consistency and coordinates the MC consumer after this export exists.

Root separately owns review, clean builds, staged delivery, guarded rollout, and real selected preflight/full8 evidence after source fixes. Passing fake-effect or UI fixture tests alone is never a workflow GO claim.

## Custody closure interface ruling

Consume the paired spec Private SF custody closure section: Task1 additionally produces zero-argument `closeSelectedManualWorkerCustodyV1(): Promise<void>`, common fixed closures/<jobId>.json with explicit commandHash, irreversible never-reserved/acquired lifecycle and cumulative all-slot actual canonical-owner release proof. Existing mapped admission module/tests only; no public DTO/authority/FileMap widening. Task2 must release then close before authenticated terminal acknowledgement; certain pre-publication refusal may close its own intent despite unrelated owners, which stay blocking. MC UUID job-dir/required intent namespace is strict; other broker siblings opaque/no-follow, never terminal authority. Add meaningful RED/GREEN lifecycle/closure/busy/refusal/history/owner-status tests before claiming Task1 complete. Original intermediate4412179e P3 capture3/9 is retained, not final proof.

Root recovery-ordering ruling after actual PG failure: private recovery insertion first takes existing generic shared fence, then manual reservation refusal, then unchanged privileged recovery wrapper (which reentrantly takes the same transaction fence). Root verified wrapper already uses the same ordinary DB guard/fence. Preserve all privileged input/authority checks and generic helper unchanged. Component binds actual generic fence plus an unusable privileged wrapper, asserting it is never entered under reservation; separate public authority refusal remains. This fixes observe-after-authority ordering in the actual mapped insertion path, with no db-pg or privilege widening.

Root P3 binding ruling after source-based independent diagnosis: five first-capture failures used a query-suffixed clone for writes and unsuffixed outer-primary pool for reads. Configure the unsuffixed actual module with existing pgConfigureIsolatedTestDatabase(database.url) before initialization, assert both actual current_database identities and .js/.ts getSql identity, then close that owned runtime client before clone drop. No helper/profile/runtime-config/db-pg/compiler fixture or role change. Insertion-first must observe actual acquirer backend blocked by the insertion backend before release, with bounded readonly wait observation and owned cleanup. Earlier failing results remain retained; positive SQL/canonical assertions must execute under the corrected topology before success is claimed.

## Accepted private worker protocol refinement

The paired spec private worker channel/journal and cancellation sections supersede earlier ambiguous revision/handshake/publication wording. New file map entries are causally required for uninterrupted pre-DB custody and truthful late-cancellation evidence. Task1 source review and actual focused gates precede Task2 implementation. Read the private protocol as binding, including provisional reportRefs until canonical release/closure, fatal ownership/journal errors escaping settle, no restart adoption, exact consumed-claim start recovery and immediate finalization boundary before promotion. All original suite/budget/oracle/material/role/guard constraints remain. Root records exact private exports before cross-repo implementation.

Root Task3 verification refinement: pure nonmutating reader/adapter tests plus actual production-promotion/read-only integration through new registered P3 test, Root captured. Read task-3-reader-census.md and task-3-qualification-resolution.md before implementation; recheck Task2 frozen runner/schema/gate final semantics. No synthetic positive admission row or journal/receipt upgrade shortcut; proof of artifact qualification does not settle unknown worker ownership.

Root actual OS refinement: before changing existing Task1 observer, preserve old long-path real-child refusal RED; implement exact paired stable metadata/args→comm-only→same metadata/args in Task1 helper and early channel. Only processOwnerV1 observation parsing changes, no custody/census/closure/DB/role authority changes. New raw actual-child test is automatically discovered; Root alone reruns affected15RAW/17ownedPG plus focused new observer and final Task2 covering tests, then reviews the root fix. Old70adjacent pass remains historical at673b9872, not new-source credit.
