# V3 auto-verification supervision boundary implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Prevent the legacy background verifier from queuing V3 verification before authenticated supervisor acceptance.

**Architecture:** Exclude V3 at the existing background producer query. Keep all V3 authoritative routes and fail-closed guards unchanged.

**Tech Stack:** TypeScript ESM, Node test, TypeScript AST extraction, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-08-v3-auto-verify-supervision-boundary-design.md`

## Global constraints

- Sole writer branch `fix/v3-auto-verify-supervise-order-20261108`, base `e3d3b88dcabd641bfaead0d5d5521f7b2c79221f`.
- Root alone stages/commits/pushes/delivers and operates services. Preserve all old records and dirty files.
- No live DB mutation, role/credential changes, guard bypass, model/provider calls, generated-code edits, thread resolution, or quarantined-RCR replay.
- Preserve every topology/claim/CAS/retry limit and non-V3 behavior.
- No full-suite campaign. Focused verification and one clean stock build after reviewed delivery.

### Task 1: Bound the background verifier to non-V3 runs

**Files:** Modify `src/spawner.ts`; create `tests/spawner-auto-verify-protocol-boundary.test.ts`; repair the missing real-helper import and required empty drainEvidence fixture in `tests/spawner-gateway-recovery.test.ts`.

**Interfaces:** Consume the existing `autoVerifyMergedPrEachStories()` body and its `pgQuery`/`pgRun` ports. Produce no new production export or API.

- [x] Read the spec, current evidence and test-writing guidance; verify clean sole writer before edits.
- [x] Add a test-only AST harness modeled on `tests/spawner-inflight-claim-ownership.test.ts`: select exactly one function declaration by name, transpile its unchanged body, and replace only its two dynamic imports with named inert step-ops/step-advance ports. Bind `pgQuery` and `pgRun` to real PostgreSQL.
- [x] Use `createIsolatedTestDatabase({migrate:false})` from `tests/execution-attempts/test-database.ts`; create minimal runs/steps/stories tables containing all fields the genuine query and UPDATE access. Protocol is NOT NULL DEFAULT 'legacy'. Clean up only the helper-owned test database using its maintained cleanup.
- [x] Seed running V3 implement-loop + done OPEN-PR story + waiting verify; the inert auto-verifier returns that story. Invoke the genuine caller and assert:
```ts
assert.equal(v3Verify.status, "waiting");
assert.equal(calls.autoVerifyForV3, 0);
assert.equal(calls.advanceForV3, 0);
assert.equal(calls.errors.length, 0);
```
- [x] Add real-SQL controls: legacy waiting verify becomes pending; legacy pending verify remains eligible after stale review delay; mixed V3/legacy results affect only the legacy row. Assert durable row states, not SQL substrings or fabricated query returns.
- [x] Run and preserve original RED receipt/output before production changes. Expected failure: old production function changes V3 verify to pending/calls its auto-verifier; no fixture or connection error.
- [x] Apply the smallest production change inside the background selector:
```sql
WHERE r.status = 'running'
  AND r.protocol <> 'v3'
```
- [x] Run the same focused test to GREEN, then existing spawner gateway recovery controls and TypeScript no-emit. Use the maintained helper in its supported standalone mode on one owned private PostgreSQL fixture. The closed P3 projection runner rejects this new test/source scope; do not alter that runner or use guard/marker bypasses. Set SETFARM_TEST_PG_ADMIN_URL only to the private fixture, bind the extracted caller SQL ports to database.sql.unsafe, and stop the owned PG normally. Keep the fixture-error and genuine RED captures distinct. Preserve argv/PID/exit/log hashes and inspect child exit codes.
- [x] Reproduce the existing gateway fixture failure on the clean e3d release using only its failing test name. Bind its actual missing isSubscriptionRuntimePathV1 helper in the test-generated module; preserve all behavior/assertions, then rerun the gateway suite once.
- [x] Self-review and freeze the exact diff/file hashes plus red/green receipts in this plan's workspace; stop implementation work for independent task/whole-branch review. No delivery effects by the implementer.

## Root delivery and live qualification

After review, Root commits/pushes this scoped branch, reads exact GitHub review, merges normally, and builds an exact clean-main release. Current run remains failed/quarantined evidence until a reviewed maintained stop/termination path closes ownership. Do not change old row state or replay its completion. Normal next-release installation/paired rollout and one unchanged real case remain separate Root effects under existing bounded authority. Supervisor evidence-handoff investigation may refine the same objective only after actual omission is demonstrated, with this File Map and tests updated before delivery.

### Task 2: Deliver authenticated accepted evidence to supervisor input

**Files:** Modify `src/execution/subscription-supervise-contracts-v1.ts`, `src/installer/step-ops.ts`, `tests/execution-attempts/subscription-supervise-scope-v1.test.ts`, `tests/execution-attempts/subscription-workflow-transport-v1.test.ts`.

**Interfaces:** Preserve `readAuthenticatedSubscriptionSuperviseContractsV1(envelope,runtimeSessionId)` exactly. Add `readAuthenticatedSubscriptionSuperviseEvidenceV1(envelope:ClaimEnvelopeV1,runtimeSessionId:string)` as a fixed DATA reader returning frozen own canonical JSON. Consume existing authenticated contracts, `loadV3ImplementationAttemptContext`, actual accepted-model source authority and native evidence-only success authority; produce no new grants or public API.

- [x] Read the updated spec and actual audit. Task 1 is already reviewed/committed; do not redo it or modify its files.
- [x] Add a genuine input-assembly RED in the existing transport test: execute the actual step-ops statements from template resolution through module override/English policy, using explicit inert registry/store boundaries and a valid actual-schema accepted-evidence fixture. Existing Source should build an instruction missing the known accepted bundle. Assert on the resulting input:
```ts
assert.ok(resolvedInput.includes(acceptedEvidenceBundleHash));
assert.ok(resolvedInput.includes(acceptedCandidateSha));
assert.ok(resolvedInput.includes(acceptedCompletionRequestId));
```
  Keep these assertions unchanged after implementation; do not make missing-export/import errors the RED.
- [x] Add reader/projection fixtures using actual EvidenceBundleV2 schema/hash and compiled evidence plan, and execute actual accepted-source authority code rather than returning a fabricated trusted result. External SQL/storage ports may be inert; clearly scope that as a component test. Assert exact identity/source/tree/packet/slice/attempt/generation and predicate-coverage binding. Negative cases: missing/duplicate bundle, crossed run/story/RCR/claim/generation/attempt/source/tree, changed bundle hash, missing required predicate, and contradictory acceptance facts. Preserve fail/inconclusive facts or refuse; never manufacture PASS.
- [x] Include existing native evidence-only success as its own genuine authority kind (no fake model RCR) and both existing subject kinds; preserve old contract return/seal unchanged. Other runtime modes, legacy and non-supervisor prompts remain byte-identical and must not load the new data reader.
- [x] Preserve the original failing input-assembly capture before source changes.
- [x] Implement the separate fixed reader and bounded JSON projection. Parse/hash the exact stored bundle and validate against the authenticated compiled context/source, using existing schemas/readers. Summary contains actual RCR or verifier authority, candidate SHA/tree, bundle/hash, runner/coverage/verdicts, observations and artifact metadata; no raw bodies or secrets.
- [x] Append it at the existing final-input seam after module prompt override:
```ts
// Under the existing subscription + V3 + supervise selection:
const evidence = await readAuthenticatedSubscriptionSuperviseEvidenceV1(
  singleStepClaimEnvelope, singleStepRuntime.sessionId,
);
resolvedInput += "\n\nSETFARM_ACCEPTED_IMPLEMENTATION_EVIDENCE\n"
  + canonicalJsonStringify(evidence);
```
  Use the actual available authenticated pair, existing runtime selection and imports; fail closed on absent pair. Do not alter other input policies or append after sealing.
- [x] GREEN must show the exact accepted binding/verdicts in final instruction, canonical stage material and existing readable fragments; module override must not drop it. Existing capacity refusal must happen before worker creation; do not raise limits or silently drop evidence.
- [x] Run only the two focused files and TypeScript no-emit with original argv/PID/exit/log captures. No full suite, providers, live DB or service actions. Do not rerun Task1 PG tests absent a new reason.
- [x] Self-review and freeze exact code/test diff/file hashes and original RED/GREEN receipts. Return for independent review; no Git delivery or live effects.

## Combined delivery boundary

Both confirmed causes belong to the same observed supervisor failure: the model lacked accepted evidence, and publishing its valid retry then met an invalid state created by the background producer. Keep one scoped branch/review/clean-main build/next rollout. Task2 is not authority to change model behavior, require extra speculative checks, or manually rescue the current generated project.
