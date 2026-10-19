#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";
import { isTask4CommandV1, readTask4Fd4V1, prepareTask4ContextV1, observeTask4OriginalChildV1,
  observeTask4ProcessV1, task4CanonicalV1, pinTask4DirectoryV1, readTask4ProofV1, publishTask4ProofV1,
  validateTask4ParentEnvelopeV1, validateTask4RunnerEnvelopeV1 } from "../tests/fixtures/mission-control-render-smoke-owned-v1.js";

type P3ProjectionMarkerV1 = Readonly<{
  schema: "setfarm.p3-isolated-projection-marker.v1";
  projectionRoot: string;
  projectedHead: string;
  runDatabasePrefix: string;
  templateDatabaseName: string;
  adminUrlSha256: string;
  setupNonceSha256: string;
  testNonceSha256: string;
}>;

type P3CapabilityRoleV1 = "setup" | "test";

const SOURCE_ROOT = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const P3_RECOVERY_LIFECYCLE_TEST_FILE_V1 = "tests/findings/v3-recovery-lifecycle-reconciler.test.ts";
const P3_RECOVERY_LIFECYCLE_TEST_SHARDS_V1 = Object.freeze(["0/3", "1/3", "2/3"] as const);
const P3_TRACKED_SCOPE = new Set([
  "scripts/run-isolated-postgres-tests.ts",
  "src/db-pg.ts",
  "src/db/contract-spine-migrations.ts",
  "src/db/contract-spine-migration-source-integrity.ts",
  "src/db/contract-spine-migration-digests.generated.ts",
  "src/internal-production/baseline-workspace-authority-path-v1.ts",
  "src/internal-production/baseline-spawner-launch-environment-v1.ts",
  "src/runtime-config.ts",
  "src/internal-production/owner-admission-head-v1.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/execution/attempt-reconciler.ts",
  "src/execution/attempt-repository.ts",
  "src/execution/claim-attempt-transition.ts",
  "src/execution/claim-runtime-publication.ts",
  "src/execution/operational-retry-reservation.ts",
  "src/execution/operational-event-delivery-repository.ts",
  "src/execution/operational-outbox-repository.ts",
  "src/execution/pre-dispatch-withdrawal-authority.ts",
  "src/execution/recovery-source-bootstrap-run-authority-v1.ts",
  "src/execution/run-terminal-transition.ts",
  "src/execution/run-termination.ts",
  "src/execution/runtime-completion-effect-repository.ts",
  "src/execution/runtime-completion-effect-runner.ts",
  "src/execution/runtime-completion.ts",
  "src/execution/runtime-session-repository.ts",
  "src/findings/finding-publication-v1.ts",
  "src/findings/legacy-finding-publication-inventory-v1.ts",
  "src/execution/v3-implementation-attempt.ts",
  "src/installer/cleanup-ops.ts",
  "src/installer/step-fail.ts",
  "src/installer/step-ops.ts",
  "src/medic/checks.ts",
  "src/medic/medic.ts",
  "src/recovery/finding-recovery-repository.ts",
  "src/recovery/v3-downstream-evidence-publication.ts",
  "src/recovery/v3-evidence-only-publication.ts",
  "src/recovery/v3-evidence-only-worker.ts",
  "src/recovery/v3-recovery-lifecycle-reconciler.ts",
  "tests/claim-log-lifecycle.test.ts",
  "tests/cleanup-ops.test.ts",
  "tests/evidence/accepted-candidate-repository.test.ts",
  "tests/run-operational-snapshot.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/claim-authority.test.ts",
  "tests/execution-attempts/claim-attempt-transition.test.ts",
  "tests/execution-attempts/claim-runtime-publication.test.ts",
  "tests/execution-attempts/claim-step-v3-recovery.integration.test.ts",
  "tests/execution-attempts/compiler-claim-fence.test.ts",
  "tests/execution-attempts/concurrency.test.ts",
  "tests/execution-attempts/helpers/compiler-story-admission-fixture.ts",
  "tests/execution-attempts/helpers/compiler-story-english-admission-fixture.ts",
  "tests/execution-attempts/migration-runtime-preservation.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/operational-event-delivery.test.ts",
  "tests/execution-attempts/operational-outbox-repository.test.ts",
  "tests/execution-attempts/operational-retry-reservation.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/run-termination.test.ts",
  "tests/execution-attempts/runtime-completion-effect-runner.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/runtime-hooks.test.ts",
  "tests/execution-attempts/runtime-session-repository.test.ts",
  "tests/execution-attempts/test-database.ts",
  "tests/execution-attempts/v3-downstream-evidence-publication.test.ts",
  "tests/execution-attempts/v3-platform-preclaim-claim.integration.test.ts",
  "tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts",
  "tests/execution-attempts/v3-platform-preclaim-termination-race.integration.test.ts",
  "tests/execution-attempts/v3-pre-dispatch-failure.integration.test.ts",
  "tests/execution-attempts/v3-preparation-claim-authority.test.ts",
  "tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts",
  "tests/execution-attempts/v3-setup-build-untyped-build-failure.integration.test.ts",
  "tests/execution-attempts/v3-stage-input-unresolved.integration.test.ts",
  "tests/findings/repository.test.ts",
  "tests/findings/v3-evidence-only-worker.test.ts",
  "tests/findings/v3-recovery-lifecycle-reconciler.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/task-0-source-manifest.test.ts",
]);
const CODE_OWNED_GIT_ENVIRONMENT_V1: NodeJS.ProcessEnv = Object.freeze({
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_COUNT: "0",
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "/usr/bin/false",
});

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function capabilityFrameV1(role: P3CapabilityRoleV1, nonce: Buffer): Buffer {
  return Buffer.from(
    `SETFARM_P3_PROJECTION_CAPABILITY_V1:${role}:${nonce.toString("hex")}\n`,
    "ascii",
  );
}

const SETFARM_P3_TEST_CAPABILITY_PRELOAD_V1 = `
process.env.NODE_OPTIONS = "--test-isolation=none";
await import("tsx");
const helper = await import(
  new URL("./tests/execution-attempts/test-database.ts", import.meta.url).href
);
helper.authenticateP3ProjectedReadinessTestCapabilityV1();
`;

function commandArguments(): string[] {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
  // One closed findings selector; the existing six-cell grammar stays unchanged.
  const fixedColdPre32Command = [
    "node", "--import", "tsx", "--test", "--test-concurrency=1",
    "--test-name-pattern=^cold pre32 catalog rejects unjournaled relations and orphan routines or triggers without writes$",
    "tests/findings/repository.test.ts",
  ] as const;
  if (command.length === fixedColdPre32Command.length
    && command.every((cell, index) => cell === fixedColdPre32Command[index])) {
    return command;
  }
  if (
    command.length !== 6
    || command[0] !== "node"
    || command[1] !== "--import"
    || command[2] !== "tsx"
    || command[3] !== "--test"
    || command[4] !== "--test-concurrency=1"
    || !command[5]
    || command[5].startsWith("-")
    || path.isAbsolute(command[5])
    || command[5].includes("..")
  ) {
    throw new Error("ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE");
  }
  return command;
}

function git(args: string[], options: Readonly<{ cwd?: string; env?: NodeJS.ProcessEnv }> = {}): string {
  const result = spawnSync("/usr/bin/git", args, {
    cwd: options.cwd ?? SOURCE_ROOT,
    env: options.env ?? CODE_OWNED_GIT_ENVIRONMENT_V1,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`P3_PROJECTION_GIT_FAILED:${args[0]}:${result.stderr.trim()}`);
  }
  return result.stdout;
}

function gitBytes(args: string[]): Buffer {
  const result = spawnSync("/usr/bin/git", args, {
    cwd: SOURCE_ROOT,
    env: CODE_OWNED_GIT_ENVIRONMENT_V1,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`P3_PROJECTION_GIT_FAILED:${args[0]}:${result.stderr.toString().trim()}`);
  }
  return result.stdout;
}

function assertSourceScopeV1(): void {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  for (const line of status.split("\n").filter(Boolean)) {
    const raw = line.slice(3);
    const locator = raw.includes(" -> ") ? raw.slice(raw.indexOf(" -> ") + 4) : raw;
    if (!line.startsWith("??") && !P3_TRACKED_SCOPE.has(locator)) {
      throw new Error(`P3_PROJECTION_TRACKED_SCOPE_INVALID:${locator}`);
    }
    if (line.startsWith("??")) {
      throw new Error(`P3_PROJECTION_UNTRACKED_SCOPE_INVALID:${locator}`);
    }
  }
}

function isAcceptedPinnedGitPhysicalModeV1(gitMode: string, physicalMode: number): boolean {
  if (gitMode !== "100644" && gitMode !== "100755") return false;
  const declaredMode = gitMode === "100755" ? 0o755 : 0o644;
  const requiredMode = gitMode === "100755" ? 0o500 : 0o400;
  return Number.isSafeInteger(physicalMode)
    && physicalMode >= 0
    && physicalMode <= 0o7777
    && (physicalMode & (0o7777 ^ declaredMode)) === 0
    && (physicalMode & requiredMode) === requiredMode;
}

const P3_CURRENT_ENTRY_WORKSPACE_SOURCE_V1 =
  'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");';
const P3_CURRENT_ENTRY_WORKSPACE_PROJECTION_V1 =
  'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.resolve(import.meta.dirname, "../../..");';

function projectP3CurrentEntryWorkspaceAuthorityV1(locator: string, bytes: Buffer): Buffer {
  if (locator !== "src/internal-production/baseline-workspace-authority-path-v1.ts") return bytes;
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) {
    throw new Error("P3_PROJECTION_CURRENT_ENTRY_SOURCE_INVALID");
  }
  const sourceParts = source.split(P3_CURRENT_ENTRY_WORKSPACE_SOURCE_V1);
  if (sourceParts.length !== 2 || source.includes(P3_CURRENT_ENTRY_WORKSPACE_PROJECTION_V1)) {
    throw new Error("P3_PROJECTION_CURRENT_ENTRY_WORKSPACE_AUTHORITY_INVALID");
  }
  const projected = sourceParts.join(P3_CURRENT_ENTRY_WORKSPACE_PROJECTION_V1);
  if (projected.split(P3_CURRENT_ENTRY_WORKSPACE_PROJECTION_V1).length !== 2) {
    throw new Error("P3_PROJECTION_CURRENT_ENTRY_WORKSPACE_AUTHORITY_INVALID");
  }
  return Buffer.from(projected, "utf8");
}

function readStableIndexedMemberV1(
  locator: string,
  gitMode: string,
  expectedDevice: bigint,
): Readonly<{ bytes: Buffer; physicalMode: number }> {
  const currentUid = process.getuid?.();
  if (typeof currentUid !== "number" || !Number.isSafeInteger(currentUid) || currentUid < 0) {
    throw new Error(`P3_PROJECTION_MEMBER_INVALID:${locator}`);
  }
  const source = path.join(SOURCE_ROOT, locator);
  const first = lstatSync(source, { bigint: true });
  const physicalMode = Number(first.mode & 0o7777n);
  if (
    !first.isFile()
    || first.isSymbolicLink()
    || first.dev !== expectedDevice
    || first.nlink !== 1n
    || first.uid !== BigInt(currentUid)
    || !isAcceptedPinnedGitPhysicalModeV1(gitMode, physicalMode)
  ) {
    throw new Error(`P3_PROJECTION_MEMBER_INVALID:${locator}`);
  }
  const descriptor = openSync(source, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    const final = fstatSync(descriptor, { bigint: true });
    const last = lstatSync(source, { bigint: true });
    for (const observed of [opened, final, last]) {
      if (
        !observed.isFile()
        || observed.dev !== first.dev
        || observed.ino !== first.ino
        || observed.mode !== first.mode
        || observed.uid !== first.uid
        || observed.nlink !== first.nlink
        || observed.size !== first.size
        || observed.mtimeNs !== first.mtimeNs
        || observed.ctimeNs !== first.ctimeNs
      ) {
        throw new Error(`P3_PROJECTION_MEMBER_CHANGED:${locator}`);
      }
    }
    if (BigInt(bytes.length) !== first.size) {
      throw new Error(`P3_PROJECTION_MEMBER_CHANGED:${locator}`);
    }
    return Object.freeze({ bytes, physicalMode });
  } finally {
    closeSync(descriptor);
  }
}

function projectCurrentBytesV1(): Readonly<{ root: string; head: string }> {
  const sourceHead = git(["rev-parse", "HEAD"]).trim();
  const sourceIndex = git(["ls-files", "--stage", "-z"]);
  assertSourceScopeV1();
  const temporaryParent = mkdtempSync(path.join(tmpdir(), "setfarm-p3-projection-"));
  try {
    const projectionRoot = path.join(temporaryParent, "setfarm");
    mkdirSync(projectionRoot, { mode: 0o700 });
    const sourceDevice = lstatSync(SOURCE_ROOT, { bigint: true }).dev;
    const entries = sourceIndex.split("\0").filter(Boolean);
    const observations = new Map<string, Readonly<{
      bytes: Buffer;
      sourcePhysicalMode: number;
      projectedMode: number;
    }>>();
    for (const entry of entries) {
      const match = /^(100644|100755) ([a-f0-9]{40,64}) 0\t(.+)$/.exec(entry);
      if (!match) throw new Error(`P3_PROJECTION_INDEX_ENTRY_INVALID:${entry}`);
      const locator = match[3]!;
      if (path.isAbsolute(locator) || locator.split("/").includes("..")) {
        throw new Error(`P3_PROJECTION_LOCATOR_INVALID:${locator}`);
      }
      const expectedMode = match[1] === "100755" ? 0o755 : 0o644;
      const observed = readStableIndexedMemberV1(locator, match[1]!, sourceDevice);
      const bytes = observed.bytes;
      if (!P3_TRACKED_SCOPE.has(locator) && !bytes.equals(gitBytes(["cat-file", "blob", match[2]!])) ) {
        throw new Error(`P3_PROJECTION_SOURCE_CHANGED:${locator}`);
      }
      observations.set(locator, Object.freeze({
        bytes,
        sourcePhysicalMode: observed.physicalMode,
        projectedMode: expectedMode,
      }));
    }

    for (const [locator, observation] of observations) {
      const reopened = readStableIndexedMemberV1(
        locator,
        observation.projectedMode === 0o755 ? "100755" : "100644",
        sourceDevice,
      );
      if (!reopened.bytes.equals(observation.bytes) || reopened.physicalMode !== observation.sourcePhysicalMode) {
        throw new Error(`P3_PROJECTION_SOURCE_CHANGED:${locator}`);
      }
    }
    if (
      git(["rev-parse", "HEAD"]).trim() !== sourceHead
      || git(["ls-files", "--stage", "-z"]) !== sourceIndex
    ) {
      throw new Error("P3_PROJECTION_SOURCE_CHANGED");
    }
    try {
      assertSourceScopeV1();
    } catch {
      throw new Error("P3_PROJECTION_SOURCE_CHANGED");
    }

    for (const [locator, observation] of observations) {
      const projectedBytes = projectP3CurrentEntryWorkspaceAuthorityV1(locator, observation.bytes);
      const target = path.join(projectionRoot, locator);
      mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, projectedBytes, { mode: observation.projectedMode });
      chmodSync(target, observation.projectedMode);
    }

    for (const [locator, observation] of observations) {
      const reopened = readStableIndexedMemberV1(
        locator,
        observation.projectedMode === 0o755 ? "100755" : "100644",
        sourceDevice,
      );
      if (!reopened.bytes.equals(observation.bytes) || reopened.physicalMode !== observation.sourcePhysicalMode) {
        throw new Error(`P3_PROJECTION_SOURCE_CHANGED:${locator}`);
      }
    }
    if (
      git(["rev-parse", "HEAD"]).trim() !== sourceHead
      || git(["ls-files", "--stage", "-z"]) !== sourceIndex
    ) {
      throw new Error("P3_PROJECTION_SOURCE_CHANGED");
    }
    try {
      assertSourceScopeV1();
    } catch {
      throw new Error("P3_PROJECTION_SOURCE_CHANGED");
    }

    git(["init", "-q"], { cwd: projectionRoot });
    git(["config", "user.name", "Setfarm P3 Isolated Projection"], { cwd: projectionRoot });
    git(["config", "user.email", "setfarm-p3-projection@invalid"], { cwd: projectionRoot });
    git(["config", "commit.gpgSign", "false"], { cwd: projectionRoot });
    git(["config", "core.hooksPath", "/dev/null"], { cwd: projectionRoot });
    const sourceCommonDirectory = git(["rev-parse", "--git-common-dir"]).trim();
    const sourceObjects = realpathSync(path.join(
      path.isAbsolute(sourceCommonDirectory) ? sourceCommonDirectory : path.resolve(SOURCE_ROOT, sourceCommonDirectory),
      "objects",
    ));
    const alternatesPath = path.join(projectionRoot, ".git", "objects", "info", "alternates");
    mkdirSync(path.dirname(alternatesPath), { recursive: true });
    writeFileSync(alternatesPath, `${sourceObjects}\n`, { mode: 0o600 });
    const nodeModules = realpathSync(path.join(SOURCE_ROOT, "node_modules"));
    symlinkSync(nodeModules, path.join(projectionRoot, "node_modules"), "dir");
    writeFileSync(
      path.join(projectionRoot, ".git", "info", "exclude"),
      "node_modules\n.setfarm-p3-projection-marker.json\n.setfarm-p3-test-capability-preload.mjs\nsrc/internal-production/baseline-spawner-startup-admission-v1.js\n",
      { mode: 0o600 },
    );
    git(["add", "-A"], { cwd: projectionRoot });
    const tree = git(["write-tree"], { cwd: projectionRoot }).trim();
    const commitEnv = {
      ...CODE_OWNED_GIT_ENVIRONMENT_V1,
      GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
    };
    const projectedHead = git(
      ["commit-tree", tree, "-p", sourceHead, "-m", "setfarm p3 authenticated current-byte projection"],
      { cwd: projectionRoot, env: commitEnv },
    ).trim();
    git(["update-ref", "HEAD", projectedHead], { cwd: projectionRoot });
    git(["reset", "--mixed", "-q", projectedHead], { cwd: projectionRoot });
    return Object.freeze({ root: realpathSync(projectionRoot), head: projectedHead });
  } catch (error) {
    rmSync(temporaryParent, { recursive: true, force: true });
    throw error;
  }
}

function normalizedAdminUrlV1(): string {
  const raw = process.env.SETFARM_TEST_PG_ADMIN_URL;
  if (!raw) throw new Error("ISOLATED_TEST_PG_ADMIN_URL_REQUIRED");
  const parsed = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("ISOLATED_TEST_PG_ADMIN_URL_REJECTED");
  }
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function spawnWithCapabilityV1(input: Readonly<{
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  frame: Buffer;
  task4?: Readonly<{
    setup: Readonly<Record<string, any>>;
    context: Awaited<ReturnType<typeof prepareTask4ContextV1>>;
    role: "setup" | "test";
    records: Array<Record<string, unknown>>;
  }>;
}>): Promise<number> {
  if (input.task4) {
    const { setup, context, role, records } = input.task4;
    const expected = role === "setup"
      ? ["--import", "tsx", "tests/execution-attempts/test-database.ts"]
      : ["--import", "tsx", "--test", "--test-concurrency=1", "tests/fixtures/mission-control-render-smoke-owned-v1.ts"];
    if (JSON.stringify(input.args) !== JSON.stringify(expected)) throw new Error("TASK4_BINDING_REFUSED");
    context.check();
    const child = spawn(process.execPath, input.args, {
      cwd: input.cwd, env: input.env,
      stdio: role === "test" ? ["inherit", "inherit", "inherit", "pipe", "pipe"] : ["inherit", "inherit", "inherit", "pipe"],
    });
    const original = observeTask4OriginalChildV1(child);
    // Attach immediately. A failed publication cannot abandon the captured child promise.
    const terminal = original.then(value => ({ value, failed: false }), () => ({ value: null, failed: true }));
    const record: Record<string, any> = { role, owner: null, exit: null, fd3: "unknown", fd4: role === "test" ? "unknown" : "not_applicable" };
    records.push(record);
    const deliveries: Promise<void>[] = [];
    const write = (descriptor: number, bytes: Buffer) => {
      const writer = child.stdio[descriptor] as import("node:stream").Writable;
      let finished = false;
      const delivery = new Promise<void>((resolve, reject) => {
        writer.once("error", () => reject(new Error("TASK4_FRAME_DELIVERY_UNKNOWN")));
        writer.once("finish", () => { finished = true; record[`fd${descriptor}`] = "finished"; resolve(); });
        writer.once("close", () => { if (!finished) reject(new Error("TASK4_FRAME_DELIVERY_UNKNOWN")); });
      });
      deliveries.push(delivery); writer.end(bytes);
    };
    let publicationFailed = false;
    try {
      if (!child.pid) throw new Error("TASK4_CHILD_UNKNOWN");
      const observed = observeTask4ProcessV1(child.pid);
      if (observed.pin.ppid !== process.pid || observed.pin.executable !== realpathSync(process.execPath)
        || observed.rawCommand !== [realpathSync(process.execPath), ...expected].join(" ")) throw new Error("TASK4_BINDING_REFUSED");
      record.owner = observed.pin;
      context.check();
      write(3, input.frame);
      if (role === "test") write(4, Buffer.from(task4CanonicalV1(setup) + "\n"));
    } catch {
      publicationFailed = true;
      for (const descriptor of role === "test" ? [3, 4] : [3]) {
        const writer = child.stdio[descriptor] as import("node:stream").Writable;
        writer?.on("error", () => {}); if (writer && !writer.writableEnded && !writer.destroyed) writer.end();
      }
    }
    const [sent, ended] = await Promise.all([Promise.allSettled(deliveries), terminal]);
    record.exit = ended.value;
    context.check();
    if (publicationFailed || ended.failed || sent.some(result => result.status === "rejected") || !ended.value
      || ended.value.signal !== null) throw new Error("TASK4_CHILD_UNKNOWN");
    return ended.value.code ?? 1;
  }
  const child = spawn(process.execPath, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: ["inherit", "inherit", "inherit", "pipe"],
  });
  const writer = child.stdio[3]! as import("node:stream").Writable;
  let deliveryStarted = false;
  let deliveryFinished = false;
  const delivery = new Promise<void>((resolve, reject) => {
    writer.once("error", () => {
      reject(new Error("P3_PROJECTION_CAPABILITY_DELIVERY_FAILED"));
    });
    writer.once("finish", () => {
      deliveryFinished = true;
      resolve();
    });
  });
  const lifecycle = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (!deliveryStarted || !deliveryFinished) {
        reject(new Error("P3_PROJECTION_CAPABILITY_DELIVERY_FAILED"));
      } else if (signal) {
        reject(new Error(`ISOLATED_TEST_COMMAND_SIGNAL:${signal}`));
      } else {
        resolve(code ?? 1);
      }
    });
  });
  deliveryStarted = true;
  writer.end(input.frame);
  const [delivered, exited] = await Promise.allSettled([delivery, lifecycle]);
  if (delivered.status === "rejected") throw delivered.reason;
  if (exited.status === "rejected") throw exited.reason;
  return exited.value;
}

function childEnvironmentV1(input: Readonly<{
  databaseUrl: string;
  adminUrl: string;
  testProcess?: boolean;
  recoveryLifecycleShard?: typeof P3_RECOVERY_LIFECYCLE_TEST_SHARDS_V1[number];
  task4?: Readonly<{ home: string; tmp: string }>;
}>): NodeJS.ProcessEnv {
  return {
    PATH: "/usr/bin:/bin",
    LANG: "C",
    LC_ALL: "C",
    TSX_DISABLE_CACHE: "1",
    ...(input.task4 ? { HOME: input.task4.home, TMPDIR: input.task4.tmp } : {}),
    ...(input.testProcess ? {
      NODE_OPTIONS:
        "--test-isolation=none --import=./.setfarm-p3-test-capability-preload.mjs",
    } : {}),
    SETFARM_PG_URL: input.databaseUrl,
    SETFARM_TEST_PG_ADMIN_URL: input.adminUrl,
    ...(input.recoveryLifecycleShard === undefined ? {} : {
      SETFARM_P3_RECOVERY_LIFECYCLE_SHARD_V1: input.recoveryLifecycleShard,
    }),
  };
}

async function cleanupDatabasesV1(adminUrl: string, prefix: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, connect_timeout: 5, idle_timeout: 1, onnotice: () => {} });
  try {
    const rows = await admin<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${prefix}%`} ORDER BY datname
    `;
    const exact = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(?:template|primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$`);
    for (const { datname } of rows) {
      if (!exact.test(datname)) continue;
      await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${datname} AND pid<>pg_backend_pid()`;
      await admin.unsafe(`DROP DATABASE "${datname}"`);
      process.stderr.write(`[p3-isolated-test-db] dropped ${datname}\n`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function cloneDatabaseV1(adminUrl: string, database: string, template: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, connect_timeout: 5, idle_timeout: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE DATABASE "${database}" TEMPLATE "${template}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function verifyPrimaryCloneV1(
  projectionRoot: string,
  primaryUrl: string,
): Promise<void> {
  const db = await import(
    `${pathToFileURL(path.join(projectionRoot, "src/db-pg.ts")).href}?p3-primary-verifier=${Date.now()}`
  );
  try {
    db.pgConfigureIsolatedTestDatabase(primaryUrl);
    const current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    if (
      current === null
      || current.receipt.phase !== "A"
      || current.receipt.orderedPlans.length !== 1
      || current.receipt.orderedPlans[0] !== "A"
    ) throw new Error("CURRENT_INVALID");
    const readinessPath = path.join(
      projectionRoot,
      "src/internal-production/baseline-spawner-startup-admission-v1.js",
    );
    const first = lstatSync(readinessPath, { bigint: true });
    const descriptor = openSync(readinessPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    let bytes: Buffer;
    let opened: ReturnType<typeof fstatSync>;
    let final: ReturnType<typeof fstatSync>;
    try {
      opened = fstatSync(descriptor, { bigint: true });
      bytes = readFileSync(descriptor);
      final = fstatSync(descriptor, { bigint: true });
    } finally {
      closeSync(descriptor);
    }
    const last = lstatSync(readinessPath, { bigint: true });
    if (
      !first.isFile()
      || first.isSymbolicLink()
      || first.dev !== lstatSync(projectionRoot, { bigint: true }).dev
      || first.mode !== last.mode
      || first.ino !== last.ino
      || first.size !== last.size
      || first.mtimeNs !== last.mtimeNs
      || first.ctimeNs !== last.ctimeNs
      || first.nlink !== 1n
      || (first.mode & 0o777n) !== 0o600n
      || BigInt(bytes.length) !== first.size
    ) throw new Error("READINESS_INVALID");
    for (const observed of [opened, final, last]) {
      if (
        !observed.isFile()
        || observed.dev !== first.dev
        || observed.ino !== first.ino
        || observed.mode !== first.mode
        || observed.nlink !== first.nlink
        || observed.size !== first.size
        || observed.mtimeNs !== first.mtimeNs
        || observed.ctimeNs !== first.ctimeNs
      ) throw new Error("READINESS_INVALID");
    }
    const match = /const READY = deepFreeze\((\{[^\n]+\})\);/.exec(bytes.toString("utf8"));
    if (!match) throw new Error("READINESS_INVALID");
    const ready = JSON.parse(match[1]!) as Record<string, unknown>;
    if (JSON.stringify(Reflect.ownKeys(ready)) !== JSON.stringify([
      "state", "admissionReadyRef", "admissionReadyHash", "manifestActivationRef",
      "manifestActivationHash", "manifestHeadRef", "manifestHeadHash",
    ])) throw new Error("READINESS_INVALID");
    const readinessHash = sha256(JSON.stringify({
      activationHash: current.receipt.activationHash,
      activationRef: current.receipt.activationRef,
      headHash: current.head.headHash,
      headRef: current.head.headRef,
      schema: "setfarm.p3-projected-admission-ready.v1",
    }));
    if (
      ready.state !== "normal-task0-admission-ready"
      || ready.admissionReadyHash !== readinessHash
      || ready.admissionReadyRef !== `setfarm://tests/p3/admission-ready/sha256/${readinessHash}`
      || ready.manifestActivationRef !== current.receipt.activationRef
      || ready.manifestActivationHash !== current.receipt.activationHash
      || ready.manifestHeadRef !== current.head.headRef
      || ready.manifestHeadHash !== current.head.headHash
    ) throw new Error("READINESS_INVALID");
  } catch {
    throw new Error("P3_PRIMARY_VERIFICATION_FAILED");
  } finally {
    await db.pgClose().catch(() => {});
  }
}

let task4InvocationV1 = false;
async function main(): Promise<void> {
  if (process.env.SETFARM_PG_URL !== undefined) throw new Error("ISOLATED_TEST_AMBIENT_PG_URL_FORBIDDEN");
  const command = commandArguments();
  task4InvocationV1 = isTask4CommandV1(command);
  const task4Setup = task4InvocationV1 ? await readTask4Fd4V1("setup") : undefined;
  const adminUrl = normalizedAdminUrlV1();
  const task4Context = task4Setup ? await prepareTask4ContextV1(task4Setup, "runner", adminUrl) : undefined;
  const task4Children: Array<Record<string, unknown>> = [];
  const projection = projectCurrentBytesV1();
  const prefix = `setfarm_p3_${randomBytes(12).toString("hex")}`;
  const templateDatabaseName = `${prefix}_template`;
  const primaryDatabaseName = `${prefix}_primary`;
  const setupNonce = randomBytes(32);
  const testShards = command[command.length - 1] === P3_RECOVERY_LIFECYCLE_TEST_FILE_V1
    ? P3_RECOVERY_LIFECYCLE_TEST_SHARDS_V1
    : Object.freeze([undefined] as const);
  const testNonces = testShards.map(() => randomBytes(32));
  const markerForTestNonce = (testNonce: Buffer): P3ProjectionMarkerV1 => Object.freeze({
    schema: "setfarm.p3-isolated-projection-marker.v1",
    projectionRoot: projection.root,
    projectedHead: projection.head,
    runDatabasePrefix: prefix,
    templateDatabaseName,
    adminUrlSha256: sha256(adminUrl),
    setupNonceSha256: sha256(setupNonce),
    testNonceSha256: sha256(testNonce),
  });
  writeFileSync(
    path.join(projection.root, ".setfarm-p3-projection-marker.json"),
    `${JSON.stringify(markerForTestNonce(testNonces[0]!))}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(projection.root, ".setfarm-p3-test-capability-preload.mjs"),
    SETFARM_P3_TEST_CAPABILITY_PRELOAD_V1,
    { mode: 0o600 },
  );
  const templateUrl = new URL(adminUrl);
  templateUrl.pathname = `/${templateDatabaseName}`;
  const primaryUrl = new URL(adminUrl);
  primaryUrl.pathname = `/${primaryDatabaseName}`;
  let task4BodyFailed = false;
  try {
    const setupCode = await spawnWithCapabilityV1({
      args: ["--import", "tsx", "tests/execution-attempts/test-database.ts"],
      cwd: projection.root,
      env: childEnvironmentV1({ databaseUrl: templateUrl.toString(), adminUrl, task4: task4Context }),
      frame: capabilityFrameV1("setup", setupNonce),
      ...(task4Setup && task4Context ? { task4: { setup: task4Setup, context: task4Context, role: "setup" as const, records: task4Children } } : {}),
    });
    if (setupCode !== 0) throw new Error(`P3_TEMPLATE_SETUP_FAILED:${setupCode}`);
    await cloneDatabaseV1(adminUrl, primaryDatabaseName, templateDatabaseName);
    task4Context?.check();
    await verifyPrimaryCloneV1(projection.root, primaryUrl.toString());
    task4Context?.check();
    process.stderr.write(`[p3-isolated-test-db] cloned ${primaryDatabaseName} from ${templateDatabaseName}\n`);
    for (const [index, recoveryLifecycleShard] of testShards.entries()) {
      const testNonce = testNonces[index]!;
      writeFileSync(
        path.join(projection.root, ".setfarm-p3-projection-marker.json"),
        `${JSON.stringify(markerForTestNonce(testNonce))}\n`,
        { mode: 0o600 },
      );
      if (recoveryLifecycleShard !== undefined) {
        process.stderr.write(`[p3-isolated-test-db] lifecycle shard ${recoveryLifecycleShard}\n`);
      }
      const exitCode = await spawnWithCapabilityV1({
        args: command.slice(1),
        cwd: projection.root,
        env: childEnvironmentV1({
          databaseUrl: primaryUrl.toString(),
          adminUrl,
          testProcess: true,
          recoveryLifecycleShard,
          task4: task4Context,
        }),
        frame: capabilityFrameV1("test", testNonce),
        ...(task4Setup && task4Context ? { task4: { setup: task4Setup, context: task4Context, role: "test" as const, records: task4Children } } : {}),
      });
      if (exitCode !== 0) {
        process.exitCode = exitCode;
        break;
      }
    }
  } catch (error) {
    task4BodyFailed = true;
    throw error;
  } finally {
    if (task4Setup && task4Context) {
      let parent: Readonly<Record<string, any>> | null = null;
      let parentResult: Readonly<{ sha256: string; bytes: number }> | null = null;
      let databasesAbsent: boolean | null = null;
      let projectionAbsent: boolean | null = null;
      let outcome = "unknown";
      let code: string | null = "TASK4_CLEANUP_UNKNOWN";
      const projectionPin = pinTask4DirectoryV1(projection.root, true);
      try {
        task4Context.check();
        try {
          const observed = readTask4ProofV1(task4Setup.resourceRoot.path, "parent-result.json");
          parentResult = observed.ref;
          const test = task4Children.find(record => record.role === "test");
          if (!test?.owner) throw new Error("TASK4_CHILD_UNKNOWN");
          parent = validateTask4ParentEnvelopeV1(observed.value, task4Setup, test.owner as Record<string, any>);
          for (const ref of Object.values(parent.evidence)) if (ref !== null) {
            readTask4ProofV1(task4Setup.resourceRoot.path, "artifact", ref as Readonly<{ sha256: string; bytes: number }>);
          }
          if (task4CanonicalV1(parent.projection.root) !== task4CanonicalV1(projectionPin.value)
            || parent.projection.projectedHead !== projection.head) throw new Error("TASK4_BINDING_REFUSED");
        } catch { parent = null; }
        let cleanupSafe = false;
        try {
          task4Context.check(); projectionPin.check();
          if (task4BodyFailed || !parent || parent.outcome === "unknown" || parent.integrity !== "verified"
            || parent.projection.runDatabasePrefix !== prefix || task4Children.length !== 2) throw new Error("TASK4_CLEANUP_UNKNOWN");
          for (const [index, child] of task4Children.entries()) {
            const exit = child.exit as Record<string, unknown> | null;
            const owner = child.owner as Record<string, unknown> | null;
            if (child.role !== ["setup", "test"][index] || !owner || owner.ppid !== task4Context.owner.pid
              || owner.executable !== task4Context.owner.executable || owner.executableHash !== task4Context.owner.executableHash
              || !exit || exit.exitObserved !== true || exit.closeObserved !== true || exit.signal !== null
              || exit.code !== (index === 0 || parent.outcome === "pass" ? 0 : 1)
              || child.fd3 !== "finished" || child.fd4 !== (index === 0 ? "not_applicable" : "finished")) throw new Error("TASK4_CLEANUP_UNKNOWN");
          }
          if (task4CanonicalV1(task4Children[1]!.owner) !== task4CanonicalV1(parent.fixtureOwner)) throw new Error("TASK4_BINDING_REFUSED");
          // The authenticated parent owns semantic validation of inner evidence. Re-read the
          // exact retained result it bound before allowing any destructive prefix cleanup.
          const inner = readTask4ProofV1(task4Setup.resourceRoot.path, "inner-result.json", parent.inner.result).value;
          if (inner.outcome !== parent.outcome || inner.integrity !== "verified"
            || inner.binding.setupDescriptorHash !== parent.setupDescriptorHash
            || inner.binding.readyDescriptorHash !== parent.readyDescriptorHash
            || task4CanonicalV1(inner.owner) !== task4CanonicalV1(parent.inner.owner)) throw new Error("TASK4_INTEGRITY_FAILED");
          task4Context.check(); projectionPin.check(); cleanupSafe = true;
        } catch { cleanupSafe = false; }
        // Unknown descendants retain their database and Source. Cleanup cannot repair proof.
        if (cleanupSafe) {
        try {
          await cleanupDatabasesV1(adminUrl, prefix);
          task4Context.check();
          const admin = postgres(adminUrl, { max: 1, connect_timeout: 5, idle_timeout: 1, onnotice: () => {}, connection: { statement_timeout: 5000 } });
          try {
            const remaining = await admin.unsafe("SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname LIMIT 65", [prefix + "%"]);
            databasesAbsent = remaining.length === 0;
          } finally { await admin.end({ timeout: 5 }); }
          task4Context.check();
        } catch { databasesAbsent = null; }
        if (databasesAbsent === true) {
        try {
          task4Context.check(); projectionPin.check();
          rmSync(path.dirname(projection.root), { recursive: true, force: false });
          try { lstatSync(path.dirname(projection.root)); projectionAbsent = false; }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") projectionAbsent = true; else throw error; }
          task4Context.check();
        } catch { projectionAbsent = null; }
        }
        }
        if (cleanupSafe && parent && databasesAbsent === true && projectionAbsent === true) {
          outcome = parent.outcome; code = parent.code;
        }
        let result: Record<string, any> = {
          schema: "setfarm.task4-runner-result.v1", executionId: task4Setup.executionId,
          setupDescriptorHash: sha256(task4CanonicalV1(task4Setup) + "\n"), owner: task4Context.owner,
          outcome, code, children: task4Children, parentResult,
          projection: { root: projectionPin.value, projectedHead: projection.head }, cleanup: { databasesAbsent, projectionAbsent },
        };
        try { result = validateTask4RunnerEnvelopeV1(result, task4Setup, task4Context.owner, parent, parentResult); }
        catch {
          // Keep actual original facts, but never promote an inconsistent child/parent mapping.
          result = { ...result, outcome: "unknown", code: "TASK4_INTEGRITY_FAILED" };
          result = validateTask4RunnerEnvelopeV1(result, task4Setup, task4Context.owner, parent, parentResult);
        }
        task4Context.check(); publishTask4ProofV1(task4Setup.resourceRoot.path, "runner-result.json", result); task4Context.check();
        if (result.outcome !== "pass") process.exitCode = 1;
      } finally { projectionPin.close(); task4Context.close(); }
    } else {
    await cleanupDatabasesV1(adminUrl, prefix).catch((error) => {
      process.stderr.write(`P3_DATABASE_CLEANUP_FAILED:${String(error)}\n`);
      process.exitCode = 1;
    });
    rmSync(path.dirname(projection.root), { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${task4InvocationV1 ? (/^TASK4_[A-Z_]+$/.test(message) ? message : "TASK4_CLEANUP_UNKNOWN") : message}\n`);
  process.exitCode = 1;
});
