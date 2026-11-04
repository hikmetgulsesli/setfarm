# Annual Subscription Coding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development task by task. One source writer; Root alone stages/commits/delivers. Read design/AGENTS. No worker performs credential/provider/OS/DB/service effects. Tests confer no operational authority.

**Goal:** annual MiniMax/Kimi filesystem-only workers rejoin existing durable evidence/completion.
**Architecture:** pure policy, protected parent broker, sandbox worker, parent attachment; existing lifecycle repositories.
**Tech Stack:** TypeScript ESM, Node22, existing OpenClaw pi, Darwin sandbox-exec, postgres/zod. No dependency additions.
**Spec:** `docs/superpowers/specs/2026-11-04-subscription-operational-integration-design.md`

## Global Constraints

Primary `minimax/MiniMax-M3.1-Flash`; existing bounded retry `kimi/k3.1-pro`. No PAYG/gateway/SDK fallback. Tools exactly `read,write,edit`, workspaceOnly=true. Complete bound handoff in an owned read-only in-worktree file plus short prompt reference/hash; parent report publication; no worker CLI/DB. Preserve Codex/legacy/read-only20s, activation/current-clean-main/selected-DB/native guards. Fixed limits:128 requests,8192 output/524288 total tokens,2097152 request bytes,8388608 response/67108864 total bytes,262144 SSE bytes,1800000/120000/60000 attempt/request/idle ms. No dirty-build/guard bypass. Actual live/provider/credential effects remain unadmitted.

## File Map

Task5B1 isolated lifecycle verification also adds one closed `subscription-runtime` mode in `scripts/run-private-postgres-tests.mjs` and a focused dispatch regression in `scripts/__tests__/private-postgres-test-cluster.test.js`. It reuses the existing owned private-cluster/P3 transport because no test admin URL is present; it never selects the live database or expands command input.

Physical Node compatibility refinement: add `src/execution/subscription-coding-node-libraries-v1.ts` and `tests/execution-attempts/subscription-coding-node-libraries-v1.test.ts`; consume only in existing coding worker/policy and its test. The v4 synthetic original proves an actual denied llhttp dylib dependency after literal-root loader startup is repaired. Derive the current Node's bounded exact dylib/alias/RPATH inventory internally; pin and recheck it, then grant literal read/map paths only. No provisioning refactor, broad Homebrew access or new native framework. The existing public-only inventory is diagnostic data, not admission.

This compatibility slice now passes 32 focused groups, zero skips, fresh Root project no-emit compilation and scoped spec/quality review. Genuine zero-argument public metadata capture resolves the current Node's 25 dylibs and 67 exact alias/canonical read/map paths, rechecks them and closes held descriptors. The real-format fixes add `otool -h` for load-command headers and permit ordinary `@` in formula symlink names. SDK/provider execution and live entry remain unqualified until their own actual outcomes.

The v5 synthetic original crossed the library load and found Node's forbidden implicit host OpenSSL configuration read. Coding material now fixes `OPENSSL_CONF=/dev/null`; parent TLS verification and readonly20s material are unchanged. This adds no host filesystem grant. The exact-environment regression failed before the fix; 37 affected policy/worker/owner groups and fresh no-emit compilation then passed, with scoped peer acceptance. The next synthetic original must still establish actual SDK work.

The v6 original reached genuine nonce-bound READY and the SDK, with original worker/broker closure, but no model request: OpenClaw's missing-temp fallback attempted chmod. The parent now exclusively prepares the fixed owned0700 UID temp leaf under the private worker root and pins it before gate opening. No mode-write or shared-temp permission is added. Regression RED then nineteen worker groups, fresh no-emit compilation and scoped review pass. The v7 capture checks this parent preparation before opening the gate; software output remains unproven until that original finishes.

Create under `src/execution/`: `subscription-coding-policy-v1.ts` (projection/limits), `subscription-parent-credential-v1.ts` (selected guarded facade), `subscription-credential-record-v1.ts` (private record DATA reader), `subscription-coding-worker-policy-v1.ts` (fixed material/scope/protocol/ownership DATA), `subscription-coding-worker-preload-v1.ts` (fixed ESM probe/gate), `subscription-coding-worker-v1.ts` (sandbox/process), `subscription-runtime-attachment-v1.ts` (journal), `subscription-coding-runtime-v1.ts` (joint owner), `subscription-workflow-transport-v1.ts` (inline role/report mapping).

Task5B1 additionally creates `src/execution/subscription-coding-runtime-selected-v1.ts` and `src/execution/subscription-coding-runtime-binding-v1.ts` (import-inert binding/path/drain DATA); it reuses `src/execution/claim-authority.ts` transactionally. Authenticate and persist immutable subscription-start binding/authority in existing runtime JSON, preserving it across later evidence updates. Task5B2 must also update the actual Codex-only service-start gate in `src/server/spawnerctl.ts`; no additional UI is required. Read both authenticated-start seam reports: v2 corrects journal to the worker's sibling directory and retains legitimate stage scratch.
Create `src/installation/selected-model-profile-v1.ts` for the import-inert pure profile projection. Modify `src/installation/fresh-installation-v3-profile-v1.ts`, `src/execution/operational-retry-directive.ts`, `src/evals/convergence-runner.ts` (profile); `src/execution/runtime-session-repository.ts`, `src/spawner.ts` (lifecycle). Matching tests under `tests/execution-attempts/`; existing installation/retry/convergence/repository/completion tests. Task5 control recipe: create `src/installation/selected-convergence-recipe-v1.ts`; modify `src/execution/schemas/manual-control-job-v1.ts`, `src/execution/manual-test-admission-v1.ts`, `src/execution/manual-test-worker-v1.ts`, `src/evals/convergence-runner.ts`, `src/evals/control-evidence-reader-v1.ts`. Mission Control repo: `server/services/fresh-installation-runtime.ts`, `server/services/control-jobs.ts` and their focused tests. Workflow verification gaps: `src/installer/steps/05-setup-build/guards.ts`, `src/installer/step-ops.ts` verify completion seam, `src/installer/steps/12-supervise/guards.ts` (or their existing direct helper), with focused existing module tests. Register new DB lifecycle test OWNER_BACKED_TESTS in `scripts/run-execution-attempt-tests.ts`. Reuse `subscription-runtime-attachment-v1.ts` for the exact shared preparation hash; add the genuine recovery-delivery expiry regression in existing `tests/execution-attempts/runtime-session-repository.test.ts` rather than copying its private fixture.

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
- [x] RED subscription primary/fallback, unknown runtime, sticky drift, Codex argv/fallback refusal, ordinary null. Preserve existing actual Source-extraction tests; new pure projection tests direct import. Production consumers continue through the selected facade. Before running any existing test, inspect transitive imports; isolate or omit DB/provider side effects unless explicitly admitted. Run only `node --import tsx --test tests/installation/selected-model-profile-v1.test.ts tests/installation/fresh-installation-v3-profile.test.ts`. Root rejected the broad commands because their eager imports capture credential-bearing installation/runtime state.
- [x] Implement captured `subscription|codex`, generic sticky API, fixed MiniMax/Kimi, exact Codex. Keep Codex-named compatibility exports; type-only import prevents cycle. Retry passes selection; convergence reads primary. Spawner stays closed pending owner.
- [x] GREEN 17/17 with zero skips (4d8011), full project no-emit TypeScript pass (d0b4f5/15fc0d), scoped review clean (2d83b2a4); Root commit.

### Task 3: protected parent credential

Create selected reader facade plus import-inert filesystem record DATA helper and matching direct fake-store test. No unit test imports the eager selected credential capture. The DATA helper confers no operational admission; the production facade derives its fixed root from genuine selected entry. API:
```ts
export function withSelectedSubscriptionCredentialV1<T>(modelRef:SubscriptionModelRefV1,
 use:(credential:string)=>Promise<T>):Promise<T>;
```
- [x] RED fake-store tests missing/symlink/hardlink/uid/mode/oversize/extra or duplicate keys/model mismatch/replacement/Source drift; callback never runs on invalid input; no secrets/hash/path/raw exception. Run `node --import tsx --test tests/execution-attempts/subscription-parent-credential-v1.test.ts`. Root RED79679c; test-only recursion corrected after c6968c; GREEN0565d4 8/8, project no-emit TSC d9e80c/f1bfb8, scoped review c560a5a5.
- [x] Fixed selected paths/schema from design, no provisioning/path/env/SDK fallback. Follow private-assets descriptor pattern: private canonical ancestors, O_NOFOLLOW/O_NONBLOCK, owned0600 regular single-link4096 bound; stable fd/name dev/ino/mode/uid/gid/nlink/size/mtime/ctime before/after. Canonical JSON.stringify(parsed record)+LF rejects duplicates while allowing member order variation. Exact model and selected entry before/after the read. Finish all file/selection checks and close owned descriptors before invoking the callback. No post-callback validation may discard a successfully acquired broker handle: the runtime owner must retain it before its next guarded await and close it on refusal. Callback directly supplies broker/drops refs; fixed `SUBSCRIPTION_CREDENTIAL_REFUSED`; no JS erasure claim. Fake FD helper confers no production authority.
- [x] GREEN; Root review/commit. Real protected-store provenance remains operational prerequisite within retained approved scope.

### Task 4: real filesystem-only owned worker

Task4 is complete only for the actual fixed filesystem-worker mechanism with a synthetic upstream. Original v8 proves real file bytes, exact final report, original process/streams and broker closure after two calls. Root's outer capture exited1 because its extra replayInvalid=false assertion was wrong: the installed SDK deliberately marks successful mutations unsafe to replay. The original failed verdict is retained unchanged; separate pinned readback and independent semantic review adopt the required mechanics without another run. This grants no provider entitlement, selected-entry admission, live service or whole-workflow credit. Preserve the no-replay flag.

Source correction wave verified: fourteen inert/fake-filesystem groups pass, zero skips; Root project no-emit compilation passes. Independent R1–R6 re-review accepted. The owned READY result exposes frozen actual material/policy/preload/probe/isolation hashes for the Task5 journal before gate opening. Actual sandbox/SDK qualification remains a separate pending result; these unit checks grant no operational readiness.

First physical synthetic qualification refused before child acquisition or any model request: the existing public `/opt/homebrew/lib` ancestor is owned by the current user, admin GID80, mode0775. The causal compatibility fix has a dedicated public-runtime walker with only that exact exception, held ancestor descriptor/name/stat checks and isolation binding. Every private/worktree/authority/control/transcript guard remains unchanged; no host permissions were modified. New regression RED then fifteen-group GREEN and project no-emit pass; scoped review accepted. A fresh synthetic original is required after this source correction.

Create worker/matching test. API:
```ts
export type SubscriptionCodingOwnedWorkerV1=SubscriptionOwnedWorkerV1 & Readonly<{
 child:ChildProcess;processIdentity:ProcessIdentityV1;openGate():void;isolationHash:string;
}>;
export function launchSubscriptionCodingWorkerV1(input:Readonly<{
 material:SubscriptionCodingMaterialV1;transcriptPath:string;authorityRoots:readonly string[];
 writeGrants:readonly Readonly<{path:string;kind:"file"|"directory"}>[];readOnlyControlPaths:readonly string[];
}>):Promise<SubscriptionCodingOwnedWorkerV1>;
```
- [ ] RED actual-policy tests: deny fork/same-Node spawn; exact broker outbound only/no inbound; credentials/journal/authority denied; only canonical claimed write grants writable; empty grants mean read-only SDK and no workspace writes; parent handoff controls/structural ancestors protected. Private SDK state remains writable. Reject aliases/.git/symlink/overlap. Original closure tests: exit without streams-close pending, PID reuse never signaled. Run `node --import tsx --test tests/execution-attempts/subscription-coding-worker-v1.test.ts`.
- [ ] Parent derives authority roots, pins real Node/OpenClaw JS entry, refuses wrappers. Materialize EXCL0600/0700/no-follow. Direct sandbox-exec→Node `--import <fixed-gate.mjs> <pinned-entry> ...argv` with top-level await, exact env/FD3 gate. Nonce-bound preload probes deny same-Node fork/credential-parent read/authority write/public and nonbroker-loopback, broker TCP succeeds without provider request. EOF/abort exits.
- [ ] SBPL permits initial pinned Node exec, denies fork and nonpinned exec/outside signals/info/inbound/host writes/authority reads; permits exact broker/minimum runtime/package reads/worktree/state. Genuine OS/runtime/CLI-child dependency failure refuses. The actual applied profile, same-Node spawn denial and nonpinned-exec denial qualify the admitted filesystem-only SDK interface; they do not claim every possible native fork syscall was exercised. No new native helper framework. Actual probe evidence before gate; fixtures/booleans confer no qualification. No preview-policy change or public-Q executor.
- [ ] Original process/streams captured immediately; identity-bound TERM→KILL after2s; ack is no closure. GREEN pure/fake test; actual qualification separately admitted. Root review/commit.

### Task 5: durable joint owner and production integration

Task5A owner/journal mechanics are implemented and reviewed: nineteen direct inert/fake-store groups pass with zero skips, full project no-emit compilation passes, independent spec/quality review approves. Real owner strings retain hostname:pid:UUID. Late worker rejection retains the actual branded partial owner even after shutdown wins; the runtime's own refusal ownership cannot be mistaken for a worker. Synchronous filesystem/process observation can delay event-loop timers; no hard wall-clock guarantee is claimed. Production selected acquisition, repository authentication, spawner and report publication remain Task5B, followed by shared Setfarm/Mission Control recipes. No live readiness is implied.

Task5B1 now has authenticated starting/running lookup, immutable existing-JSON start seed, genuine selected acquisition, an async gate bound to the actual published worker identity, and original joint closure checks. Root direct binding/changed attachment checks pass 17/17, zero skips; fresh project no-emit compilation and independent final source review pass; actual owned-PG33 now passes 33/33 with zero skips, private DB quiescence and original test/server closure. The additional existing recovery-suite case remains explicitly unrun. Restart without retained originals stays quarantined; automatic absence-based restart recovery is outside this slice. Task5B2 spawner/report transport remains pending.

Create attachment/runtime/transport/tests; modify repository/spawner/dispatcher. APIs:
```ts
export type SubscriptionRuntimeBindingV1=Readonly<{
 runtimeSessionId:string;claimId:number;
 ownerInstanceId:string;modelRef:SubscriptionModelRefV1;sourceSha:string;worktree:string;
}> & (Readonly<{kind:'execution-attempt';attemptId:string;generation:number;fenceToken:string}>
 | Readonly<{kind:'stage-claim';attemptId?:never;generation?:never;fenceToken?:never}>);
export type SubscriptionRuntimeClosureV1=Readonly<{
 binding:SubscriptionRuntimeBindingV1;attachmentHash:string;status:'closed'|'custody-uncertain';
 broker:'closed'|'custody-uncertain';worker:'closed'|'custody-uncertain';evidenceRefs:readonly string[];
}>;
export function acquireSubscriptionCodingRuntimeV1(input:SubscriptionCodingRuntimeInputV1,
 acquisition:SubscriptionCodingRuntimeAcquisitionV1):Promise<SubscriptionCodingRuntimeV1>;
export function startSelectedSubscriptionCodingRuntimeV1(input:Readonly<{
 envelope:ClaimEnvelopeV1;authority:SubscriptionCodingCanonicalAuthorityV1;
 runtimeSessionId:string;ownerInstanceId:string;recoveryFence?:RecoveryRuntimeLeaseFence;signal:AbortSignal;
}>):Promise<Omit<SubscriptionCodingRuntimeV1,'openGate'> & Readonly<{openGate():Promise<void>}>>;
export function renderSubscriptionWorkflowPromptV1(input:Readonly<{
 claim:ClaimEnvelopeV1; authority:V3ImplementationContextV1|V3StageClaimHandoffV1;
 handoffRef:Readonly<{path:string;bytes:number;sha256:string}>;
}>):string;
export function parseSubscriptionWorkflowReportV1(input:Readonly<{
 claim:ClaimEnvelopeV1;authority:V3ImplementationContextV1|V3StageClaimHandoffV1;assistantText:string;
}>):Readonly<{output:string}>;
```
- [ ] RED owner/transport tests: revoke broker first, original closures, abort/deadline/partial spawn/publication failure, mismatched tuple, idempotent same close promise. Enumerate actual workflow mapping: every intended role inline/output mapping, no worker tmp/bootstrap/CLI/DB, invalid reports refuse. Max report65536 UTF8/no NUL; unsupported role before claim. Feature-dev pairs: plan/planner, design/designer, stories/planner, setup-repo/setup-repo, setup-build/setup-build, implement/developer, verify/reviewer, supervise/supervisor, security-gate/security-gate, qa-test/qa-tester, final-test/tester, deploy/deployer. Derive canonical filesystem authority: none maps to zero write grants, claim-source maps to exact slice/recovery paths, bootstrap requires its actual policy. Parent resolves the complete validated canonical implementation/stage handoff (not only resolvedInput), stores unchanged bytes under protected .setfarm claim metadata, and supplies a short path/hash reference within the existing CLI prompt cap. No truncation or arbitrary capacity widening. Preserve V3 implementation max512KiB proposal and typed PLAN output; other roles keep existing module formats. Successful SDK-envelope payload extraction must be added; existing terminal helper drops successful text. Reports remain claims through existing output contracts/evidence.
- [ ] Add isolated-PG `subscription-runtime-lifecycle-v1.integration.test.ts`: missing closure blocks drain/recovery, locked tuple mismatch, termination beats completion, one release, legacy unchanged. Register OWNER_BACKED_TESTS. RED via `node --import tsx scripts/run-execution-attempt-tests.ts` with new exact files and runtime-session-repository.test.ts.
- [ ] Internal write/readSubscriptionRuntimeAttachmentV1 writes immutable `prepared|worker-bound|closed` tuple/parent identity/activation/Source/policy/preload, then worker identity/port/actual probe hash. Parent runtime_path journal separate/denied to worker. No secrets/capabilities. EXCL+file/directory fsync before effects, exact replay idempotent/conflict refuses, partial creation uncertain.
- [ ] Compose reader→unchanged broker→Task1 material→worker. Genuine execution attempt uses generationId=`generation-${binding.generation}`; real stage claims use explicitly labelled claim/runtime-derived broker identities without inventing an execution-attempt row or fence. Original-closure result1800s lifetime/2500ms drain/1000ms publication, no20s override. Failed acquisition closes known handles; uncertainty quarantines.
- [ ] Strict optional subscriptionClosure in RuntimeDrainEvidenceV1; markDrained/quarantine recovery authenticate locked session/claim/attempt attachment+closure/full tuple. Legacy absence booleans cannot release subscription. Preserve CAS/release/completion; no table/migration. Restart requires original parent absent, original worker absent twice+actual fork-denial provenance; live/unknown parent/partial journal/missing proof quarantines. No PID-death/publication shortcut.
- [ ] Spawner init322–331 chooses Codex/subscription; assertion357–364 generic, ordinary init unchanged. Subscription local_process. At markStarting8171+ retain selected/claim/recovery guards, derive roots and canonical tool-authority/slice write grants (none means SDK read-only), prepare protected complete handoff plus short prompt reference, start owner/durable binding, markRunning real identity, then gate. Publication/cancel race closes both/quarantines current path.
- [ ] ActiveProcess captures owner before risky awaits. Parent maps report to existing output after joint drain; requestRuntimeCompletion/settleExitedClaimAndRuntime remain authority. drainDurableRuntimeSession closes/verifies pair before markDrained; no global OpenClaw tasks for local session. Cover cancel/error/timeout/shutdown; no ambient child env/shared auth/gateway.
- [ ] `subscription-spawner-integration-v1.test.ts` covers actual init/handoff, credential after markStarting/gate after markRunning, whole-role/output mapping, cancel/Codex regression. GREEN once plus runtime-completion, v3-operational-retry-lifecycle, v3-pre-dispatch-failure through dispatcher. Root review/commit.

#### Task5 causal consumer refinements

Task5C shared Setfarm recipes now pass thirteen focused Root checks, zero skips, fresh project no-emit compilation and independent source review. Mission Control uses the same compiled facade. Its independent activation/UI/history/evidence/cancel capabilities remain available when the optional full8 model profile is unavailable or drifts; new full8 launches alone require the captured profile before mutation/spawn. Old fixed Codex suite metadata never supplies fallback model execution. Full MC verification retains six old negative-profile fixtures for adaptation to the earlier rejection boundary.

B2 refinements from actual installed SDK and production Source:
- Retain the exact original claim envelope in ActiveProcess; reconstructed issuedAt/input cannot replace the immutable start seed. Invoke the fixed handoff materializer inside the genuine facade, with no caller prompt/path override.
- Preserve the existing 1MiB control-file and 256-path caps. Plan raw canonical UTF8 fragments and decoded instruction/previous-output readable parts, each at most 40KiB, with ordered offsets, per-part/full hashes and line counts. Their concatenation preserves complete canonical bytes. All files are private, protected controls. If worst-case expansion cannot fit existing caps, refuse capacity before directory/key/broker effects; never truncate or widen prompt capacity. No bash-dependent read instructions.
- Ordinary V3 supervise is a genuine stage claim without an attempt. Implement-step supervisor_repair keeps its actual implementation attempt and JSON format. Correct the spawner-prompt requirement by workflowStepId rather than fabricating an implementation handoff for ordinary supervise.
- A small fixed internal supervisor scope resolver reuses current bound-subject authority and actual accepted/effects_committed terminal compiler contexts to derive explicit owned/shared_writable paths; final-product scope is an explicit union. Historical attempts supply slice contracts only. Recheck authentic subject/contracts before worker gate; missing or ambiguous authority refuses.
- Extend the existing canonical/implementation evidence runner with a discriminated supervise stageClaim identity, fixed artifact namespace and hashed envelope/runtime/request/output/bound-subject/current source/slice/plan binding. Omit bundle.attemptId and reuse existing nullable bundle storage. Authenticate actual executing completion owner/RCR DB-clock lease, drained runtime and bound subject before/after execution; gate pass/fixed before owner commit with mandatory fresh evidence. Preserve implementation behavior and QA/final routing. No new evidence schema, runner framework, table or invented lease.

- Actual `ClaimEnvelopeV1` forbids attempt fields on nonstory stages. Use the honest discriminated binding above, reuse existing `assertClaimAuthority` transactionally, and authenticate starting/running runtime owner/paths/lease before gate. Platform Source is selected installation origin, not generated-project sourceBefore. Preserve launcher's exclusive worker-root/transcript creation: the selected branch must skip legacy transcript precreation. Exact caller/local mapping: `.superpowers/sdd/subscription-operational-integration-20261104-v1/task-5b-authenticated-start-seam.md`.

- Complete owner/repository integration, workflow transport/publication, and selected control recipes as separately reviewable serial source slices. Do not create a generic command RPC.
- Actual local SDK output is bare `{payloads,meta}`, not always the existing `{runId,status,result}` wrapper. The successful report parser must handle the observed local format, retain exact session/model joins and real completion/abort/error checks, and preserve `replayInvalid:true` after completed mutation as a no-automatic-replay signal. It is not a completion failure. The SDK's default `livenessState:working` also is not proof of a live process; original ownership remains authoritative.
- Preserve every supported feature-dev role contract. Setup-build must refresh repaired design-validator evidence before its existing build; verify needs bounded owned premerge configured command evidence; supervisor edits need fresh owned candidate/evidence before pass. QA/final smoke and V3 deploy are already platform-owned; preserve them. Exact source map: `.superpowers/sdd/subscription-operational-integration-20261104-v1/task-5-role-transport-seam.md`.
- The shared compiled facade `installation/selected-convergence-recipe-v1.js` exposes async zero-argument `captureSelectedConvergenceRecipeV1()`, returning the fixed suite path, selected execution profile, nonsecret worker environment and synchronous captured `assertUnchanged`. Its pure projection module remains import-inert and lazily loads the genuine selected facade only on capture. Mission Control awaits and pins it.
- Annual full8 must use existing `evals/suites/product-convergence-minimax-m31-flash-v1.json`; old Codex suite/receipts stay unchanged. One trusted selected-profile-derived recipe API is shared by manual-control schema/admission/worker, convergence CLI, evidence reader and Mission Control fresh-runtime/control-jobs. Historical readback resolves persisted suite hashes against the two pinned recipes, never substitutes the current one. Exact map: `.superpowers/sdd/subscription-operational-integration-20261104-v1/task-5-mc-selected-profile-seam.md`. No new UI/route or arbitrary suite path.

### Task 6: bounded verification and live handoff

- [ ] New pure/isolated-PG groups once; unchanged broker/readonly behavior uses direct controls unless a new change or failure warrants their suites. Repeat affected failures/changes only. Root credential/OS/crash/join/completion review; serialize fixes/update File Map.
- [ ] Reviewed delivery/stock build in exact clean-main; inspect original exit/capture before repeating interrupted work; no dirty-build/guard bypass.
- [ ] Source result separate from live readiness. Actual provider/credential/OS/service effects unadmitted. Preserve activation/current Source/build/native/DB/exact retained scope; public-Q flags false.
- [ ] Real positive path: protected annual provenance, genuine sandbox/current admission; source-changing filesystem-only/no-child canary, exact model/endpoint, capability-only persistence, joint closure, Setfarm-owned build/runtime evidence and matching DB tuple. Then actual workflow/full8 through existing gates. Fixtures certify no live effects.
- [ ] Preserve history. Fresh route avoids universal retirement but needs service/port custody/historical visibility. Missing primitive/key/native qualification/authority stays explicit refusal; exact dependency, no speculative framework.
