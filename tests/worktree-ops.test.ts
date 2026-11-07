import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inspectSubscriptionCodingWorktreeV1 } from "../src/execution/subscription-coding-worker-v1.js";

import { ensureStoryBranchWorktree, saveAndRemoveWorktree, NativeImplementationAssetError, writeStoryScopeSnapshot, applyScopedRetryPatchForStory, copyStitchToWorktree, createStoryWorktree, discardDirtyRetryWorktreeState, discardStoryWorktreeAndResetBranchExact, latestRetryPatchForStory } from "../src/installer/worktree-ops.js";
import { produceProductSpecV1 } from "../src/product-compiler/producers/product-spec.js";
import { produceDesignGenerationTargetsV1 } from "../src/product-compiler/producers/design-targets.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../src/product-compiler/producers/stitch-target-candidate-selection.js";
import {
  buildTestRenderedSemantics,
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./product-compiler/fixtures/stitch-artifacts.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function writeValidStitchV2Authority(repo: string): void {
  const product = produceProductSpecV1({
    task: "Build a compact status utility called Worktree Pulse. It has a refresh button and a ready/paused toggle. Keep status in localStorage. Do not add navigation or analytics.",
  });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const target = targets.generationTargets.targets[0]!;
  let ordinal = 1;
  const nextRef = () => `E${String(ordinal++).padStart(6, "0")}`;
  const html = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}" data-setfarm-element-ref="${nextRef()}">`,
    ...target.requiredActionRefs.map((actionRef) =>
      `<button data-action="${actionRef}" data-setfarm-element-ref="${nextRef()}">${actionRef}</button>`),
    ...target.requiredActionInputs.flatMap((input) => input.inputFields.map((field) =>
      `<input data-action-input="${input.actionRef}.${field}" data-setfarm-element-ref="${nextRef()}" />`)),
    "</main>",
  ].join(""), "worktree-authority");
  const screenshot = validStitchPng(4);
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "worktree-authority",
    batches: [{
      stageId: "stage-worktree",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId: "screen",
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts("screen", html, screenshot),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{ screenId: "screen", htmlBytes: html, screenshotBytes: screenshot }];
  const renderedSemantics = buildTestRenderedSemantics({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts,
  });
  const selected = selectStitchTargetCandidatesV1({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    renderedSemantics,
    artifacts,
    authorityMode: "clean_v3",
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected.diagnostics));
  if (selected.status !== "produced") return;
  const bound = bindStitchTargetCandidateSelectionsV2({
    generationTargets: targets.generationTargets,
    candidateSelection: selected.candidateSelection,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
  if (bound.status !== "produced") return;
  const stitch = path.join(repo, "stitch");
  fs.mkdirSync(path.join(stitch, "rendered-dom"), { recursive: true });
  for (const [name, value] of [
    ["GENERATION_TARGETS.json", targets.generationTargets],
    ["STITCH_DIRECT_RESPONSE_EVIDENCE.json", directResponseEvidence],
    ["STITCH_RENDERED_SEMANTICS.json", renderedSemantics],
    ["STITCH_TARGET_CANDIDATE_SELECTION.json", selected.candidateSelection],
    ["STITCH_RESPONSE_BINDINGS.json", bound.responseBindings],
  ] as const) {
    fs.writeFileSync(path.join(stitch, name), `${JSON.stringify(value)}\n`);
  }
  fs.writeFileSync(path.join(stitch, "screen.html"), html);
  fs.writeFileSync(path.join(stitch, "screen.png"), screenshot);
  fs.writeFileSync(path.join(stitch, "rendered-dom", "screen.html"), html);
}

describe("worktree operations", () => {

  it("prepares native audit assets on the exact completed branch without replacing its committed corpus", () => {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-audit-assets-")));
    const repo = path.join(tmp, "repo");
    try {
      fs.mkdirSync(repo);
      git(repo, ["init", "--initial-branch=main"]);
      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n.worktrees/\n.setfarm/\n");
      fs.writeFileSync(path.join(repo, "app.txt"), "base\n");
      for (const directory of ["references", "stitch"]) {
        fs.mkdirSync(path.join(repo, directory));
        fs.writeFileSync(path.join(repo, directory, "manual.txt"), "base corpus\n");
      }
      git(repo, ["add", "."]); git(repo, ["commit", "-m", "base"]);
      const baseSha = git(repo, ["rev-parse", "HEAD"]);
      git(repo, ["checkout", "-b", "audit-story"]);
      fs.writeFileSync(path.join(repo, "app.txt"), "completed implementation\n");
      for (const directory of ["references", "stitch"]) fs.writeFileSync(path.join(repo, directory, "manual.txt"), "committed story corpus\n");
      git(repo, ["add", "."]); git(repo, ["commit", "-m", "completed story"]);
      const storySha = git(repo, ["rev-parse", "HEAD"]);
      assert.notEqual(storySha, baseSha);
      git(repo, ["checkout", "main"]);
      const dependencies = path.join(repo, "node_modules");
      fs.mkdirSync(path.join(dependencies, "tiny"), { recursive: true });
      fs.mkdirSync(path.join(dependencies, ".bin"));
      const source = path.join(dependencies, "tiny", "tool.cjs");
      fs.writeFileSync(source, "module.exports = 'source';\n");
      fs.symlinkSync("../tiny/tool.cjs", path.join(dependencies, ".bin", "tiny"));

      // The old producer ignores the fourth argument and creates root aliases:
      // unchanged worker inspection is the genuine regression assertion.
      const review: string = Reflect.apply(ensureStoryBranchWorktree, undefined, [repo, "audit-story", undefined, "native-audit"]);
      assert.ok(review);
      assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(review, []));
      assert.equal(git(review, ["rev-parse", "HEAD"]), storySha);
      assert.equal(fs.readFileSync(path.join(review, "app.txt"), "utf8"), "completed implementation\n");
      for (const directory of ["references", "stitch"]) assert.equal(fs.readFileSync(path.join(review, directory, "manual.txt"), "utf8"), "committed story corpus\n");
      const copied = path.join(review, "node_modules", "tiny", "tool.cjs");
      assert.notEqual(fs.statSync(copied).ino, fs.statSync(source).ino);
      assert.equal(fs.statSync(copied).nlink, 1);
      assert.equal(fs.statSync(path.join(review, ".setfarm", "native-dependency-custody.json")).mode & 0o7777, 0o600);
      const inode = fs.statSync(copied).ino;
      assert.equal(Reflect.apply(ensureStoryBranchWorktree, undefined, [repo, "audit-story", undefined, "native-audit"]), review);
      assert.equal(fs.statSync(copied).ino, inode);
      assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(review, []));
      assert.equal(git(review, ["status", "--porcelain"]), "");
      fs.writeFileSync(copied, "private drift\n");
      assert.throws(() => Reflect.apply(ensureStoryBranchWorktree, undefined, [repo, "audit-story", undefined, "native-audit"]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
      assert.equal(fs.readFileSync(copied, "utf8"), "private drift\n");
      assert.equal(git(review, ["rev-parse", "HEAD"]), storySha);
      assert.equal(fs.readFileSync(source, "utf8"), "module.exports = 'source';\n");
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  it("uses a preferred native audit worktree and preserves unknown assets on refusal while legacy links remain unchanged", () => {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-audit-preferred-")));
    const repo = path.join(tmp, "repo"), preferred = path.join(tmp, "supervisor", "story-worktrees", "audit-story");
    try {
      fs.mkdirSync(repo);
      git(repo, ["init", "--initial-branch=main"]);
      git(repo, ["config", "user.email", "setfarm@example.invalid"]);git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\nreferences/\n.worktrees/\n.setfarm/\n");
      fs.writeFileSync(path.join(repo, "app.txt"), "completed code\n");
      git(repo, ["add", "."]);git(repo, ["commit", "-m", "base"]);
      git(repo, ["branch", "audit-story"]);git(repo, ["branch", "legacy-story"]);
      fs.mkdirSync(path.dirname(preferred), { recursive: true });git(repo, ["worktree", "add", preferred, "audit-story"]);
      const sha = git(preferred, ["rev-parse", "HEAD"]);
      fs.mkdirSync(path.join(repo, "node_modules", "tiny"), { recursive: true });
      fs.writeFileSync(path.join(repo, "node_modules", "tiny", "index.cjs"), "source dependency\n");
      fs.mkdirSync(path.join(repo, "references"));fs.writeFileSync(path.join(repo, "references", "manual.txt"), "external manual\n");
      const review: string = Reflect.apply(ensureStoryBranchWorktree, undefined, [repo, "audit-story", undefined, "native-audit", preferred]);
      assert.equal(review, preferred);
      assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(review, []));
      assert.equal(fs.existsSync(path.join(review, "references")), false);
      assert.equal(git(review, ["rev-parse", "HEAD"]), sha);
      const legacy = ensureStoryBranchWorktree(repo, "legacy-story");
      for (const name of ["node_modules", "references"]) assert.equal(fs.lstatSync(path.join(legacy, name)).isSymbolicLink(), true);
      assert.throws(() => inspectSubscriptionCodingWorktreeV1(legacy, []));
      fs.symlinkSync(path.join(repo, "references"), path.join(review, "references"));
      const oldDependencyInode = fs.statSync(path.join(review, "node_modules")).ino;
      assert.throws(() => Reflect.apply(ensureStoryBranchWorktree, undefined, [repo, "audit-story", undefined, "native-audit", preferred]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
      assert.equal(fs.readlinkSync(path.join(review, "references")), path.join(repo, "references"));
      assert.equal(fs.statSync(path.join(review, "node_modules")).ino, oldDependencyInode);
      assert.equal(git(review, ["rev-parse", "HEAD"]), sha);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
  it("prepares private native implementation dependencies for the unchanged worker inspector and preserves legacy assets", () => {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-private-native-assets-")));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    try {
      git(tmp, ["init", "--bare", "--initial-branch=main", origin]);
      git(tmp, ["clone", origin, repo]);
      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n.worktrees/\n.setfarm/\n");
      fs.writeFileSync(path.join(repo, "README.md"), "private native assets fixture\n");
      git(repo, ["add", ".gitignore", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);
      const baseSha = git(repo, ["rev-parse", "HEAD"]);
      const dependencies = path.join(repo, "node_modules");
      fs.mkdirSync(path.join(dependencies, "tiny", "bin"), { recursive: true });
      fs.mkdirSync(path.join(dependencies, ".bin"));
      const sourceFile = path.join(dependencies, "tiny", "index.cjs");
      const sourceBytes = "module.exports = 'original dependency';\n";
      fs.writeFileSync(sourceFile, sourceBytes);
      fs.linkSync(sourceFile, path.join(dependencies, "tiny", "alias.cjs"));
      fs.writeFileSync(path.join(dependencies, "tiny", "bin", "cli.cjs"), "#!/usr/bin/env node\n", { mode: 0o755 });
      fs.symlinkSync("../tiny/bin/cli.cjs", path.join(dependencies, ".bin", "tiny"));
      const nestedModules = path.join(dependencies, "tiny", "node_modules");
      fs.mkdirSync(path.join(nestedModules, "nested-tool", "bin"), { recursive: true });
      fs.mkdirSync(path.join(nestedModules, ".bin"));
      fs.writeFileSync(path.join(nestedModules, "nested-tool", "bin", "cli.cjs"), "#!/usr/bin/env node\n", { mode: 0o755 });
      fs.symlinkSync("../nested-tool/bin/cli.cjs", path.join(nestedModules, ".bin", "nested-tool"));
      const sourceIdentity = fs.statSync(sourceFile);
      assert.equal(sourceIdentity.nlink, 2);

      const legacy = createStoryWorktree(repo, "legacy-assets", baseSha);
      assert.ok(legacy);
      assert.equal(fs.lstatSync(path.join(legacy, "node_modules")).isSymbolicLink(), true);
      assert.equal(fs.realpathSync(path.join(legacy, "node_modules")), dependencies);

      // Reflect.apply keeps the old producer callable for an honest behavioral
      // RED: its existing implementation ignores the optional native choice.
      const native: string = Reflect.apply(createStoryWorktree, undefined,
        [repo, "native-assets", baseSha, undefined, "native-implementation"]);
      assert.ok(native);
      writeStoryScopeSnapshot(native, ["README.md"]);
      assert.equal(fs.readFileSync(path.join(native, ".story-scope-files"), "utf8"), "README.md\n");
      assert.equal(fs.statSync(path.join(native, ".story-scope-files")).mode & 0o7777, 0o600);
      assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(native, []));
      const nativeDependencies = path.join(native, "node_modules");
      assert.equal(fs.lstatSync(nativeDependencies).isDirectory(), true);
      assert.equal(fs.lstatSync(nativeDependencies).isSymbolicLink(), false);
      const copied = path.join(nativeDependencies, "tiny", "index.cjs");
      const copiedAlias = path.join(nativeDependencies, "tiny", "alias.cjs");
      const copiedIdentity = fs.statSync(copied);
      assert.equal(copiedIdentity.nlink, 1);
      assert.equal(fs.statSync(copiedAlias).nlink, 1);
      assert.notEqual(copiedIdentity.ino, sourceIdentity.ino);
      assert.notEqual(copiedIdentity.ino, fs.statSync(copiedAlias).ino);
      assert.equal(fs.readFileSync(copied, "utf8"), sourceBytes);
      assert.equal(fs.readlinkSync(path.join(nativeDependencies, ".bin", "tiny")), "../tiny/bin/cli.cjs");
      assert.equal(fs.statSync(path.join(nativeDependencies, "tiny", "bin", "cli.cjs")).mode & 0o111, 0o111);
      const nestedLink = path.join(nativeDependencies, "tiny", "node_modules", ".bin", "nested-tool");
      assert.equal(fs.readlinkSync(nestedLink), "../nested-tool/bin/cli.cjs");
      assert.equal(fs.realpathSync(nestedLink), path.join(nativeDependencies, "tiny", "node_modules", "nested-tool", "bin", "cli.cjs"));
      const reused: string = Reflect.apply(createStoryWorktree, undefined,
        [repo, "native-assets", baseSha, undefined, "native-implementation"]);
      assert.equal(reused, native);
      assert.equal(fs.statSync(copied).ino, copiedIdentity.ino);
      assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(reused, []));
      const marker = path.join(native, ".setfarm", "native-dependency-custody.json");
      assert.equal(fs.statSync(marker).mode & 0o7777, 0o600);
      assert.equal(git(native, ["status", "--porcelain"]), "");
      fs.writeFileSync(copied, "private change\n");
      assert.equal(fs.readFileSync(sourceFile, "utf8"), sourceBytes);
      assert.equal(fs.readFileSync(copiedAlias, "utf8"), sourceBytes);
      assert.equal(fs.statSync(sourceFile).nlink, 2);
      assert.equal(git(repo, ["rev-parse", "HEAD"]), baseSha);
      assert.equal(git(native, ["rev-parse", "HEAD"]), baseSha);
      assert.throws(() => Reflect.apply(createStoryWorktree, undefined,
        [repo, "native-assets", baseSha, undefined, "native-implementation"]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
      assert.equal(fs.readFileSync(copied, "utf8"), "private change\n");
      const unknown = createStoryWorktree(repo, "unknown-assets", baseSha);
      fs.unlinkSync(path.join(unknown, "node_modules"));
      fs.mkdirSync(path.join(unknown, "node_modules"));
      fs.writeFileSync(path.join(unknown, "node_modules", "sentinel"), "unknown bytes\n");
      assert.throws(() => Reflect.apply(createStoryWorktree, undefined,
        [repo, "unknown-assets", baseSha, undefined, "native-implementation"]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
      assert.equal(fs.readFileSync(path.join(unknown, "node_modules", "sentinel"), "utf8"), "unknown bytes\n");
      fs.mkdirSync(path.join(repo, ".setfarm"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".setfarm", "outside.cjs"), "outside dependency\n");
      fs.symlinkSync("../../.setfarm/outside.cjs", path.join(dependencies, ".bin", "escape"));
      assert.throws(() => Reflect.apply(createStoryWorktree, undefined,
        [repo, "escaping-assets", baseSha, undefined, "native-implementation"]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("replaces stale worktree Stitch bytes when v2 output authority exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-v2-copy-"));
    const repo = path.join(tmp, "repo");
    const worktree = path.join(tmp, "worktree");
    try {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(worktree, "stitch"), { recursive: true });
      writeValidStitchV2Authority(repo);
      fs.writeFileSync(path.join(worktree, "stitch", "screen.html"), "stale html\n");
      fs.writeFileSync(path.join(worktree, "stitch", "stale-only.html"), "stale only\n");

      copyStitchToWorktree(repo, worktree);

      assert.deepEqual(
        fs.readFileSync(path.join(worktree, "stitch", "screen.html")),
        fs.readFileSync(path.join(repo, "stitch", "screen.html")),
      );
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "stale-only.html")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "STITCH_TARGET_CANDIDATE_SELECTION.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "STITCH_RENDERED_SEMANTICS.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "rendered-dom", "screen.html")), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("refuses to copy a tampered rendered-semantics sidecar into a story worktree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-v2-tamper-"));
    const repo = path.join(tmp, "repo");
    const worktree = path.join(tmp, "worktree");
    try {
      fs.mkdirSync(worktree, { recursive: true });
      writeValidStitchV2Authority(repo);
      fs.appendFileSync(path.join(repo, "stitch", "rendered-dom", "screen.html"), "<!-- tampered -->");

      assert.throws(
        () => copyStitchToWorktree(repo, worktree),
        (error: unknown) => (error as { code?: string }).code === "STITCH_WORKTREE_AUTHORITY_INVALID",
      );
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "STITCH_RESPONSE_BINDINGS.json")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("supports macOS worktree process cleanup via lsof", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/worktree-ops.ts"), "utf-8");

    assert.match(source, /process\.platform === "darwin"/);
    assert.match(source, /execFileSync\("lsof",\s*\["-t",\s*"\+D",\s*dir\]/);
    assert.match(source, /process\.kill\(pid,\s*"SIGTERM"\)/);
    assert.match(source, /process\.kill\(pid,\s*"SIGKILL"\)/);
  });

  it("recovers when the main project worktree is left on the story branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-001";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      git(repo, ["checkout", "-b", storyBranch]);
      fs.writeFileSync(path.join(repo, "story.txt"), "story\n");
      git(repo, ["add", "story.txt"]);
      git(repo, ["commit", "-m", "story"]);
      git(repo, ["push", "-u", "origin", storyBranch]);
      assert.equal(git(repo, ["branch", "--show-current"]), storyBranch);

      const worktree = createStoryWorktree(repo, storyBranch, "main");

      assert.ok(worktree.endsWith(path.join(".worktrees", storyBranch)));
      assert.ok(fs.existsSync(path.join(worktree, "story.txt")));
      assert.equal(git(repo, ["branch", "--show-current"]), "main");
      assert.equal(git(worktree, ["branch", "--show-current"]), storyBranch);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not hand a dirty reused story worktree to the next claim", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-dirty-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-qa-fix-001";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(firstWorktree, "dirty.txt"), "uncommitted retry context\n");
      fs.writeFileSync(path.join(firstWorktree, "AGENTS.md"), "# OpenClaw workspace instructions\n");
      fs.mkdirSync(path.join(firstWorktree, ".openclaw"), { recursive: true });
      fs.writeFileSync(path.join(firstWorktree, ".openclaw", "workspace-state.json"), "{}\n");
      assert.notEqual(git(firstWorktree, ["status", "--porcelain"]), "");

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.equal(git(secondWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.existsSync(path.join(secondWorktree, "dirty.txt")), false);
      assert.match(git(repo, ["stash", "list"]), /setfarm-auto-stash dirty story worktree before c62e1bc1-qa-fix-001/);
      const retryPatch = latestRetryPatchForStory(repo, storyBranch);
      assert.ok(retryPatch.endsWith(".patch"));
      const retryPatchBody = fs.readFileSync(retryPatch, "utf-8");
      assert.match(retryPatchBody, /dirty\.txt/);
      assert.match(retryPatchBody, /uncommitted retry context/);
      assert.doesNotMatch(retryPatchBody, /AGENTS\.md|workspace-state\.json|\.openclaw/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("replaces a managed story worktree path that was left as a normal git repository", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-gitdir-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-009";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const stalePath = path.join(repo, ".worktrees", storyBranch);
      fs.mkdirSync(stalePath, { recursive: true });
      execFileSync("git", ["init", "--initial-branch=main"], {
        cwd: stalePath,
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(fs.lstatSync(path.join(stalePath, ".git")).isDirectory(), true);

      const worktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(worktree, stalePath);
      assert.equal(fs.lstatSync(path.join(worktree, ".git")).isFile(), true);
      assert.equal(git(worktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.readFileSync(path.join(worktree, "README.md"), "utf-8"), "base\n");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("finds retry patches captured under run-prefixed story branches", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-patch-"));
    const repo = path.join(tmp, "repo");

    try {
      fs.mkdirSync(path.join(repo, ".setfarm", "retry-patches"), { recursive: true });
      const patchPath = path.join(repo, ".setfarm", "retry-patches", "257439ea-qa-fix-001-2026-06-05T07-03-48-938Z.patch");
      fs.writeFileSync(patchPath, "diff --git a/src/App.tsx b/src/App.tsx\n");

      assert.equal(latestRetryPatchForStory(repo, "QA-FIX-001"), patchPath);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not reuse a clean story worktree when main advanced underneath it", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-stale-base-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-qa-fix-002";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base v1\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base v1"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      assert.equal(fs.readFileSync(path.join(firstWorktree, "README.md"), "utf-8"), "base v1\n");
      assert.equal(git(firstWorktree, ["status", "--porcelain"]), "");

      fs.writeFileSync(path.join(repo, "README.md"), "base v2\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base v2"]);
      git(repo, ["push", "origin", "main"]);

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.equal(git(secondWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.readFileSync(path.join(secondWorktree, "README.md"), "utf-8"), "base v2\n");
      assert.equal(git(secondWorktree, ["rev-parse", "HEAD"]), git(repo, ["rev-parse", "main"]));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not let assume-unchanged tracked source changes hide in a reused worktree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-hidden-index-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-006";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const value = 'base';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(firstWorktree, "src", "App.tsx"), "export const value = 'stale hidden';\n");
      git(firstWorktree, ["update-index", "--assume-unchanged", "src/App.tsx"]);
      assert.equal(git(firstWorktree, ["status", "--porcelain"]), "");
      assert.match(git(firstWorktree, ["ls-files", "-v", "src/App.tsx"]), /^h /);

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(fs.readFileSync(path.join(secondWorktree, "src", "App.tsx"), "utf-8"), "export const value = 'base';\n");
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.match(git(secondWorktree, ["ls-files", "-v", "src/App.tsx"]), /^H /);
      assert.match(git(repo, ["stash", "list"]), /setfarm-auto-stash dirty story worktree before c62e1bc1-us-006/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discards dirty tracked files before retry context reaches an agent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-clean-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-007";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "src", "App.tsx"), "export const marker = 'failed retry shell';\n");
      assert.match(git(worktree, ["status", "--porcelain"]), /src\/App\.tsx/);

      const discarded = discardDirtyRetryWorktreeState(worktree, "US-007", "run-test");

      assert.deepEqual(discarded, ["src/App.tsx"]);
      assert.equal(git(worktree, ["status", "--porcelain"]), "");
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'clean';\n");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("restores the latest retry patch when every touched file is inside story scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-restore-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-008";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "src", "App.tsx"), "export const marker = 'failed attempt';\n");
      const retryWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(retryWorktree, worktree);
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'clean';\n");
      assert.ok(latestRetryPatchForStory(repo, storyBranch));

      const restored = applyScopedRetryPatchForStory(repo, worktree, storyBranch, ["src/App.tsx"], "run-test");

      assert.equal(restored.applied, true);
      assert.deepEqual(restored.touchedFiles, ["src/App.tsx"]);
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'failed attempt';\n");
      assert.match(git(worktree, ["status", "--porcelain"]), /src\/App\.tsx/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not restore retry patches that touch files outside story scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-restore-deny-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-009";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      fs.writeFileSync(path.join(repo, "package.json"), "{\"scripts\":{}}\n");
      git(repo, ["add", "src/App.tsx", "package.json"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "package.json"), "{\"scripts\":{\"test\":\"vitest\"}}\n");
      createStoryWorktree(repo, storyBranch, "main");

      const restored = applyScopedRetryPatchForStory(repo, worktree, storyBranch, ["src/App.tsx"], "run-test");

      assert.equal(restored.applied, false);
      assert.equal(restored.reason, "out_of_scope");
      assert.deepEqual(restored.touchedFiles, ["package.json"]);
      assert.equal(git(worktree, ["status", "--porcelain"]), "");
      assert.equal(fs.readFileSync(path.join(worktree, "package.json"), "utf-8"), "{\"scripts\":{}}\n");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not auto-stash product supervisor memory from the main repo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-internal-main-dirty-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-005";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      fs.writeFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "legacy memory\n");
      git(repo, ["add", "README.md", "SUPERVISOR_MEMORY.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      fs.writeFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "updated manager memory\n");
      assert.match(git(repo, ["status", "--porcelain"]), /SUPERVISOR_MEMORY\.md/);

      const worktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(git(repo, ["stash", "list"]), "");
      assert.equal(git(worktree, ["branch", "--show-current"]), storyBranch);
      assert.match(git(repo, ["status", "--porcelain"]), /SUPERVISOR_MEMORY\.md/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("releases stale managed supervisor worktrees before retrying a story branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-supervisor-lock-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const supervisorWorktree = path.join(tmp, "supervisor", "story-worktrees", "c62e1bc1-us-004");
    const storyBranch = "c62e1bc1-us-004";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);
      git(repo, ["branch", storyBranch, "main"]);
      fs.mkdirSync(path.dirname(supervisorWorktree), { recursive: true });
      git(repo, ["worktree", "add", supervisorWorktree, storyBranch]);

      assert.equal(git(supervisorWorktree, ["branch", "--show-current"]), storyBranch);

      const retryWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.ok(retryWorktree.endsWith(path.join(".worktrees", storyBranch)));
      assert.equal(git(retryWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.existsSync(supervisorWorktree), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discards guarded retry worktrees instead of preserving WIP history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-guard-discard-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-002";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);
      const baseSha = git(repo, ["rev-parse", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, baseSha);
      fs.writeFileSync(path.join(worktree, "bad.txt"), "contaminated\n");
      git(worktree, ["add", "bad.txt"]);
      git(worktree, ["commit", "-m", "wip: contaminated runtime guard attempt"]);
      git(worktree, ["push", "-u", "origin", storyBranch]);
      assert.ok(fs.existsSync(worktree));
      assert.notEqual(git(worktree, ["rev-parse", "HEAD"]), baseSha);

      discardStoryWorktreeAndResetBranchExact(repo, storyBranch, baseSha);

      assert.equal(fs.existsSync(worktree), false);
      assert.equal(git(repo, ["rev-parse", storyBranch]), baseSha);
      assert.throws(() => git(repo, ["ls-remote", "--exit-code", "origin", storyBranch]));

      const cleanWorktree = createStoryWorktree(repo, storyBranch, baseSha);
      assert.equal(git(cleanWorktree, ["rev-parse", "HEAD"]), baseSha);
      assert.equal(fs.existsSync(path.join(cleanWorktree, "bad.txt")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("removes a guarded story branch registered in another managed worktree root", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-exact-registered-"));
    const remote = path.join(tmp, "remote.git");
    const repo = path.join(tmp, "repo");
    const managed = path.join(tmp, "story-worktrees", "run12345-story-1");
    const storyBranch = "run12345-story-1";
    try {
      git(tmp, ["init", "--bare", remote]);
      git(tmp, ["clone", remote, repo]);
      git(repo, ["checkout", "-b", "main"]);
      git(repo, ["config", "user.email", "setfarm-test@example.com"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "-u", "origin", "main"]);
      const baseSha = git(repo, ["rev-parse", "main"]);

      fs.mkdirSync(path.dirname(managed), { recursive: true });
      git(repo, ["worktree", "add", "-b", storyBranch, managed, baseSha]);
      fs.writeFileSync(path.join(managed, "bad.txt"), "untracked contamination\n");
      git(managed, ["add", "bad.txt"]);
      git(managed, ["commit", "-m", "wip: guarded contamination"]);
      assert.ok(fs.existsSync(managed));
      assert.notEqual(git(managed, ["rev-parse", "HEAD"]), baseSha);

      discardStoryWorktreeAndResetBranchExact(repo, storyBranch, baseSha);

      assert.equal(fs.existsSync(managed), false);
      assert.equal(git(repo, ["rev-parse", storyBranch]), baseSha);
      assert.doesNotMatch(git(repo, ["worktree", "list", "--porcelain"]), new RegExp(`refs/heads/${storyBranch}`));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not reuse story branches with WIP retry history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-wip-history-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-003";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);
      const baseSha = git(repo, ["rev-parse", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, baseSha);
      fs.writeFileSync(path.join(firstWorktree, "bad.txt"), "contaminated\n");
      git(firstWorktree, ["add", "bad.txt"]);
      git(firstWorktree, ["commit", "-m", "wip: contaminated history"]);
      git(firstWorktree, ["push", "-u", "origin", storyBranch]);

      const secondWorktree = createStoryWorktree(repo, storyBranch, baseSha);

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["rev-parse", "HEAD"]), baseSha);
      assert.equal(fs.existsSync(path.join(secondWorktree, "bad.txt")), false);
      assert.equal(git(repo, ["rev-parse", storyBranch]), baseSha);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

import ts from "typescript";

function actualAuditHelperForTest(): (...args: any[]) => string {
  const filename = path.join(process.cwd(), "src/installer/step-ops.ts");
  const text = fs.readFileSync(filename, "utf8");
  const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = ["stripSetfarmGitWrapperPath", "platformGitEnv", "execPlatformGit",
    "storyWorkdirMatchesBranch", "ensureStoryAuditWorkdir"];
  const declarations = names.map(name => {
    const rows = tree.statements.filter((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(rows.length, 1, `actual private production function required: ${name}`);
    return rows[0]!.getText(tree).replace(/^export\s+/, "");
  });
  const body = ts.transpileModule(declarations.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  // Only logger is a sink. Every Git/filesystem/producer port below is real.
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  return new Function("fs", "os", "path", "execFileSync", "ensureStoryBranchWorktree",
    "NativeImplementationAssetError", "logger", body + ";return ensureStoryAuditWorkdir;")(
      fs, os, path, execFileSync, ensureStoryBranchWorktree, NativeImplementationAssetError, logger);
}

it("native audit helper prepares the current matching worktree and preserves typed custody refusal", () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-audit-helper-current-")));
  const repo = path.join(tmp, "repo");
  const current = path.join(tmp, "supervisor", "story-worktrees", "audit-helper-story");
  try {
    fs.mkdirSync(repo);
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.email", "setfarm@example.invalid"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\nreferences/\n.worktrees/\n.setfarm/\n");
    fs.writeFileSync(path.join(repo, "app.txt"), "base\n");
    git(repo, ["add", "."]); git(repo, ["commit", "-m", "base"]);
    git(repo, ["checkout", "-b", "audit-helper-story"]);
    fs.writeFileSync(path.join(repo, "app.txt"), "completed story\n");
    git(repo, ["add", "app.txt"]); git(repo, ["commit", "-m", "completed story"]);
    const storySha = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["checkout", "main"]);
    fs.mkdirSync(path.dirname(current), { recursive: true });
    git(repo, ["worktree", "add", current, "audit-helper-story"]);
    const sourceDependencies = path.join(repo, "node_modules");
    fs.mkdirSync(path.join(sourceDependencies, "tiny"), { recursive: true });
    const sourceFile = path.join(sourceDependencies, "tiny", "index.cjs");
    fs.writeFileSync(sourceFile, "module.exports = 'original dependency';\n");
    fs.mkdirSync(path.join(repo, "references"));
    fs.writeFileSync(path.join(repo, "references", "manual.txt"), "external corpus\n");
    const context = { repo, story_workdir: current, story_branch: "audit-helper-story" };
    const helper = actualAuditHelperForTest();

    // Old helper ignores arg7 and returns current before actual asset production.
    const selected = Reflect.apply(helper, undefined,
      [context, "audit-helper-story", undefined, "run-component", "US-001", "supervise_each", "native-audit"]);
    assert.equal(selected, current);
    assert.equal(context.story_workdir, current);
    const copiedFile = path.join(current, "node_modules", "tiny", "index.cjs");
    assert.equal(fs.existsSync(copiedFile), true, "native current-path audit must prepare private dependencies");
    assert.equal(fs.readFileSync(copiedFile, "utf8"), "module.exports = 'original dependency';\n");
    assert.notEqual(fs.statSync(copiedFile).ino, fs.statSync(sourceFile).ino);
    assert.equal(fs.statSync(copiedFile).nlink, 1);
    assert.doesNotThrow(() => inspectSubscriptionCodingWorktreeV1(current, []));
    assert.equal(git(current, ["rev-parse", "HEAD"]), storySha);
    assert.equal(fs.readFileSync(path.join(current, "app.txt"), "utf8"), "completed story\n");

    // A stale context on another branch is not a preferred audit worktree.
    assert.equal(Reflect.apply(helper, undefined,
      [{ ...context, story_workdir: repo }, "audit-helper-story", undefined, "run-component", "US-001", "supervise_each", "native-audit"]), current);

    // Genuine custody drift, no mocked throw and no cleanup of changed bytes.
    fs.writeFileSync(copiedFile, "private dependency drift\n");
    const inode = fs.statSync(copiedFile).ino;
    assert.throws(() => Reflect.apply(helper, undefined,
      [context, "audit-helper-story", undefined, "run-component", "US-001", "supervise_each", "native-audit"]), NativeImplementationAssetError);
    assert.equal(fs.readFileSync(copiedFile, "utf8"), "private dependency drift\n");
    assert.equal(fs.statSync(copiedFile).ino, inode);
    assert.equal(fs.readFileSync(sourceFile, "utf8"), "module.exports = 'original dependency';\n");
    assert.equal(git(current, ["rev-parse", "HEAD"]), storySha);
    // Legacy current-path reuse remains unchanged, without repairing the drift.
    assert.equal(Reflect.apply(helper, undefined,
      [context, "audit-helper-story", undefined, "run-component", "US-001", "supervise_each"]), current);
    assert.equal(fs.readFileSync(copiedFile, "utf8"), "private dependency drift\n");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});


it("native audit refuses a foreign preferred repository with the same branch before publishing dependencies", () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-audit-foreign-")));
  const repo = path.join(tmp, "repo"), foreign = path.join(tmp, "foreign");
  try {
    for (const directory of [repo, foreign]) {
      fs.mkdirSync(directory);
      git(directory, ["init", "--initial-branch=main"]);
      git(directory, ["config", "user.email", "setfarm@example.invalid"]);git(directory, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(directory, ".gitignore"), "node_modules/\n.worktrees/\n.setfarm/\n");
      fs.writeFileSync(path.join(directory, "app.txt"), "preserve original bytes\n");
      git(directory, ["add", "."]);git(directory, ["commit", "-m", "base"]);
      git(directory, ["branch", "audit-story"]);
    }
    git(foreign, ["checkout", "audit-story"]);
    fs.mkdirSync(path.join(repo, "node_modules", "tiny"), { recursive: true });
    fs.writeFileSync(path.join(repo, "node_modules", "tiny", "index.cjs"), "dependency\n");
    assert.throws(() => Reflect.apply(ensureStoryBranchWorktree, undefined,
      [repo, "audit-story", undefined, "native-audit", foreign]), /NATIVE_IMPLEMENTATION_ASSETS_REFUSED/);
    assert.equal(fs.existsSync(path.join(foreign, "node_modules")), false);
    assert.equal(fs.existsSync(path.join(foreign, ".setfarm")), false);
    assert.equal(fs.readFileSync(path.join(foreign, "app.txt"), "utf8"), "preserve original bytes\n");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});


// Real Git fixtures: swallowing a failed commit/push must never remove these bytes.
function savedWorktreeFixture() {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-save-worktree-")));
  const repo = path.join(tmp, "repo");
  const origin = path.join(tmp, "origin.git");
  const worktree = path.join(repo, ".worktrees", "save-story");
  fs.mkdirSync(repo);
  git(repo, ["init", "--initial-branch=main"]);
  git(repo, ["config", "user.email", "setfarm@example.invalid"]);
  git(repo, ["config", "user.name", "Setfarm Test"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  const hooks = path.join(tmp, "hooks");
  fs.mkdirSync(hooks);
  git(repo, ["config", "core.hooksPath", hooks]);
  fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules\n.worktrees/\n");
  fs.writeFileSync(path.join(repo, "app.txt"), "base source\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "base"]);
  git(tmp, ["init", "--bare", origin]);
  git(repo, ["remote", "add", "origin", origin]);
  git(repo, ["worktree", "add", "-b", "save-story", worktree]);
  const dependencies = path.join(tmp, "dependencies");
  fs.mkdirSync(dependencies);
  fs.writeFileSync(path.join(dependencies, "retained.txt"), "shared dependency\n");
  fs.symlinkSync(dependencies, path.join(worktree, "node_modules"));
  return { tmp, repo, origin, worktree, dependencies, hooks };
}

function assertSavedWorktreeRetained(fixture: ReturnType<typeof savedWorktreeFixture>, source: string): void {
  assert.equal(fs.existsSync(fixture.worktree), true, "worktree must survive failed preservation");
  assert.equal(fs.readFileSync(path.join(fixture.worktree, "app.txt"), "utf8"), source);
  const link = path.join(fixture.worktree, "node_modules");
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true, "dependency link must survive failed preservation");
  assert.equal(fs.readlinkSync(link), fixture.dependencies);
  assert.equal(fs.readFileSync(path.join(link, "retained.txt"), "utf8"), "shared dependency\n");
}

describe("save-and-remove preservation", () => {
  it("preserves dirty worktree and dependency link when commit hook rejects save", () => {
    const fixture = savedWorktreeFixture();
    try {
      fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "unique unsaved source\n");
      fs.writeFileSync(path.join(fixture.hooks, "pre-commit"), "#!/bin/sh\necho fixture-commit-rejected >&2\nexit 1\n", { mode: 0o755 });
      let failure: unknown;
      try { saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story"); } catch (error) { failure = error; }
      assertSavedWorktreeRetained(fixture, "unique unsaved source\n");
      assert.ok(failure instanceof Error, "failed preservation must be reported to the caller");
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  it("preserves committed worktree and dependency link when remote rejects saved push", () => {
    const fixture = savedWorktreeFixture();
    try {
      fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "unique saved source\n");
      fs.writeFileSync(path.join(fixture.origin, "hooks", "pre-receive"), "#!/bin/sh\necho fixture-push-rejected >&2\nexit 1\n", { mode: 0o755 });
      let failure: unknown;
      try { saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story"); } catch (error) { failure = error; }
      assertSavedWorktreeRetained(fixture, "unique saved source\n");
      assert.equal(git(fixture.worktree, ["status", "--porcelain"]), "");
      assert.equal(git(fixture.worktree, ["show", "HEAD:app.txt"]), "unique saved source");
      assert.ok(failure instanceof Error, "failed preservation must be reported to the caller");
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  it("preserves clean worktree with local commits when remote rejects push", () => {
    const fixture = savedWorktreeFixture();
    try {
      fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "committed local source\n");
      git(fixture.worktree, ["add", "app.txt"]);
      git(fixture.worktree, ["commit", "-m", "local source"]);
      const savedHead = git(fixture.worktree, ["rev-parse", "HEAD"]);
      fs.writeFileSync(path.join(fixture.origin, "hooks", "pre-receive"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      assert.throws(() => saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story"));
      assertSavedWorktreeRetained(fixture, "committed local source\n");
      assert.equal(git(fixture.worktree, ["rev-parse", "HEAD"]), savedHead);
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  for (const invalid of ["missing", "broken", "branch mismatch", "case mismatch", "detached", "index locked", "status failure"] as const) {
    it(`preserves worktree with ${invalid} Git state`, () => {
      const fixture = savedWorktreeFixture();
      try {
        fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "retained invalid-state source\n");
        const marker = path.join(fixture.worktree, ".git");
        const gitDir = git(fixture.worktree, ["rev-parse", "--absolute-git-dir"]);
        if (invalid === "missing") fs.unlinkSync(marker);
        if (invalid === "broken") fs.writeFileSync(marker, "gitdir: /nonexistent/setfarm-test-gitdir\n");
        if (invalid === "branch mismatch") git(fixture.worktree, ["switch", "-c", "another-story"]);
        if (invalid === "case mismatch") {
          git(fixture.worktree, ["branch", "-m", "temporary-case-rename"]);
          git(fixture.worktree, ["branch", "-m", "Save-Story"]);
        }
        if (invalid === "detached") git(fixture.worktree, ["checkout", "--detach"]);
        if (invalid === "index locked") fs.writeFileSync(path.join(gitDir, "index.lock"), "fixture lock\n");
        if (invalid === "status failure") fs.writeFileSync(path.join(gitDir, "index"), "invalid index\n");
        assert.throws(() => saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story"));
        assertSavedWorktreeRetained(fixture, "retained invalid-state source\n");
        assert.throws(() => git(fixture.repo, ["ls-remote", "--exit-code", "origin", "refs/heads/save-story"]), "invalid identity/state must not push");
      } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
    });
  }

  it("preserves foreign linked worktree even when its branch matches", () => {
    const fixture = savedWorktreeFixture();
    const foreign = savedWorktreeFixture();
    try {
      assert.throws(() => saveAndRemoveWorktree(fixture.repo, foreign.worktree, "save-story"));
      assertSavedWorktreeRetained(foreign, "base source\n");
      assert.throws(() => git(foreign.repo, ["ls-remote", "--exit-code", "origin", "refs/heads/save-story"]));
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
      fs.rmSync(foreign.tmp, { recursive: true, force: true });
    }
  });

  it("preserves supplied primary repository instead of treating it as a linked worktree", () => {
    const fixture = savedWorktreeFixture();
    try {
      git(fixture.repo, ["switch", "-c", "primary-story"]);
      assert.throws(() => saveAndRemoveWorktree(fixture.repo, fixture.repo, "primary-story"));
      assert.equal(fs.readFileSync(path.join(fixture.repo, "app.txt"), "utf8"), "base source\n");
      assert.equal(fs.statSync(path.join(fixture.repo, ".git")).isDirectory(), true);
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  it("preserves separate-git-dir primary under a managed path without saving or pushing", () => {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-separate-primary-")));
    const primary = path.join(tmp, ".worktrees", "save-story");
    const metadata = path.join(tmp, "primary.git");
    const origin = path.join(tmp, "origin.git");
    const dependencies = path.join(tmp, "dependencies");
    try {
      fs.mkdirSync(primary, { recursive: true });
      git(primary, ["init", "--initial-branch=save-story", "--separate-git-dir", metadata]);
      git(primary, ["config", "user.email", "setfarm@example.invalid"]);
      git(primary, ["config", "user.name", "Setfarm Test"]);
      git(primary, ["config", "commit.gpgsign", "false"]);
      git(primary, ["config", "core.hooksPath", path.join(tmp, "empty-hooks")]);
      fs.writeFileSync(path.join(primary, ".gitignore"), "node_modules\n");
      fs.writeFileSync(path.join(primary, "app.txt"), "base primary source\n");
      git(primary, ["add", "."]);
      git(primary, ["commit", "-m", "base primary"]);
      const originalHead = git(primary, ["rev-parse", "HEAD"]);
      git(tmp, ["init", "--bare", origin]);
      git(primary, ["remote", "add", "origin", origin]);
      fs.mkdirSync(dependencies);
      fs.symlinkSync(dependencies, path.join(primary, "node_modules"));
      fs.writeFileSync(path.join(primary, "app.txt"), "unique primary source\n");
      let failure: unknown;
      try { saveAndRemoveWorktree(primary, primary, "save-story"); } catch (error) { failure = error; }
      assert.equal(fs.existsSync(primary), true, "separate-git-dir primary must survive cleanup");
      assert.equal(fs.readFileSync(path.join(primary, "app.txt"), "utf8"), "unique primary source\n");
      assert.equal(fs.lstatSync(path.join(primary, "node_modules")).isSymbolicLink(), true);
      assert.equal(fs.readlinkSync(path.join(primary, "node_modules")), dependencies);
      assert.ok(failure instanceof Error, "primary must be refused before preservation mutates Git");
      assert.equal(git(primary, ["rev-parse", "HEAD"]), originalHead, "primary must not be auto-committed");
      assert.equal(git(primary, ["diff", "--cached", "--name-only"]), "", "primary must not be staged");
      assert.equal(git(origin, ["for-each-ref", "--format=%(refname)"]), "", "primary must not be pushed");
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  for (const change of ["dirty source", "new HEAD", "changed branch"] as const) {
    it(`preserves worktree when successful push leaves ${change}`, () => {
      const fixture = savedWorktreeFixture();
      try {
        const savedHead = git(fixture.worktree, ["rev-parse", "HEAD"]);
        const mutation = change === "changed branch"
          ? "git switch -c another-story"
          : "printf 'source changed during push\\n' > app.txt" + (change === "new HEAD"
            ? "\ngit add app.txt\ngit commit -m hook-local-commit" : "");
        fs.writeFileSync(path.join(fixture.hooks, "pre-push"), `#!/bin/sh\nset -e\n${mutation}\n`, { mode: 0o755 });
        assert.throws(() => saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story"));
        assertSavedWorktreeRetained(fixture, change === "changed branch" ? "base source\n" : "source changed during push\n");
        assert.equal(git(fixture.repo, ["ls-remote", "origin", "refs/heads/save-story"]).split(/\s/)[0], savedHead, "push must actually succeed before the post-push refusal");
        if (change === "new HEAD") assert.notEqual(git(fixture.worktree, ["rev-parse", "HEAD"]), savedHead);
        if (change === "changed branch") assert.equal(git(fixture.worktree, ["branch", "--show-current"]), "another-story");
      } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
    });
  }

  it("save-and-remove pushes saved source before removing a worktree", () => {
    const fixture = savedWorktreeFixture();
    try {
      fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "remote preserved source\n");
      saveAndRemoveWorktree(fixture.repo, fixture.worktree, "SAVE-STORY");
      assert.equal(fs.existsSync(fixture.worktree), false);
      assert.equal(git(fixture.origin, ["show", "refs/heads/save-story:app.txt"]), "remote preserved source");
      assert.equal(git(fixture.origin, ["rev-parse", "refs/heads/save-story"]), git(fixture.repo, ["rev-parse", "save-story"]));
      assert.equal(fs.readFileSync(path.join(fixture.dependencies, "retained.txt"), "utf8"), "shared dependency\n");
      assert.equal(git(fixture.repo, ["worktree", "list", "--porcelain"]).includes(fixture.worktree), false);
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  it("save-and-remove pushes clean local commits before removal", () => {
    const fixture = savedWorktreeFixture();
    try {
      fs.writeFileSync(path.join(fixture.worktree, "app.txt"), "clean committed source\n");
      git(fixture.worktree, ["add", "app.txt"]);
      git(fixture.worktree, ["commit", "-m", "clean local source"]);
      const savedHead = git(fixture.worktree, ["rev-parse", "HEAD"]);
      saveAndRemoveWorktree(fixture.repo, fixture.worktree, "save-story");
      assert.equal(fs.existsSync(fixture.worktree), false);
      assert.equal(git(fixture.origin, ["rev-parse", "refs/heads/save-story"]), savedHead);
      assert.equal(git(fixture.origin, ["show", "refs/heads/save-story:app.txt"]), "clean committed source");
    } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
  });

  it("save-and-remove absent target is idempotent without a Git repository", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-save-absent-"));
    try { assert.doesNotThrow(() => saveAndRemoveWorktree(tmp, path.join(tmp, "absent"), "save-story")); }
    finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

});
