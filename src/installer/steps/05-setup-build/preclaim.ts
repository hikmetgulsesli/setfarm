import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

const MIN_STITCH_HTML_BYTES = 1000;

function isReusableStitchHtml(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (fs.statSync(filePath).size < MIN_STITCH_HTML_BYTES) return false;
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 4000).toLowerCase();
    if (!head.includes("<html") && !head.includes("<!doctype")) return false;
    if (head.includes("empty html") || head.includes("design not generated")) return false;
    return true;
  } catch {
    return false;
  }
}

function isPrdPseudoHtmlFile(fileName: string): boolean {
  return /\bprd\b/.test(fileName.toLowerCase());
}

function ensureFile(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content);
  return true;
}

function cleanProcessText(value: unknown): string {
  const text = Buffer.isBuffer(value) ? value.toString("utf-8") : String(value || "");
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .trim();
}

function formatProcessFailure(error: unknown, max = 1200): string {
  const e = error as { status?: unknown; signal?: unknown; stdout?: unknown; stderr?: unknown; message?: unknown };
  const parts: string[] = [];
  const status = e?.status !== undefined ? `exit=${e.status}` : "";
  const signal = e?.signal ? `signal=${String(e.signal)}` : "";
  const header = [status, signal].filter(Boolean).join(" ");
  if (header) parts.push(header);
  const stderr = cleanProcessText(e?.stderr);
  const stdout = cleanProcessText(e?.stdout);
  if (stderr) parts.push(`stderr:\n${stderr}`);
  if (stdout) parts.push(`stdout:\n${stdout}`);
  if (parts.length === 0 && e?.message) parts.push(cleanProcessText(e.message));
  return parts.join("\n\n").slice(0, max);
}

function ensureTailwindV3Files(repo: string): void {
  ensureFile(path.join(repo, "postcss.config.js"), `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`);
  ensureFile(path.join(repo, "tailwind.config.js"), `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`);

  const cssCandidates = [
    path.join(repo, "src", "index.css"),
    path.join(repo, "src", "main.css"),
    path.join(repo, "src", "App.css"),
    path.join(repo, "app", "globals.css"),
  ];
  const cssPath = cssCandidates.find(p => fs.existsSync(p)) || (fs.existsSync(path.join(repo, "src")) ? path.join(repo, "src", "index.css") : "");
  if (!cssPath) return;
  if (!fs.existsSync(cssPath)) fs.writeFileSync(cssPath, "");
  const css = fs.readFileSync(cssPath, "utf-8");
  if (!/@tailwind\s+base\b/.test(css) && !/@import\s+["']tailwindcss["']/.test(css)) {
    fs.writeFileSync(cssPath, `@tailwind base;
@tailwind components;
@tailwind utilities;

${css}`);
  }
}

// Heavy work before agent:
// 1. npm install (idempotent — skip if node_modules exists)
// 2. npm run build — baseline verification
// 3. Compat engine (fail fast on React 19 / testing-library mismatches)
// 4. Tailwind install/config (when Stitch uses utility classes)
// 5. stitch-to-jsx → src/screens/<TurkishName>.tsx + commit
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  if (!repo || !fs.existsSync(path.join(repo, "package.json"))) {
    const msg = "package.json missing after setup-repo — baseline scaffold did not run";
    logger.warn(`[module:setup-build preclaim] ${msg}`, { runId: ctx.runId });
    ctx.context["baseline_fail"] = msg;
    return;
  }

  // 1. npm install (skip if node_modules already present — idempotent)
  let installedDeps = false;
  if (!fs.existsSync(path.join(repo, "node_modules"))) {
    try {
      execFileSync("npm", ["install"], { cwd: repo, timeout: 300000, stdio: "pipe" });
      installedDeps = true;
      logger.info(`[module:setup-build preclaim] npm install ok`, { runId: ctx.runId });
    } catch (e) {
      const details = formatProcessFailure(e);
      logger.warn(`[module:setup-build preclaim] npm install failed: ${details.slice(0, 300)}`, { runId: ctx.runId });
      ctx.context["baseline_fail"] = `npm install failed:\n${details}`;
    }
  }
  if (installedDeps) {
    try {
      execFileSync("git", ["add", "package-lock.json"], { cwd: repo, timeout: 5000, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "chore: install baseline dependencies"], { cwd: repo, timeout: 10000, stdio: "pipe" });
    } catch { /* nothing to commit is fine */ }
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
        const details = formatProcessFailure(e);
        logger.warn(`[module:setup-build preclaim] baseline build failed: ${details.slice(0, 300)}`, { runId: ctx.runId });
        ctx.context["baseline_fail"] = details;
      }
    } else {
      buildCmd = "(no build script)";
    }
  } catch (e) {
    logger.warn(`[module:setup-build preclaim] package.json parse: ${String(e).slice(0, 80)}`);
  }
  ctx.context["build_cmd_hint"] = buildCmd;

  // 4. Tailwind install/config (if Stitch HTML uses utility classes).
  // Keep the setup-repo baseline on one path: Tailwind v3 + PostCSS. A later
  // setup-build completion hook used to add @tailwindcss/vite on top of this,
  // which produced mixed integrations in generated apps.
  try {
    const stitchDir = path.join(repo, "stitch");
    if (fs.existsSync(stitchDir)) {
      const htmlFiles = fs.readdirSync(stitchDir)
        .filter(f => f.endsWith(".html") && !isPrdPseudoHtmlFile(f))
        .filter(f => isReusableStitchHtml(path.join(stitchDir, f)));
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
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const tailwindSpec = String(allDeps["tailwindcss"] || "");
        const usesTailwindV4 = !!(
          allDeps["@tailwindcss/vite"] ||
          allDeps["@tailwindcss/postcss"] ||
          tailwindSpec === "latest" ||
          /(^|[~^<>= ])4\./.test(tailwindSpec)
        );
        if (!allDeps["tailwindcss"]) {
          try {
            execFileSync("npm", ["install", "-D", "tailwindcss@^3.4.19", "postcss@^8.4.41", "autoprefixer@^10.4.20"],
              { cwd: repo, timeout: 120000, stdio: "pipe" });
            logger.info(`[module:setup-build preclaim] tailwind installed`, { runId: ctx.runId });
          } catch (e) {
            logger.warn(`[module:setup-build preclaim] tailwind install failed: ${formatProcessFailure(e, 500)}`, { runId: ctx.runId });
          }
        }
        if (!usesTailwindV4) ensureTailwindV3Files(repo);
        try {
          const commitPaths = ["package.json", "package-lock.json", "postcss.config.js", "tailwind.config.js", "src/index.css", "src/main.css", "src/App.css", "app/globals.css"]
            .filter(p => fs.existsSync(path.join(repo, p)));
          if (commitPaths.length > 0) {
            execFileSync("git", ["add", ...commitPaths], { cwd: repo, timeout: 5000, stdio: "pipe" });
            execFileSync("git", ["commit", "-m", "chore: configure tailwind baseline"], { cwd: repo, timeout: 10000, stdio: "pipe" });
          }
        } catch { /* nothing to commit is fine */ }
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
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
          if (pkg.scripts?.build) {
            execFileSync("npm", ["run", "build"], { cwd: repo, timeout: 180000, stdio: "pipe" });
            logger.info(`[module:setup-build preclaim] post-stitch build ok`, { runId: ctx.runId });
          }
        } catch (e) {
          const msg = `npm run build failed after stitch-to-jsx:\n${formatProcessFailure(e)}`;
          logger.warn(`[module:setup-build preclaim] ${msg}`, { runId: ctx.runId });
          ctx.context["baseline_fail"] = msg;
        }
      }
    } catch (e) {
      const details = formatProcessFailure(e);
      logger.warn(`[module:setup-build preclaim] stitch-to-jsx failed: ${details.slice(0, 300)}`, { runId: ctx.runId });
      ctx.context["baseline_fail"] = `stitch-to-jsx failed:\n${details}`;
    }
  }
}
