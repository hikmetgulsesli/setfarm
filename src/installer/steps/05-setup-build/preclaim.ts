import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

// Heavy work before agent:
// 1. npm install (idempotent — skip if node_modules exists)
// 2. npm run build — baseline verification
// 3. Compat engine (fail fast on React 19 / testing-library mismatches)
// 4. Tailwind install (when stitch uses tailwind classes)
// 5. stitch-to-jsx → src/screens/<TurkishName>.tsx + commit
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  if (!repo || !fs.existsSync(path.join(repo, "package.json"))) {
    logger.warn(`[module:setup-build preclaim] skipped — no package.json`, { runId: ctx.runId });
    return;
  }

  // 1. npm install (skip if node_modules already present — idempotent)
  if (!fs.existsSync(path.join(repo, "node_modules"))) {
    try {
      execFileSync("npm", ["install"], { cwd: repo, timeout: 300000, stdio: "pipe" });
      logger.info(`[module:setup-build preclaim] npm install ok`, { runId: ctx.runId });
    } catch (e) {
      logger.warn(`[module:setup-build preclaim] npm install failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  // 2. Compat engine check (fail fast before build so errors are actionable)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
    const { evaluateCompat } = await import("../../compat-engine.js");
    const { fails, warns } = evaluateCompat(pkg, "setup-build");
    for (const w of warns) {
      logger.warn(`[module:setup-build preclaim] compat warn ${w.id}: ${w.resolvedMessage.slice(0, 200)}`, { runId: ctx.runId });
    }
    if (fails.length > 0) {
      const header = fails.length === 1
        ? fails[0].resolvedMessage
        : `COMPAT_VIOLATIONS (${fails.length}):\n\n` + fails.map((f: any) => `[${f.id}] ${f.resolvedMessage}`).join("\n\n");
      logger.warn(`[module:setup-build preclaim] compat FAIL: ${header.slice(0, 300)}`, { runId: ctx.runId });
      ctx.context["compat_fail"] = header.slice(0, 800);
    }
  } catch (e) {
    logger.warn(`[module:setup-build preclaim] compat evaluate failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }

  // 3. npm run build — baseline verification, auto-derive BUILD_CMD hint
  let buildCmd = "npm run build";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
    if (pkg.scripts && pkg.scripts.build) {
      try {
        execFileSync("npm", ["run", "build"], { cwd: repo, timeout: 180000, stdio: "pipe" });
        logger.info(`[module:setup-build preclaim] build baseline ok`, { runId: ctx.runId });
      } catch (e) {
        logger.warn(`[module:setup-build preclaim] baseline build failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
        ctx.context["baseline_fail"] = String(e).slice(0, 400);
      }
    } else {
      buildCmd = "(no build script)";
    }
  } catch (e) {
    logger.warn(`[module:setup-build preclaim] package.json parse: ${String(e).slice(0, 80)}`);
  }
  ctx.context["build_cmd_hint"] = buildCmd;

  // 4. Tailwind install (if stitch HTML uses tailwind classes)
  try {
    const stitchDir = path.join(repo, "stitch");
    if (fs.existsSync(stitchDir)) {
      const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"));
      let needsTailwind = false;
      for (const f of htmlFiles) {
        const html = fs.readFileSync(path.join(stitchDir, f), "utf-8");
        if (/\b(grid-cols-\d+|flex-\w+|gap-\d+|rounded-\w+|p[xy]?-\d+|m[xy]?-\d+|bg-\w+|text-\w+)\b/.test(html)) {
          needsTailwind = true;
          break;
        }
      }
      if (needsTailwind) {
        const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
        const hasTW = (pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss);
        if (!hasTW) {
          try {
            execFileSync("npm", ["install", "-D", "tailwindcss", "postcss", "autoprefixer"],
              { cwd: repo, timeout: 120000, stdio: "pipe" });
            logger.info(`[module:setup-build preclaim] tailwind installed`, { runId: ctx.runId });
          } catch (e) {
            logger.warn(`[module:setup-build preclaim] tailwind install failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
          }
        }
      }
    }
  } catch (e) {
    logger.debug(`[module:setup-build preclaim] tailwind check: ${String(e).slice(0, 80)}`);
  }

  // 5. stitch-to-jsx: generate src/screens/<ComponentName>.tsx from stitch HTML + commit
  const stitchManifest = path.join(repo, "stitch", "DESIGN_MANIFEST.json");
  if (fs.existsSync(stitchManifest)) {
    try {
      const scriptPath = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-to-jsx.mjs");
      if (fs.existsSync(scriptPath)) {
        execFileSync("node", [scriptPath, repo], { timeout: 30000, stdio: "pipe" });
        try {
          execFileSync("git", ["add", "src/screens/"], { cwd: repo, timeout: 5000, stdio: "pipe" });
          execFileSync("git", ["commit", "-m", "chore: auto-generate JSX screens from Stitch HTML"], { cwd: repo, timeout: 10000, stdio: "pipe" });
        } catch { /* nothing to commit is fine */ }
        logger.info(`[module:setup-build preclaim] stitch-to-jsx ok`, { runId: ctx.runId });
      }
    } catch (e) {
      logger.warn(`[module:setup-build preclaim] stitch-to-jsx failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }
}
