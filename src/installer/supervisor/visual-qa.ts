import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  appendSupervisorEvent,
  applyScanFindings,
  supervisorVisualDir,
  writeSupervisorVisualResult,
} from "./state.js";
import type {
  SupervisorEvidenceStatus,
  SupervisorFinding,
  SupervisorVisualIssue,
  SupervisorVisualIssueType,
  SupervisorVisualResult,
} from "./types.js";

interface VisualQaParams {
  runId: string;
  workdir: string;
  repoPath?: string;
  storyId?: string;
  maxRoutes?: number;
  maxControlsPerRoute?: number;
}

interface PreviewServer {
  proc: ChildProcess;
  url: string;
}

interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
}

const VIEWPORTS: ViewportSpec[] = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const CONTROL_SELECTOR = [
  "button:visible",
  "[role='button']:visible",
  "a[href]:visible",
].join(", ");

export async function runSupervisorVisualQa(params: VisualQaParams): Promise<SupervisorVisualResult> {
  const repoPath = params.repoPath || params.workdir;
  const artifactDir = supervisorVisualDir(params.workdir, params.runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const webProject = readWebProject(repoPath);
  if (!webProject) {
    return persistVisualResult(params, {
      ok: true,
      skipped: true,
      reason: "No package.json web preview/dev script found",
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
      issues: [],
      artifactDir,
    });
  }

  const server = await startPreviewServer(repoPath, webProject.scripts);
  if (!server) {
    return persistVisualResult(params, {
      ok: false,
      reason: "Preview/dev server did not become ready",
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
      issues: [{
        id: "preview-failed",
        type: "preview_failed",
        severity: "blocker",
        route: "/",
        viewport: "server",
        detail: "npm preview/dev script failed to expose an HTTP app within the timeout.",
      }],
      artifactDir,
    });
  }

  try {
    const browser = await chromium.launch();
    try {
      const result = await scanBrowserApp({
        ...params,
        browser,
        repoPath,
        artifactDir,
        baseUrl: server.url,
        maxRoutes: params.maxRoutes || 16,
        maxControlsPerRoute: params.maxControlsPerRoute || 24,
      });
      await browser.close();
      return persistVisualResult(params, result);
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    return persistVisualResult(params, {
      ok: true,
      skipped: true,
      reason: `Playwright browser unavailable: ${String(error).slice(0, 180)}`,
      baseUrl: server.url,
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
      issues: [],
      artifactDir,
    });
  } finally {
    stopPreviewServer(server.proc);
  }
}

export function formatSupervisorVisualReport(result: SupervisorVisualResult): string {
  if (result.skipped) return `Supervisor visual QA skipped: ${result.reason || "unknown"}`;
  if (result.ok) {
    return [
      `Supervisor visual QA PASS (${result.routesChecked.length} route(s), ${result.controlsChecked} control(s)).`,
      `Artifacts: ${result.artifactDir}`,
    ].join("\n");
  }
  const lines = [
    `Supervisor visual QA FAIL: ${result.issues.length} issue(s), ${result.routesChecked.length} route(s), ${result.controlsChecked} control(s).`,
    `Artifacts: ${result.artifactDir}`,
  ];
  for (const issue of result.issues.slice(0, 16)) {
    lines.push(`- [${issue.severity}] ${issue.type} ${issue.viewport} ${issue.route}: ${issue.detail}`);
  }
  return lines.join("\n");
}

async function scanBrowserApp(params: Required<Pick<VisualQaParams, "runId" | "workdir">> & {
  browser: Browser;
  repoPath: string;
  storyId?: string;
  artifactDir: string;
  baseUrl: string;
  maxRoutes: number;
  maxControlsPerRoute: number;
}): Promise<Omit<SupervisorVisualResult, "schema" | "runId" | "storyId" | "createdAt">> {
  const routes = await discoverRoutes(params.browser, params.baseUrl, params.maxRoutes);
  const issues: SupervisorVisualIssue[] = [];
  const screenshots: string[] = [];
  let controlsChecked = 0;

  for (const viewport of VIEWPORTS) {
    for (const route of routes) {
      const page = await newPage(params.browser, viewport);
      const routeUrl = new URL(route, params.baseUrl).toString();
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          issues.push(makeIssue("console_error", "warning", route, viewport.name, msg.text().slice(0, 240)));
        }
      });
      page.on("pageerror", (error) => {
        issues.push(makeIssue("page_error", "blocker", route, viewport.name, String(error).slice(0, 240)));
      });
      page.on("requestfailed", (request) => {
        const failure = request.failure()?.errorText || "request failed";
        const resource = request.resourceType();
        const severity = resource === "document" ? "blocker" : "warning";
        issues.push(makeIssue("network_error", severity, route, viewport.name, `${request.url()} ${failure}`.slice(0, 260)));
      });

      try {
        await gotoRoute(page, routeUrl);
        const screenshot = path.join(params.artifactDir, `${safeSegment(viewport.name)}-${safeSegment(route)}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        screenshots.push(path.relative(params.workdir, screenshot));
        issues.push(...await inspectPage(page, route, viewport.name, screenshots[screenshots.length - 1]));
        const clickResult = await exerciseControls(page, {
          route,
          routeUrl,
          viewport: viewport.name,
          maxControls: params.maxControlsPerRoute,
          workdir: params.workdir,
          artifactDir: params.artifactDir,
        });
        controlsChecked += clickResult.controlsChecked;
        screenshots.push(...clickResult.screenshots);
        issues.push(...clickResult.issues);
      } catch (error) {
        issues.push(makeIssue("navigation_error", "blocker", route, viewport.name, String(error).slice(0, 260)));
      } finally {
        await page.close().catch(() => {});
      }
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== "blocker"),
    baseUrl: params.baseUrl,
    routesChecked: routes,
    controlsChecked,
    screenshots,
    issues: dedupeIssues(issues),
    artifactDir: params.artifactDir,
  };
}

async function discoverRoutes(browser: Browser, baseUrl: string, maxRoutes: number): Promise<string[]> {
  const page = await newPage(browser, VIEWPORTS[0]);
  try {
    try {
      await gotoRoute(page, baseUrl);
    } catch {
      return ["/"];
    }
    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]"))
      .map((node) => (node as HTMLAnchorElement).getAttribute("href") || "")
      .filter(Boolean));
    const routes = new Set<string>(["/"]);
    for (const href of hrefs) {
      const route = normalizeInternalRoute(href, baseUrl);
      if (route) routes.add(route);
      if (routes.size >= maxRoutes) break;
    }
    return [...routes].slice(0, maxRoutes);
  } finally {
    await page.close().catch(() => {});
  }
}

async function newPage(browser: Browser, viewport: ViewportSpec): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile || false,
  });
  const page = await context.newPage();
  page.on("close", async () => {
    await context.close().catch(() => {});
  });
  return page;
}

async function gotoRoute(page: Page, url: string): Promise<void> {
  await page.goto(url, { timeout: 20000, waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}

async function inspectPage(page: Page, route: string, viewport: string, screenshot?: string): Promise<SupervisorVisualIssue[]> {
  const snapshot = await page.evaluate(() => {
    const body = document.body;
    const text = body?.innerText?.replace(/\s+/g, " ").trim() || "";
    const meaningful = document.querySelectorAll("canvas,svg,img,button,a,input,select,textarea,[role]").length;
    const overflow = Array.from(document.body.querySelectorAll("*")).flatMap((node) => {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
      if (!visible) return [];
      const tooWide = rect.width > window.innerWidth + 8 || rect.left < -8 || rect.right > window.innerWidth + 8;
      if (!tooWide) return [];
      const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 120);
      return [`${el.tagName.toLowerCase()} ${label} width=${Math.round(rect.width)} left=${Math.round(rect.left)} right=${Math.round(rect.right)}`];
    }).slice(0, 6);
    return { text, meaningful, overflow };
  });

  const issues: SupervisorVisualIssue[] = [];
  if (snapshot.text.length < 5 && snapshot.meaningful === 0) {
    issues.push(makeIssue("blank_screen", "blocker", route, viewport, "Rendered page is blank.", screenshot));
  }
  for (const detail of snapshot.overflow) {
    issues.push(makeIssue("layout_overflow", "blocker", route, viewport, detail, screenshot));
  }
  return issues;
}

async function exerciseControls(page: Page, params: {
  route: string;
  routeUrl: string;
  viewport: string;
  maxControls: number;
  workdir: string;
  artifactDir: string;
}): Promise<{ controlsChecked: number; issues: SupervisorVisualIssue[]; screenshots: string[] }> {
  await gotoRoute(page, params.routeUrl);
  const descriptors = await page.locator(CONTROL_SELECTOR).evaluateAll((elements, max) => {
    return elements.slice(0, Number(max)).map((element, index) => {
      const el = element as HTMLElement;
      const anchor = el instanceof HTMLAnchorElement ? el : null;
      const button = el instanceof HTMLButtonElement ? el : null;
      return {
        index,
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 140),
        href: anchor?.getAttribute("href") || "",
        disabled: Boolean(button?.disabled) || el.getAttribute("aria-disabled") === "true",
      };
    });
  }, params.maxControls);

  const issues: SupervisorVisualIssue[] = [];
  const screenshots: string[] = [];
  let controlsChecked = 0;
  for (const descriptor of descriptors) {
    if (descriptor.disabled) continue;
    if (descriptor.href && !normalizeInternalRoute(descriptor.href, params.routeUrl)) continue;
    await gotoRoute(page, params.routeUrl);
    const before = await pageFingerprint(page);
    const locator = page.locator(CONTROL_SELECTOR).nth(descriptor.index);
    try {
      await locator.click({ timeout: 4000 });
      controlsChecked += 1;
      await page.waitForTimeout(350);
    } catch (error) {
      const screenshot = await captureControlScreenshot(page, params, descriptor.index);
      screenshots.push(screenshot);
      issues.push(makeIssue("dead_control", "blocker", params.route, params.viewport, `${descriptor.label || descriptor.tag}: ${String(error).slice(0, 180)}`, screenshot));
      continue;
    }
    const after = await pageFingerprint(page);
    const postInspect = await inspectPage(page, params.route, params.viewport);
    issues.push(...postInspect);
    if (before === after) {
      const screenshot = await captureControlScreenshot(page, params, descriptor.index);
      screenshots.push(screenshot);
      issues.push(makeIssue("dead_control", "blocker", params.route, params.viewport, `${descriptor.label || descriptor.tag}: click produced no visible state, route, focus, or DOM change.`, screenshot));
    }
  }
  return { controlsChecked, issues, screenshots };
}

async function captureControlScreenshot(page: Page, params: {
  route: string;
  viewport: string;
  workdir: string;
  artifactDir: string;
}, index: number): Promise<string> {
  const file = path.join(params.artifactDir, `${safeSegment(params.viewport)}-${safeSegment(params.route)}-control-${index}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return path.relative(params.workdir, file);
}

async function pageFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({
    url: location.href,
    title: document.title,
    text: document.body.innerText.replace(/\s+/g, " ").slice(0, 5000),
    html: document.body.innerHTML.replace(/\s+/g, " ").slice(0, 5000),
    focus: document.activeElement ? `${document.activeElement.tagName}:${document.activeElement.getAttribute("aria-label") || ""}` : "",
  }));
}

function persistVisualResult(
  params: VisualQaParams,
  result: Omit<SupervisorVisualResult, "schema" | "runId" | "storyId" | "createdAt">,
): SupervisorVisualResult {
  const full: SupervisorVisualResult = {
    schema: "setfarm.supervisor-visual-result.v1",
    runId: params.runId,
    storyId: params.storyId,
    createdAt: new Date().toISOString(),
    ...result,
  };
  writeSupervisorVisualResult(params.workdir, full);
  const findings = visualIssuesToFindings(full);
  if (findings.length > 0) {
    applyScanFindings({
      workdir: params.workdir,
      runId: params.runId,
      storyId: params.storyId || "visual-qa",
      findings,
    });
  }
  appendSupervisorEvent(params.workdir, {
    ts: full.createdAt,
    runId: params.runId,
    storyId: params.storyId,
    type: "visual-scan-completed",
    source: "visual-qa",
    message: full.skipped
      ? `Visual QA skipped: ${full.reason || "unknown"}`
      : `Visual QA completed: ${full.issues.length} issue(s), ${full.routesChecked.length} route(s), ${full.controlsChecked} control(s).`,
  });
  return full;
}

function visualIssuesToFindings(result: SupervisorVisualResult): SupervisorFinding[] {
  return result.issues.map((issue) => ({
    itemId: `visual:${issue.id}`,
    storyId: result.storyId,
    status: visualStatus(issue.type),
    severity: issue.severity,
    observed: [issue.detail],
    lastScan: "visual-qa",
    files: issue.screenshot ? [issue.screenshot] : [],
    message: `Visual QA ${issue.type} on ${issue.viewport} ${issue.route}: ${issue.detail}`,
    checkedAt: result.createdAt,
  }));
}

function visualStatus(type: SupervisorVisualIssueType): SupervisorEvidenceStatus {
  switch (type) {
    case "blank_screen":
      return "blank-screen";
    case "layout_overflow":
      return "layout-overflow";
    case "dead_control":
      return "dead-control";
    case "console_error":
    case "page_error":
      return "browser-error";
    case "network_error":
      return "network-error";
    default:
      return "visual-failure";
  }
}

function makeIssue(
  type: SupervisorVisualIssueType,
  severity: SupervisorVisualIssue["severity"],
  route: string,
  viewport: string,
  detail: string,
  screenshot?: string,
): SupervisorVisualIssue {
  return {
    id: `${safeSegment(type)}-${safeSegment(viewport)}-${safeSegment(route)}-${hashText(detail)}`,
    type,
    severity,
    route,
    viewport,
    detail,
    screenshot,
  };
}

function dedupeIssues(issues: SupervisorVisualIssue[]): SupervisorVisualIssue[] {
  return [...new Map(issues.map((issue) => [issue.id, issue])).values()];
}

function readWebProject(repoPath: string): { scripts: Array<"preview" | "dev"> } | null {
  try {
    const pkgPath = path.join(repoPath, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const scripts: Array<"preview" | "dev"> = [];
    if (pkg?.scripts?.preview) scripts.push("preview");
    if (pkg?.scripts?.dev) scripts.push("dev");
    return scripts.length > 0 ? { scripts } : null;
  } catch {
    return null;
  }
}

async function startPreviewServer(repoPath: string, scripts: Array<"preview" | "dev">): Promise<PreviewServer | null> {
  for (const script of scripts) {
    const server = await startSinglePreviewServer(repoPath, script);
    if (server) return server;
  }
  return null;
}

async function startSinglePreviewServer(repoPath: string, script: "preview" | "dev"): Promise<PreviewServer | null> {
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}`;
  const proc = spawn("npm", ["run", script, "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: repoPath,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  let exited = false;
  proc.once("exit", () => {
    exited = true;
  });
  const ready = await waitForServer(url, 35000, () => exited);
  if (!ready) {
    stopPreviewServer(proc);
    return null;
  }
  return { proc, url };
}

function stopPreviewServer(proc: ChildProcess): void {
  try {
    if (proc.pid) process.kill(-proc.pid, "SIGTERM");
  } catch {
    try { proc.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => {
    try {
      if (proc.pid) process.kill(-proc.pid, "SIGKILL");
    } catch {
      try { proc.kill("SIGKILL"); } catch {}
    }
  }, 2500).unref();
}

async function waitForServer(url: string, timeoutMs: number, isProcessExited?: () => boolean): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isProcessExited?.()) return false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.status < 500) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function normalizeInternalRoute(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || /^(mailto:|tel:|sms:|javascript:)/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, baseUrl);
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) return null;
    return `${url.pathname || "/"}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function safeSegment(value: string): string {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "root";
}

function hashText(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
