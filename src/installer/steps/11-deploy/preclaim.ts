import { execFileSync } from "node:child_process";
import os from "node:os";
import type { ClaimContext } from "../types.js";
import { getSql, pgGet } from "../../../db-pg.js";
import {
  assertV3DeployAuthority,
  V3DeployAuthorityError,
} from "../../../execution/v3-deploy-authority.js";
import { createPostgresV3DeployExecutor } from "../../../execution/v3-deploy-executor.js";
import type { V3DeployReceiptV1 } from "../../../execution/schemas/v3-deploy-receipt-v1.js";
import { V3DeployPublicationPendingError } from "../../../execution/v3-deploy-publication.js";
import { logger } from "../../../lib/logger.js";
import { missionControlApi, runtimeConfig } from "../../../runtime-config.js";
import { recordGateObservation, recordStackEvidencePlanObservation } from "../../operation-observability.js";
import { resolveOperationalStackContract, stackEvidenceMetadata } from "../../stack-evidence.js";

export interface DeployCapabilitySnapshot {
  platform: NodeJS.Platform | string;
  localMissionControl: boolean;
  localSystemctl: boolean;
  remoteHost: string;
  remoteReachable: boolean;
  deployRequired: boolean;
  deployDisabled: boolean;
}

export interface DeployCapabilityDecision {
  shouldSkip: boolean;
  mode: "local" | "remote" | "disabled" | "unavailable" | "required";
  reason: string;
}

function isTruthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function commandSucceeds(command: string, args: string[], timeoutMs: number): boolean {
  try {
    execFileSync(command, args, { timeout: timeoutMs, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string): boolean {
  return commandSucceeds("sh", ["-lc", `command -v ${shellQuote(command)} >/dev/null 2>&1`], 2_000);
}

function localMissionControlAvailable(): boolean {
  if (!commandExists("curl")) return false;
  return commandSucceeds("curl", ["-fsS", "--max-time", "2", missionControlApi("/api/projects/next-port")], 4_000);
}

function localSystemctlAvailable(): boolean {
  if (!commandExists("systemctl")) return false;
  return commandSucceeds("systemctl", ["--user", "is-system-running"], 4_000)
    || commandSucceeds("systemctl", ["--user", "list-units", "--type=service", "--no-pager"], 4_000);
}

function remoteDeployHostReachable(host: string): boolean {
  if (!host || !commandExists("ssh")) return false;
  const script = [
    "command -v systemctl >/dev/null 2>&1",
    `curl -fsS --max-time 3 ${shellQuote(runtimeConfig.missionControlInternalUrl + "/api/projects/next-port")} >/dev/null 2>&1`,
  ].join(" && ");
  return commandSucceeds("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, script], 8_000);
}

function configuredRemoteHost(ctx: ClaimContext): string {
  return (
    ctx.context["deploy_host"]
    || ctx.context["DEPLOY_HOST"]
    || process.env.SETFARM_DEPLOY_HOST
    || process.env.SETFARM_DEPLOY_SSH_HOST
    || ""
  ).trim();
}

export function evaluateDeployCapability(snapshot: DeployCapabilitySnapshot): DeployCapabilityDecision {
  if (snapshot.deployDisabled) {
    return {
      shouldSkip: true,
      mode: "disabled",
      reason: "Deployment is disabled by SETFARM_DISABLE_DEPLOY.",
    };
  }

  if (snapshot.localMissionControl && snapshot.localSystemctl) {
    return {
      shouldSkip: false,
      mode: "local",
      reason: "Local deployment services are available.",
    };
  }

  if (snapshot.remoteHost && snapshot.remoteReachable) {
    return {
      shouldSkip: false,
      mode: "remote",
      reason: `Remote deployment host ${snapshot.remoteHost} is reachable.`,
    };
  }

  const missing = [
    snapshot.localMissionControl ? "" : `Mission Control is not reachable at ${runtimeConfig.missionControlInternalUrl}`,
    snapshot.localSystemctl ? "" : "local systemd user services are unavailable",
    snapshot.remoteHost
      ? `remote deploy host ${snapshot.remoteHost} is not reachable or lacks deploy services`
      : "no SETFARM_DEPLOY_HOST or deploy_host context is configured",
  ].filter(Boolean);

  if (snapshot.deployRequired) {
    return {
      shouldSkip: false,
      mode: "required",
      reason: `Deployment is required but capability checks failed: ${missing.join("; ")}.`,
    };
  }

  return {
    shouldSkip: true,
    mode: "unavailable",
    reason: `Deployment infrastructure is unavailable in this workspace: ${missing.join("; ")}.`,
  };
}

/**
 * Product Compiler deploys through a Setfarm-owned local process adapter, so
 * local systemd is not a v3 prerequisite. Keep the legacy capability decision
 * byte-for-byte compatible for agent-owned deploy claims.
 */
export function evaluateV3DeployCapability(snapshot: DeployCapabilitySnapshot): DeployCapabilityDecision {
  if (snapshot.deployDisabled) return evaluateDeployCapability(snapshot);
  return {
    shouldSkip: false,
    mode: "local",
    reason: "Setfarm-owned local process deployment is available.",
  };
}

async function readUnprunedRunContext(runId: string): Promise<Record<string, string>> {
  const row = await pgGet<{ context: string | Record<string, unknown> | null }>(
    "SELECT context FROM runs WHERE id = $1 LIMIT 1",
    [runId],
  );
  const raw = row?.context;
  const parsed = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("V3_DEPLOY_RUN_CONTEXT_INVALID");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

type CanonicalDeployCommitStatus = "committed" | "absent" | "unknown";

async function canonicalDeployCompletionStatus(input: Readonly<{
  runId: string;
  stepDbId: string;
  receiptHash: string;
}>): Promise<CanonicalDeployCommitStatus> {
  try {
    const row = await pgGet<{
      deploy_receipt_hash: string | null;
      step_status: string;
      ledger_receipt_hash: string | null;
    }>(
      `SELECT run.deploy_receipt_hash, step.status AS step_status,
              receipt.receipt_hash AS ledger_receipt_hash
         FROM runs run
         JOIN steps step ON step.id = $2 AND step.run_id = run.id
         LEFT JOIN v3_deploy_receipts receipt
           ON receipt.receipt_hash = run.deploy_receipt_hash
          AND receipt.run_id = run.id
        WHERE run.id = $1
        LIMIT 1`,
      [input.runId, input.stepDbId],
    );
    return row?.deploy_receipt_hash === input.receiptHash
      && row.ledger_receipt_hash === input.receiptHash
      && row.step_status === "done"
      ? "committed"
      : "absent";
  } catch {
    return "unknown";
  }
}

function asV3DeployPlatformFailure(runId: string, error: unknown): V3DeployAuthorityError {
  if (error instanceof V3DeployAuthorityError) return error;
  return new V3DeployAuthorityError(
    "V3_DEPLOY_PLATFORM_FAILED",
    `deterministic deploy lifecycle failed: ${String(error).slice(0, 700)}`,
    { runId },
  );
}

export async function commitV3DeployCompletion(input: Readonly<{
  runId: string;
  stepDbId: string;
  receipt: V3DeployReceiptV1;
  complete(): Promise<void>;
  canonicalCommitStatus(): Promise<CanonicalDeployCommitStatus>;
  releaseOwnership(outcome: "committed" | "reconcile"): Promise<void>;
  rollback(reason: string): Promise<void>;
}>): Promise<"committed" | "already_committed"> {
  try {
    await input.complete();
    try {
      await input.releaseOwnership("committed");
    } catch (releaseError) {
      throw new V3DeployPublicationPendingError({
        runId: input.runId,
        receiptHash: input.receipt.receiptHash,
        cause: releaseError,
      });
    }
    return "committed";
  } catch (completionError) {
    if (completionError instanceof V3DeployPublicationPendingError) throw completionError;
    let commitStatus: CanonicalDeployCommitStatus = "unknown";
    try {
      commitStatus = await input.canonicalCommitStatus();
    } catch {
      commitStatus = "unknown";
    }
    if (commitStatus === "committed") {
      try {
        await input.releaseOwnership("committed");
      } catch (releaseError) {
        throw new V3DeployPublicationPendingError({
          runId: input.runId,
          receiptHash: input.receipt.receiptHash,
          cause: releaseError,
        });
      }
      return "already_committed";
    }
    if (commitStatus === "unknown") {
      try {
        await input.releaseOwnership("reconcile");
      } catch (releaseError) {
        throw new V3DeployPublicationPendingError({
          runId: input.runId,
          receiptHash: input.receipt.receiptHash,
          cause: new AggregateError([completionError, releaseError]),
        });
      }
      throw new V3DeployPublicationPendingError({
        runId: input.runId,
        receiptHash: input.receipt.receiptHash,
        cause: completionError,
      });
    }
    try {
      await input.rollback(`deploy receipt publication failed: ${String(completionError).slice(0, 700)}`);
    } catch (rollbackError) {
      throw new V3DeployAuthorityError(
        "V3_DEPLOY_ROLLBACK_FAILED",
        `deploy receipt publication and rollback failed: ${String(rollbackError).slice(0, 500)}`,
        { runId: input.runId, receiptHash: input.receipt.receiptHash },
      );
    }
    throw completionError;
  }
}

export function detectDeployCapability(ctx: ClaimContext): DeployCapabilitySnapshot {
  const remoteHost = configuredRemoteHost(ctx);
  return {
    platform: process.platform,
    localMissionControl: localMissionControlAvailable(),
    localSystemctl: localSystemctlAvailable(),
    remoteHost,
    remoteReachable: remoteHost ? remoteDeployHostReachable(remoteHost) : false,
    deployRequired: isTruthy(process.env.SETFARM_DEPLOY_REQUIRED) || isTruthy(process.env.SETFARM_REQUIRE_DEPLOY),
    deployDisabled: isTruthy(process.env.SETFARM_DISABLE_DEPLOY),
  };
}

function detectV3DeployCapability(): DeployCapabilitySnapshot {
  return {
    platform: process.platform,
    localMissionControl: false,
    localSystemctl: false,
    remoteHost: "",
    remoteReachable: false,
    deployRequired: isTruthy(process.env.SETFARM_DEPLOY_REQUIRED) || isTruthy(process.env.SETFARM_REQUIRE_DEPLOY),
    deployDisabled: isTruthy(process.env.SETFARM_DISABLE_DEPLOY),
  };
}

export async function rethrowV3DeployAuthorityAfterObservation(
  ctx: Pick<ClaimContext, "runId" | "stepId">,
  error: V3DeployAuthorityError,
  observe: typeof recordGateObservation = recordGateObservation,
): Promise<never> {
  try {
    await observe({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "deployer",
      checkId: "v3-accepted-candidate-source",
      label: "V3 accepted final-tree source",
      status: "fail",
      summary: error.code,
      detail: error.message,
      metadata: { code: error.code, ...error.evidence },
    });
  } catch (observationError) {
    // The typed authority failure is canonical. Observability must never
    // replace it with an untyped storage error and accidentally permit a
    // deploy-agent spawn.
    logger.warn(`[module:deploy preclaim] failed to record authority observation: ${String(observationError).slice(0, 300)}`, {
      runId: ctx.runId,
      stepId: ctx.stepId,
    });
  }
  throw error;
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = (ctx.context["repo"] || ctx.context["REPO"] || "").replace(/^~/, os.homedir());
  let v3Authority: Extract<Awaited<ReturnType<typeof assertV3DeployAuthority>>, { status: "authorized" }> | undefined;
  try {
    const authority = await assertV3DeployAuthority({
      sql: getSql(),
      runId: ctx.runId,
      worktree: repo,
    });
    if (authority.status === "authorized") {
      v3Authority = authority;
      ctx.context["accepted_candidate_hash"] = authority.candidate.candidateHash;
      ctx.context["accepted_source_sha"] = authority.candidate.sourceRevision.sha;
      ctx.context["accepted_source_tree_hash"] = authority.candidate.sourceRevision.treeHash;
      try {
        await recordGateObservation({
          runId: ctx.runId,
          stepId: ctx.stepId,
          agentId: "deployer",
          checkId: "v3-accepted-candidate-source",
          label: "V3 accepted final-tree source",
          status: "pass",
          summary: "Deploy source exactly matches the immutable AcceptedCandidate.",
          detail: authority.candidate.candidateHash,
          metadata: {
            candidateHash: authority.candidate.candidateHash,
            sourceSha: authority.candidate.sourceRevision.sha,
            sourceTreeHash: authority.candidate.sourceRevision.treeHash,
          },
        });
      } catch (observationError) {
        logger.warn(`[module:deploy preclaim] source-pass observation is advisory: ${String(observationError).slice(0, 300)}`, {
          runId: ctx.runId,
          stepId: ctx.stepId,
        });
      }
    }
  } catch (error) {
    if (error instanceof V3DeployAuthorityError) {
      await rethrowV3DeployAuthorityAfterObservation(ctx, error);
    }
    throw error;
  }

  if (isTruthy(process.env.SETFARM_DISABLE_DEPLOY_CAPABILITY_GATE) && !v3Authority) {
    logger.info("[module:deploy preclaim] capability gate disabled by environment", { runId: ctx.runId });
    return;
  }

  let stackMetadata: Record<string, unknown> = {};
  if (v3Authority) {
    try {
      const stackContract = resolveOperationalStackContract(ctx.context, false);
      stackMetadata = stackEvidenceMetadata(stackContract);
      await recordStackEvidencePlanObservation({
        run_id: ctx.runId,
        step_id: ctx.stepId,
        agent_id: "deployer",
      }, ctx.context, "running", "Deploy preclaim resolved stack evidence contract.");
    } catch (observationError) {
      logger.warn(`[module:deploy preclaim] legacy stack observation is advisory for sealed v3 deploy: ${String(observationError).slice(0, 300)}`, {
        runId: ctx.runId,
        stepId: ctx.stepId,
      });
    }
  } else {
    const stackContract = resolveOperationalStackContract(ctx.context, false);
    stackMetadata = stackEvidenceMetadata(stackContract);
    await recordStackEvidencePlanObservation({
      run_id: ctx.runId,
      step_id: ctx.stepId,
      agent_id: "deployer",
    }, ctx.context, "running", "Deploy preclaim resolved stack evidence contract.");
  }

  const snapshot = v3Authority
    ? detectV3DeployCapability()
    : detectDeployCapability(ctx);
  const decision = v3Authority
    ? evaluateV3DeployCapability(snapshot)
    : evaluateDeployCapability(snapshot);
  try {
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "deployer",
      checkId: "deploy-capability",
      label: "Deploy capability",
      status: decision.shouldSkip ? "info" : "pass",
      summary: decision.reason,
      detail: JSON.stringify(snapshot),
      metadata: {
        mode: decision.mode,
        shouldSkip: decision.shouldSkip,
        ...stackMetadata,
      },
    });
  } catch (observationError) {
    if (!v3Authority) throw observationError;
    logger.warn(`[module:deploy preclaim] capability observation is advisory for v3 deploy: ${String(observationError).slice(0, 300)}`, {
      runId: ctx.runId,
      stepId: ctx.stepId,
    });
  }
  if (!decision.shouldSkip) {
    ctx.context["deploy_capability"] = decision.mode;
    ctx.context["deploy_capability_reason"] = decision.reason;
    if (!v3Authority) return;

    const step = await pgGet<{ id: string }>(
      "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [ctx.runId, ctx.stepId],
    );
    const stepDbId = step?.id;
    if (!stepDbId) {
      await rethrowV3DeployAuthorityAfterObservation(
        ctx,
        asV3DeployPlatformFailure(
          ctx.runId,
          `deploy preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`,
        ),
      );
      return;
    }
    try {
      const fullContext = await readUnprunedRunContext(ctx.runId);
      const execution = await createPostgresV3DeployExecutor({ sql: getSql() }).execute({
        runId: ctx.runId,
        worktree: repo,
        context: fullContext,
        target: {
          mode: decision.mode === "remote" ? "remote" : "local",
          ...(decision.mode === "remote" && snapshot.remoteHost
            ? { remoteHost: snapshot.remoteHost }
            : {}),
        },
      });
      const { completeStep } = await import("../../step-ops.js");
      if (execution.status === "not_deployable") {
        const lines = [
          "STATUS: skip",
          "DEPLOY_TYPE: setfarm-v3-not-deployable",
          `SKIP_REASON: ${execution.reason}`,
          `ACCEPTED_CANDIDATE_HASH: ${execution.candidate.candidateHash}`,
          `ACCEPTED_SOURCE_SHA: ${execution.sourceRevision.sha}`,
          `ACCEPTED_SOURCE_TREE_HASH: ${execution.sourceRevision.treeHash}`,
        ];
        await completeStep(stepDbId, lines.join("\n"), ctx.claimEnvelope);
        logger.info("[module:deploy preclaim] v3 topology is deterministically non-deployable; no model spawned", {
          runId: ctx.runId,
          stepId: ctx.stepId,
        });
        return;
      }

      const receipt = execution.receipt;
      ctx.context["deploy_receipt_hash"] = receipt.receiptHash;
      ctx.context["deploy_url"] = receipt.runtime.deployUrl;
      ctx.context["port"] = String(receipt.runtime.port);
      try {
        await recordGateObservation({
          runId: ctx.runId,
          stepId: ctx.stepId,
          agentId: "setfarm-v3-deploy-executor",
          checkId: "v3-deterministic-deploy-receipt",
          label: "V3 deterministic deploy receipt",
          status: "pass",
          summary: "Setfarm deployed and health-checked the exact AcceptedCandidate without a model.",
          detail: receipt.receiptHash,
          metadata: {
            receipt,
            candidateHash: receipt.candidateHash,
            packetHash: receipt.packetHash,
            sourceSha: receipt.sourceAfter.sha,
            sourceTreeHash: receipt.sourceAfter.treeHash,
            terminalProjectProjection: receipt.terminalProjectProjection,
          },
        });
      } catch (observationError) {
        logger.warn(`[module:deploy preclaim] receipt observation is advisory: ${String(observationError).slice(0, 300)}`, {
          runId: ctx.runId,
          stepId: ctx.stepId,
        });
      }
      const completionResult = await commitV3DeployCompletion({
        runId: ctx.runId,
        stepDbId,
        receipt,
        complete: async () => completeStep(stepDbId, [
          "STATUS: done",
          "DEPLOY_TYPE: setfarm-v3-deterministic",
          `DEPLOY_URL: ${receipt.runtime.deployUrl}`,
          `PORT: ${receipt.runtime.port}`,
          `SERVICE_ID: ${receipt.runtime.serviceId}`,
          `DEPLOY_RECEIPT_HASH: ${receipt.receiptHash}`,
          `ACCEPTED_CANDIDATE_HASH: ${receipt.candidateHash}`,
          `ACCEPTED_SOURCE_SHA: ${receipt.sourceAfter.sha}`,
          `ACCEPTED_SOURCE_TREE_HASH: ${receipt.sourceAfter.treeHash}`,
          `TERMINAL_PROJECT_PROJECTION_REF: ${receipt.terminalProjectProjection.evidenceRef}`,
          `DEPLOY_RECEIPT_JSON: ${JSON.stringify(receipt)}`,
        ].join("\n"), ctx.claimEnvelope, {
          deferContinuationToEffectLedger: true,
        }).then(() => undefined),
        canonicalCommitStatus: () => canonicalDeployCompletionStatus({
          runId: ctx.runId,
          stepDbId,
          receiptHash: receipt.receiptHash,
        }),
        rollback: execution.rollback,
        releaseOwnership: execution.release,
      });
      if (completionResult === "already_committed") {
        logger.warn("[module:deploy preclaim] receipt/step commit is canonical; deferring post-commit continuation reconciliation", {
          runId: ctx.runId,
          stepId: ctx.stepId,
        });
        return;
      }
      logger.info("[module:deploy preclaim] v3 deterministic deployment completed; no model spawned", {
        runId: ctx.runId,
        stepId: ctx.stepId,
      });
      return;
    } catch (error) {
      if (error instanceof V3DeployPublicationPendingError) throw error;
      await rethrowV3DeployAuthorityAfterObservation(
        ctx,
        asV3DeployPlatformFailure(ctx.runId, error),
      );
    }
  }

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) {
    throw new Error(`deploy preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const lines = [
    "STATUS: skip",
    "DEPLOY_TYPE: skip",
    "DEPLOY_CAPABILITY: unavailable",
    `SKIP_REASON: ${decision.reason}`,
    `LOCAL_PLATFORM: ${snapshot.platform || os.platform()}`,
    `LOCAL_MISSION_CONTROL: ${snapshot.localMissionControl ? "available" : "unavailable"}`,
    `LOCAL_SYSTEMD: ${snapshot.localSystemctl ? "available" : "unavailable"}`,
    `REMOTE_DEPLOY_HOST: ${snapshot.remoteHost || "none"}`,
    `REMOTE_DEPLOY_REACHABLE: ${snapshot.remoteReachable ? "yes" : "no"}`,
  ];

  const { completeStep } = await import("../../step-ops.js");
  try {
    await completeStep(step.id, lines.join("\n"), ctx.claimEnvelope);
  } catch (error) {
    if (!v3Authority) throw error;
    await rethrowV3DeployAuthorityAfterObservation(
      ctx,
      asV3DeployPlatformFailure(ctx.runId, error),
    );
  }
  logger.warn(`[module:deploy preclaim] AUTO-SKIPPED deploy: ${decision.reason}`, { runId: ctx.runId, stepId: ctx.stepId });
}
