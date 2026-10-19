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

**Files:** Create `src/execution/manual-test-worker-v1.ts`, `src/execution/manual-test-worker-channel-v1.ts`, `src/execution/schemas/manual-control-worker-channel-v1.ts`, `src/cli/control-test-worker-v1.ts`; modify only `processOwnerV1` executable observation in `src/execution/manual-test-admission-v1.ts` for the actual macOS truncation root fix; modify `src/evals/convergence-runner.ts`, `src/evals/result-schema.ts`, `src/evals/release-gate.ts`; test `tests/execution-attempts/manual-test-worker-v1.test.ts`, `manual-control-worker-channel-v1.test.ts`, new `tests/execution-attempts/manual-control-owner-observation-v1.test.ts` actual owned-child regression, `tests/installation/fresh-installation-control-worker-entry.test.ts`, `tests/installation/control-worker-compiled-negative-support.ts`, `tests/evals/convergence-eval.test.ts`, `convergence-runner-v2.test.ts`. Activation cancellation uses invocation/return boundaries; no activation source edit is needed solely for cancellation.

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

**Files:** Create `src/evals/control-evidence-reader-v1.ts`, `src/evals/control-evidence-admission-reader-v1.ts` and pure `src/execution/schemas/activation-preflight-report-v1.ts`; move existing report Zod export/import from `src/execution/activation-preflight.ts` without changing runtime behavior; test `tests/evals/control-evidence-reader-v1.test.ts`, `tests/evals/control-evidence-admission-reader-v1.test.ts`, new `tests/execution-attempts/control-evidence-admission-reader-v1.isolated-pg.test.ts`; register only this new integration in mapped `scripts/run-execution-attempt-tests.ts` OWNER_BACKED_TESTS. Shared fixture helper `tests/evals/control-evidence-fixture-v1.ts` (new) supplies schema-valid filesystem serialization and immutable selected-observation seams without registering tests as import effects. Root runs protected P3.

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

## Root Source acceptance and compiled-test Map boundary

Task2 Source/component review is accepted through `5cdb92c35e7b4d77c028a8eb541967bb832fc568`: I1–I5 addressed, 105 raw/component plus46 evaluator/entry passes, exact protectedPGpromotion test excluded. Source helper `tests/installation/control-worker-compiled-negative-support.ts` was explicitly approved before creation and is now in the tracked FileMap. Its17 actual-child case definitions remain NOT RUN and unqualified; require Root clean reviewed immutable compiled release, two real isolated acknowledged selections, private measured context and independent observation coverage. No table/noop/skip or fixture authority substitutes. Current Task1 admission helper/pure ABI unchanged; prior actualPG17 remains its own evidence. Stock build, actual production broker/child, activation/full8/promotion/runtime gates remain open. Source acceptance permits the reader implementation, never a deployment/GO claim.

Task3 keeps frozen public schema/input and pure filesystem export. FS-only current execute/pass/linkedGO is available but unqualified with CONTROL_RELEASE_ADMISSION_UNOBSERVED. Additional private admission reader owns source FSvalidation plus fixed repeatable-read/read-only two-argument rawSQL transaction, exactLIMIT2 release-wide cardinality beforehashfilter, pure schema/hash/scalar/ref linkage and after-await identity recheck. Only actual committed admission observed from captured selected owner qualifies; no SQL cache/client/init/repository/store.get/publisher/worker import, no new privileges. New protectedPG positive must invoke actual productionpromotion under valid stored prerequisites, not handwrite an authority row. Author the mapped P3 test and registry only; Root executes it with protected private capability. Component temp-tree/SQL fixtures and actual selected/runtime qualification remain separate.


Root Task3 internal snapshot refinement: `readSelectedControlEvidenceSnapshotV1(input)` is a Source-internal export in the existing reader file returning the public projection, minimal validated GO-candidate metadata (including `preflightHash` and result `finishedAt`), and `assertUnchanged():void`. The admission adapter obtains a fresh snapshot itself, compares actual admission `preflightHash`/`issuedAt`, and rechecks selected identity and pinned files after transaction completion. No caller-supplied candidate/projection authority, WeakMap cache, public DTO change, raw task/oracle/private-path exposure, extra MC export, database initializer or runtime import is permitted. The ninth mapped test helper above shares only FS facts; real protected PG still uses actual SQL/production promotion. Root approved these exact refinements before their implementation.


## Root Task3 Source acceptance

Task3 Source accepted through `96f8fb0aa92fb726035bf35543fad7ec4d8b9a38`: independent scoped review approved after lost-return assertion repair. Root verified nine Source files and114 original command artifacts,62 component and10 activation regression passes, Source/unit noEmit, emitted static graph34modules/88edges with no operational imports, English/path/diff checks. Actual protectedP3v2 passed7assertions in53.175s with unchanged Source/HEAD and all owned clone/primary/template databases dropped. Lost-return observation now uses one real promotion transaction and no retry, exact injected post-commit error, strict committed row/hash/tuple, then independent reader. ExistingDEP0205 remains unsuppressed/deferred; integration-inclusive typecheck retains8 byte-identical baseline helper diagnostics, no pass claimed.

All three producer tasks have Source acceptance. This permits final whole-branch Source review and ordinary reviewed PR delivery under standing authority. New reviewed merged clean immutable stock build, actual17 compiled-child cases with real prepared context/observations, selected MC/SF original-channel composition, activation/preflight, unchanged provider full8/promotion and guarded rollout/live health remain separate mandatory Root gates. No fixture/Source test, recorded GO file or isolated test admission is production workflow GO.


## Root final whole-Source review integration fix boundary

Final review of18ea6bb3..cc853749 is C0/I3/M1 and does not approve Source delivery. Individually accepted task tests do not prove real process composition. The necessary root fixes remain the same selected manual-evaluation objective: (I1) exclude only the original owned observation process after definite exit and strict captured PID/parent/command/group facts; (I2) permit only the one exact original admitted default CLI start child through insertion, bound to current custody/revision/durable start intent/stored one-use canary/slot/case/task/repetition/selection and actual canonical executable/argv/parent identity; (I3) preserve read-only canonical drain observation after cancellation before one release/close. All foreign children, malformed evidence, unknown identity, uncertain mutation and stale custody still refuse. No broad descendant exemption, canary-looking-env shortcut, terminal-status settlement, uncertain release retry, repeated stop/start/promotion or weakened material/runtime guards.

Exact initially mapped existing Source/test paths for this one final fix dispatch: src/execution/manual-test-admission-v1.ts; src/execution/manual-test-worker-v1.ts; src/evals/convergence-runner.ts; src/execution/run-persistence.ts; tests/execution-attempts/manual-control-owner-observation-v1.test.ts; tests/execution-attempts/manual-test-admission-v1.test.ts; tests/execution-attempts/manual-test-admission-v1.isolated-pg.test.ts; tests/execution-attempts/manual-test-worker-v1.test.ts; tests/evals/convergence-eval.test.ts; tests/evals/convergence-runner-v2.test.ts. Additional paths/private interface changes require concrete Root ruling before edit. No public frame/DTO, fixed suite/budget/oracle/role/credential/CLI-form change.

I1 representation ruling before implementation: an internal Source-owned all-process observation captures the actual spawnSync returned PID and fixed argv/executable, plus successful status/error/signal/complete-output facts. Require the exact unique snapshot row to match that original observer PID, actual current parent, inherited process group and exact fixed raw command. Only after definite observer exit normalize that one row away; never exclude by name, caller PID input, broad ancestry or absence. Keep private observation provenance module-owned, not an external exemption parameter. Reuse normalization in external-owner and closure paths. Actual OS all-process regression must retain a concurrent foreign child/descendant/group member; Source-only processOwner regression is insufficient.

I2 exact private proof interface and race/order must be proposed by implementer and settled by Root before behavior edits; no fabricated child authority or mutation ahead of existing same-transaction canary authorization. An actual default child/real persistence regression is required under Root isolated authority, with explicit component/compiled-boundary limits. I1 and other independent mapped tests may proceed while this interface is reviewed. I3 observes only positively known ordinary pending canonical owner/outbox state under existing bounds/ownership discipline and suppresses optional sync/new work after cancel. Unknown/refused/fatal states remain retained. Root reruns affected real PG/adjacent gates after Sourcefreeze; no test/compiled/runtime credit is inferred from source traces.


### Root final-fix private interfaces and frozen verification

The original final-review I1–I3 findings require this same manual-evaluation root fix. Root approved the following exact interfaces before their implementation, and records them here before delivery. I2 adds only the optional internal startRun descriptor carrying current reservation plus durable journal revision/hash. The default process port captures its original ChildProcess and publishes the pinned private canonical start-child proof, binding actual PID/start/parent/group/executable/raw argv to the full current start_requested/canary_bound journal chain, custody/intent/selection/source/suite and exact slot/case/task/repetition. No token or nonce appears in that proof. Missing-only publication races may wait read-only for at most5seconds; mismatch refuses immediately. Exact stored unconsumed canary and both insertion-proof checks precede owner creation and insertion mutation under the existing fence. Publication refusal still awaits the original child outcome; no second start, release retry, public DTO or extra CLI form.

I3 adds private observeSelectedManualSettlementV1(reservation), returning only ready/pending under captured selection/custody/intent/history pins and bounded repeatable-read READ ONLY SQL. Because existing terminal resolvers require FOR UPDATE, the exact additional File Map is src/db-pg.ts for only observeInternalProductionWorkflowRunClosedOwnerInTransactionV1 and observeInternalProductionOperationalDeliveryBoundOwnerInTransactionV1. Both reuse unchanged complete reservation/state/binding/migration/genesis/close validators and issue no mutation authority. Cumulative exact consumed slots and terminal runs must match canonical closed ownership. Every active owner must pair one-to-one with a validated pending/leased operational-delivery owner and exact event/outbox/run payload; foreign, missing, malformed, ambiguous or excess evidence refuses. Release independently retains its original locked zero-activity proof.

Existing runner projection polling (12 observations, at most5second waits) and the new worker read-only settlement stage (at most60seconds monotonic,12 observations, at most5second waits/transactions) are separate bounds: nominal combined waiting may approach120seconds plus already bounded I/O. This is settlement overhead, not an execution-budget change. No shared public deadline hook; private component clock only. Cancellation suppresses optional sync/new work. One ordinary release/close follows positively established readiness; uncertainty retains custody.

Root verified frozen Source atc4f90d2:1778full Source file hashes,10changed paths,30commands/120original capture leaves, manifest204d92146fdc27321d13aff02715892408fe10df1beb4899febff2b3df320313. Final focused139/139, Source noEmit and diff checks passed. Isolated-module typecheck retains the exact8 verified baseline helper diagnostics;6 additional broader unchanged-line diagnostics are baseline-unproven, and that expanded check is not green. All failed originals remain retained. The authored actual default-port/owned temporary CLI/real persistence P3 uses explicit injected selection/parent-OS component setup and only its owned database; it is not compiled-release qualification. Root protected PG and affected adjacent tests, one final scoped Source re-review, reviewed delivery and new clean immutable build are still required. Actual compiled/selected/channel/full8/runtime gates remain open; no archive or live service was changed.


### Root actual PGv5 failure and exact test-only diagnostic boundary

Root protectedPGv5 at9919bfa6 completed19tests/17pass/2fail in170.618seconds, Source/HEAD unchanged, no forced timeout and all owned clone/primary/template databases dropped. Both actual default-child positive setups failed initial publication with CONTROL_START_UNRESOLVED; the production port intentionally discarded the nested cause. Proof-drift/foreign-child negative passes are causally unproven while that positive baseline fails. No I2/PG acceptance is granted.

Root approved only the existing isolated-PG test path for safe diagnostics: its existing observation hook wraps the exact original publisher while preserving body/argument/return/throw semantics. Record allowlisted name/code and up to6 bounded function/basename-line frames, never raw error/URI/child stderr/task/proof/selection/token/nonce/DB URL. Original child outcome is still awaited. Negative fixtures must positively prove their exact deliberate injection marker and successful initial publication, so unrelated refusal cannot pass. Production Source is unchanged. Root verified1778current Source files,24original diagnostic leaves, supplemental report and unchanged PGv5 original against manifestb3a35c7f48690d41b869656a33102dd0f4ea0b3d2b0e3cb9f9ca065918688693. Final sanitizer/generatedCLI syntax checks passed; strict module typecheck retains the same exact8 baseline diagnostics, not green. Root protectedPGv6 diagnoses before any production repair; affected adjacent and held final scoped review follow after the concrete cause is fixed. All actual compiled/selected/full8/runtime gates remain open.


### Root PGv6 concrete context-order defect and test-only correction

Actual protectedPGv6 atc8007d74 completed19tests/15pass/4fail in169.763seconds, unchanged Source/HEAD, no forced timeout, all owned databases dropped. Tightened negatives correctly reject unrelated publication refusal. The safe original records MANUAL_EVALUATION_OWNERSHIP_UNKNOWN; transformed line1084 is not an exact original location because the component Source hook does not regenerate its source map. No production repair is inferred from that location.

Root independently read the actual repository descriptor sort/returned contexts and the test's index0 selection. Actual suite/pure exactCanarySlotKey replay proves case0 utility-status-baseline differs from sorted-first game-start-baseline, so the test paired the wrong task hash with its canary. Root approved the same test path only: select exactly one context by intended caseHash/taskHash/repetition for all4 actual-child cases. Preserve production task/identity guard, all deliberate wrong-task negatives, sanitized diagnostics and exact fault markers. Root verified1778Sourcepins/16original leaves and report/PGv6red against manifestfc51ec8503c32f907657d25ed9acc1ee57f1d8220e093d3f3fe90d75015e0d7c. Replay, CLI syntax and diff pass; strict module retains exactly8 baseline helper diagnostics, not green. Production Source remains unchanged. Actual protectedPGv7 must establish the corrected positive and I3 SQL subchecks before adjacent/scoped review/delivery; compiled/selected/full8/runtime gates remain open.


### Root actual PGv7 child failure diagnostic

ProtectedPGv7 at25426496 completed19tests/17pass/2positivefail in169.182seconds, unchangedSource/HEAD/noForcedTimeout, allownedDBcleanup. Initial default-child proof publication now succeeds; both fault injections reached their markers. The positive child exits nonzero, so positive persistence/I3 SQL and causally isolated negative qualification remain open. Native initialization/readiness is only a hypothesis, not a proven missing-fd3 failure.

Root approved the existing isolated-PG test only for a private child diagnostic: exact sanitizer embedded in owned CLI, first core failure recorded before unchanged cleanup, exclusive0600<=4096byte fixed-schema/stage/cleanupunknown JSON. Allow only exact known Source codes or5character SQLSTATE code properties, bounded names/6function-basenameframes, no raw messages/stderr/URL/input/proof/task/token/nonce. Parent validates nofollow/currentowner/singlelink/mode/size/canonicalencoding and stable file identity after awaiting the original child. Absent or invalid diagnostic remains null/unknown. No auth, readiness, loader, production, selector or cleanup behavior change. Root verified1778Sourcepins/20original diagnostic leaves and report/PGv7red against manifestf54099049002adca0d847e32b04f92fc3f70affa648164ab8881982778b5887e. Sanitizer/record contract/generatedCLI syntax/diff pass; strict module retains8same baseline diagnostics, not green. One overlong recorder argument was rejected before process launch and preserved honestly. ProtectedPGv8 must locate the actual child cause before any runtime repair; all compiled/selected/full8/runtime gates remain open.


## Root PGv8 readonly P3 readiness component composition

Actual protectedPGv8 at09da20f4 completed19tests17PASS2positiveFAIL in167.913s, Source/headstable/no forcedtimeout and allownedDBcleanup. Original log10391B SHA503afd193a012b8d6732d659ec5e828d3577f909ab4da3338c45fc352351b9ab. Child diagnostic now proves persist_run/RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE after initialization and actual child-proof publication. Native relative.js-to.ts loader selects actual baseline.ts; the authenticated parent P3 shadow is process-local and requires its existing role. No failed attempt or negative is upgraded. Production correctly refuses.

Exact causal additional FileMap, approved before edits: tests/execution-attempts/test-database.ts plus the existing manual-test-admission-v1.isolated-pg.test.ts. The actual returned fixture gains zeroargument observeOwnedP3ReadinessV1 closing over authenticated role/marker/clone/db/migration/lifetime. It invokes the existing pinned shadow actual observe+resolve, observes current_database and ManifestA activation/head around awaited work, and returns deep-frozen actual observations with canonical descriptor hash and fixed parent/source/clone/marker bindings, no admin/URL/nonce/token. The native test adapter intercepts ONLY the exact relative readiness import from exact unsuffixed db-pg.ts, verifies independent expected parent/source/descriptor and actual clone/currentpair before/after awaits, returns the exact fixed readonly objects/references and refuses drift/foreign/unknown. It never changes production readiness or SQL/claim/proof/owner guards.

This explicitly expands the test component boundary to selection + parent OS + authenticated readonly P3 readiness observation, not actual compiled readiness/GO. Native original-child persistence still executes real namespace/status/frozen-object/currentpair validation and real SQL/common fence/stored one-use claim/childproof/owner logic. Two authored actual-child crossed-database/unknown-reference negatives require deliberate marker, successful proofpublication, specific readiness refusal and unchanged runs/owners/claims. Root must run them and the positive.

Root read the complete two-file diff/report and independently verified1778Sourcepins and20original capture leaves in manifest432a2187f1dff0b6629b63dd306139b8e94f4b855b971c4e4e8f95d7c7522287. Purebinding RED missing-validator then GREEN1/1 with serialization/crossedidentity/unknownref; three adapter/defaultCLI syntax variants anddiffPASS. Strictcheckexit2 retains8previous helperdiagnostics atshiftedlines, actualnewlogSHAb17c9c36820b63251e193082ee7ad19ee3ee01e8ae80d89e54d92b923a28ecb8, notgreen/notidenticaloldSHA. Broader6errors remainbaseline-unproven; no unrelatederrorfix. Sourcehashes isolatedPGcbd12b38a4a34f4a65c229e60425f1c4088624a93b8506e8c8ec69997bf57bd5 and helper0304d443baa6a192a73b66a42e819e428608bc0af5f5cbc2316b39efa192c6b7. Production unchangedfrom9919bfa6.

Root protectedPGv9 now required, expected22tests (existing19+pure1+readinessnegatives2). Ifpositive passes, fresh affectedadjacentv3 and held scopedindependentreview follow. No new production/public ABI/capability, auth/role weakening, fixed-command guard bypass or delivery authority. All17actualcompilednegative/selectedbroker/currentmaterial/full8/rollout/live gates remain open.


## Root PGv9 exact live-run refusal test correction

ActualPGv9at54e9d812 completed22tests21PASS1FAIL193.87s, unchangedcleanSource/no forcedtimeout;21clonecreations/dropseachmatched plusprimary/template dropped. Original9898B logSHAfaf2ecaefd9ecb787d7787b642f8733f9d74fc688131b73914c51ea783982d7a retained. Bothnewreadinessnegatives andoriginalproofdrift/foreignchild negatives passed. Realdefaultchild/persistence/proofreturned, thenSource765 live-runreadonlysettlement expectedACTIVITY butunchangedterminal-onlyguard correctlyreturnedOWNERSHIP_UNKNOWN. Terminalremainderwasnotexecuted; no wholepositivepassclaim.

Root independently read observer910–930, workerfinish sequencing andactual failingpositivecase. ExactFileMap onlymanual-test-admission-v1.isolated-pg.test.ts. Beforetheliveobserver, assert oneexactrunningrun with expectedid/number/workflow/protocol/version/source/admission/task plusoneconsumedclaim boundtothatrun. Require Error.message exactlyOWNERSHIP_UNKNOWN, preserveindependentreleaseACTIVITY andallcanonicalterminal/pending/ownerdrainassertions. No broaderroracceptance/productionguardchange; liveboundrunisnotordinaryterminaldeliveryresidue.

Root reviewedcompletereport/diff andverified1778Sourcepins8captureleaves inmanifest284822664dfc17bf737c803891f4b363808823460d713ca9b993867835bc02cd; testSHA30ee4a325d91d08e3165f0e5a9218db74170f7f4cd2e2e1f948bc026123cde2b. Moduletranspile/actualunchangedguardinspection/diffPASS; nobroaderunchangedtest/typecheckrepeat. Priorstrict8deferred and6broaderbaselineunproven remainexplicit. Production/helperunchanged. RootprotectedPGv10 thenaffectedadjacentv3/heldscopedreviewifpositive; fullcompiled17/selected/currentmaterial/broker/full8/live gatesopen.


## Root PGv10 canonical foreign-event fixture repair

ActualPGv10at97e363ec finished22tests21PASS1FAIL199.352s Source/headstable/noforcedtimeout; Root matched21clonecreate/drop pairs andprimary/template drops. Log9442B SHA5c2472ba5822747d8230a6f4f6280f832c1c089f27d58e294f88c36315733a41 retained. Positiveprogressnowincludesexactrun/claim/live-refusal/canonicalterminal/read-onlyclosedowner/pending/outboxpublish/deliveryfullowner/alteredandextraowner checks. It failsatSource837 on UPDATEoperational_events.run_id; actualDB23514OPERATIONAL_EVENT_IMMUTABLE correctlyenforcestheexistingBEFORE UPDATE/DELETE trigger. Finaldrain/ready/releaseunexecuted.

ExactFileMaponlytheexistingisolatedPGtest. Rootapprovedandreviewedexactimmutabilitycode/messageassertion, canonicaleventdigestbeforeafter andunchangedpending/fullsnapshot. Preserveforeign-provenancecoverageusingONEvalidcanonicalforeignrun eventidentity throughalreadyimported originaloutbox enqueue/claim/publish anditsrealcanonicalbuilder/bothdeliveryowneradmissions. Assertforeignpendingoutboxandpublishedforeigndeliveries eachrefusereadonlyobserverwithACTIVITY_UNKNOWNandunchangedstate. No foreignrunINSERTimplied, triggerdisable/update-success/directeventinsert/delete/censuszero. Existingknown-owned-fixturerepodrain settlesallknownfixtureevents includingforeign andkeepsfinalready/releasechecks.

Root readactualimmutabletrigger, canonicaloutboxbuilder/identity/publish/findcontract andthe complete test delta (33 insertions, 3 deletions) and report. Verified1778Sourcepins8originalleaves inmanifest492c9f715296b0156d19ae450bf093b67cbd2d89217fa37bbccfce74db53e5f9; testSHAa990f4d0b78a99ff0e4eaa7cd03d0e1b4f24f52bba1811cb336a470e656b7950. ExactnewenqueueASTinputreplayedthroughrealpurecanonicalbuilderandmoduletranspile/diffPASS; noPGcredit. Production/helperunchanged; deferredtypechecklimitsremain. RootprotectedPGv11thenaffectedadjacentv3/heldscopedreviewifwholepositivepasses. Compiled17/currentmaterial/broker/full8/rollout/livegatesremainopen.


## Root final Source qualification and scoped PR delivery

FrozenSource3fa1a9146aa001d2cf3ae58d0bd8a8732aab1eca: protectedPGv11all22PASS218.209s/log7756B SHA66125521750f300e3c374fdad52b724bdc66bde22b11be74db047a9925afe0e0; freshaffectedadjacentv3all70PASS(23protocol+28terminal+19termination)714.995s/log18644B SHA550950f1cdce395acd39de2451a0fe82ed943b156ff2944bf42cd45562086b5f. No fail/skip/cancel/forcedtimeout; cleanSource/headunchanged. RootverifiedPGv11all21clones+primary/template drops; adjacentall43clones+2emptydatabases+6primary/template drops. No modeled or historical adjacent run substituted.

Scopedindependentreview final-source-fix-1-review.md SHA088e188ec23cc9ed213c375d6c7a7a98635d21a719e129516ba863849cd6f99a approvesSourceSpec/QualityforordinaryscopedPRdelivery/mergeat3fa1: I1–I3 addressed,C0/I0/no newminor; existingM1DEP0205 deferredvisible. Source139focused/noEmit evidence andexactPG/P3readiness/selection/parentOSseams remainattributed; notall22arecompiledtests. Eightbaselinehelpertypeerrors andsixbroaderbaseline-unproven errors remainexplicit, nofailedtypecheckgreenclaim. Above31linewordingcorrectedtomeasured33insertions/3deletions, noSourceeffect.

RootwilldeliverordinaryreviewedPRfromsolefeaturewriter, preservemaingitdisciplineandcurrentliveQ3. Newreviewed/merged-mainimmutablecleanstockbuild/17actualcompilednegative/currentselectedmaterial/actualMC-SFbroker/custody/activationpreflight/full8/promotion/guardedrollout/live qualificationremainopen. SeparateTask4P3fixturecompositionhasitsown2SF/5MCmap/designandneedsSource-review/actualgates; thisacceptancegrantsnoneofit. CurrentSourcecompletionisnotprojectorGOcompletion.
