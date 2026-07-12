import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  LegacySourceSnapshotRequestV1Schema,
  readLegacySourceSnapshot,
} from "../../src/product-compiler/legacy-source-snapshot.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const BASE_SHA = "1".repeat(40);
const TREE_HASH = "2".repeat(40);

async function createSourceRoot(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name);
  await mkdir(path.join(root, "stories"), { recursive: true });
  await mkdir(path.join(root, "generated"), { recursive: true });
  await writeFile(path.join(root, "task.md"), "Build a deterministic task editor.\n", "utf8");
  await writeFile(path.join(root, "plan.json"), '{"actions":["ACT_SAVE_TASK"]}\n', "utf8");
  await writeFile(path.join(root, "generated", "screen.tsx"), "<button>Save</button>\n", "utf8");
  await writeFile(path.join(root, "stories", "US-001.json"), '{"id":"US-001"}\n', "utf8");
  return root;
}

function request(readRoot: string, runId = "run-a") {
  return {
    schema: "setfarm.legacy-source-snapshot-request.v1" as const,
    runId,
    readRoot,
    sources: {
      task: { locator: "task.md", mediaType: "text/markdown", required: true },
      plan: { locator: "plan.json", mediaType: "application/json", required: true },
      stitchArtifacts: [],
      generatedSources: [
        { locator: "generated/screen.tsx", mediaType: "text/typescript", required: true },
      ],
      stories: [
        { locator: "stories/US-001.json", mediaType: "application/json", required: true },
      ],
      setupCertificate: {
        locator: "setup/certificate.json",
        mediaType: "application/json",
        required: false,
      },
    },
    repo: { baseSha: BASE_SHA, treeHash: TREE_HASH },
  };
}

describe("legacy source snapshot", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("hashes declared sources without inference and reports optional absence", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-"));
    tempRoots.push(parent);
    const root = await createSourceRoot(parent, "root-a");

    const result = await readLegacySourceSnapshot(request(root));

    assert.equal(result.runId, "run-a");
    assert.ok(result.snapshot);
    assert.equal(result.snapshot.schema, "setfarm.legacy-source-snapshot.v1");
    assert.equal(result.snapshot.task.locator, "task.md");
    assert.equal(result.snapshot.plan.locator, "plan.json");
    assert.deepEqual(
      result.snapshot.generatedSources.map((source) => source.locator),
      ["generated/screen.tsx"],
    );
    assert.deepEqual(result.missingSources, [
      {
        kind: "setupCertificate",
        locator: "setup/certificate.json",
        required: false,
        reason: "not_found",
      },
    ]);
    assert.equal(JSON.stringify(result.snapshot).includes(root), false);
    assert.equal(JSON.stringify(result.snapshot).includes("run-a"), false);
  });

  it("produces identical semantic snapshots across roots and run IDs", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-"));
    tempRoots.push(parent);
    const firstRoot = await createSourceRoot(parent, "root-a");
    const secondRoot = await createSourceRoot(parent, "root-b");

    const first = await readLegacySourceSnapshot(request(firstRoot, "run-a"));
    const second = await readLegacySourceSnapshot(request(secondRoot, "run-b"));

    assert.ok(first.snapshot);
    assert.ok(second.snapshot);
    assert.deepEqual(second.snapshot, first.snapshot);
    assert.equal(hashCanonicalJson(second.snapshot), hashCanonicalJson(first.snapshot));
  });

  it("sorts set-like source arrays by normalized locator", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-"));
    tempRoots.push(parent);
    const root = await createSourceRoot(parent, "root-a");
    await writeFile(path.join(root, "generated", "a.tsx"), "a\n", "utf8");
    const value = request(root);
    value.sources.generatedSources = [
      { locator: "generated/screen.tsx", mediaType: "text/typescript", required: true },
      { locator: "generated/a.tsx", mediaType: "text/typescript", required: true },
    ];

    const result = await readLegacySourceSnapshot(value);
    assert.deepEqual(
      result.snapshot?.generatedSources.map((source) => source.locator),
      ["generated/a.tsx", "generated/screen.tsx"],
    );
  });

  it("returns no semantic snapshot when a required source is missing", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-"));
    tempRoots.push(parent);
    const root = await createSourceRoot(parent, "root-a");
    const value = request(root);
    value.sources.plan.locator = "missing-plan.json";

    const result = await readLegacySourceSnapshot(value);
    assert.equal(result.snapshot, undefined);
    assert.equal(
      result.missingSources.some((missing) =>
        missing.locator === "missing-plan.json"
        && missing.required
        && missing.reason === "not_found"),
      true,
    );
  });

  it("rejects traversal and absolute locators before reading", () => {
    const base = request("/tmp/source-root");
    for (const locator of ["../secret", "/tmp/secret", "generated/../secret"]) {
      const value = structuredClone(base);
      value.sources.task.locator = locator;
      assert.equal(LegacySourceSnapshotRequestV1Schema.safeParse(value).success, false);
    }
  });

  it("does not follow a declared source symlink outside the read root", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-"));
    tempRoots.push(parent);
    const root = await createSourceRoot(parent, "root-a");
    const outside = path.join(parent, "outside.json");
    await writeFile(outside, '{"secret":"must not be read"}\n', "utf8");
    await symlink(outside, path.join(root, "escaped.json"));
    const value = request(root);
    value.sources.plan.locator = "escaped.json";

    const result = await readLegacySourceSnapshot(value);
    assert.equal(result.snapshot, undefined);
    assert.deepEqual(result.missingSources.find((item) => item.kind === "plan"), {
      kind: "plan",
      locator: "escaped.json",
      required: true,
      reason: "outside_root",
    });
  });
});
