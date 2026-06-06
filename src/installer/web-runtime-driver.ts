import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { allocateRuntimePort } from "./runtime-ports.js";
import type {
  CapturedRuntimeState,
  InteractionRequest,
  InteractionResult,
  RuntimeDriver,
  RuntimeSession,
  StoryRuntimeContext,
} from "./runtime-driver.js";

export interface WebPreviewRuntimeDriverOptions {
  previewCommand?: string;
  readinessPath?: string;
  timeoutMs?: number;
}

const DEFAULT_PREVIEW_COMMAND = "npm run preview -- --host {{HOST}} --port {{PORT}} --strictPort";

export function renderRuntimeCommand(template: string, host: string, port: number): string {
  return template.replaceAll("{{HOST}}", host).replaceAll("{{PORT}}", String(port));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

async function waitForHttp200(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status >= 200 && response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (err: any) {
      lastError = String(err?.message || err).slice(0, 200);
    }
    await delay(500);
  }
  throw new Error(`Runtime did not become ready at ${url}: ${lastError || "timeout"}`);
}

export class WebPreviewRuntimeDriver implements RuntimeDriver {
  private readonly options: Required<WebPreviewRuntimeDriverOptions>;
  private readonly processes = new Map<string, ChildProcess>();
  private readonly browsers = new Map<string, any>();
  private readonly pages = new Map<string, any>();

  constructor(options: WebPreviewRuntimeDriverOptions = {}) {
    this.options = {
      previewCommand: options.previewCommand || DEFAULT_PREVIEW_COMMAND,
      readinessPath: options.readinessPath || "/",
      timeoutMs: options.timeoutMs || 120000,
    };
  }

  async start(context: StoryRuntimeContext): Promise<RuntimeSession> {
    const allocation = await allocateRuntimePort({
      runId: context.runId,
      runNumber: context.runNumber ?? null,
      band: "preview",
      preferredPort: context.preferredPort ?? null,
      host: context.host || "127.0.0.1",
    });
    const command = renderRuntimeCommand(this.options.previewCommand, allocation.host, allocation.port);
    const child = spawn(command, {
      cwd: context.workdir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });
    const session: RuntimeSession = {
      kind: "browser",
      sessionId: `${context.runId.slice(0, 8)}-${context.storyId}-${allocation.port}`,
      workdir: context.workdir,
      host: allocation.host,
      port: allocation.port,
      url: allocation.url,
      startedAt: nowIso(),
    };
    this.processes.set(session.sessionId, child);
    return session;
  }

  async waitReady(session: RuntimeSession): Promise<void> {
    if (!session.url) throw new Error("Browser runtime session has no URL.");
    const url = `${session.url}${this.options.readinessPath === "/" ? "" : this.options.readinessPath}`;
    await waitForHttp200(url, this.options.timeoutMs);
  }

  private async sessionPage(session: RuntimeSession): Promise<any> {
    if (!session.url) throw new Error("Browser runtime session has no URL.");
    const existing = this.pages.get(session.sessionId);
    if (existing && !existing.isClosed?.()) return existing;
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    this.browsers.set(session.sessionId, browser);
    this.pages.set(session.sessionId, page);
    return page;
  }

  async interact(session: RuntimeSession, action: InteractionRequest): Promise<InteractionResult> {
    const startedAt = nowIso();
    if (!session.url) {
      return { id: action.id || action.action, action: action.action, status: "fail", startedAt, completedAt: nowIso(), detail: "Runtime session has no URL." };
    }
    try {
      const page = await this.sessionPage(session);
      if (action.action === "click" && action.target) await page.locator(action.target).first().click({ timeout: action.timeoutMs || 10000 });
      else if (action.action === "fill" && action.target) await page.locator(action.target).first().fill(action.value || "", { timeout: action.timeoutMs || 10000 });
      else if (action.action === "press" && action.target) await page.locator(action.target).first().press(action.value || "Enter", { timeout: action.timeoutMs || 10000 });
      else if (action.action === "navigate" && action.value) await page.goto(action.value, { waitUntil: "domcontentloaded", timeout: action.timeoutMs || 30000 });
      else if (action.action === "snapshot") {
        // No-op interaction used when Setfarm synthesizes a conservative runtime evidence request.
      }
      else if (action.action === "wait") await page.waitForTimeout(Math.min(action.timeoutMs || 1000, 10000));
      else return { id: action.id || action.action, action: action.action, status: "fail", startedAt, completedAt: nowIso(), detail: `Unsupported or incomplete interaction: ${action.action}` };
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      return { id: action.id || action.action, action: action.action, status: "pass", startedAt, completedAt: nowIso() };
    } catch (err: any) {
      return { id: action.id || action.action, action: action.action, status: "fail", startedAt, completedAt: nowIso(), detail: String(err?.message || err).slice(0, 1000) };
    }
  }

  async captureState(session: RuntimeSession): Promise<CapturedRuntimeState> {
    if (!session.url) throw new Error("Browser runtime session has no URL.");
    const outDir = path.join(session.workdir, ".setfarm", "runtime", session.sessionId);
    fs.mkdirSync(outDir, { recursive: true });
    const capturedAt = nowIso();
    const screenshotPath = path.join(outDir, `screenshot-${Date.now()}.png`);
    const domSnapshotPath = path.join(outDir, `dom-${Date.now()}.json`);
    const page = await this.sessionPage(session);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const dom = await page.evaluate(() => ({
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 4000) || "",
      rootHtml: document.querySelector("#root")?.outerHTML?.slice(0, 12000) || "",
    }));
    const stateBridge = await page.evaluate(() => {
      const g = globalThis as any;
      return g.__SETFARM_TEST_BRIDGE__ || g.app || null;
    }).catch(() => null);
    fs.writeFileSync(domSnapshotPath, JSON.stringify(dom, null, 2));
    return { capturedAt, screenshotPath, domSnapshotPath, stateBridge };
  }

  async stop(session: RuntimeSession): Promise<void> {
    const page = this.pages.get(session.sessionId);
    this.pages.delete(session.sessionId);
    await page?.close?.().catch(() => undefined);
    const browser = this.browsers.get(session.sessionId);
    this.browsers.delete(session.sessionId);
    await browser?.close?.().catch(() => undefined);
    const child = this.processes.get(session.sessionId);
    this.processes.delete(session.sessionId);
    if (!child || child.killed) return;
    child.kill("SIGTERM");
    await delay(250);
    if (!child.killed) child.kill("SIGKILL");
  }
}
