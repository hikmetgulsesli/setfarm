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

- [ ] Read the spec, current evidence and test-writing guidance; verify clean sole writer before edits.
- [ ] Add a test-only AST harness modeled on `tests/spawner-inflight-claim-ownership.test.ts`: select exactly one function declaration by name, transpile its unchanged body, and replace only its two dynamic imports with named inert step-ops/step-advance ports. Bind `pgQuery` and `pgRun` to real PostgreSQL.
- [ ] Use `createIsolatedTestDatabase({migrate:false})` from `tests/execution-attempts/test-database.ts`; create minimal runs/steps/stories tables containing all fields the genuine query and UPDATE access. Protocol is NOT NULL DEFAULT 'legacy'. Clean up only the helper-owned test database using its maintained cleanup.
- [ ] Seed running V3 implement-loop + done OPEN-PR story + waiting verify; the inert auto-verifier returns that story. Invoke the genuine caller and assert:
```ts
assert.equal(v3Verify.status, "waiting");
assert.equal(calls.autoVerifyForV3, 0);
assert.equal(calls.advanceForV3, 0);
assert.equal(calls.errors.length, 0);
```
- [ ] Add real-SQL controls: legacy waiting verify becomes pending; legacy pending verify remains eligible after stale review delay; mixed V3/legacy results affect only the legacy row. Assert durable row states, not SQL substrings or fabricated query returns.
- [ ] Run and preserve original RED receipt/output before production changes. Expected failure: old production function changes V3 verify to pending/calls its auto-verifier; no fixture or connection error.
- [ ] Apply the smallest production change inside the background selector:
```sql
WHERE r.status = 'running'
  AND r.protocol <> 'v3'
```
- [ ] Run the same focused test to GREEN, then existing spawner gateway recovery controls and TypeScript no-emit. Use the maintained helper in its supported standalone mode on one owned private PostgreSQL fixture. The closed P3 projection runner rejects this new test/source scope; do not alter that runner or use guard/marker bypasses. Set SETFARM_TEST_PG_ADMIN_URL only to the private fixture, bind the extracted caller SQL ports to database.sql.unsafe, and stop the owned PG normally. Keep the fixture-error and genuine RED captures distinct. Preserve argv/PID/exit/log hashes and inspect child exit codes.
- [ ] Reproduce the existing gateway fixture failure on the clean e3d release using only its failing test name. Bind its actual missing isSubscriptionRuntimePathV1 helper in the test-generated module; preserve all behavior/assertions, then rerun the gateway suite once.
- [ ] Self-review and freeze the exact diff/file hashes plus red/green receipts in this plan's workspace; stop implementation work for independent task/whole-branch review. No delivery effects by the implementer.

## Root delivery and live qualification

After review, Root commits/pushes this scoped branch, reads exact GitHub review, merges normally, and builds an exact clean-main release. Current run remains failed/quarantined evidence until a reviewed maintained stop/termination path closes ownership. Do not change old row state or replay its completion. Normal next-release installation/paired rollout and one unchanged real case remain separate Root effects under existing bounded authority. Supervisor evidence-handoff investigation may refine the same objective only after actual omission is demonstrated, with this File Map and tests updated before delivery.
