import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1,
  getSql,
} from "../db-pg.js";
import {
  requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1,
  requireExactInternalProductionRecoverySourceBootstrapSetupAuthorityV1,
  resolveInternalProductionRecoverySourceBootstrapRunContextAuthorityV1,
  type InternalProductionRecoverySourceBootstrapRunPersistenceV1,
} from "./recovery-source-bootstrap-run-authority-v1.js";
import {
  publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1,
  syncInternalProductionRecoverySourceBootstrapRepositoryToOriginMainV1,
  type InternalProductionRecoverySourceBootstrapArtifactPathV1,
} from "./recovery-source-bootstrap-repository-v1.js";

const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1 = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function createInternalProductionRecoverySourceBootstrapSmokeEnvironmentV1(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    const upperKey = key.toUpperCase();
    if (
      key === "NODE_OPTIONS"
      || key === "NODE_PATH"
      || key === "LD_PRELOAD"
      || key.startsWith("DYLD_")
      || key.startsWith("AGENT_BROWSER_")
      || upperKey === "HTTP_PROXY"
      || upperKey === "HTTPS_PROXY"
      || upperKey === "ALL_PROXY"
      || upperKey === "NO_PROXY"
      || value === undefined
    ) continue;
    sanitized[key] = value;
  }
  const lookupPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  const located = execFileSync("/usr/bin/which", ["agent-browser"], {
    encoding: "utf8",
    env: { PATH: lookupPath },
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const executable = realpathSync(located);
  const stat = lstatSync(executable);
  if (
    !path.isAbsolute(executable)
    || !stat.isFile()
    || stat.nlink !== 1
    || stat.uid !== process.getuid?.()
    || (stat.mode & 0o022) !== 0
  ) throw new Error("RECOVERY_SMOKE_AGENT_BROWSER_AUTHORITY_CROSSED");
  const configPath = realpathSync(path.join(
    RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
    "scripts/agent-browser-recovery-config.json",
  ));
  const configStat = lstatSync(configPath);
  if (
    !configStat.isFile()
    || configStat.nlink !== 1
    || configStat.uid !== process.getuid?.()
    || (configStat.mode & 0o022) !== 0
    || !readFileSync(configPath).equals(Buffer.from("{}\n", "utf8"))
  ) throw new Error("RECOVERY_SMOKE_AGENT_BROWSER_CONFIG_CROSSED");
  return Object.freeze({
    ...sanitized,
    PATH: lookupPath,
    AGENT_BROWSER_NAMESPACE: `setfarm-recovery-${randomBytes(32).toString("hex")}`,
    AGENT_BROWSER_CONFIG: configPath,
    AGENT_BROWSER_IDLE_TIMEOUT_MS: "300000",
    SETFARM_RECOVERY_AGENT_BROWSER_PATH: executable,
  });
}

async function observeActiveInternalProductionRecoverySourceBootstrapRunV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
  }>,
): Promise<Readonly<{
  persistence: InternalProductionRecoverySourceBootstrapRunPersistenceV1;
}>> {
  const authority = resolveInternalProductionRecoverySourceBootstrapRunContextAuthorityV1({
    sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
    runId: input.runId,
    context: input.context,
  });
  const persistence = await getSql().begin("isolation level repeatable read read only", async (transaction) => {
    return await classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1(
      transaction,
      {
        recoveryState: "prepared",
        recoveryOperationAuthority: authority.operation,
      },
    );
  }) as InternalProductionRecoverySourceBootstrapRunPersistenceV1;
  return Object.freeze({ persistence });
}

export async function requireActiveInternalProductionRecoverySourceBootstrapSetupV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
  }>,
): Promise<ReturnType<typeof requireExactInternalProductionRecoverySourceBootstrapSetupAuthorityV1>> {
  const observed = await observeActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  return requireExactInternalProductionRecoverySourceBootstrapSetupAuthorityV1({
    sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
    runId: input.runId,
    context: input.context,
    persistence: observed.persistence,
  });
}

export async function requireActiveInternalProductionRecoverySourceBootstrapRunV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
  }>,
): Promise<ReturnType<typeof requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1>> {
  const observed = await observeActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  return requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1({
    sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
    runId: input.runId,
    context: input.context,
    persistence: observed.persistence,
  });
}

export function requireInternalProductionRecoverySourceBootstrapRunMutationStateV1(
  persistence: Readonly<{ state: unknown; workflowState?: unknown }>,
): void {
  if (
    persistence.state !== "active"
    || !["running", "resuming"].includes(String(persistence.workflowState))
  ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_RUN_MUTATION_STATE_INVALID");
}

export async function requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
  }>,
): Promise<ReturnType<typeof requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1>> {
  const observed = await observeActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  requireInternalProductionRecoverySourceBootstrapRunMutationStateV1(observed.persistence);
  return requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1({
    sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
    runId: input.runId,
    context: input.context,
    persistence: observed.persistence,
  });
}

export async function syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
  }>,
): Promise<ReturnType<typeof requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1>> {
  const authority = await requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  syncInternalProductionRecoverySourceBootstrapRepositoryToOriginMainV1({
    sourceRepositoryRoot: authority.repositoryIdentity.sourceRepositoryRoot,
    runId: input.runId,
    operationRef: authority.operation.operationRef,
    operationHash: authority.operation.operationHash,
    baseSourceSha: authority.operation.baseSourceSha,
    baseSourceTreeHash: authority.operation.baseSourceTreeHash,
  });
  return await requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1(input);
}

export async function publishActiveInternalProductionRecoverySourceBootstrapArtifactV1(
  input: Readonly<{
    runId: string;
    context: Readonly<Record<string, unknown>>;
    relativePath: InternalProductionRecoverySourceBootstrapArtifactPathV1;
    bytes: Buffer;
  }>,
): Promise<ReturnType<typeof requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1>> {
  const authority = await requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1({
    sourceRepositoryRoot: authority.repositoryIdentity.sourceRepositoryRoot,
    runId: input.runId,
    operationRef: authority.operation.operationRef,
    operationHash: authority.operation.operationHash,
    baseSourceSha: authority.operation.baseSourceSha,
    baseSourceTreeHash: authority.operation.baseSourceTreeHash,
  }, {
    relativePath: input.relativePath,
    bytes: input.bytes,
  });
  const confirmed = await requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1(input);
  if (
    confirmed.operation.operationRef !== authority.operation.operationRef
    || confirmed.operation.operationHash !== authority.operation.operationHash
    || confirmed.repositoryIdentity.repositoryRoot !== authority.repositoryIdentity.repositoryRoot
    || confirmed.repositoryIdentity.branch !== authority.repositoryIdentity.branch
  ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_AUTHORITY_CROSSED");
  return confirmed;
}

export type InternalProductionRecoverySourceBootstrapScreenshotFrameV1 = Readonly<{
  relativePath: "smoke-home.png" | "smoke-after-click.png";
  bytes: Buffer;
}>;

export function decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1(
  input: Buffer,
): readonly InternalProductionRecoverySourceBootstrapScreenshotFrameV1[] {
  const crossed = (): never => {
    throw new Error("RECOVERY_SOURCE_BOOTSTRAP_SCREENSHOT_FRAMES_CROSSED");
  };
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > 90 * 1024 * 1024) crossed();
  let parsed: unknown;
  try { parsed = JSON.parse(input.toString("utf8")); }
  catch { crossed(); }
  if (parsed === null || typeof parsed !== "object") crossed();
  const parsedRecord = parsed as Record<string, unknown>;
  if (
    Reflect.ownKeys(parsedRecord).length !== 2
    || Reflect.get(parsedRecord, "schema") !== "setfarm.internal-production-recovery-smoke-screenshots.v1"
    || !Array.isArray(Reflect.get(parsedRecord, "screenshots"))
  ) crossed();
  const screenshots = Reflect.get(parsedRecord, "screenshots") as unknown[];
  if (screenshots.length > 2) crossed();
  const expectedPaths = ["smoke-home.png", "smoke-after-click.png"] as const;
  let priorPathIndex = -1;
  const decoded = screenshots.map((frame) => {
    if (frame === null || typeof frame !== "object") crossed();
    const frameRecord = frame as Record<string, unknown>;
    const relativePath = Reflect.get(frameRecord, "relativePath");
    const pathIndex = expectedPaths.indexOf(relativePath as typeof expectedPaths[number]);
    if (
      Reflect.ownKeys(frameRecord).length !== 4
      || pathIndex <= priorPathIndex
      || !Number.isSafeInteger(Reflect.get(frameRecord, "byteLength"))
      || typeof Reflect.get(frameRecord, "contentHash") !== "string"
      || typeof Reflect.get(frameRecord, "contentBase64") !== "string"
    ) crossed();
    priorPathIndex = pathIndex;
    const contentBase64 = Reflect.get(frameRecord, "contentBase64") as string;
    const bytes = Buffer.from(contentBase64, "base64");
    if (
      bytes.length < 8
      || bytes.length > 32 * 1024 * 1024
      || Reflect.get(frameRecord, "byteLength") !== bytes.length
      || bytes.toString("base64") !== contentBase64
      || !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      || createHash("sha256").update(bytes).digest("hex") !== Reflect.get(frameRecord, "contentHash")
    ) crossed();
    return Object.freeze({
      relativePath: expectedPaths[pathIndex],
      bytes,
    });
  });
  const canonicalInput = Buffer.from(JSON.stringify({
    schema: "setfarm.internal-production-recovery-smoke-screenshots.v1",
    screenshots: screenshots.map((frame) => {
      const record = frame as Record<string, unknown>;
      return {
        relativePath: Reflect.get(record, "relativePath"),
        byteLength: Reflect.get(record, "byteLength"),
        contentHash: Reflect.get(record, "contentHash"),
        contentBase64: Reflect.get(record, "contentBase64"),
      };
    }),
  }), "utf8");
  if (!input.equals(canonicalInput)) crossed();
  return Object.freeze(decoded);
}
