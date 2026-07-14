import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { promisify } from "node:util";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { captureShadowSourceRevision } from "../../src/execution/shadow-attempt-recorder.js";
import { captureV3BuildArtifact } from "../../src/execution/v3-build-artifact.js";
import {
  createV3SealedRuntimeManifestV1,
  V3SealAuthorityV1Schema,
  V3SealedRuntimeManifestV1Schema,
} from "../../src/execution/schemas/v3-sealed-runtime-manifest-v1.js";
import {
  materializeV3SealedRuntime,
  v3SealAuthorityFilePath,
} from "../../src/execution/v3-sealed-runtime.js";

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];
const runId = "run-v3-seal-authority";

async function sha256(value: string): Promise<string> {
  return createHash("sha256").update(value).digest("hex");
}

async function fixture(): Promise<Readonly<{
  root: string;
  stateRoot: string;
  candidateHash: string;
  sourceRevision: Awaited<ReturnType<typeof captureShadowSourceRevision>>;
  artifact: Awaited<ReturnType<typeof captureV3BuildArtifact>>;
  input: Parameters<typeof materializeV3SealedRuntime>[0];
}>> {
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), "setfarm-v3-sealed-runtime-unit-"));
  cleanupPaths.push(root);
  await writeFile(path.join(root, ".gitignore"), "dist/\nnode_modules/\nruntime/\n", "utf8");
  await writeFile(path.join(root, "package.json"), "{\"name\":\"sealed-runtime-unit\",\"private\":true}\n", "utf8");
  await writeFile(path.join(root, "source.txt"), "accepted source\n", "utf8");
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "setfarm-tests@example.invalid"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Setfarm Tests"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const sourceRevision = await captureShadowSourceRevision(root);
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "dist", "index.html"), "sealed build", "utf8");
  await mkdir(path.join(root, "node_modules", "runtime-value"), { recursive: true });
  await writeFile(path.join(root, "node_modules", "runtime-value", "value.txt"), "sealed dependency", "utf8");
  const artifact = await captureV3BuildArtifact({ runId, worktree: root, outputPaths: ["dist"] });
  const candidateHash = "a".repeat(64);
  const stateRoot = path.join(root, "runtime");
  const input = {
    stateRoot,
    runId,
    candidateHash,
    expectedSource: sourceRevision,
    worktree: root,
    artifact,
    runtimeDataContractHash: "c".repeat(64),
    previewCwd: ".",
    packageManager: "npm",
  } as const;
  return { root, stateRoot, candidateHash, sourceRevision, artifact, input };
}

async function makeWritableAndRemove(root: string): Promise<void> {
  await execFileAsync("chmod", ["-R", "u+w", root]);
  await rm(root, { recursive: true, force: true });
}

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map(async (entry) => {
    try { await execFileAsync("chmod", ["-R", "u+w", entry]); } catch { /* best-effort cleanup */ }
    await rm(entry, { recursive: true, force: true });
  }));
});

describe("v3 external sealed-runtime authority", () => {
  it("rejects a new seal when the global seal-count quota is full", async () => {
    const value = await fixture();
    const capacityLimits = {
      rootQuotaBytes: 1024 * 1024 * 1024,
      maxSealCount: 1,
      minFreeBytes: 0,
    } as const;
    await materializeV3SealedRuntime({ ...value.input, capacityLimits });
    const secondCandidateHash = "b".repeat(64);
    await assert.rejects(
      materializeV3SealedRuntime({
        ...value.input,
        candidateHash: secondCandidateHash,
        capacityLimits,
      }),
      /V3_DEPLOY_SEAL_COUNT_QUOTA_EXCEEDED/,
    );
    await assert.rejects(lstat(v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: secondCandidateHash,
      artifactHash: value.artifact.artifactHash,
    })), /ENOENT/);
  });

  it("charges crash orphans to the global byte quota without deleting them", async () => {
    const value = await fixture();
    const orphanRoot = path.join(value.stateRoot, "sealed", ".crash-orphan.tmp");
    await mkdir(orphanRoot, { recursive: true });
    const orphanPath = path.join(orphanRoot, "retained.bin");
    await writeFile(orphanPath, "retained-crash-evidence", "utf8");
    await assert.rejects(
      materializeV3SealedRuntime({
        ...value.input,
        capacityLimits: {
          rootQuotaBytes: 8,
          maxSealCount: 10,
          minFreeBytes: 0,
        },
      }),
      /V3_DEPLOY_SEAL_ROOT_QUOTA_EXCEEDED/,
    );
    assert.equal(await readFile(orphanPath, "utf8"), "retained-crash-evidence");
  });

  it("fails before copying when the configured free-space reserve would be crossed", async () => {
    const value = await fixture();
    await assert.rejects(
      materializeV3SealedRuntime({
        ...value.input,
        capacityLimits: {
          rootQuotaBytes: Number.MAX_SAFE_INTEGER,
          maxSealCount: 10,
          minFreeBytes: Number.MAX_SAFE_INTEGER,
        },
      }),
      /V3_DEPLOY_SEAL_FREE_SPACE_LOW/,
    );
    await assert.rejects(lstat(v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    })), /ENOENT/);
  });

  for (const layer of ["state-root", "sealed", "candidate", "final"] as const) {
    it(`rejects a symlinked ${layer} path before writing seal evidence`, async () => {
      const value = await fixture();
      const outside = await mkdtemp(path.join(await realpath(os.tmpdir()), `setfarm-v3-${layer}-outside-`));
      cleanupPaths.push(outside);
      let linkPath: string;
      if (layer === "state-root") {
        linkPath = value.stateRoot;
      } else {
        await mkdir(value.stateRoot, { recursive: true });
        linkPath = path.join(value.stateRoot, "sealed");
        if (layer === "candidate" || layer === "final") {
          await mkdir(linkPath);
          linkPath = path.join(linkPath, value.candidateHash);
        }
        if (layer === "final") {
          await mkdir(linkPath);
          linkPath = path.join(linkPath, value.artifact.artifactHash);
        }
      }
      await symlink(outside, linkPath, "dir");
      await assert.rejects(
        materializeV3SealedRuntime(value.input),
        /V3_DEPLOY_STATE_PATH_SYMLINK/,
      );
      assert.deepEqual(await readdir(outside), []);
    });
  }

  for (const boundary of ["tree_durable", "authority_durable", "root_renamed"] as const) {
    it(`recovers exactly after a process crash at ${boundary}`, async () => {
      const value = await fixture();
      await mkdir(value.stateRoot, { recursive: true });
      const inputPath = path.join(value.stateRoot, `crash-${boundary}.json`);
      await writeFile(inputPath, `${JSON.stringify(value.input)}\n`, "utf8");
      const workerPath = path.resolve(
        "tests/execution-attempts/fixtures/v3-seal-crash-worker.ts",
      );
      await assert.rejects(
        execFileAsync(process.execPath, ["--import", "tsx", workerPath, inputPath, boundary], {
          cwd: path.resolve("."),
          timeout: 30_000,
        }),
        (error: unknown) => (
          error instanceof Error
          && "code" in error
          && (error as NodeJS.ErrnoException).code === 90
        ),
      );
      const authorityPath = v3SealAuthorityFilePath({
        stateRoot: value.stateRoot,
        candidateHash: value.candidateHash,
        artifactHash: value.artifact.artifactHash,
      });
      const finalRoot = path.join(
        value.stateRoot,
        "sealed",
        value.candidateHash,
        value.artifact.artifactHash,
      );
      if (boundary === "tree_durable") {
        await assert.rejects(lstat(authorityPath), /ENOENT/);
        await assert.rejects(lstat(finalRoot), /ENOENT/);
      } else {
        assert.equal((await lstat(authorityPath)).isFile(), true);
        if (boundary === "authority_durable") await assert.rejects(lstat(finalRoot), /ENOENT/);
        else assert.equal((await lstat(finalRoot)).isDirectory(), true);
      }

      const recovered = await materializeV3SealedRuntime(value.input);
      assert.equal(recovered.root, finalRoot);
      const authority = V3SealAuthorityV1Schema.parse(JSON.parse(await readFile(authorityPath, "utf8")));
      assert.equal(authority.manifestHash, recovered.manifestHash);
      assert.equal(authority.fileCount > 0, true);
      assert.equal(authority.totalBytes > 0, true);
    });
  }

  it("adopts an unchanged post-rename crash root only through its sibling authority", async () => {
    const value = await fixture();
    const first = await materializeV3SealedRuntime(value.input);
    const authorityPath = v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    });
    const authorityBytes = await readFile(authorityPath, "utf8");
    const authority = V3SealAuthorityV1Schema.parse(JSON.parse(authorityBytes));
    assert.equal((await lstat(authorityPath)).mode & 0o777, 0o400);
    assert.equal(authority.manifestHash, first.manifestHash);

    // No deployment state is written in this unit: the second call is exactly
    // the rename -> state-persistence crash adoption window.
    const adopted = await materializeV3SealedRuntime(value.input);
    assert.deepEqual(adopted, first);
    assert.equal(await readFile(authorityPath, "utf8"), authorityBytes);
  });

  it("rejects a coordinated source/dependency/internal-manifest rewrite", async () => {
    const value = await fixture();
    const sealed = await materializeV3SealedRuntime(value.input);
    const authorityPath = v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    });
    const authorityBytes = await readFile(authorityPath, "utf8");
    const sourcePath = path.join(sealed.root, "source.txt");
    const dependencyPath = path.join(sealed.root, "node_modules", "runtime-value", "value.txt");
    const manifestPath = path.join(sealed.root, ".setfarm-sealed-runtime-manifest.json");
    await chmod(sourcePath, 0o600);
    await chmod(dependencyPath, 0o600);
    await chmod(manifestPath, 0o600);
    await writeFile(sourcePath, "rewritten source\n", "utf8");
    await writeFile(dependencyPath, "rewritten dependency", "utf8");
    await chmod(sourcePath, 0o400);
    await chmod(dependencyPath, 0o400);

    const oldManifest = V3SealedRuntimeManifestV1Schema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
    const replacements = new Map([
      ["source.txt", "rewritten source\n"],
      ["node_modules/runtime-value/value.txt", "rewritten dependency"],
    ]);
    const files = await Promise.all(oldManifest.files.map(async (file) => {
      const replacement = replacements.get(file.path);
      return replacement === undefined ? file : {
        ...file,
        byteLength: Buffer.byteLength(replacement),
        contentHash: await sha256(replacement),
      };
    }));
    const rewrittenManifest = createV3SealedRuntimeManifestV1({
      schema: oldManifest.schema,
      runId: oldManifest.runId,
      candidateHash: oldManifest.candidateHash,
      sourceRevision: oldManifest.sourceRevision,
      buildArtifactHash: oldManifest.buildArtifactHash,
      runtimeDataContractHash: oldManifest.runtimeDataContractHash,
      dependencyRoots: oldManifest.dependencyRoots,
      directories: oldManifest.directories,
      files,
      totalBytes: files.reduce((sum, file) => sum + file.byteLength, 0),
    });
    await writeFile(manifestPath, `${canonicalJsonStringify(rewrittenManifest)}\n`, "utf8");
    await chmod(manifestPath, 0o400);

    await assert.rejects(
      materializeV3SealedRuntime(value.input),
      /V3_DEPLOY_SEALED_RUNTIME_IDENTITY_CONFLICT/,
    );
    assert.equal(await readFile(authorityPath, "utf8"), authorityBytes);
    assert.equal(await readFile(sourcePath, "utf8"), "rewritten source\n");
    assert.equal(await readFile(manifestPath, "utf8"), `${canonicalJsonStringify(rewrittenManifest)}\n`);
  });

  it("serializes identical concurrent materialization and keeps one authority", async () => {
    const value = await fixture();
    const results = await Promise.all(Array.from({ length: 4 }, () => materializeV3SealedRuntime(value.input)));
    assert.equal(new Set(results.map((result) => JSON.stringify(result))).size, 1);
    const authorityPath = v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    });
    assert.deepEqual(V3SealAuthorityV1Schema.parse(JSON.parse(await readFile(authorityPath, "utf8"))).manifestHash, results[0]!.manifestHash);
    const entries = await readdir(path.dirname(authorityPath));
    assert.equal(entries.filter((entry) => entry.endsWith(".authority.json")).length, 1);
    assert.equal(entries.some((entry) => entry.endsWith(".tmp")), false);
  });

  it("retains missing/conflicting authority evidence instead of silently replacing it", async () => {
    const value = await fixture();
    const sealed = await materializeV3SealedRuntime(value.input);
    const authorityPath = v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    });
    const authorityBytes = await readFile(authorityPath, "utf8");
    await makeWritableAndRemove(sealed.root);
    await writeFile(path.join(value.root, "node_modules", "runtime-value", "value.txt"), "changed before retry", "utf8");
    await assert.rejects(
      materializeV3SealedRuntime(value.input),
      /V3_DEPLOY_SEAL_AUTHORITY_CONFLICT/,
    );
    assert.equal(await readFile(authorityPath, "utf8"), authorityBytes);
    await assert.rejects(lstat(sealed.root), /ENOENT/);

    await rm(authorityPath);
    await mkdir(sealed.root, { recursive: true });
    await assert.rejects(
      materializeV3SealedRuntime(value.input),
      /V3_DEPLOY_SEAL_AUTHORITY_MISSING/,
    );
    assert.equal((await lstat(sealed.root)).isDirectory(), true);
  });

  it("rejects an external dependency symlink before copying escaped bytes", async () => {
    const value = await fixture();
    const outside = await mkdtemp(path.join(await realpath(os.tmpdir()), "setfarm-v3-dependency-outside-"));
    cleanupPaths.push(outside);
    await writeFile(path.join(outside, "secret.txt"), "must-not-copy", "utf8");
    await symlink(outside, path.join(value.root, "node_modules", "00-external"), "dir");
    await assert.rejects(
      materializeV3SealedRuntime(value.input),
      /V3_DEPLOY_RUNTIME_DEPENDENCY_ESCAPE/,
    );
    const authorityPath = v3SealAuthorityFilePath({
      stateRoot: value.stateRoot,
      candidateHash: value.candidateHash,
      artifactHash: value.artifact.artifactHash,
    });
    await assert.rejects(lstat(authorityPath), /ENOENT/);
    assert.equal(await readFile(path.join(outside, "secret.txt"), "utf8"), "must-not-copy");
  });
});
