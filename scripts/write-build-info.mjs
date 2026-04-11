#!/usr/bin/env node
/**
 * Write dist/BUILD_INFO.json with the current git HEAD / branch / dirty flag.
 * Called by `npm run prebuild`. Refuses to stamp builds on non-main branches
 * or dirty working trees unless --allow-dirty-build is passed.
 *
 * Root cause (cuddly-sleeping-quail): setfarm-repo drifted to a story worktree
 * branch and `npm run build` silently rebuilt dist from the stale branch. The
 * resulting runtime ran pre-Wave-10 code. This guard refuses to build at all
 * if the branch is wrong, making the failure loud and obvious.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const distDir = resolve(repoRoot, "dist");

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  }).trim();
}

const allowDirty = process.argv.includes("--allow-dirty-build") || process.env.SETFARM_ALLOW_DIRTY_BUILD === "1";

let sha, branch, porcelain;
try {
  sha = git(["rev-parse", "HEAD"]);
  branch = git(["branch", "--show-current"]);
  porcelain = git(["status", "--porcelain"]);
} catch (e) {
  console.error("[write-build-info] git failed: " + String(e));
  process.exit(1);
}

const dirty = porcelain.length > 0;

if (!allowDirty) {
  if (branch !== "main") {
    console.error("[write-build-info] REFUSING to build: branch='" + branch + "' (expected 'main')");
    console.error("[write-build-info] Override: npm run build -- --allow-dirty-build  or  SETFARM_ALLOW_DIRTY_BUILD=1");
    process.exit(1);
  }
  if (dirty) {
    console.error("[write-build-info] REFUSING to build: working tree is dirty");
    console.error("[write-build-info] " + porcelain.split("\n").slice(0, 10).join("\n"));
    console.error("[write-build-info] Override: npm run build -- --allow-dirty-build  or  SETFARM_ALLOW_DIRTY_BUILD=1");
    process.exit(1);
  }
}

mkdirSync(distDir, { recursive: true });
const info = { sha, branch, dirty, builtAt: new Date().toISOString() };
writeFileSync(resolve(distDir, "BUILD_INFO.json"), JSON.stringify(info, null, 2) + "\n");
console.log("[write-build-info] stamped dist/BUILD_INFO.json: " + sha.slice(0, 8) + " on " + branch + (dirty ? " (DIRTY)" : ""));
