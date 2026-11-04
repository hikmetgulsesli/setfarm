# Annual Subscription Coding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development task by task. One source writer; Root alone stages/commits/delivers. Read design/AGENTS. No worker performs credential/provider/OS/DB/service effects. Tests confer no operational authority.

**Goal:** annual MiniMax/Kimi filesystem-only workers rejoin existing durable evidence/completion.
**Architecture:** pure policy, protected parent broker, sandbox worker, parent attachment; existing lifecycle repositories.
**Tech Stack:** TypeScript ESM, Node22, existing OpenClaw pi, Darwin sandbox-exec, postgres/zod. No dependency additions.
**Spec:** `docs/superpowers/specs/2026-11-04-subscription-operational-integration-design.md`

## Global Constraints

Primary `minimax/MiniMax-M3.1-Flash`; existing bounded retry `kimi/k3.1-pro`. No PAYG/gateway/SDK fallback. Tools exactly `read,write,edit`, workspaceOnly=true. Inline full claim, parent report publication; no worker CLI/DB. Preserve Codex/legacy/read-only20s, activation/current-clean-main/selected-DB/native guards. Fixed limits:128 requests,8192 output/524288 total tokens,2097152 request bytes,8388608 response/67108864 total bytes,262144 SSE bytes,1800000/120000/60000 attempt/request/idle ms. No dirty-build/guard bypass. Actual live/provider/credential effects remain unadmitted.

## File Map

Create under `src/execution/`: `subscription-coding-policy-v1.ts` (projection/limits), `subscription-parent-credential-v1.ts` (reader), `subscription-coding-worker-v1.ts` (sandbox/process), `subscription-runtime-attachment-v1.ts` (journal), `subscription-coding-runtime-v1.ts` (joint owner), `subscription-workflow-transport-v1.ts` (inline role/report mapping).
Create `src/installation/selected-model-profile-v1.ts` for the import-inert pure profile projection. Modify `src/installation/fresh-installation-v3-profile-v1.ts`, `src/execution/operational-retry-directive.ts`, `src/evals/convergence-runner.ts` (profile); `src/execution/runtime-session-repository.ts`, `src/spawner.ts` (lifecycle). Matching tests under `tests/execution-attempts/`; existing installation/retry/convergence/repository/completion tests. Register new DB lifecycle test OWNER_BACKED_TESTS in `scripts/run-execution-attempt-tests.ts`.

### Task 1: pure coding policy, first releasable task

Create policy and matching test. Existing broker/material types:
```ts
export type SubscriptionModelRefV1=SubscriptionAttemptBrokerWorkerV1['modelRef'];
export const SUBSCRIPTION_CODING_LIMITS_V1:SubscriptionAttemptBrokerLimitsV1;
export type SubscriptionCodingMaterialV1=Omit<SubscriptionAttemptLaunchMaterialV1,'profile'> &
 Readonly<{profile:'subscription-coding-files-v1'}>;
export function buildSubscriptionCodingMaterialV1(input:SubscriptionAttemptLaunchInputV1 &
 Readonly<{worktree:string}>):SubscriptionCodingMaterialV1;
```
- [x] RED direct-import tests: both exact models, deep detached freeze, exact identity, canonical worktree/root overlap, extra keys/getters/proxy sanitization, readonly regression. Assertions:
```ts
const cfg=JSON.parse(material.files[0].contents);
assert.deepEqual(cfg.tools.allow,['read','write','edit']);
assert.equal(cfg.tools.fs.workspaceOnly,true);
assert.equal(material.cwd,worktree);
assert.equal(cfg.agents.defaults.workspace,worktree);
assert.equal(cfg.agents.list[0].workspace,worktree);
assert.equal(cfg.agents.defaults.timeoutSeconds,1800);
assert.deepEqual(cfg.agents.defaults.model.fallbacks,[]);
```
Run `node --import tsx --test tests/execution-attempts/subscription-coding-policy-v1.test.ts`.
- [x] Validate exact five-key own-data input. Call readonly builder with original four fields, copy generated config into separate coding result. Change all workspaces/cwd/tools/timeout/maxTokens; preserve private HOME/auth/env. Freeze. Lexical worktree matches root discipline, permits spaces, rejects containing/contained private root. Fixed `SUBSCRIPTION_CODING_INPUT_INVALID`; no physical admission/effects.
- [x] GREEN seven focused cases, including the unchanged readonly control; strict focused TypeScript checks and scoped review passed. Root captures 3f62d5/bfb643; review c0f26d68. No unchanged custody or old Parent tour replay. Task5 consumes this API.

### Task 2: actual selected profile consumers

Modify profile/retry/convergence and tests. Add import-inert `src/installation/selected-model-profile-v1.ts` so direct unit tests never import the selected-installation credential capture. The existing facade retains captured selection/drift checks and Codex compatibility. API:
```ts
export function assertSelectedFreshExecutionProfileUnchangedV1():void;
export function readSelectedFreshExecutionProfileV1(
 selection:'primary'|'fallback'='primary'):ModelExecutionProfileV1|null;
```
- [ ] RED subscription primary/fallback, unknown runtime, sticky drift, Codex argv/fallback refusal, ordinary null. Preserve existing actual Source-extraction tests; new pure projection tests direct import. Production consumers continue through the selected facade. Before running any existing test, inspect transitive imports; isolate or omit DB/provider side effects unless explicitly admitted. Run `node --import tsx --test tests/installation/fresh-installation-v3-profile.test.ts tests/execution-attempts/operational-retry-directive.test.ts tests/evals/convergence-runner-v2.test.ts`.
- [ ] Implement captured `subscription|codex`, generic sticky API, fixed MiniMax/Kimi, exact Codex. Keep Codex-named compatibility exports; type-only import prevents cycle. Retry passes selection; convergence reads primary. Spawner stays closed pending owner.
- [ ] GREEN same command; Root review/commit.

### Task 3: protected parent credential

Create reader/matching test. API:
```ts
export function withSelectedSubscriptionCredentialV1<T>(modelRef:SubscriptionModelRefV1,
 use:(credential:string)=>Promise<T>):Promise<T>;
```
- [ ] RED fake-store tests missing/symlink/hardlink/uid/mode/oversize/extra or duplicate keys/model mismatch/replacement/Source drift; callback never runs on invalid input; no secrets/hash/path/raw exception. Run `node --import tsx --test tests/execution-attempts/subscription-parent-credential-v1.test.ts`.
- [ ] Fixed selected paths/schema from design, no provisioning/path/env/SDK fallback. Follow private-assets descriptor pattern: private canonical ancestors, O_NOFOLLOW/O_NONBLOCK, owned0600 regular single-link4096 bound; stable fd/name dev/ino/mode/uid/gid/nlink/size/mtime/ctime before/after. Exact model and selected entry before/after. Callback directly supplies broker/drops refs; fixed `SUBSCRIPTION_CREDENTIAL_REFUSED`; no JS erasure claim. Fake FD helper confers no production authority.
- [ ] GREEN; Root review/commit. Real protected-store provenance remains operational prerequisite within retained approved scope.

### Task 4: real filesystem-only owned worker

Create worker/matching test. API:
```ts
export type SubscriptionCodingOwnedWorkerV1=SubscriptionOwnedWorkerV1 & Readonly<{
 child:ChildProcess;processIdentity:ProcessIdentityV1;openGate():void;isolationHash:string;
}>;
export function launchSubscriptionCodingWorkerV1(input:Readonly<{
 material:SubscriptionCodingMaterialV1;transcriptPath:string;authorityRoots:readonly string[];
}>):Promise<SubscriptionCodingOwnedWorkerV1>;
```
- [ ] RED actual-policy tests: deny fork/same-Node spawn; exact broker outbound only/no inbound; credentials/journal/authority denied; claimed worktree/state writable. Reject aliases/.git/symlink/overlap. Original closure tests: exit without streams-close pending, PID reuse never signaled. Run `node --import tsx --test tests/execution-attempts/subscription-coding-worker-v1.test.ts`.
- [ ] Parent derives authority roots, pins real Node/OpenClaw JS entry, refuses wrappers. Materialize EXCL0600/0700/no-follow. Direct sandbox-exec→Node `--require <fixed-gate.cjs> <pinned-entry> ...argv`, exact env/FD3 gate. Nonce-bound preload probes deny same-Node fork/credential-parent read/authority write/public and nonbroker-loopback, broker TCP succeeds without provider request. EOF/abort exits.
- [ ] SBPL permits initial pinned Node exec, denies fork and nonpinned exec/outside signals/info/inbound/host writes/authority reads; permits exact broker/minimum runtime/package reads/worktree/state. Genuine OS/native/runtime/CLI-child dependency failure refuses. Actual probe evidence before gate; fixtures/booleans confer no qualification. No preview-policy change or public-Q executor.
- [ ] Original process/streams captured immediately; identity-bound TERM→KILL after2s; ack is no closure. GREEN pure/fake test; actual qualification separately admitted. Root review/commit.

### Task 5: durable joint owner and production integration

Create attachment/runtime/transport/tests; modify repository/spawner/dispatcher. APIs:
```ts
export type SubscriptionRuntimeBindingV1=Readonly<{
 runtimeSessionId:string;claimId:number;attemptId:string;generation:number;fenceToken:string;
 ownerInstanceId:string;modelRef:SubscriptionModelRefV1;sourceSha:string;worktree:string;
}>;
export type SubscriptionRuntimeClosureV1=Readonly<{
 binding:SubscriptionRuntimeBindingV1;attachmentHash:string;status:'closed'|'custody-uncertain';
 broker:'closed'|'custody-uncertain';worker:'closed'|'custody-uncertain';evidenceRefs:readonly string[];
}>;
export function startSubscriptionCodingRuntimeV1(input:Readonly<{
 binding:SubscriptionRuntimeBindingV1;root:string;prompt:string;transcriptPath:string;signal:AbortSignal;
}>):Promise<Readonly<{worker:SubscriptionCodingOwnedWorkerV1;attachmentHash:string;
 close(reason:SubscriptionAttemptBrokerStopV1):Promise<SubscriptionRuntimeClosureV1>;}>>;
export function verifySubscriptionRuntimeDrainV1(session:ClaimRuntimeSession):
 Promise<SubscriptionRuntimeClosureV1|null>;
export function renderSubscriptionWorkflowPromptV1(input:Readonly<{
 workflowStepId:string;role:string;resolvedInstructions:string;
}>):string;
export function parseSubscriptionWorkflowReportV1(input:Readonly<{
 workflowStepId:string;role:string;assistantText:string;
}>):Readonly<{output:string}>;
```
- [ ] RED owner/transport tests: revoke broker first, original closures, abort/deadline/partial spawn/publication failure, mismatched tuple, idempotent same close promise. Enumerate actual workflow mapping: every intended role inline/output mapping, no worker tmp/bootstrap/CLI/DB, invalid reports refuse. Max report65536 UTF8/no NUL; unsupported role before claim. Parent resolves full context; reports remain claims through existing output contracts/evidence.
- [ ] Add isolated-PG `subscription-runtime-lifecycle-v1.integration.test.ts`: missing closure blocks drain/recovery, locked tuple mismatch, termination beats completion, one release, legacy unchanged. Register OWNER_BACKED_TESTS. RED via `node --import tsx scripts/run-execution-attempt-tests.ts` with new exact files and runtime-session-repository.test.ts.
- [ ] Internal write/readSubscriptionRuntimeAttachmentV1 writes immutable `prepared|worker-bound|closed` tuple/parent identity/activation/Source/policy/preload, then worker identity/port/actual probe hash. Parent runtime_path journal separate/denied to worker. No secrets/capabilities. EXCL+file/directory fsync before effects, exact replay idempotent/conflict refuses, partial creation uncertain.
- [ ] Compose reader→unchanged broker→Task1 material→worker. generationId=`generation-${binding.generation}`; original-closure result1800s lifetime/2500ms drain/1000ms publication, no20s override. Failed acquisition closes known handles; uncertainty quarantines.
- [ ] Strict optional subscriptionClosure in RuntimeDrainEvidenceV1; markDrained/quarantine recovery authenticate locked session/claim/attempt attachment+closure/full tuple. Legacy absence booleans cannot release subscription. Preserve CAS/release/completion; no table/migration. Restart requires original parent absent, original worker absent twice+actual fork-denial provenance; live/unknown parent/partial journal/missing proof quarantines. No PID-death/publication shortcut.
- [ ] Spawner init322–331 chooses Codex/subscription; assertion357–364 generic, ordinary init unchanged. Subscription local_process. At markStarting8171+ retain selected/claim/recovery guards, derive roots, inline full instructions, start owner/durable binding, markRunning real identity, then gate. Publication/cancel race closes both/quarantines current path.
- [ ] ActiveProcess captures owner before risky awaits. Parent maps report to existing output after joint drain; requestRuntimeCompletion/settleExitedClaimAndRuntime remain authority. drainDurableRuntimeSession closes/verifies pair before markDrained; no global OpenClaw tasks for local session. Cover cancel/error/timeout/shutdown; no ambient child env/shared auth/gateway.
- [ ] `subscription-spawner-integration-v1.test.ts` covers actual init/handoff, credential after markStarting/gate after markRunning, whole-role/output mapping, cancel/Codex regression. GREEN once plus runtime-completion, v3-operational-retry-lifecycle, v3-pre-dispatch-failure through dispatcher. Root review/commit.

### Task 6: bounded verification and live handoff

- [ ] New pure/isolated-PG groups once; unchanged broker/readonly behavior uses direct controls unless a new change or failure warrants their suites. Repeat affected failures/changes only. Root credential/OS/crash/join/completion review; serialize fixes/update File Map.
- [ ] Reviewed delivery/stock build in exact clean-main; inspect original exit/capture before repeating interrupted work; no dirty-build/guard bypass.
- [ ] Source result separate from live readiness. Actual provider/credential/OS/service effects unadmitted. Preserve activation/current Source/build/native/DB/exact retained scope; public-Q flags false.
- [ ] Real positive path: protected annual provenance, genuine sandbox/current admission; source-changing filesystem-only/no-child canary, exact model/endpoint, capability-only persistence, joint closure, Setfarm-owned build/runtime evidence and matching DB tuple. Then actual workflow/full8 through existing gates. Fixtures certify no live effects.
- [ ] Preserve history. Fresh route avoids universal retirement but needs service/port custody/historical visibility. Missing primitive/key/native qualification/authority stays explicit refusal; exact dependency, no speculative framework.
