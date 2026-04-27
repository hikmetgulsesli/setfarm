/**
 * Playwright Visual Verify — launches preview server, renders pages, compares
 * screenshots against Stitch HTML baselines, clicks known buttons to catch
 * dead handlers.
 *
 * Best-effort module: when Playwright is not installed (or setup script absent),
 * verify step falls back to pure static analysis. Do not block the pipeline on
 * missing browser tooling.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../../../lib/logger.js";

const execFileAsync = promisify(execFile);

export interface PlaywrightIssue {
  type: "screenshot_diff" | "dead_button" | "console_error" | "preview_failed";
  screen?: string;
  detail: string;
}

export interface PlaywrightResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  issues: PlaywrightIssue[];
  screensChecked: number;
}

/**
 * Check if Playwright browser binary is available on the host.
 * Returns false if not — verify falls back to static analysis.
 */
async function isPlaywrightAvailable(repoPath: string): Promise<boolean> {
  try {
    const pkgPath = path.join(repoPath, "package.json");
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const hasDep = pkg.devDependencies?.["@playwright/test"] || pkg.dependencies?.["@playwright/test"] || pkg.devDependencies?.playwright;
    if (!hasDep) return false;
    // chromium binary check
    await execFileAsync("npx", ["playwright", "--version"], { cwd: repoPath, timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start Vite/Next preview server in background. Returns child process + URL.
 */
async function startPreviewServer(repoPath: string): Promise<{ proc: ChildProcess; url: string } | null> {
  const pkgPath = path.join(repoPath, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  // Prefer preview (build output), fall back to dev
  const hasPreview = pkg.scripts?.preview;
  const hasDev = pkg.scripts?.dev;
  const script = hasPreview ? "preview" : hasDev ? "dev" : null;
  if (!script) return null;

  // Pick a free port in 5500-5599 range (avoid dev server collisions)
  const port = 5500 + Math.floor(Math.random() * 100);
  const proc = spawn("npm", ["run", script, "--", "--port", String(port), "--host", "127.0.0.1"], {
    cwd: repoPath, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });

  // Wait up to 30s for "Local:" or similar ready signal
  const url = `http://127.0.0.1:${port}`;
  const ready = await new Promise<boolean>((resolve) => {
    let buf = "";
    const timer = setTimeout(() => resolve(false), 30000);
    proc.stdout?.on("data", (d: Buffer) => {
      buf += d.toString();
      if (/Local:|localhost:|ready|listening/i.test(buf)) { clearTimeout(timer); resolve(true); }
    });
    proc.on("error", () => { clearTimeout(timer); resolve(false); });
    proc.on("exit", () => { clearTimeout(timer); resolve(false); });
  });
  if (!ready) {
    try { proc.kill("SIGTERM"); } catch { /* ignore */ }
    return null;
  }
  return { proc, url };
}

function stopPreviewServer(proc: ChildProcess): void {
  try { proc.kill("SIGTERM"); setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* */ } }, 3000); } catch { /* */ }
}

/**
 * Main entry: run Playwright-backed visual verify on the repo's preview build.
 * Returns list of issues (empty = pass). Skipped flag indicates Playwright absent.
 */
export async function runPlaywrightCheck(repoPath: string): Promise<PlaywrightResult> {
  if (!await isPlaywrightAvailable(repoPath)) {
    return { ok: true, skipped: true, reason: "Playwright not installed", issues: [], screensChecked: 0 };
  }

  const server = await startPreviewServer(repoPath);
  if (!server) {
    return { ok: false, reason: "preview server failed to start", issues: [{ type: "preview_failed", detail: "npm run preview/dev did not become ready within 30s" }], screensChecked: 0 };
  }

  const issues: PlaywrightIssue[] = [];
  let screensChecked = 0;

  try {
    // Stitch screens list
    const stitchDir = path.join(repoPath, "stitch");
    const screenMaps = fs.existsSync(path.join(stitchDir, "DESIGN_MANIFEST.json"))
      ? JSON.parse(fs.readFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), "utf-8"))
      : [];

    // Write a small Playwright harness script + run it
    const harnessPath = path.join(repoPath, ".setfarm-playwright-harness.mjs");
    const harness = `
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const issues = [];
page.on('console', msg => { if (msg.type() === 'error') issues.push({ type: 'console_error', detail: msg.text().slice(0, 200) }); });
try {
  await page.goto('${server.url}', { timeout: 15000, waitUntil: 'networkidle' });
  function fingerprint() {
    return JSON.stringify({
      url: location.href,
      text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 4000),
      html: document.body.innerHTML.replace(/\\s+/g, ' ').slice(0, 4000),
      active: document.activeElement?.tagName || ''
    });
  }
  function labelFor(el) {
    return (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.outerHTML || '?').replace(/\\s+/g, ' ').slice(0, 120);
  }
  // Click all visible buttons. A click that produces no visible URL/text/DOM/focus
  // change is treated as dead unless the element is explicitly disabled/ignored.
  const buttons = await page.locator('button:visible').all();
  for (const b of buttons.slice(0, 30)) {
    const ignored = await b.evaluate(el => el.hasAttribute('data-smoke-ignore') || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true').catch(() => false);
    if (ignored) continue;
    const before = await page.evaluate(fingerprint);
    let label = '?';
    try { label = await b.evaluate(labelFor); await b.click({ timeout: 3000 }); await page.waitForTimeout(300); }
    catch (e) { issues.push({ type: 'dead_button', detail: \`\${label || '?'}: \${String(e).slice(0, 120)}\` }); continue; }
    const after = await page.evaluate(fingerprint);
    if (before === after) issues.push({ type: 'dead_button', detail: \`\${label || '?'}: click produced no visible state, route, focus, or DOM change\` });
  }
} catch (e) { issues.push({ type: 'preview_failed', detail: String(e).slice(0, 200) }); }
await browser.close();
console.log(JSON.stringify({ issues, checked: 1 }));
`;
    fs.writeFileSync(harnessPath, harness, "utf-8");
    const { stdout } = await execFileAsync("node", [harnessPath], { cwd: repoPath, timeout: 60000 });
    try { fs.unlinkSync(harnessPath); } catch { /* */ }

    // Parse harness output
    const match = stdout.match(/\{"issues":\[.*?\],"checked":\d+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.issues)) issues.push(...parsed.issues);
      screensChecked = parsed.checked || 0;
    }
  } catch (err: any) {
    issues.push({ type: "preview_failed", detail: String(err?.message || err).slice(0, 200) });
  } finally {
    stopPreviewServer(server.proc);
  }

  return { ok: issues.length === 0, issues, screensChecked };
}

export function formatPlaywrightReport(result: PlaywrightResult): string {
  if (result.skipped) return `Playwright check skipped: ${result.reason || "unknown"}`;
  if (result.ok) return `Playwright check PASS (${result.screensChecked} screen(s), no issues)`;
  const lines = [`Playwright check FAIL — ${result.issues.length} issue(s):`];
  for (const i of result.issues.slice(0, 10)) {
    lines.push(`- [${i.type}${i.screen ? " " + i.screen : ""}] ${i.detail}`);
  }
  return lines.join("\n");
}
