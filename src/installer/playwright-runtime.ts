import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolvePlatformRoot } from "./paths.js";

export const PLAYWRIGHT_BROWSER_MISSING = /(?:browserType\.launch|chromium\.launch|playwright|chromium|chrome)[\s\S]{0,900}(?:Executable doesn't exist|Looks like Playwright Test or Playwright was just installed or updated|Please run[\s\S]{0,160}playwright install)|chromium_headless_shell-\d+[\s\S]{0,500}Executable doesn't exist/i;

function cleanProcessText(value: unknown): string {
  const text = Buffer.isBuffer(value) ? value.toString("utf-8") : String(value || "");
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "").trim();
}

function formatFailure(error: unknown): string {
  const e = error as { stdout?: unknown; stderr?: unknown; message?: unknown; status?: unknown; signal?: unknown };
  const parts: string[] = [];
  const header = [e?.status !== undefined ? `exit=${e.status}` : "", e?.signal ? `signal=${String(e.signal)}` : ""].filter(Boolean).join(" ");
  if (header) parts.push(header);
  const stdout = cleanProcessText(e?.stdout);
  const stderr = cleanProcessText(e?.stderr);
  if (stdout) parts.push(`stdout:\n${stdout}`);
  if (stderr) parts.push(`stderr:\n${stderr}`);
  if (parts.length === 0 && e?.message) parts.push(cleanProcessText(e.message));
  return parts.join("\n\n").slice(0, 5000);
}

export function isMissingPlaywrightBrowserFailure(output: string): boolean {
  return PLAYWRIGHT_BROWSER_MISSING.test(output);
}

export function ensurePlaywrightChromiumInstalled(timeoutMs = 240_000): { ok: boolean; output: string } {
  const platformRoot = resolvePlatformRoot();
  if (!existsSync(platformRoot)) return { ok: false, output: `Setfarm platform root does not exist: ${platformRoot}` };
  try {
    const output = execFileSync("npx", ["playwright", "install", "chromium"], {
      cwd: platformRoot,
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    return { ok: true, output: cleanProcessText(output).slice(0, 2000) };
  } catch (err) {
    return { ok: false, output: formatFailure(err) };
  }
}
