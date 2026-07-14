import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spawnerSource = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf8");
const stepOpsSource = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf8");

function sourceBlock(startMarker: string, endMarker: string): string {
  const start = spawnerSource.indexOf(startMarker);
  const end = spawnerSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `source marker missing: ${startMarker}`);
  assert.notEqual(end, -1, `source end marker missing: ${endMarker}`);
  return spawnerSource.slice(start, end);
}

describe("durable recovery coordinator source boundaries", () => {
  it("carries the exact recovery lease token into the tracked runtime owner", () => {
    assert.match(stepOpsSource, /recoveryLeaseToken:\s*handoff\.lease\.leaseToken/);
    const trackedOwner = sourceBlock(
      "const activeProcess: ActiveProcess = {",
      "let processExited = false;",
    );
    assert.match(trackedOwner, /recoveryLeaseToken:\s*claim\.recoveryLeaseToken/);
  });

  it("heartbeats recovery ownership before runtime guards and drains expired owners before one follow-up pass", () => {
    const reaper = sourceBlock(
      "async function reapFinishedClaims(): Promise<void> {",
      "function spawnAgent(agentId: string, wfId: string, role: string): void {",
    );
    const heartbeat = reaper.indexOf("heartbeatRunningV3RecoveryOwner(active)");
    const firstRuntimeGuard = reaper.indexOf("implementPackageScopeDirtyGuard(active)");
    assert.ok(heartbeat >= 0 && firstRuntimeGuard > heartbeat, "owner heartbeat must precede model-runtime guards");
    assert.match(reaper, /V3 recovery owner[\s\S]*terminateActiveProcess\(active, "v3-recovery-owner-lease-lost", false\)/);

    const lifecycle = sourceBlock(
      "async function reconcileV3RecoveryLifecycle(): Promise<void> {",
      "async function runV3EvidenceOnlyRecovery(): Promise<void> {",
    );
    assert.match(lifecycle, /event\.action !== "request_runtime_drain"/);
    assert.match(lifecycle, /await drainDurableRuntimeSession\(session/);
    assert.match(lifecycle, /reports\.push\(await reconciler\.reconcileActive\(\{ runId, limit: 100 \}\)\)/);
  });

  it("publishes output-file recovery as a RuntimeCompletionRequest instead of directly completing", () => {
    const recovery = sourceBlock(
      "async function completeRunningClaimFromOutputFile(",
      "async function completeActiveClaimFromOutputFile(",
    );

    assert.doesNotMatch(
      recovery,
      /\bcompleteStep\s*\(/,
      "a durable output-file recovery must not mutate product state before its runtime is drained",
    );
    assert.match(
      recovery,
      /requestRuntimeCompletion\s*\(|publishRuntimeCompletion\w*\s*\(/,
      "output-file recovery must publish the exact claim/output proposal to the manager-owned completion queue",
    );
  });

  it("publishes recovered implement work instead of directly completing its durable claim", () => {
    const recovery = sourceBlock(
      "async function tryRecoverExitedImplementWork(",
      "async function cleanupQuiescedStoryWorktree(",
    );

    assert.doesNotMatch(
      recovery,
      /\bcompleteStep\s*\(/,
      "build-passing recovered work is still only a proposal until the durable runtime is drained",
    );
    assert.match(
      recovery,
      /requestRuntimeCompletion\s*\(|publishRuntimeCompletion\w*\s*\(/,
      "recovered implement output must enter the same canonical completion request path as agent output",
    );
  });

  it("keeps the compatibility completion fallback behind one canonical publication helper", () => {
    const publisher = sourceBlock(
      "async function publishRuntimeCompletionProposal(",
      "async function publishRuntimeCompletionIfPresent(",
    );

    assert.match(publisher, /requestRuntimeCompletion\s*\(/);
    assert.match(
      publisher,
      /submission\.status\s*!==\s*"direct"[\s\S]*return\s*\{\s*managed:\s*true/,
      "a managed runtime must return through the durable completion path",
    );
    assert.match(
      publisher,
      /return\s*\{\s*managed:\s*false,\s*result:\s*await\s+completeStep\s*\(/,
      "only the explicit unmanaged compatibility result may use legacy direct completion",
    );
  });

  it("keeps exit handling on the durable completion publication path", () => {
    const recovery = sourceBlock(
      "async function failClaimIfStillRunning(",
      "function detectRuntimeApprovalPending(",
    );

    assert.doesNotMatch(recovery, /\bcompleteStep\s*\(/);
    assert.match(
      recovery,
      /requestRuntimeCompletion\s*\(|publishRuntimeCompletion\w*\s*\(/,
      "exit recovery must publish or delegate to an explicitly named completion publisher before retry/failure routing",
    );
  });

  it("excludes every durably owned claim from generic startup stale recovery", () => {
    const recovery = sourceBlock(
      "async function failStaleRunningClaimsFromPreviousSpawner(",
      "async function requeueStaleRunningClaimFromPreviousSpawner(",
    );
    const staleSelectionEnd = recovery.indexOf("for (const row of rows)");
    assert.notEqual(staleSelectionEnd, -1, "startup stale-claim selection boundary missing");
    const staleSelection = recovery.slice(0, staleSelectionEnd);

    assert.match(staleSelection, /NOT EXISTS[\s\S]*runtime_sessions/i);
    assert.match(
      staleSelection,
      /runtime_sessions[\s\S]*state\s*(?:<>\s*'released'|NOT IN\s*\(\s*'released'\s*\))/i,
      "all non-released runtime states, including unexpired processing ownership, fence generic stale recovery",
    );
    assert.match(staleSelection, /NOT EXISTS[\s\S]*runtime_completion_requests/i);
    assert.match(
      staleSelection,
      /runtime_completion_requests[\s\S]*state\s+(?:IN\s*\(\s*'requested'\s*,\s*'draining'\s*,\s*'processing'\s*\)|NOT IN\s*\(\s*'accepted'\s*,\s*'rejected'\s*,\s*'quarantined'\s*\))/i,
      "requested, draining, and processing completion requests fence generic stale recovery without a lease-age exception",
    );
    assert.match(staleSelection, /NOT EXISTS[\s\S]*run_termination_requests/i);
    assert.match(staleSelection, /run_termination_requests[\s\S]*state\s*<>\s*'terminalized'/i);
  });

  it("awaits every lifecycle processor before shutdown releases ownership", () => {
    const shutdown = sourceBlock(
      "const shutdown = (): Promise<number> =>",
      "process.on(\"SIGTERM\"",
    );
    const release = shutdown.indexOf("releaseActiveProcessForShutdown");
    assert.ok(release >= 0, "shutdown release boundary missing");
    const beforeRelease = shutdown.slice(0, release);

    const awaitsCompletion = /await runtimeCompletionProcessPromise/.test(beforeRelease);
    const awaitsTermination = /await (?:processRunTerminationRequests\s*\(|[A-Za-z_$][\w$]*Termination[\w$]*Promise)/.test(beforeRelease);
    const awaitsUnifiedCoordinator = /await runRecoveryCoordinator\.join\(\)/.test(beforeRelease)
      || /await (?:process[A-Za-z_$][\w$]*(?:Recovery|Lifecycle|Coordinator)[\w$]*\s*\(|[A-Za-z_$][\w$]*(?:Recovery|Lifecycle|Coordinator)[\w$]*Promise)/.test(beforeRelease);
    assert.ok(
      awaitsUnifiedCoordinator || (awaitsCompletion && awaitsTermination),
      "shutdown must await termination work too, or await one coordinator that owns both request classes",
    );
  });

  it("preserves an untracked drained session as a durable handoff instead of quarantining it", () => {
    const shutdown = sourceBlock(
      "const shutdown = (): Promise<number> =>",
      "process.on(\"SIGTERM\"",
    );
    const remainingStart = shutdown.indexOf("for (const session of remaining)");
    const close = shutdown.indexOf("await pgClose()", remainingStart);
    assert.ok(remainingStart >= 0 && close > remainingStart, "untracked-runtime shutdown sweep missing");
    const remaining = shutdown.slice(remainingStart, close);
    const drainedHandoff = remaining.search(
      /session\.state\s*===\s*"drained"[\s\S]{0,1200}(?:continue\s*;|preserv\w*|handoff\w*)/,
    );
    const quarantine = remaining.indexOf("runtimeSessions.quarantine(");

    assert.ok(
      drainedHandoff >= 0 && (quarantine < 0 || drainedHandoff < quarantine),
      "a proven drained session must remain recoverable by its open completion/termination request across shutdown",
    );
  });

  it("runs every termination candidate through the bounded per-request error boundary", () => {
    const processor = sourceBlock(
      "async function runRunTerminationProcessor(",
      "async function runOperationalOutboxProcessor(",
    );
    assert.match(processor, /return processRunTerminationBatch\(\{/);
    assert.match(processor, /async process\(candidate\)/);
    assert.match(processor, /async quarantine\(candidate, diagnostic\)/);
    assert.match(processor, /candidate\.state === "drained"[\s\S]*terminations\.terminalize/);
  });
});
