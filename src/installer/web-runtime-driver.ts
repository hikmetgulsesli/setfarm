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
  exactCommand?: Readonly<{
    argv: readonly string[];
    cwd: string;
    env?: Readonly<Record<string, string>>;
  }>;
  captureAbi?: Readonly<{
    schema: "setfarm.browser-state-capture.v1";
    globalName: string;
    actionInvocation: Readonly<{
      schema: "setfarm.browser-action-invocation.v1";
      method: string;
    }>;
    scenarioMode: Readonly<{
      schema: "setfarm.browser-scenario-mode.v1";
      globalName: string;
      value: "manual";
    }>;
    stateBindings: readonly Readonly<{ stateRef: string; pointer: string }>[];
  }>;
  readinessPath?: string;
  readinessMethod?: "GET" | "HEAD";
  readinessExpectedStatus?: number;
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

async function launchBrowser(chromium: any): Promise<any> {
  try {
    return await chromium.launch({ headless: true });
  } catch (err: any) {
    const message = String(err?.message || err);
    if (!/Executable doesn't exist|playwright install|chromium_headless_shell/i.test(message)) throw err;
    return await chromium.launch({ channel: "chrome", headless: true });
  }
}

async function waitForHttpReady(
  url: string,
  timeoutMs: number,
  method: "GET" | "HEAD",
  expectedStatus?: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method });
      const ready = expectedStatus === undefined
        ? response.status >= 200 && response.status < 500
        : response.status === expectedStatus;
      await response.body?.cancel().catch(() => undefined);
      if (ready) return;
      lastError = expectedStatus === undefined
        ? `HTTP ${response.status}`
        : `HTTP ${response.status}; expected ${expectedStatus}`;
    } catch (err: any) {
      lastError = String(err?.message || err).slice(0, 200);
    }
    await delay(500);
  }
  throw new Error(`Runtime did not become ready at ${url}: ${lastError || "timeout"}`);
}

export class WebPreviewRuntimeDriver implements RuntimeDriver {
  private readonly options: {
    previewCommand: string;
    exactCommand?: WebPreviewRuntimeDriverOptions["exactCommand"];
    captureAbi?: WebPreviewRuntimeDriverOptions["captureAbi"];
    readinessPath: string;
    readinessMethod: "GET" | "HEAD";
    readinessExpectedStatus?: number;
    timeoutMs: number;
  };
  private readonly processes = new Map<string, ChildProcess>();
  private readonly browsers = new Map<string, any>();
  private readonly pages = new Map<string, any>();

  constructor(options: WebPreviewRuntimeDriverOptions = {}) {
    this.options = {
      previewCommand: options.previewCommand || DEFAULT_PREVIEW_COMMAND,
      ...(options.exactCommand ? { exactCommand: options.exactCommand } : {}),
      ...(options.captureAbi ? { captureAbi: options.captureAbi } : {}),
      readinessPath: options.readinessPath || "/",
      readinessMethod: options.readinessMethod || "GET",
      ...(options.readinessExpectedStatus !== undefined
        ? { readinessExpectedStatus: options.readinessExpectedStatus }
        : {}),
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
    const exact = this.options.exactCommand;
    let child: ChildProcess;
    if (exact) {
      const root = path.resolve(context.workdir);
      const cwd = path.resolve(root, exact.cwd);
      if (cwd !== root && !cwd.startsWith(`${root}${path.sep}`)) {
        throw new Error("BROWSER_RUNTIME_EVIDENCE_CWD_ESCAPE");
      }
      const argv = exact.argv.map((argument) => renderRuntimeCommand(argument, allocation.host, allocation.port));
      child = spawn(argv[0]!, argv.slice(1), {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          CI: "true",
          ...Object.fromEntries(Object.entries(exact.env ?? {}).map(([key, value]) => [
            key,
            renderRuntimeCommand(value, allocation.host, allocation.port),
          ])),
        },
      });
    } else {
      const command = renderRuntimeCommand(this.options.previewCommand, allocation.host, allocation.port);
      child = spawn(command, {
        cwd: context.workdir,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CI: "true" },
      });
    }
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
    await waitForHttpReady(
      url,
      this.options.timeoutMs,
      this.options.readinessMethod,
      this.options.readinessExpectedStatus,
    );
  }

  private async sessionPage(session: RuntimeSession): Promise<any> {
    if (!session.url) throw new Error("Browser runtime session has no URL.");
    const existing = this.pages.get(session.sessionId);
    if (existing && !existing.isClosed?.()) return existing;
    const { chromium } = await import("playwright");
    const browser = await launchBrowser(chromium);
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    if (this.options.captureAbi) {
      const scenarioMode = this.options.captureAbi.scenarioMode;
      await page.addInitScript(
        `globalThis[${JSON.stringify(scenarioMode.globalName)}]=${JSON.stringify(scenarioMode.value)};`,
      );
    }
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
      else if (action.action === "select" && action.target && action.value !== undefined) await page.locator(action.target).first().selectOption(action.value, { timeout: action.timeoutMs || 10000 });
      else if (action.action === "navigate" && action.value) {
        const destination = action.value.startsWith("__SETFARM_RUNTIME_URL__")
          ? `${session.url}${action.value.slice("__SETFARM_RUNTIME_URL__".length)}`
          : action.value;
        await page.goto(destination, { waitUntil: "domcontentloaded", timeout: action.timeoutMs || 30000 });
      }
      else if (action.action === "reset" && this.options.captureAbi) {
        await page.evaluate(() => {
          globalThis.localStorage?.clear();
          globalThis.sessionStorage?.clear();
        });
        await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: action.timeoutMs || 30000 });
      }
      else if (action.action === "invoke" && action.target && this.options.captureAbi) {
        await page.evaluate(async ({
          globalName,
          method,
          actionRef,
          inputValues,
        }: {
          globalName: string;
          method: string;
          actionRef: string;
          inputValues: Readonly<Record<string, unknown>>;
        }) => {
          const bridge = (globalThis as any)[globalName];
          const invoke = bridge?.[method];
          if (typeof invoke !== "function") {
            throw new Error(`SETFARM_BROWSER_ACTION_INVOKER_MISSING:${globalName}.${method}`);
          }
          await invoke.call(bridge, actionRef, inputValues);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        }, {
          globalName: this.options.captureAbi.globalName,
          method: this.options.captureAbi.actionInvocation.method,
          actionRef: action.target,
          inputValues: action.inputValues ?? {},
        });
      }
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
    // Keep this as browser-native JavaScript text. When tsx/esbuild preserves
    // function names it can otherwise inject its Node-side `__name` helper
    // into a serialized Playwright callback, where that helper does not exist.
    const dom = await page.evaluate(`(() => {
      const implicitRole = (element) => {
        const explicit = element.getAttribute("role")?.trim();
        if (explicit) return explicit;
        const tag = element.tagName.toLowerCase();
        if (tag === "button") return "button";
        if (tag === "a" && element.hasAttribute("href")) return "link";
        if (tag === "select") return "combobox";
        if (tag === "textarea") return "textbox";
        if (tag === "input") {
          const type = (element.getAttribute("type") || "text").toLowerCase();
          if (["button", "submit", "reset"].includes(type)) return "button";
          if (type === "checkbox") return "checkbox";
          if (type === "radio") return "radio";
          return "textbox";
        }
        return "";
      };
      const accessibleName = (element) => {
        const labelledBy = element.getAttribute("aria-labelledby")?.trim();
        if (labelledBy) {
          const label = labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
          if (label) return label;
        }
        return (
          element.getAttribute("aria-label")
          || element.getAttribute("alt")
          || element.getAttribute("title")
          || element.getAttribute("placeholder")
          || element.textContent
          || ""
        ).replace(/\\s+/g, " ").trim().slice(0, 1_000);
      };
      const candidates = [...document.querySelectorAll(
        "[data-action-id],[data-control-id],[data-surface-id],button,a[href],input,select,textarea,[role]",
      )].slice(0, 5_000);
      const elements = candidates.map((element) => {
        const html = element;
        const style = getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        const input = element;
        return {
          actionId: element.getAttribute("data-action-id") || null,
          controlId: element.getAttribute("data-control-id") || null,
          surfaceId: element.getAttribute("data-surface-id") || null,
          containingSurfaceId: element.closest("[data-surface-id]")?.getAttribute("data-surface-id") || null,
          role: implicitRole(element),
          accessibleName: accessibleName(element),
          visibleText: (html.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 4_000),
          value: "value" in input ? input.value : null,
          visible: style.display !== "none"
            && style.visibility !== "hidden"
            && style.opacity !== "0"
            && rect.width > 0
            && rect.height > 0,
          enabled: !("disabled" in input && input.disabled) && element.getAttribute("aria-disabled") !== "true",
        };
      });
      return {
        schema: "setfarm.browser-dom-observation.v1",
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 12_000) || "",
        rootHtml: document.querySelector("#root")?.outerHTML?.slice(0, 24_000) || "",
        elements,
      };
    })()`);
    const stateBridge = this.options.captureAbi
      ? await page.evaluate((abi: NonNullable<WebPreviewRuntimeDriverOptions["captureAbi"]>) => {
          const root = (globalThis as any)[abi.globalName];
          const states: Record<string, unknown> = {};
          const missingStateRefs: string[] = [];
          for (const binding of abi.stateBindings) {
            let state: unknown = root;
            if (binding.pointer !== "") {
              for (const encoded of binding.pointer.slice(1).split("/")) {
                if (state === null || typeof state !== "object") {
                  state = undefined;
                  break;
                }
                const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
                state = (state as Record<string, unknown>)[key];
              }
            }
            if (state === undefined) missingStateRefs.push(binding.stateRef);
            else states[binding.stateRef] = state;
          }
          return {
            schema: "setfarm.runtime-state-bridge.v1",
            captureSchema: abi.schema,
            globalName: abi.globalName,
            states,
            missingStateRefs,
          };
        }, this.options.captureAbi)
      : await page.evaluate(() => {
          const g = globalThis as any;
          return g.__SETFARM_TEST_BRIDGE__ || g.app || null;
        }).catch(() => null);
    fs.writeFileSync(domSnapshotPath, JSON.stringify(dom, null, 2));
    return { capturedAt, url: page.url(), screenshotPath, domSnapshotPath, stateBridge };
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
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    await delay(250);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}
