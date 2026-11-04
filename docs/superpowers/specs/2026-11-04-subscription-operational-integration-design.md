# Annual subscription coding integration design

Baseline: sole writer W, branch `fix/subscription-operational-integration-20261104`, HEAD `d98b2caa8dde643692d66208dfd1fa9096687822`. Finish selected-runtime → reserved claim → worker → durable completion. Selected profile/spawner are Codex-only; broker/read-only material/20s custody are preparatory. Source completion and operational activation are separate outcomes.

Decision: filesystem-only coding worker with exactly Read/Write/Edit. Existing `step-ops` → implement-evidence-runner → stack-driver build/test/browser/runtime feedback remains. Read-only20s cannot edit source; ambient gateway inherits unsafe auth/config; shell/native distribution expansion is unnecessary. No extra UI/diagnostics, Task6A continuation or old-project rescue.

## Selection and workflow transport

Capture selected runtime once. `codex` retains exact model argv/fallback refusal. `subscription` fixes primary `minimax/MiniMax-M3.1-Flash`, bounded retry `kimi/k3.1-pro`; retry/convergence use same generic profile. Drift sticks refused. Change spawner initialization322–331 AND assertion357–364; no hidden Codex/gateway/PAYG fallback.

Join exact claimId/runtimeSessionId/ownerInstanceId/model/platform Source/worktree before launch, publication and completion. An `execution-attempt` binding additionally carries the genuine attemptId/numeric generation/fenceToken; its broker generationId=`generation-${generation}`. A `stage-claim` has no execution-attempt fields: nonstory PLAN/setup claims genuinely have no execution_attempt row. Its broker-only identity is explicitly stage-labelled and derived from claim/runtime IDs, never asserted as a DB execution attempt. Reject mixed binding shapes. Preserve existing claim and runtime authority checks for both kinds.

Current `/tmp` claim/bootstrap/output and shell completion instructions conflict with workspaceOnly filesystem tools. Parent stores the complete validated canonical implementation/stage handoff unchanged in an owned read-only file inside the claimed workspace; a short prompt carries its exact reference/hash within the existing CLI prompt cap. This preserves legitimate large stage context without truncation or large argv. No worker CLI/DB/bootstrap calls; final assistant reports retain their existing typed/STATUS contracts and map to exact existing output. Parent publishes only after joint drain through fenced completion. Report remains a claim checked by Setfarm-owned evidence. Explicit mapping/tests cover every intended workflow role; unsupported roles refuse before claim. workspaceOnly=true remains.

## Coding policy and credential

First releasable module `subscription-coding-policy-v1.ts` reuses validated readonly projection into separate immutable `subscription-coding-files-v1`. Preserve original material/custody. Change tools to `read,write,edit`, all workspace/cwd locations to claimed worktree,1800s timeout,8192 maxTokens,200000 context, empty fallbacks. Private HOME/config/auth remain capability-only. Projection proves no physical custody/admission.

Fixed broker limits:128 requests;8192 output/524288 total tokens;2097152 request bytes;8388608 response/67108864 total response bytes;262144 SSE bytes;1800000/120000/60000 attempt/request/idle ms. Local reservations are not entitlement claims.

`withSelectedSubscriptionCredentialV1(modelRef,use)` derives selected installation `credentials/coding-subscriptions/{minimax,kimi}.json`, exact `{schema:"setfarm.subscription-credential.v1",providerId,modelRef,credential}`. No path/env/SDK fallback/provisioning. Require private canonical ancestors, owned0600 regular single-link file, O_NOFOLLOW,4096 bound, stable fd/name identity, exact model and sanitized errors. Parent supplies unchanged broker directly then drops references; no JS erasure claim or secret/hash/path publication. Actual key provenance/annual entitlement still need real evidence.

## Genuine owned worker

Implement coding-specific Darwin adapter, leaving preview sandbox unchanged. Direct `/usr/bin/sandbox-exec` → pinned Node/OpenClaw JS entry, no shell/override. Fixed ESM preload uses Node --import with top-level await for probes and the parent FD3 gate before CLI. Asynchronous CommonJS --require cannot provide this ordering. Allow initial exec of the pinned Node; deny fork and nonpinned exec, inbound, outside signals/info, host writes, authority/credential reads. Same-Node child-spawn denial needs actual proof; the Node exception is not universal exec denial. Allow only exact broker127.0.0.1 port outbound, minimum trusted runtime/package reads, private worker state and claimed canonical worktree. Resolve `.git` indirection; reject authority overlap/symlink escape.

Actual nonce-bound probes before CLI gate must deny parent credential reads, authority writes, same-Node spawn/fork, public/nonbroker-loopback; broker TCP reachability succeeds without provider request. Missing OS/native/runtime qualification, CLI child dependency or ambiguity refuses. Tests/caller flags confer no readiness. Public Q parent stays fixed public reader; all six authority flags false.

Capture original process close, both streams and exact identity. Exit/stop ack is insufficient. Proven fork denial prevents descendants; failed proof keeps gate shut. Parent solely owns broker/secret. Revoke capability before worker stop, await originals within2500ms; publication1000ms/lifetime1800s. Preserve old20s custody.

## Durable ownership

Reuse runtime_sessions.runtime_path for parent-only immutable attachment records; no table/migration. EXCL0600+file/directory fsync binds full tuple, activation/Source, parent identity/policy before broker creation. Worker record adds real identity/port/probe hash before gate. Journal separate from worker state and denied to worker. Gate opens only after markRunning.

Extend strict RuntimeDrainEvidenceV1 optional subscription closure. Subscription markDrained/quarantine recovery authenticate attachment/closure against locked claim/attempt; legacy absence-only evidence cannot release it. Existing start/drain/completion/release CAS stays authoritative. Journal publication is not absence proof.

Live drain closes both. Restart infers in-process broker closure only from authenticated original parent absent; requires worker absence twice with actual fork-denial provenance. Live/unknown parent, partial creation, reused PID, missing streams/proof/timeouts quarantine. No foreign PID signals, fabricated release or success inference from closure.

## Verification and dependencies

Direct regressions, isolated-PG lifecycle, scoped review and stock clean-main build precede real effects. Current credential/provider/OS/service effects are unadmitted. Keep activation/current-clean-main/selected-DB/native guards. Operational success needs protected annual provenance, genuine sandbox qualification, whole-role transport, admitted source-changing canary and Setfarm-owned evidence/completion. Missing prerequisite remains explicit refusal.

Fresh installation avoids universal legacy retirement; actual service/port custody and historical visibility remain rollout obligations. Preserve old records. Source tests do not certify cutover/full8; no larger release framework is needed for this subsystem.

## Root scope decisions

Task1 and Task2 source work are adopted under the existing annual-model coding objective. Remaining tasks describe implementation requirements, not authorization for live effects. Task2 adds an import-inert pure profile projection because the selected-installation facade captures credential-bearing selection at import; direct tests use the pure module, while actual production consumers use the selected facade. Existing Codex compatibility exports retain their semantics. Whole-role report mapping and genuine CLI fork-denial compatibility must be resolved before operational activation. Closed public Parent and old unit tours are not repeated.

Task3 uses an import-inert filesystem record DATA reader for direct fake-store tests, with the selected guarded facade as its production caller. The DATA reader provides no operational authority. Complete file/selection checks and close descriptors before the credential callback; the callback owner retains any acquired broker before further validation, so a later refusal cannot lose its cleanup handle. No existing credential is read or provisioned by this source change.

Task3 record bytes use JSON.stringify(parsed record)+LF, allow member-order variation, and reject duplicate keys. Real Node BigIntStats fields are checked, including birthtimeNs; BSD st_flags is not exposed and is not claimed observed. The one-shot test replacement hook separates fixture operations from source descriptor ownership; its initial recursion failure is retained as test provenance.

Task4 uses the actual applied process-fork-denying policy plus genuine same-Node child-process creation and nonpinned-exec denial probes for the admitted filesystem-only SDK interface. It does not claim an exercised universal native-fork syscall proof or add a new native helper framework. The runtime admits no exec/plugin/child tool and makes no whole-host zero-owner claim. Failed or ambiguous probes keep the CLI gate shut. Closure still requires the original process, both streams, and matching applied-policy/probe/source identity.

Task5 causal consumer audit: successful SDK payload text is not currently published, and three existing role verification gaps (repaired design validation, configured premerge commands, supervisor after-edit evidence) must be covered by owned platform checks. No generic command RPC or replacement evidence pipeline. Mission Control and five Setfarm control consumers genuinely pin Codex; a single selected recipe API selects the existing annual MiniMax suite, preserving old Codex suite/receipts and persisted historical suite hashes. These are required integration consumers, with no additional UI feature.
