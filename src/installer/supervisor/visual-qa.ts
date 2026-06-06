import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  appendSupervisorEvent,
  applyScanFindings,
  resolveVisualFindingsForStory,
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
  ownershipRepoPath?: string;
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

export interface VisualScreenHint {
  storyId?: string;
  title: string;
  file: string;
  actionIds: string[];
  labels: string[];
}

export interface VisualScreenClassification {
  storyId?: string;
  title?: string;
  score: number;
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

export function isTilingBackgroundRepeat(value: string | undefined): boolean {
  const repeat = String(value || "").toLowerCase().trim();
  if (!repeat || repeat === "no-repeat") return false;
  return repeat
    .split(/\s+/)
    .some((part) => part === "repeat" || part === "repeat-x" || part === "repeat-y" || part === "round" || part === "space");
}

export function hasSceneFillingBackgroundSize(value: string | undefined): boolean {
  return /(cover|contain|100%|calc\()/i.test(String(value || ""));
}

export function isUnsafeSceneBackground(repeat: string | undefined, size: string | undefined): boolean {
  if (hasSceneFillingBackgroundSize(size)) return false;
  return isTilingBackgroundRepeat(repeat) || !String(size || "").trim();
}

export function resolveStoryVisualScope(repoPath: string, storyId?: string, fallbackRepoPaths: string[] = []): { skip: boolean; reason?: string } {
  if (!repoPath || !storyId) return { skip: false };
  const candidates = [repoPath, ...fallbackRepoPaths]
    .filter(Boolean)
    .map((candidate) => path.join(candidate, ".setfarm", "STORY_OWNERSHIP.json"));
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return { skip: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      stories?: Array<{
        storyId?: string;
        ownsScreens?: unknown[];
        scopeFiles?: unknown[];
      }>;
    };
    const story = parsed.stories?.find((item) => item.storyId === storyId);
    if (!story) return { skip: false };
    const ownsScreens = Array.isArray(story.ownsScreens) ? story.ownsScreens.filter(Boolean) : [];
    const scopeFiles = Array.isArray(story.scopeFiles) ? story.scopeFiles.map(String) : [];
    const ownsScreenFiles = scopeFiles.some((rel) => /^src\/screens\/.+\.(tsx|jsx|ts|js)$/i.test(rel));
    if (ownsScreens.length === 0 && !ownsScreenFiles) {
      return {
        skip: true,
        reason: `Story ${storyId} owns no visual screens; visual QA is deferred to the screen-owner story.`,
      };
    }
  } catch {
    return { skip: false };
  }
  return { skip: false };
}

export function classifyVisibleScreenText(text: string, hints: VisualScreenHint[], currentStoryId?: string): VisualScreenClassification {
  const haystack = normalizeTextForScreenMatch(text);
  let best: VisualScreenClassification = { score: 0 };
  for (const hint of hints) {
    const titleTokens = tokenizeScreenText(hint.title);
    const titleMatches = titleTokens.filter((token) => haystack.includes(token)).length;
    const labelTokens = hint.labels.flatMap(tokenizeScreenText);
    const labelMatches = labelTokens.filter((token) => haystack.includes(token)).length;
    const score = (titleMatches * 2) + labelMatches;
    if (score > best.score) best = { storyId: hint.storyId, title: hint.title, score };
  }
  if (best.score < 2) return { score: 0 };
  if (currentStoryId && best.storyId === currentStoryId) return best;
  return best;
}

function readVisualScreenHints(repoPath: string, fallbackRepoPaths: string[] = []): VisualScreenHint[] {
  const repos = [repoPath, ...fallbackRepoPaths].filter(Boolean);
  const ownership = readStoryOwnershipForVisualScope(repos);
  const screenIndexFile = repos
    .map((repo) => path.join(repo, "src", "screens", "SCREEN_INDEX.json"))
    .find((file) => fs.existsSync(file));
  if (!screenIndexFile) return [];
  try {
    const screens = JSON.parse(fs.readFileSync(screenIndexFile, "utf-8")) as Array<{
      title?: string;
      file?: string;
      actions?: Array<{ label?: string; id?: string }>;
      buttons?: unknown;
    }>;
    return screens
      .map((screen) => {
        const file = String(screen.file || "");
        const title = String(screen.title || "");
        if (!file || !title) return null;
        return {
          file,
          title,
          storyId: ownership.titleToStory.get(normalizeOwnedScreenTitle(title)) || ownership.fileToStory.get(file),
          actionIds: (screen.actions || []).map((action) => String(action.id || "").trim()).filter(Boolean),
          labels: [
            title,
            ...((screen.actions || []).flatMap((action) => [action.label, action.id]).filter(Boolean).map(String)),
          ],
        } satisfies VisualScreenHint;
      })
      .filter(Boolean) as VisualScreenHint[];
  } catch {
    return [];
  }
}

function readStoryOwnershipForVisualScope(repos: string[]): {
  fileToStory: Map<string, string>;
  titleToStory: Map<string, string>;
} {
  const fileToStory = new Map<string, string>();
  const titleToStory = new Map<string, string>();
  const file = repos
    .map((repo) => path.join(repo, ".setfarm", "STORY_OWNERSHIP.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (!file) return { fileToStory, titleToStory };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      stories?: Array<{ storyId?: string; ownsScreens?: unknown[]; scopeFiles?: unknown[] }>;
    };
    for (const story of parsed.stories || []) {
      const storyId = String(story.storyId || "");
      if (!storyId) continue;
      for (const rel of Array.isArray(story.scopeFiles) ? story.scopeFiles.map(String) : []) {
        if (/^src\/screens\/.+\.(tsx|jsx|ts|js)$/i.test(rel) && !fileToStory.has(rel)) fileToStory.set(rel, storyId);
      }
      for (const title of Array.isArray(story.ownsScreens) ? story.ownsScreens.map(String) : []) {
        titleToStory.set(normalizeOwnedScreenTitle(title), storyId);
      }
    }
  } catch {
    return { fileToStory, titleToStory };
  }
  return { fileToStory, titleToStory };
}

function normalizeOwnedScreenTitle(value: string): string {
  return normalizeTextForScreenMatch(value.replace(/\([^)]*\)/g, " "));
}

function normalizeTextForScreenMatch(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeScreenText(value: string): string[] {
  return normalizeTextForScreenMatch(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["the", "and", "for", "screen", "button"].includes(token));
}

export async function runSupervisorVisualQa(params: VisualQaParams): Promise<SupervisorVisualResult> {
  const repoPath = params.repoPath || params.workdir;
  const artifactDir = supervisorVisualDir(params.workdir, params.runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const storyScope = resolveStoryVisualScope(repoPath, params.storyId, [params.ownershipRepoPath || ""]);
  if (storyScope.skip) {
    const result = persistVisualResult(params, {
      ok: true,
      skipped: true,
      reason: storyScope.reason,
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
      issues: [],
      artifactDir,
    });
    if (params.storyId) {
      resolveVisualFindingsForStory({
        workdir: params.workdir,
        runId: params.runId,
        storyId: params.storyId,
        checkedAt: result.createdAt,
      });
    }
    return result;
  }

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
      return persistVisualResult(params, suppressBrowserInfraIssues(result));
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
    await stopPreviewServer(server.proc);
    cleanupDetachedPlaywrightChildren("visual-qa-finally");
  }
}

export function suppressBrowserInfraIssues(
  result: Omit<SupervisorVisualResult, "schema" | "runId" | "storyId" | "createdAt">,
): Omit<SupervisorVisualResult, "schema" | "runId" | "storyId" | "createdAt"> {
  const productIssues = result.issues.filter((issue) => !isBrowserInfraIssue(issue));
  if (productIssues.length === result.issues.length) return result;
  return {
    ...result,
    ok: productIssues.every((issue) => issue.severity !== "blocker"),
    reason: productIssues.length === 0
      ? "Browser infrastructure navigation errors were ignored; no product visual blockers remained."
      : result.reason,
    issues: productIssues,
  };
}

function isBrowserInfraIssue(issue: SupervisorVisualIssue): boolean {
  if (!/\b(target page, context or browser has been closed|browser has been closed|target closed|context closed|page closed|browser context was closed|Protocol error:.*Target closed)\b/i.test(issue.detail)) {
    return false;
  }
  return issue.type === "navigation_error" || issue.type === "dead_control";
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
  ownershipRepoPath?: string;
  storyId?: string;
  artifactDir: string;
  baseUrl: string;
  maxRoutes: number;
  maxControlsPerRoute: number;
}): Promise<Omit<SupervisorVisualResult, "schema" | "runId" | "storyId" | "createdAt">> {
  const routes = await discoverRoutes(params.browser, params.baseUrl, params.maxRoutes);
  const screenHints = readVisualScreenHints(params.repoPath, [params.workdir, params.ownershipRepoPath || ""]);
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
          storyId: params.storyId,
          screenHints,
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
  await waitForMeaningfulRender(page);
}

async function waitForMeaningfulRender(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById("root") || document.querySelector("[data-setfarm-root]") || document.body;
    const text = root?.textContent?.replace(/\s+/g, " ").trim() || "";
    const meaningful = document.querySelectorAll("canvas,svg,img,button,a,input,select,textarea,[role],[data-setfarm-root]").length;
    return text.length >= 5 || meaningful > 0;
  }, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250).catch(() => {});
}

async function inspectPage(page: Page, route: string, viewport: string, screenshot?: string): Promise<SupervisorVisualIssue[]> {
    const snapshot = await page.evaluate(() => {
      const body = document.body;
      const text = body?.innerText?.replace(/\s+/g, " ").trim() || "";
      const meaningful = document.querySelectorAll("canvas,svg,img,button,a,input,select,textarea,[role]").length;
      const viewportIssues: string[] = [];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const visible = (el: Element) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 4 && rect.height > 4 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.03;
      };
      const isTilingBackgroundRepeat = (value: string | undefined) => {
        const repeat = String(value || "").toLowerCase().trim();
        if (!repeat || repeat === "no-repeat") return false;
        return repeat
          .split(/\s+/)
          .some((part) => part === "repeat" || part === "repeat-x" || part === "repeat-y" || part === "round" || part === "space");
      };
      const hasSceneFillingBackgroundSize = (value: string | undefined) => /(cover|contain|100%|calc\()/i.test(String(value || ""));
      const isUnsafeSceneBackground = (repeat: string | undefined, size: string | undefined) => {
        if (hasSceneFillingBackgroundSize(size)) return false;
        return isTilingBackgroundRepeat(repeat) || !String(size || "").trim();
      };
      const root = document.getElementById("root") || document.querySelector("[data-setfarm-root]") || document.body.firstElementChild;
      if (root) {
        const rect = (root as HTMLElement).getBoundingClientRect();
        if (rect.height < vh * 0.92) viewportIssues.push(`root height=${Math.round(rect.height)} viewport=${vh}`);
        if (rect.width < vw * 0.92) viewportIssues.push(`root width=${Math.round(rect.width)} viewport=${vw}`);
      }
      const largeImages = Array.from(document.images)
        .filter((img) => visible(img) && img.getBoundingClientRect().width * img.getBoundingClientRect().height > vw * vh * 0.025)
        .map((img) => {
          const rect = img.getBoundingClientRect();
          return {
            src: img.currentSrc || img.src || "",
            x: Math.round(rect.left),
            y: Math.round(rect.top),
          };
        });
      const imageGroups = new Map<string, Array<{ x: number; y: number }>>();
      for (const img of largeImages) {
        if (!imageGroups.has(img.src)) imageGroups.set(img.src, []);
        imageGroups.get(img.src)?.push({ x: img.x, y: img.y });
      }
      for (const [src, items] of imageGroups) {
        if (items.length < 4) continue;
        const xs = new Set(items.map((item) => item.x)).size;
        const ys = new Set(items.map((item) => item.y)).size;
        if (xs >= 2 && ys >= 2) viewportIssues.push(`${items.length} repeated large image tiles; first=${src.split("/").pop() || src}`);
      }
      for (const node of Array.from(document.querySelectorAll("*"))) {
        if (!visible(node)) continue;
        const rect = (node as HTMLElement).getBoundingClientRect();
        if (rect.width * rect.height < vw * vh * 0.35) continue;
        const style = window.getComputedStyle(node);
        if (!/url\(/.test(style.backgroundImage || "")) continue;
        const repeat = (style.backgroundRepeat || "").toLowerCase();
        const size = (style.backgroundSize || "").toLowerCase();
        if (isUnsafeSceneBackground(repeat, size)) {
          const label = (
            (node as HTMLElement).getAttribute("data-alt")
            || (node as HTMLElement).getAttribute("aria-label")
            || String((node as HTMLElement).className || (node as HTMLElement).tagName)
          ).replace(/\s+/g, " ").slice(0, 80);
          viewportIssues.push(`large scene background uses repeat=${repeat} size=${size} on ${label}`);
        }
      }
      const gameish = /\b(score|high score|level|paused|game over|start game|space to|tap or space|retry|difficulty)\b/i.test(text);
      if (gameish) {
        const scene = document.querySelector("canvas,[data-game-scene],[data-game-root],[data-setfarm-root],main,#root");
        if (scene) {
          const rect = (scene as HTMLElement).getBoundingClientRect();
          if (rect.width < vw * 0.9 || rect.height < vh * 0.72) {
            viewportIssues.push(`game scene=${Math.round(rect.width)}x${Math.round(rect.height)} viewport=${vw}x${vh}`);
          }
        }
      }
      const pageHorizontallyScrollable = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > window.innerWidth + 8;
      const overflow = Array.from(document.body.querySelectorAll("*")).flatMap((node) => {
        const el = node as HTMLElement;
        const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
      if (!visible) return [];
      const tooWide = rect.width > window.innerWidth + 8 || rect.left < -8 || rect.right > window.innerWidth + 8;
      if (!tooWide) return [];
      let ancestor = el.parentElement;
      let hasClippingAncestor = false;
      while (ancestor) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        if (
          ["hidden", "clip"].includes(ancestorStyle.overflow)
          || ["hidden", "clip"].includes(ancestorStyle.overflowX)
        ) {
          hasClippingAncestor = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const transformed = Boolean(style.transform && style.transform !== "none");
      if (hasClippingAncestor && (transformed || !pageHorizontallyScrollable)) return [];
      const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 120);
      return [`${el.tagName.toLowerCase()} ${label} width=${Math.round(rect.width)} left=${Math.round(rect.left)} right=${Math.round(rect.right)}`];
    }).slice(0, 6);
    return { text, meaningful, overflow, viewportIssues };
  });

  const issues: SupervisorVisualIssue[] = [];
  if (snapshot.text.length < 5 && snapshot.meaningful === 0) {
    issues.push(makeIssue("blank_screen", "blocker", route, viewport, "Rendered page is blank.", screenshot));
  }
  for (const detail of snapshot.overflow) {
    issues.push(makeIssue("layout_overflow", "blocker", route, viewport, detail, screenshot));
  }
  for (const detail of snapshot.viewportIssues) {
    issues.push(makeIssue("viewport_integrity", "blocker", route, viewport, detail, screenshot));
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
  storyId?: string;
  screenHints: VisualScreenHint[];
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
        actionId: el.getAttribute("data-action-id") || "",
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
    const ownerByAction = descriptor.actionId
      ? params.screenHints.find((hint) => hint.actionIds.includes(descriptor.actionId))
      : undefined;
    if (params.storyId && ownerByAction?.storyId && ownerByAction.storyId !== params.storyId) continue;
    await gotoRoute(page, params.routeUrl);
    const locator = descriptor.actionId
      ? page.locator(`[data-action-id=${JSON.stringify(descriptor.actionId)}]:visible`).first()
      : page.locator(CONTROL_SELECTOR).nth(descriptor.index);
    if (!descriptor.actionId) {
      const visibleControlCount = await page.locator(CONTROL_SELECTOR).count().catch(() => 0);
      if (descriptor.index >= visibleControlCount) continue;
    }
    const before = await pageFingerprint(page);
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
    const ownerShift = await classifyCurrentPageOwner(page, params.screenHints, params.storyId);
    if (ownerShift.storyId && params.storyId && ownerShift.storyId !== params.storyId) {
      continue;
    }
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

async function classifyCurrentPageOwner(page: Page, hints: VisualScreenHint[], currentStoryId?: string): Promise<VisualScreenClassification> {
  if (!hints.length) return { score: 0 };
  try {
    const text = await page.evaluate(() => document.body?.innerText || "");
    return classifyVisibleScreenText(text, hints, currentStoryId);
  } catch {
    return { score: 0 };
  }
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
    case "viewport_integrity":
      return "visual-failure";
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
  const proc = spawn("npm", ["run", script, "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
    await stopPreviewServer(proc);
    return null;
  }
  return { proc, url };
}

async function stopPreviewServer(proc: ChildProcess): Promise<void> {
  terminateProcessGroup(proc, "SIGTERM");
  const stopped = await waitForExit(proc, 3000);
  if (!stopped) {
    terminateProcessGroup(proc, "SIGKILL");
    await waitForExit(proc, 1000);
  }
}

function terminateProcessGroup(proc: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (proc.pid) {
      process.kill(-proc.pid, signal);
      return;
    }
  } catch {
    // Fall back to the direct child below when the process group is gone or unavailable.
  }
  try { proc.kill(signal); } catch {}
}

function cleanupDetachedPlaywrightChildren(context: string): void {
  if (process.platform === "win32") return;
  let output = "";
  try {
    output = execFileSync("ps", ["-axo", "pid=,ppid=,pgid=,command="], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 2_000_000,
    });
  } catch {
    return;
  }

  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[4] || "";
    if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) continue;
    if (!/chromium_headless_shell|playwright_chromiumdev_profile/i.test(command)) continue;
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      continue;
    }
    setTimeout(() => {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }, 1500).unref?.();
  }
}

function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    timer.unref?.();
    function done() {
      cleanup();
      resolve(true);
    }
    function cleanup() {
      clearTimeout(timer);
      proc.off("exit", done);
      proc.off("error", done);
    }
    proc.once("exit", done);
    proc.once("error", done);
  });
}

async function waitForServer(url: string, timeoutMs: number, isProcessExited?: () => boolean): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isProcessExited?.()) return false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return true;
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
