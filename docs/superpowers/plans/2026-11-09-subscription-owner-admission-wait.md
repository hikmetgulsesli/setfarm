# Subscription worker owner-admission wait implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute the single coupled task with independent review.

**Goal:** Keep an authenticated original worker alive, without SDK execution, while its selected parent completes existing fenced owner admission.

**Architecture:** An explicit one-shot bound private wait/ACK phase separates proof and OPENED clocks from owner SQL latency. The runtime negotiates it after its worker-bound journal; selected caller publication and opening order stay unchanged.

**Tech Stack:** TypeScript ESM, fixed Node preload, existing Node test/TypeScript AST harness, fake clocks and inert external ports.

**Spec:** `docs/superpowers/specs/2026-11-09-subscription-owner-admission-wait-design.md`

## Global constraints

- Sole writer branch `fix/subscription-owner-admission-wait-20261109`, base `7a7612f90aad0dfb76316ceff36ece0b15d89ea2`; Root alone stages/commits/pushes/delivers/operates services.
- Retain existing child 9000ms and parent 10000ms proof/open bounds; READY alone cannot extend them. Explicit fixed wait is 120000ms once, parent anchored at request emission; whole original worker/runtime 1800000ms is never restarted.
- Preserve all owner SQL/lease/custody/EOF/original-handle/closure/uncertainty checks. No model/profile/capacity/retry/grant/role/credential change or live DB mutation/replay.
- No live release/generated edits, providers, sandbox probes, service controls, extra cases or broad test campaign by implementer/reviewers.
- Preserve source, dirty files, new/old records and all workspaces; user retention instruction overrides any skill cleanup default.

### Task 1: Negotiate and enforce the bounded owner-admission phase

**Files:** The four source and two test files in the spec File Map. Update these two documents only if a concrete implementation detail needs a recorded correction; report it before changing scope.

**Interfaces:**

```ts
// Existing private protocol, same complete binding and exact serialization.
waitForOwnerAdmission(): string;
// Existing original-owned physical worker facade.
waitForOwnerAdmission(): Promise<void>;
// New protocol states, no selected/spawner API change.
type AddedStates = 'admission-wait-sent' | 'admission-waiting';
// Fixed frame types: 'owner-admission-wait' / 'owner-admission-waiting'.
```

- [ ] Read spec, actual safe clock proof and relevant test-writing guidance. Verify the sole writer is clean before test edits. Do not dispatch subagents or perform Git/service/provider effects.
- [ ] Extend the existing actual-body clock harness, keeping production protocol/callback/openGate/preload behavior as authority. External clocks/streams/process observation/FS may be inert explicit ports. Do not mirror production transitions in test-only code.
- [ ] Add genuine delayed-owner RED: actual worker proof validates inside original startup bounds; genuine runtime worker-bound journal is recorded; owner admission completes at fake t=16000ms; no SDK execution occurs before publication; actual OPEN/OPENED must then succeed within fresh short bounds. Under old Source, assert the observed startup fault/refusal, not a missing proposed method.

```ts
await actualRuntimeAcquisitionThroughWorkerBound();
await delayOwnerPublicationTo(16_000);
assert.equal(sdkEvaluated(), false);
await publishFencedRunningThenActualOpen();
assert.equal(actualProtocolState(), 'open');
assert.equal(originalCustodyFaults(), 0);
```

- [ ] Preserve original RED argv/PID/exit/output before any source edit. If the fixture fails first, keep that capture distinct and repair only the fixture before genuine RED.
- [ ] Implement exact wait request/ACK in the existing private protocol. Preserve strict schema/binding/byte limits; explicitly bound the optional frame sequence; reject duplicate/replay/foreign/out-of-order transitions and partial/queued data crossing outgoing transitions. Extend custody signalling states without broadening closure acceptance.
- [ ] Implement the fixed preload's optional wait phase. Keep original proof deadline until the valid transition; fixed wait expiry and EOF close before SDK entry; OPEN starts its short acknowledgement phase and SDK remains gated through exact OPENED. Do not add listeners or permissions.
- [ ] Implement the original-owned worker wait method. Validate identity/pins, anchor nonrenewable 120000ms wait at request emission, await exact ACK under current short deadline, then install that deadline while retaining the original whole lifetime. Check monotonic deadlines at request/ACK/OPEN/OPENED, so delayed callbacks cannot admit late events. Physical OPEN validates the wait/direct deadline, re-arms only the short OPENED clock, and refuses if originals closed or ownership changed. Fault/stop/finish must reject any pending wait.
- [ ] Add the runtime call immediately after genuine worker validation and `journal.bindWorker(bound)`, before startupComplete/return. Race the native wait promise against existing closed/abort/lifetime; reject missing method, malformed promise, refusal or original closure while retaining original ownership.

```ts
await journal.bindWorker(bound);
if (stopping || typeof acquiredWorker.waitForOwnerAdmission !== 'function') refuse();
const pending = acquiredWorker.waitForOwnerAdmission();
if (!nativePromise(pending)) refuse();
await Promise.race([pending, closed.then(() => { throw new SubscriptionCodingRuntimeStartupErrorV1(ownership); })]);
if (stopping) refuse();
// Existing return/openGate and selected owner checks continue unchanged.
```

- [ ] Same delayed-owner case GREEN, plus actual-body negatives: READY without wait; wait request without ACK; wait ACK without OPEN to fixed expiry; OPEN without OPENED; foreign/duplicate/replayed/malformed/out-of-order frames; EOF/death/abort; stale process/material; whole lifetime not reset. Direct non-wait path must retain its old short bounds.
- [ ] Preserve old substantive assertions. Update existing physical-worker fixtures only for the now-required typed method; do not turn custody/admission tests into mocked PASS claims.
- [ ] Run only `tests/execution-attempts/subscription-coding-worker-v1.test.ts`, `tests/execution-attempts/subscription-coding-runtime-v1.test.ts` and TypeScript no-emit using original capture wrappers. No full suite, SDK/probes/providers or live DB.
- [ ] Self-review and freeze Source/test/doc diff hashes, genuine RED/GREEN/noEmit receipts, exact changed file list and limitations in the task report. Stop edits for Root packaging and independent review; no implementer Git delivery.

## Root review and delivery

Root uses the frozen diff for task spec+quality review, then one broad whole-branch review. Apply only reviewed causal fixes through the same writer. Root owns conventional commits, scoped push/PR, actual GitHub review, normal merge and exact clean-main stock build. No direct-main commit, force or dirty/skip build. Record any design ruling with its cost in the ledger.

Public operational transition and fresh real-run qualification remain subsequent, concrete reviewed steps. Do not treat component fake-clock coverage as physical/OS qualification, a new PASS run, repaired current quarantine or a proven Task2 live handoff.
