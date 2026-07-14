import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  captureV3BuildArtifact,
  exactV3BuildArtifactMatch,
} from "../../src/execution/v3-build-artifact.js";
import { V3BuildArtifactV1Schema } from "../../src/execution/schemas/v3-deploy-receipt-v1.js";

const cleanup: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-v3-build-artifact-"));
  cleanup.push(root);
  await mkdir(path.join(root, "dist", "assets"), { recursive: true });
  await writeFile(path.join(root, "dist", "index.html"), "index", "utf8");
  await writeFile(path.join(root, "dist", "assets", "app.js"), "app", "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe("v3 sealed build artifact", () => {
  it("captures a canonical sorted manifest and detects an extra or changed byte", async () => {
    const root = await fixture();
    const first = await captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["dist"] });
    assert.deepEqual(first.files.map((file) => file.path), ["dist/assets/app.js", "dist/index.html"]);
    assert.deepEqual(V3BuildArtifactV1Schema.parse(first), first);

    await writeFile(path.join(root, "dist", "extra.txt"), "extra", "utf8");
    const withExtra = await captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["dist"] });
    assert.equal(exactV3BuildArtifactMatch(first, withExtra), false);

    await writeFile(path.join(root, "dist", "index.html"), "changed", "utf8");
    const changed = await captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["dist"] });
    assert.notEqual(changed.artifactHash, withExtra.artifactHash);
  });

  it("fails closed for absent, empty, overlapping, traversal, and symlink outputs", async () => {
    const root = await fixture();
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["missing"] }),
      /V3_DEPLOY_BUILD_OUTPUT_MISSING/,
    );
    await mkdir(path.join(root, "empty"));
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["empty"] }),
      /V3_DEPLOY_BUILD_OUTPUT_EMPTY/,
    );
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["dist", "dist/assets"] }),
      /V3_DEPLOY_BUILD_OUTPUT_CONTRACT_OVERLAP/,
    );
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["../escape"] }),
      /normalized relative locator/i,
    );
    await symlink(path.join(root, "dist"), path.join(root, "linked-dist"));
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["linked-dist"] }),
      /V3_DEPLOY_BUILD_OUTPUT_SYMLINK/,
    );
    await symlink(path.join(root, "dist", "index.html"), path.join(root, "dist", "linked.html"));
    await assert.rejects(
      captureV3BuildArtifact({ runId: "run-artifact", worktree: root, outputPaths: ["dist"] }),
      /V3_DEPLOY_BUILD_OUTPUT_SYMLINK/,
    );
  });

  it("enforces bounded files, directories, per-file bytes, and total bytes", async () => {
    const root = await fixture();
    await assert.rejects(
      captureV3BuildArtifact({
        runId: "run-artifact",
        worktree: root,
        outputPaths: ["dist"],
        limits: { maxFiles: 1 },
      }),
      /V3_DEPLOY_BUILD_OUTPUT_FILE_LIMIT/,
    );
    await assert.rejects(
      captureV3BuildArtifact({
        runId: "run-artifact",
        worktree: root,
        outputPaths: ["dist"],
        limits: { maxDirectories: 1 },
      }),
      /V3_DEPLOY_BUILD_OUTPUT_DIRECTORY_LIMIT/,
    );
    await assert.rejects(
      captureV3BuildArtifact({
        runId: "run-artifact",
        worktree: root,
        outputPaths: ["dist"],
        limits: { maxFileBytes: 4 },
      }),
      /V3_DEPLOY_BUILD_OUTPUT_FILE_SIZE_LIMIT/,
    );
    await assert.rejects(
      captureV3BuildArtifact({
        runId: "run-artifact",
        worktree: root,
        outputPaths: ["dist"],
        limits: { maxTotalBytes: 7 },
      }),
      /V3_DEPLOY_BUILD_OUTPUT_TOTAL_SIZE_LIMIT/,
    );
  });

  it("detects a file mutation inside the capture window", async () => {
    const root = await fixture();
    let mutated = false;
    await assert.rejects(
      captureV3BuildArtifact({
        runId: "run-artifact",
        worktree: root,
        outputPaths: ["dist"],
        afterFileHashed: async (locator) => {
          if (!mutated && locator === "dist/assets/app.js") {
            mutated = true;
            await writeFile(path.join(root, locator), "mutated-after-hash", "utf8");
          }
        },
      }),
      /V3_DEPLOY_BUILD_OUTPUT_DRIFT/,
    );
  });
});
