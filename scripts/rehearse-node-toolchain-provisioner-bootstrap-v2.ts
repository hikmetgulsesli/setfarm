import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { canonicalJsonBytes } from "../src/product-compiler/canonical-json.js";
import {
  disposeCompiledNodeToolchainProvisionerBootstrapV2,
  compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority,
} from "../src/product-compiler/node-toolchain-provisioner-bootstrap-v2.js";
import {
  buildNodeToolchainProvisionerBundleAuthorityV2ForTest,
  inspectNodeToolchainProvisionerBundleAuthorityReceiptV2,
  type NodeToolchainProvisionerBundleBuildInvocationV2,
  type NodeToolchainProvisionerBundleBuildResultV2,
  type NodeToolchainProvisionerBundleBuilderAdapterV2,
} from "../src/product-compiler/node-toolchain-provisioner-bundle-authority-v2.js";
import {
  inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  installNodeToolchainProvisionerBootstrapV2ForTest,
  planNodeToolchainProvisionerBootstrapRollbackV2,
  rollbackNodeToolchainProvisionerBootstrapV2ForTest,
} from "../src/product-compiler/node-toolchain-provisioner-bootstrap-installation-v2.js";
import {
  planNodeToolchainProvisionerBootstrapInstallationV2,
} from "../src/product-compiler/node-toolchain-provisioner-bootstrap-installation-plan-v2.js";
import {
  disposeNodeToolchainProvisionerBootstrapPreparedPackageV2,
  prepareNodeToolchainProvisionerBootstrapPackageV2ForTest,
} from "../src/product-compiler/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2,
  withNodeToolchainProvisionerRehearsalPrivateTreeV2,
} from "../src/product-compiler/node-toolchain-provisioner-rehearsal-source-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  inspectNodeToolchainDistributionVerificationReceiptV2,
  verifyNodeToolchainDistributionArchiveV2,
} from "../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
} from "../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_VERSION_V2,
  NodeToolchainProvisionerBootstrapRehearsalReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapRehearsalReceiptV2,
  type NodeToolchainProvisionerBootstrapRehearsalReceiptHashPayloadV2,
} from "../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-rehearsal-v2.js";
import {
  NodeToolchainProvisionerInspectionV2Schema,
  NodeToolchainProvisionerOperationReceiptV2Schema,
  NodeToolchainProvisionerPlanV2Schema,
} from "../src/product-compiler/schemas/node-toolchain-provisioner-command-v2.js";

const CHILD_OUTPUT_LIMIT_V2 = 32 * 1024 * 1024;
const CHILD_TIMEOUT_MS_V2 = 120_000;

function fail(message: string): never {
  throw new Error(message.slice(0, 2_000));
}

function builderAdapter(
  invocation: NodeToolchainProvisionerBundleBuildInvocationV2,
): Promise<NodeToolchainProvisionerBundleBuildResultV2> {
  const argv = [...invocation.argv];
  argv[2] = process.execPath;
  const result = spawnSync(process.execPath, argv, {
    cwd: invocation.cwd,
    env: { ...invocation.env },
    encoding: "buffer",
    maxBuffer: Math.max(invocation.maxStdoutBytes, invocation.maxStderrBytes),
    timeout: invocation.timeoutMs,
    shell: false,
  });
  const stdout = Buffer.from(result.stdout ?? Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0));
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return Promise.resolve(Object.freeze({
      status: "timed_out",
      exitCode: null,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  if (result.error) {
    return Promise.resolve(Object.freeze({
      status: "spawn_failed",
      exitCode: result.status,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  if (
    stdout.byteLength > invocation.maxStdoutBytes
    || stderr.byteLength > invocation.maxStderrBytes
  ) {
    return Promise.resolve(Object.freeze({
      status: "output_limit_exceeded",
      exitCode: result.status,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  return Promise.resolve(Object.freeze({
    status: "exited",
    exitCode: result.status,
    signal: result.signal,
    stdout,
    stderr,
  }));
}

type CommandOutputV2 = Readonly<{
  bytes: Buffer;
  exitCode: 0;
}>;

function invokeLauncher(launcher: string, argv: readonly string[]): CommandOutputV2 {
  const result = spawnSync(launcher, [...argv], {
    cwd: path.dirname(path.dirname(launcher)),
    env: {
      PATH: "/hostile-path-must-be-discarded",
      NODE_OPTIONS: "--definitely-invalid-and-must-be-discarded",
      SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2: "hostile",
      SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2: "/hostile",
    },
    encoding: "buffer",
    maxBuffer: CHILD_OUTPUT_LIMIT_V2,
    timeout: CHILD_TIMEOUT_MS_V2,
    shell: false,
  });
  const stdout = Buffer.from(result.stdout ?? Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0));
  if (result.error || result.status !== 0 || result.signal !== null || stderr.byteLength !== 0) {
    return fail(
      `Installed launcher command failed (${argv.join(" ")}): `
      + `${result.error?.message ?? ""} ${stderr.toString("utf8")}`,
    );
  }
  if (stdout.byteLength < 2 || stdout.at(-1) === "\n".charCodeAt(0)) {
    return fail("Installed launcher did not emit one bounded canonical artifact");
  }
  return Object.freeze({ bytes: stdout, exitCode: 0 });
}

async function writePlan(locator: string, bytes: Buffer): Promise<void> {
  await writeFile(locator, bytes, { flag: "wx", mode: 0o600 });
  const stat = await lstat(locator);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o7777) !== 0o600) {
    return fail("Rehearsal plan file lost its exact private identity");
  }
}

async function makeWritable(root: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) return fail("Rehearsal cleanup encountered a symbolic link");
  if (!stat.isDirectory()) return;
  await chmod(root, 0o700);
  for (const name of await readdir(root)) await makeWritable(path.join(root, name));
}

async function removeRehearsalRoot(root: string): Promise<void> {
  await makeWritable(root);
  await rm(root, { recursive: true, force: false });
  if (existsSync(root)) return fail("Rehearsal root remained after exact cleanup");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (
    argv.length !== 2
    || argv[0] !== "--archive"
    || !path.isAbsolute(argv[1]!)
    || path.normalize(argv[1]!) !== argv[1]
  ) {
    return fail("Usage: rehearse-node-toolchain-provisioner-bootstrap-v2.ts --archive /absolute/node.tar.xz");
  }
  if (
    process.platform !== "darwin"
    || (process.arch !== "arm64" && process.arch !== "x64")
    || typeof process.getuid !== "function"
    || process.getuid() === 0
  ) {
    return fail("Bootstrap rehearsal requires one unprivileged Darwin arm64 or x64 process");
  }
  const architecture = process.arch;
  const archivePath = argv[1]!;
  const officialArchive = await verifyNodeToolchainDistributionArchiveV2({
    architecture,
    archivePath,
  });
  const officialReceipt = inspectNodeToolchainDistributionVerificationReceiptV2(officialArchive);
  await disposeVerifiedNodeToolchainDistributionArchiveV2(officialArchive);
  assert.equal(officialReceipt.admissionScope, "production_distribution");
  const source = getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2(architecture);
  assert.equal(officialReceipt.manifest.manifestHash, source.officialManifestHash);
  assert.equal(officialReceipt.artifact.artifactHash, source.officialArtifactHash);

  const rehearsalRoot = await realpath(await mkdtemp(
    path.join(tmpdir(), "setfarm-node-toolchain-bootstrap-rehearsal-v2-"),
  ));
  await chmod(rehearsalRoot, 0o700);
  const bootstrapParent = path.join(rehearsalRoot, "bootstrap");
  const provisionerParent = path.join(rehearsalRoot, "toolchains");
  const scratchParent = path.join(rehearsalRoot, "scratch");
  for (const directory of [bootstrapParent, provisionerParent, scratchParent]) {
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
  }
  const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");

  let evidence: Omit<
    NodeToolchainProvisionerBootstrapRehearsalReceiptHashPayloadV2,
    "schema" | "receiptVersion" | "authorityRef" | "status" | "admissionScope" | "architecture"
  > | undefined;
  try {
    evidence = await withNodeToolchainProvisionerRehearsalPrivateTreeV2({
      archivePath,
      architecture,
      scratchParent,
    }, async (tree) => {
      const bundleHandle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
        tree,
        builderAdapter satisfies NodeToolchainProvisionerBundleBuilderAdapterV2,
      );
      const bundleReceipt = inspectNodeToolchainProvisionerBundleAuthorityReceiptV2(bundleHandle);
      const compiled = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
        bundleHandle,
        tree,
        bootstrapRoot,
      );
      const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(compiled, {
        scratchParent,
      });
      try {
        const installed = await installNodeToolchainProvisionerBootstrapV2ForTest({
          preparedHandle: prepared,
          plan: planNodeToolchainProvisionerBootstrapInstallationV2(prepared),
        });
        const installationReceipt =
          inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(installed);
        const manifest = installationReceipt.claim.intent.source.manifest;
        const launcher = path.join(bootstrapRoot, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2);

        const initialOutput = invokeLauncher(launcher, ["inspect"]);
        const initial = NodeToolchainProvisionerInspectionV2Schema.parse(
          JSON.parse(initialOutput.bytes.toString("utf8")),
        );
        assert.equal(initial.admissionScope, "test_fixture");
        assert.equal(initial.classification, "target_absent");

        const applyPlanOutput = invokeLauncher(launcher, [
          "plan", "apply", "--archive", archivePath,
        ]);
        const applyPlan = NodeToolchainProvisionerPlanV2Schema.parse(
          JSON.parse(applyPlanOutput.bytes.toString("utf8")),
        );
        assert.equal(applyPlan.operation, "apply");
        assert.equal(applyPlan.admissionScope, "test_fixture");
        const applyPlanPath = path.join(scratchParent, "apply-plan.v2.json");
        await writePlan(applyPlanPath, applyPlanOutput.bytes);

        const applyOutput = invokeLauncher(launcher, [
          "apply", "--plan-file", applyPlanPath, "--archive", archivePath,
        ]);
        const applyReceipt = NodeToolchainProvisionerOperationReceiptV2Schema.parse(
          JSON.parse(applyOutput.bytes.toString("utf8")),
        );
        assert.equal(applyReceipt.result, "applied_exact_generation");

        const verifyOutput = invokeLauncher(launcher, ["verify"]);
        const verifyReceipt = NodeToolchainProvisionerOperationReceiptV2Schema.parse(
          JSON.parse(verifyOutput.bytes.toString("utf8")),
        );
        assert.equal(verifyReceipt.result, "verified_exact_generation");

        const rollbackPlanOutput = invokeLauncher(launcher, ["plan", "rollback"]);
        const rollbackPlan = NodeToolchainProvisionerPlanV2Schema.parse(
          JSON.parse(rollbackPlanOutput.bytes.toString("utf8")),
        );
        assert.equal(rollbackPlan.operation, "rollback");
        assert.equal(rollbackPlan.admissionScope, "test_fixture");
        const rollbackPlanPath = path.join(scratchParent, "rollback-plan.v2.json");
        await writePlan(rollbackPlanPath, rollbackPlanOutput.bytes);

        const rollbackOutput = invokeLauncher(launcher, [
          "rollback", "--plan-file", rollbackPlanPath,
        ]);
        const rollbackReceipt = NodeToolchainProvisionerOperationReceiptV2Schema.parse(
          JSON.parse(rollbackOutput.bytes.toString("utf8")),
        );
        assert.equal(rollbackReceipt.result, "rolled_back_exact_generation");

        const replayOutput = invokeLauncher(launcher, [
          "rollback", "--plan-file", rollbackPlanPath,
        ]);
        const replayReceipt = NodeToolchainProvisionerOperationReceiptV2Schema.parse(
          JSON.parse(replayOutput.bytes.toString("utf8")),
        );
        assert.equal(replayReceipt.result, "verified_existing_rollback");

        const finalOutput = invokeLauncher(launcher, ["inspect"]);
        const finalInspection = NodeToolchainProvisionerInspectionV2Schema.parse(
          JSON.parse(finalOutput.bytes.toString("utf8")),
        );
        assert.equal(finalInspection.classification, "target_absent");

        const bootstrapRollback = await rollbackNodeToolchainProvisionerBootstrapV2ForTest({
          plan: planNodeToolchainProvisionerBootstrapRollbackV2(installed),
        });
        assert.equal(bootstrapRollback.disposition, "rolled_back");
        assert.equal(existsSync(bootstrapRoot), false);

        return {
          officialSource: {
            manifestHash: source.officialManifestHash,
            artifactHash: source.officialArtifactHash,
            verificationReceiptHash: officialReceipt.receiptHash,
            archiveSha256: officialReceipt.archive.sha256,
            archiveByteLength: officialReceipt.archive.byteLength,
          },
          bootstrap: {
            bundleAuthorityReceiptHash: bundleReceipt.receiptHash,
            manifestHash: manifest.manifestHash,
            installationReceiptHash: installationReceipt.receiptHash,
            rollbackReceiptHash: bootstrapRollback.rollbackReceipt.receiptHash,
          },
          runtime: {
            nodeVersion: "22.23.1" as const,
            modulesAbi: "127" as const,
            napiVersion: "10" as const,
            npmVersion: "10.9.8" as const,
            processAdmission: "installed_launcher_exact_runtime_bundle_environment_v2" as const,
          },
          commands: [
            { sequence: 1, commandRef: "inspect_initial", artifactSchema: initial.schema,
              artifactHash: initial.inspectionHash, exitCode: initialOutput.exitCode },
            { sequence: 2, commandRef: "plan_apply", artifactSchema: applyPlan.schema,
              artifactHash: applyPlan.planHash, exitCode: applyPlanOutput.exitCode },
            { sequence: 3, commandRef: "apply", artifactSchema: applyReceipt.schema,
              artifactHash: applyReceipt.operationReceiptHash, exitCode: applyOutput.exitCode },
            { sequence: 4, commandRef: "verify", artifactSchema: verifyReceipt.schema,
              artifactHash: verifyReceipt.operationReceiptHash, exitCode: verifyOutput.exitCode },
            { sequence: 5, commandRef: "plan_rollback", artifactSchema: rollbackPlan.schema,
              artifactHash: rollbackPlan.planHash, exitCode: rollbackPlanOutput.exitCode },
            { sequence: 6, commandRef: "rollback", artifactSchema: rollbackReceipt.schema,
              artifactHash: rollbackReceipt.operationReceiptHash, exitCode: rollbackOutput.exitCode },
            { sequence: 7, commandRef: "rollback_replay", artifactSchema: replayReceipt.schema,
              artifactHash: replayReceipt.operationReceiptHash, exitCode: replayOutput.exitCode },
            { sequence: 8, commandRef: "inspect_final", artifactSchema: finalInspection.schema,
              artifactHash: finalInspection.inspectionHash, exitCode: finalOutput.exitCode },
          ],
          finalState: {
            provisionerClassification: "target_absent" as const,
            provisionerInspectionHash: finalInspection.inspectionHash,
            bootstrapRoot: "absent_after_authenticated_rollback" as const,
            rehearsalRoot: "removed_exactly" as const,
          },
        };
      } finally {
        disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
        disposeCompiledNodeToolchainProvisionerBootstrapV2(compiled);
      }
    });
  } finally {
    await removeRehearsalRoot(rehearsalRoot);
  }
  if (!evidence) return fail("Bootstrap rehearsal completed without canonical evidence");
  const identity: NodeToolchainProvisionerBootstrapRehearsalReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_AUTHORITY_REF_V2,
    status: "rehearsal_passed",
    admissionScope: "test_fixture",
    architecture,
    ...evidence,
  };
  const receipt = NodeToolchainProvisionerBootstrapRehearsalReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapRehearsalReceiptV2(identity),
  });
  process.stdout.write(canonicalJsonBytes(receipt));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
