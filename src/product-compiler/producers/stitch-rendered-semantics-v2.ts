import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import JSON5 from "json5";
import {
  chromium,
  type BrowserContext,
  type Page,
  type Route,
} from "playwright";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import { isValidStitchHtmlBytes, isValidStitchScreenshotBytes } from "../stitch-render-artifact.js";
import { parseStitchSemanticDomV1 } from "../stitch-semantic-dom-v1.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetV2,
  type RequiredObservableSelectorV2,
} from "../schemas/design-generation-targets-v2.js";
import { StitchDirectResponseEvidenceV2Schema } from "../schemas/stitch-direct-response-evidence-v2.js";
import { ControlSlotIdSchema } from "../schemas/common-v2.js";
import type { StitchRenderProfileV1 } from "../schemas/stitch-rendered-semantics-v1.js";
import {
  STITCH_RENDERED_SEMANTICS_POLICY_V2,
  StitchRenderedSemanticsV2Schema,
  type StitchGetByRoleReceiptV2,
  type StitchRenderedCandidateV2,
  type StitchRenderedElementV2,
  type StitchRenderedSemanticsInfrastructurePhaseV2,
  type StitchRenderedSemanticsV2,
} from "../schemas/stitch-rendered-semantics-v2.js";
import type { StitchCandidateArtifactBytesV1 } from "./stitch-target-candidate-selection.js";

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = String((require("playwright/package.json") as { version: string }).version);
const CHROMIUM_REVISION = String((JSON.parse(readFileSync(
  path.join(path.dirname(require.resolve("playwright-core/package.json")), "browsers.json"),
  "utf8",
)) as {
  browsers: Array<{ name: string; revision: string }>;
}).browsers.find((browser) => browser.name === "chromium")?.revision ?? "");

const MAX_RESOURCE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_RESOURCE_BYTES = 8 * 1024 * 1024;
const CONTRACT_ATTRIBUTES = new Set([
  "data-action",
  "data-action-input",
  "data-control-slot",
  "data-surface-id",
  "role",
  "aria-label",
  "href",
]);
const PHASE_ORDER = ["before", "after", "reload"] as const;
const ARIA_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "blockquote", "button",
  "caption", "cell", "checkbox", "code", "columnheader", "combobox", "complementary",
  "contentinfo", "definition", "deletion", "dialog", "directory", "document", "emphasis",
  "feed", "figure", "form", "generic", "grid", "gridcell", "group", "heading", "img",
  "insertion", "link", "list", "listbox", "listitem", "log", "main", "marquee", "math",
  "meter", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "navigation",
  "none", "note", "option", "paragraph", "presentation", "progressbar", "radio", "radiogroup",
  "region", "row", "rowgroup", "rowheader", "scrollbar", "search", "searchbox", "separator",
  "slider", "spinbutton", "status", "strong", "subscript", "superscript", "switch", "tab",
  "table", "tablist", "tabpanel", "term", "textbox", "time", "timer", "toolbar", "tooltip",
  "tree", "treegrid", "treeitem",
]);

type PlaywrightRole = Parameters<Page["getByRole"]>[0];

type ResourceCapture = Readonly<{
  url: string;
  urlHash: string;
  resourceType: "script" | "stylesheet";
  contentHash: string;
  contentType: string;
  bytes: Buffer;
}>;

export type StitchRenderedSemanticsSidecarsV2 = Readonly<{
  semanticDom: ReadonlyMap<string, Buffer>;
  resources: ReadonlyMap<string, Buffer>;
}>;

export type StitchRenderedSemanticsCaptureV2 = Readonly<{
  artifact: StitchRenderedSemanticsV2;
  artifactHash: string;
  sidecars: StitchRenderedSemanticsSidecarsV2;
}>;

export class StitchRenderedSemanticsInfrastructureErrorV2 extends Error {
  readonly code:
    | "STITCH_RENDERER_V2_INPUT_INVALID"
    | "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"
    | "STITCH_RENDERER_V2_BROWSER_UNAVAILABLE"
    | "STITCH_RENDERER_V2_REVISION_MISMATCH"
    | "STITCH_RENDERER_V2_DOCUMENT_RENDER_FAILED"
    | "STITCH_RENDERER_V2_OBSERVATION_FAILED"
    | "STITCH_RENDERER_V2_ARTIFACT_INVALID"
    | "STITCH_RENDERER_V2_SIDECAR_INVALID"
    | "STITCH_RENDERER_V2_REPLAY_MISMATCH"
    | "STITCH_RENDERER_V2_UNEXPECTED";
  readonly phase: StitchRenderedSemanticsInfrastructurePhaseV2;

  constructor(
    code: StitchRenderedSemanticsInfrastructureErrorV2["code"],
    phase: StitchRenderedSemanticsInfrastructurePhaseV2,
    message: string,
  ) {
    super(`${code}:${phase}:${message}`);
    this.name = "StitchRenderedSemanticsInfrastructureErrorV2";
    this.code = code;
    this.phase = phase;
  }
}

class CandidateSourceError extends Error {
  readonly failureCode: StitchRenderedCandidateV2["failureCodes"][number];

  constructor(
    failureCode: StitchRenderedCandidateV2["failureCodes"][number],
    message: string,
  ) {
    super(message);
    this.name = "StitchRenderedSemanticsCandidateSourceErrorV2";
    this.failureCode = failureCode;
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
}

function infrastructure(
  code: StitchRenderedSemanticsInfrastructureErrorV2["code"],
  phase: StitchRenderedSemanticsInfrastructurePhaseV2,
  error: unknown,
): StitchRenderedSemanticsInfrastructureErrorV2 {
  return error instanceof StitchRenderedSemanticsInfrastructureErrorV2
    ? error
    : new StitchRenderedSemanticsInfrastructureErrorV2(code, phase, errorText(error));
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function renderProfile(deviceTypeInput: string): StitchRenderProfileV1 {
  const deviceType = String(deviceTypeInput || "DESKTOP").toUpperCase();
  const dimensions = deviceType === "MOBILE"
    ? { id: "mobile-390x844.v1" as const, deviceType: "MOBILE" as const, width: 390, height: 844 }
    : deviceType === "TABLET"
      ? { id: "tablet-820x1180.v1" as const, deviceType: "TABLET" as const, width: 820, height: 1180 }
      : { id: "desktop-1280x800.v1" as const, deviceType: "DESKTOP" as const, width: 1280, height: 800 };
  return {
    ...dimensions,
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
  };
}

function sanitizeExecutableSource(html: string): string {
  const inspectableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/<\s*(?:iframe|object|embed)\b/i.test(inspectableHtml)) {
    throw new CandidateSourceError(
      "RESOURCE_POLICY_VIOLATION",
      "Embedded browsing/plugin contexts are forbidden",
    );
  }
  if (
    /<[^>]+\son[a-z][a-z0-9_-]*\s*=/i.test(inspectableHtml)
    || /<[^>]+\b(?:href|src|action|formaction)\s*=\s*["']\s*javascript\s*:/i.test(inspectableHtml)
    || /<[^>]+\bsrcdoc\s*=/i.test(inspectableHtml)
  ) {
    throw new CandidateSourceError(
      "UNSUPPORTED_EXECUTABLE_SCRIPT",
      "Inline browser event, javascript URL, and srcdoc execution are forbidden",
    );
  }
  if (/<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh\b/i.test(inspectableHtml)) {
    throw new CandidateSourceError(
      "RESOURCE_POLICY_VIOLATION",
      "Meta refresh navigation is forbidden during rendered-semantics capture",
    );
  }
  const scriptStarts = inspectableHtml.match(/<script\b/gi)?.length ?? 0;
  const completeScripts = inspectableHtml.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)?.length ?? 0;
  if (scriptStarts !== completeScripts) {
    throw new CandidateSourceError(
      "UNSUPPORTED_EXECUTABLE_SCRIPT",
      "Every script source must have one complete compiler-inspectable element",
    );
  }
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (
    _full,
    attributes: string,
    body: string,
  ) => {
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) return "";
    const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) {
      const parsed = allowedResourceUrl(decodeHtmlAttribute(src), "script");
      return `<script src="${parsed.replace(/&/g, "&amp;")}"></script>`;
    }
    const match = body.match(/^\s*tailwind\.config\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) {
      if (!body.trim()) return "";
      throw new CandidateSourceError(
        "UNSUPPORTED_EXECUTABLE_SCRIPT",
        "Inline executable source is outside the Tailwind data-only policy",
      );
    }
    let config: unknown;
    try {
      config = JSON5.parse(match[1]!);
    } catch {
      throw new CandidateSourceError(
        "UNSUPPORTED_EXECUTABLE_SCRIPT",
        "Tailwind configuration must be a data-only JSON5 value",
      );
    }
    return `<script>tailwind.config=${JSON.stringify(config)};</script>`;
  });
}

function assertNoDuplicateContractAttributes(html: string): void {
  const duplicate = parseStitchSemanticDomV1(html).flatMap((element) =>
    element.duplicateAttributes.filter((attribute) => CONTRACT_ATTRIBUTES.has(attribute)));
  if (duplicate.length > 0) {
    throw new CandidateSourceError(
      "DUPLICATE_CONTRACT_ATTRIBUTE",
      "Source repeats a machine-contract attribute",
    );
  }
}

function allowedResourceUrl(raw: string, resourceType: "script" | "stylesheet"): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CandidateSourceError("RESOURCE_POLICY_VIOLATION", "Render resource URL is invalid");
  }
  const allowed = resourceType === "script"
    ? parsed.protocol === "https:" && parsed.hostname === "cdn.tailwindcss.com"
    : parsed.protocol === "https:" && ["fonts.googleapis.com", "cdn.jsdelivr.net"].includes(parsed.hostname);
  if (!allowed || parsed.port !== "" || parsed.username !== "" || parsed.password !== "") {
    throw new CandidateSourceError(
      resourceType === "script" ? "UNSUPPORTED_EXECUTABLE_SCRIPT" : "RESOURCE_POLICY_VIOLATION",
      `Render ${resourceType} URL is outside the compiler allowlist`,
    );
  }
  parsed.hash = "";
  return parsed.toString();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);?/g, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#39;/gi, "'");
}

function attributeValue(attributes: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = attributes.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  return value === undefined ? undefined : decodeHtmlAttribute(value);
}

function declaredResources(html: string): Array<Readonly<{
  url: string;
  resourceType: "script" | "stylesheet";
}>> {
  const resources: Array<{ url: string; resourceType: "script" | "stylesheet" }> = [];
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const tag = match[1]!.toLowerCase();
    const attributes = match[2]!;
    if (tag === "script") {
      const src = attributeValue(attributes, "src");
      if (src) resources.push({ url: allowedResourceUrl(src, "script"), resourceType: "script" });
      continue;
    }
    const rel = attributeValue(attributes, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const href = attributeValue(attributes, "href");
    if (rel.includes("stylesheet") && href) {
      resources.push({ url: allowedResourceUrl(href, "stylesheet"), resourceType: "stylesheet" });
    }
  }
  const unique = new Map(resources.map((resource) => [resource.url, resource] as const));
  return [...unique.values()].sort((left, right) => compareUtf16(left.url, right.url));
}

async function prefetchDeclaredResources(html: string): Promise<Map<string, ResourceCapture>> {
  const captures = new Map<string, ResourceCapture>();
  let total = 0;
  for (const resource of declaredResources(html)) {
    let response: Response;
    try {
      response = await fetch(resource.url, {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw infrastructure(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        error,
      );
    }
    if (!response.ok) {
      throw new StitchRenderedSemanticsInfrastructureErrorV2(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        `HTTP ${response.status} for ${resource.url}`,
      );
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw infrastructure(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        error,
      );
    }
    if (bytes.byteLength > MAX_RESOURCE_BYTES || total + bytes.byteLength > MAX_TOTAL_RESOURCE_BYTES) {
      throw new CandidateSourceError(
        "RESOURCE_CAPACITY_EXCEEDED",
        "Declared render resources exceed the sealed byte capacity",
      );
    }
    total += bytes.byteLength;
    captures.set(resource.url, {
      ...resource,
      urlHash: sha256(resource.url),
      contentHash: sha256(bytes),
      contentType: response.headers.get("content-type")
        ?? (resource.resourceType === "script" ? "application/javascript" : "text/css"),
      bytes,
    });
  }
  return captures;
}

async function strictContext(
  profile: StitchRenderProfileV1,
  phase: "browser_launch" | "replay_render" = "browser_launch",
): Promise<{ context: BrowserContext; version: string }> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const version = browser.version();
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: 1,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      colorScheme: profile.colorScheme,
      reducedMotion: profile.reducedMotion,
      serviceWorkers: "block",
      javaScriptEnabled: true,
    });
    context.on("page", (page) => {
      page.on("popup", (popup) => { void popup.close(); });
    });
    return { context, version };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    throw infrastructure("STITCH_RENDERER_V2_BROWSER_UNAVAILABLE", phase, error);
  }
}

async function installOfflineResourceRoutes(
  page: Page,
  captures: ReadonlyMap<string, ResourceCapture>,
): Promise<() => string[]> {
  const violations = new Set<string>();
  await page.route("**/*", async (route: Route) => {
    const url = route.request().url();
    const capture = captures.get(url);
    if (!capture) {
      violations.add(url);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: capture.contentType,
      body: capture.bytes,
    });
  });
  return () => [...violations].sort(compareUtf16);
}

async function settleRenderedDocument(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const global = globalThis as any;
    await global.document.fonts?.ready;
    await new Promise<void>((resolve) =>
      global.requestAnimationFrame(() => global.requestAnimationFrame(() => resolve())));
  });
}

async function assignRefsAndObserve(
  page: Page,
  refMode: "assign" | "verify" = "assign",
): Promise<StitchRenderedElementV2[]> {
  return page.evaluate((mode) => {
    const global = globalThis as any;
    const document = global.document;
    const interactiveRoles = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch"]);
    const nativeTags = new Set(["button", "a", "input", "textarea", "select"]);
    const relevant = [...document.querySelectorAll("*")].filter((element: any) => {
      const tag = String(element.tagName || "").toLowerCase();
      return nativeTags.has(tag)
        || [
          "data-action",
          "data-action-input",
          "data-control-slot",
          "data-surface-id",
          "role",
          "aria-label",
          "href",
        ].some((attribute) => element.hasAttribute(attribute));
    });
    relevant.forEach((element: any, index: number) => {
      const expected = `E${String(index + 1).padStart(6, "0")}`;
      if (mode === "verify" && element.getAttribute("data-setfarm-element-ref") !== expected) {
        throw new Error(`STITCH_RENDERER_V2_ELEMENT_REF_MISMATCH:${expected}`);
      }
      element.setAttribute("data-setfarm-element-ref", expected);
    });
    return relevant.map((element: any, index: number) => {
      const blockers = new Set<string>();
      let current: any = element;
      while (current && current.nodeType === 1) {
        const style = global.getComputedStyle(current);
        if (current.hasAttribute("hidden")) blockers.add("hidden_attribute");
        if (current.hasAttribute("inert")) blockers.add("inert");
        if (String(current.getAttribute("aria-hidden") || "").toLowerCase() === "true") blockers.add("aria_hidden");
        if (style.display === "none") blockers.add("ancestor_display_none");
        if (["hidden", "collapse"].includes(style.visibility)) blockers.add("visibility_hidden");
        if (style.contentVisibility === "hidden") blockers.add("content_visibility_hidden");
        if (Number.parseFloat(style.opacity || "1") === 0) blockers.add("zero_opacity");
        current = current.parentElement;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || element.getClientRects().length === 0) blockers.add("zero_geometry");
      const blockerOrder = [
        "hidden_attribute",
        "ancestor_display_none",
        "visibility_hidden",
        "content_visibility_hidden",
        "zero_opacity",
        "inert",
        "aria_hidden",
        "zero_geometry",
      ] as const;
      const orderedBlockers: StitchRenderedElementV2["renderBlockers"] = blockerOrder
        .filter((blocker) => blockers.has(blocker));
      const tagName = String(element.tagName || "").toLowerCase();
      const role = element.getAttribute("role");
      const disabled = Boolean(element.disabled)
        || Boolean(element.matches?.(":disabled"))
        || String(element.getAttribute("aria-disabled") || "").toLowerCase() === "true"
        || blockers.has("inert");
      const rendered = orderedBlockers.length === 0;
      const pointerOperable = rendered && !disabled && global.getComputedStyle(element).pointerEvents !== "none";
      const nearestSurface = element.closest("[data-surface-id]");
      const nativeControlKind: StitchRenderedElementV2["nativeControlKind"] = tagName === "a"
        ? "link"
        : ["button", "input", "textarea", "select"].includes(tagName)
          ? tagName as Exclude<StitchRenderedElementV2["nativeControlKind"], "link" | null>
          : null;
      const renderState: StitchRenderedElementV2["renderState"] = rendered ? "rendered" : "not_rendered";
      return {
        elementRef: `E${String(index + 1).padStart(6, "0")}`,
        sourceOrdinal: index,
        tagName,
        ownSurfaceRef: element.getAttribute("data-surface-id"),
        nearestSurfaceRef: nearestSurface?.getAttribute("data-surface-id") ?? null,
        dataAction: element.getAttribute("data-action"),
        dataActionInput: element.getAttribute("data-action-input"),
        dataControlSlot: element.getAttribute("data-control-slot"),
        role,
        ariaLabel: element.getAttribute("aria-label"),
        href: element.getAttribute("href"),
        nativeControlKind,
        interactiveRole: interactiveRoles.has(String(role || "").toLowerCase()),
        renderState,
        renderBlockers: orderedBlockers,
        enabled: !disabled,
        pointerOperable,
      };
    });
  }, refMode);
}

function cssAttributeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function observablePhases(observable: RequiredObservableSelectorV2): Array<"before" | "after" | "reload"> {
  const present = new Set(observable.assertions.map((assertion) => assertion.phase));
  return PHASE_ORDER.filter((phase) => present.has(phase));
}

function requiresVisibleBefore(observable: RequiredObservableSelectorV2): boolean {
  return observable.assertions.some((assertion) =>
    assertion.phase === "before"
    && assertion.property === "visibility"
    && assertion.operator === "equals"
    && assertion.expected === true);
}

async function observeRoleReceipt(
  page: Page,
  observable: RequiredObservableSelectorV2,
): Promise<StitchGetByRoleReceiptV2> {
  if (observable.selector.kind !== "accessibility") {
    throw new StitchRenderedSemanticsInfrastructureErrorV2(
      "STITCH_RENDERER_V2_OBSERVATION_FAILED",
      "role_observation",
      `Role observation received non-accessibility selector ${observable.observableRef}`,
    );
  }
  if (!ARIA_ROLES.has(observable.selector.role)) {
    throw new StitchRenderedSemanticsInfrastructureErrorV2(
      "STITCH_RENDERER_V2_INPUT_INVALID",
      "input_validation",
      `Unsupported Playwright role ${observable.selector.role}`,
    );
  }
  const surface = page.locator(
    `[data-surface-id="${cssAttributeString(observable.selector.surfaceRef)}"]`,
  );
  if (await surface.count() !== 1) {
    throw new CandidateSourceError(
      "OBSERVABLE_ROLE_CARDINALITY_MISMATCH",
      `Observable ${observable.observableRef} requires exactly one owning surface`,
    );
  }
  const locator = surface.getByRole(observable.selector.role as PlaywrightRole, {
    name: observable.selector.name,
    exact: true,
    includeHidden: true,
  });
  const observed = await locator.count();
  if (observed !== 1) {
    throw new CandidateSourceError(
      "OBSERVABLE_ROLE_CARDINALITY_MISMATCH",
      `Observable ${observable.observableRef} expected one getByRole match and observed ${observed}`,
    );
  }
  const elementRefs: string[] = [];
  const nearestSurfaceRefs: Array<string | null> = [];
  let visible = 0;
  for (let index = 0; index < observed; index += 1) {
    const match = locator.nth(index);
    const observation = await match.evaluate((element) => ({
      elementRef: element.getAttribute("data-setfarm-element-ref"),
      nearestSurfaceRef: element.closest("[data-surface-id]")?.getAttribute("data-surface-id") ?? null,
    }));
    if (!observation.elementRef) {
      throw new StitchRenderedSemanticsInfrastructureErrorV2(
        "STITCH_RENDERER_V2_OBSERVATION_FAILED",
        "role_observation",
        `Role match for ${observable.observableRef} is absent from rendered element observations`,
      );
    }
    elementRefs.push(observation.elementRef);
    nearestSurfaceRefs.push(observation.nearestSurfaceRef);
    if (await match.isVisible()) visible += 1;
  }
  const visibilityRequirement = requiresVisibleBefore(observable)
    ? "must_be_visible_before" as const
    : "traceable_hidden_allowed" as const;
  if (visibilityRequirement === "must_be_visible_before" && visible !== 1) {
    throw new CandidateSourceError(
      "OBSERVABLE_BEFORE_VISIBLE_MISSING",
      `Observable ${observable.observableRef} must be visible in the before phase`,
    );
  }
  return {
    observableRef: observable.observableRef,
    actionRef: observable.actionRef,
    selectorHash: hashCanonicalJson(observable.selector),
    surfaceRef: observable.selector.surfaceRef,
    query: {
      engine: "playwright",
      method: "getByRole",
      role: observable.selector.role,
      name: observable.selector.name,
      exact: true,
      includeHidden: true,
    },
    phases: observablePhases(observable),
    visibilityRequirement,
    elementRefs,
    nearestSurfaceRefs,
    cardinality: { expected: 1, observed, visible },
  };
}

async function observeRoleReceipts(
  page: Page,
  target: DesignGenerationTargetV2,
): Promise<StitchGetByRoleReceiptV2[]> {
  const receipts: StitchGetByRoleReceiptV2[] = [];
  for (const observable of target.requiredObservableSelectors
    .filter((candidate) => candidate.selector.kind === "accessibility")
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef))) {
    receipts.push(await observeRoleReceipt(page, observable));
  }
  return receipts;
}

async function replayRoleReceipt(
  page: Page,
  expected: StitchGetByRoleReceiptV2,
): Promise<StitchGetByRoleReceiptV2> {
  if (!ARIA_ROLES.has(expected.query.role)) {
    throw new Error(`Unsupported replay role ${expected.query.role}`);
  }
  const surface = page.locator(`[data-surface-id="${cssAttributeString(expected.surfaceRef)}"]`);
  if (await surface.count() !== 1) {
    throw new Error(`Replay surface cardinality differs for ${expected.observableRef}`);
  }
  const locator = surface.getByRole(expected.query.role as PlaywrightRole, {
    name: expected.query.name,
    exact: expected.query.exact,
    includeHidden: expected.query.includeHidden,
  });
  const observed = await locator.count();
  const elementRefs: string[] = [];
  const nearestSurfaceRefs: Array<string | null> = [];
  let visible = 0;
  for (let index = 0; index < observed; index += 1) {
    const match = locator.nth(index);
    const observation = await match.evaluate((element) => ({
      elementRef: element.getAttribute("data-setfarm-element-ref"),
      nearestSurfaceRef: element.closest("[data-surface-id]")?.getAttribute("data-surface-id") ?? null,
    }));
    if (!observation.elementRef) throw new Error(`Replay element ref missing for ${expected.observableRef}`);
    elementRefs.push(observation.elementRef);
    nearestSurfaceRefs.push(observation.nearestSurfaceRef);
    if (await match.isVisible()) visible += 1;
  }
  return {
    ...expected,
    elementRefs,
    nearestSurfaceRefs,
    cardinality: { expected: 1, observed, visible },
  };
}

async function canonicalSemanticDom(page: Page): Promise<Buffer> {
  const text = await page.evaluate(() => {
    const global = globalThis as any;
    const document = global.document;
    document.querySelectorAll("script,iframe,object,embed").forEach((element: any) => element.remove());
    document.querySelectorAll("img,source,video,audio").forEach((element: any) => {
      element.removeAttribute("src");
      element.removeAttribute("srcset");
    });
    return `<!doctype html>${document.documentElement.outerHTML}`;
  });
  return Buffer.from(text, "utf8");
}

function rejectedCandidate(input: Readonly<{
  stageId: string;
  screenId: string;
  targetRef: string | null;
  htmlHash: string | null;
  screenshotHash: string | null;
  failureCode: StitchRenderedCandidateV2["failureCodes"][number];
}>): StitchRenderedCandidateV2 {
  return {
    stageId: input.stageId,
    screenId: input.screenId,
    targetRef: input.targetRef,
    htmlArtifactHash: input.htmlHash,
    screenshotArtifactHash: input.screenshotHash,
    semanticDom: null,
    resourceRefs: [],
    status: "source_rejected",
    failureCodes: [input.failureCode],
    elements: [],
    roleReceipts: [],
    observationHash: null,
  };
}

function parseCaptureInputs(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV1[];
}>): {
  generationTargets: ReturnType<typeof DesignGenerationTargetsV2Schema.parse>;
  directResponseEvidence: ReturnType<typeof StitchDirectResponseEvidenceV2Schema.parse>;
} {
  try {
    const generationTargets = DesignGenerationTargetsV2Schema.parse(input.generationTargets);
    const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse(input.directResponseEvidence);
    const artifactIds = input.artifacts.map((artifact) => artifact.screenId);
    if (new Set(artifactIds).size !== artifactIds.length) {
      throw new Error("Candidate artifact screen IDs must be unique");
    }
    const targetIds = new Set(generationTargets.targets.map((target) => target.targetId));
    for (const batch of directResponseEvidence.batches) {
      for (const targetRef of batch.targetRefs) {
        if (!targetIds.has(targetRef)) throw new Error(`Direct response target ref is unresolved: ${targetRef}`);
      }
    }
    for (const target of generationTargets.targets) {
      for (const observable of target.requiredObservableSelectors) {
        if (
          observable.selector.kind === "accessibility"
          && !ARIA_ROLES.has(observable.selector.role)
        ) {
          throw new Error(`Unsupported Playwright role ${observable.selector.role}`);
        }
      }
    }
    return { generationTargets, directResponseEvidence };
  } catch (error) {
    throw infrastructure("STITCH_RENDERER_V2_INPUT_INVALID", "input_validation", error);
  }
}

export async function captureStitchRenderedSemanticsV2(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV1[];
  deviceType: string;
}>): Promise<StitchRenderedSemanticsCaptureV2> {
  const { generationTargets, directResponseEvidence } = parseCaptureInputs(input);
  const profile = renderProfile(input.deviceType);
  const artifactById = new Map(input.artifacts.map((artifact) => [artifact.screenId, artifact]));
  const targetById = new Map(generationTargets.targets.map((target) => [target.targetId, target] as const));
  const batchByScreenId = new Map(directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => [candidate.screenId, batch] as const)));
  const semanticDomSidecars = new Map<string, Buffer>();
  const resourceSidecars = new Map<string, Buffer>();
  const resourcesByUrlHash = new Map<string, ResourceCapture>();
  const candidates: StitchRenderedCandidateV2[] = [];
  let chromiumVersion = "";

  for (const candidate of directResponseEvidence.batches.flatMap((batch) => batch.candidates)
    .sort((left, right) => compareUtf16(left.screenId, right.screenId))) {
    const batch = batchByScreenId.get(candidate.screenId)!;
    const stageId = batch.stageId;
    const matchingTargets = batch.targetRefs
      .map((targetRef) => targetById.get(targetRef)!)
      .filter((target) => target.expectedScreenTitle === candidate.title);
    const target = matchingTargets.length === 1 ? matchingTargets[0]! : undefined;
    const targetRef = target?.targetId ?? null;
    const local = artifactById.get(candidate.screenId);
    const htmlBytes = local?.htmlBytes;
    const screenshotBytes = local?.screenshotBytes;
    const htmlHash = htmlBytes?.byteLength ? sha256(htmlBytes) : null;
    const screenshotHash = screenshotBytes?.byteLength ? sha256(screenshotBytes) : null;
    const reject = (failureCode: StitchRenderedCandidateV2["failureCodes"][number]) => {
      candidates.push(rejectedCandidate({
        stageId,
        screenId: candidate.screenId,
        targetRef,
        htmlHash,
        screenshotHash,
        failureCode,
      }));
    };
    if (!target) {
      reject("TARGET_IDENTITY_UNRESOLVED");
      continue;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(candidate.screenId)) {
      reject("UNSAFE_SCREEN_ID");
      continue;
    }
    if (!htmlBytes || !isValidStitchHtmlBytes(htmlBytes)) {
      reject("HTML_INVALID");
      continue;
    }
    if (!screenshotBytes || !isValidStitchScreenshotBytes(screenshotBytes)) {
      reject("SCREENSHOT_INVALID");
      continue;
    }
    if (
      candidate.htmlDownloadedArtifactHash !== htmlHash
      || candidate.screenshotDownloadedArtifactHash !== screenshotHash
    ) {
      reject("ARTIFACT_HASH_MISMATCH");
      continue;
    }

    let context: BrowserContext | undefined;
    let phase: StitchRenderedSemanticsInfrastructurePhaseV2 = "source_validation";
    try {
      const rawHtml = Buffer.from(htmlBytes).toString("utf8");
      assertNoDuplicateContractAttributes(rawHtml);
      const sanitizedHtml = sanitizeExecutableSource(rawHtml);

      phase = "resource_prefetch";
      const resources = await prefetchDeclaredResources(sanitizedHtml);

      phase = "browser_launch";
      const launched = await strictContext(profile);
      context = launched.context;
      chromiumVersion ||= launched.version;
      if (chromiumVersion !== launched.version) {
        throw new StitchRenderedSemanticsInfrastructureErrorV2(
          "STITCH_RENDERER_V2_REVISION_MISMATCH",
          "browser_launch",
          "Chromium version changed during one capture",
        );
      }
      const page = await context.newPage();
      const resourceViolations = await installOfflineResourceRoutes(page, resources);

      phase = "document_render";
      try {
        await page.setContent(sanitizedHtml, { waitUntil: "networkidle", timeout: 30_000 });
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_DOCUMENT_RENDER_FAILED", phase, error);
      }
      const violations = resourceViolations();
      if (violations.length > 0) {
        throw new CandidateSourceError(
          "RESOURCE_POLICY_VIOLATION",
          `Document requested resources outside its presealed first-level set: ${violations.slice(0, 5).join(", ")}`,
        );
      }

      phase = "document_settle";
      try {
        await settleRenderedDocument(page);
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_DOCUMENT_RENDER_FAILED", phase, error);
      }

      phase = "dom_observation";
      let elements: StitchRenderedElementV2[];
      try {
        elements = await assignRefsAndObserve(page);
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_OBSERVATION_FAILED", phase, error);
      }
      if (elements.some((element) =>
        element.dataControlSlot !== null
        && !ControlSlotIdSchema.safeParse(element.dataControlSlot).success)) {
        throw new CandidateSourceError(
          "INVALID_CONTRACT_ATTRIBUTE",
          "A rendered data-control-slot value is not a canonical ControlSlot identity",
        );
      }

      phase = "role_observation";
      const roleReceipts = await observeRoleReceipts(page, target);

      phase = "semantic_dom_serialization";
      let semanticDom: Buffer;
      try {
        semanticDom = await canonicalSemanticDom(page);
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_OBSERVATION_FAILED", phase, error);
      }
      const locator = `stitch/rendered-dom-v2/${candidate.screenId}.html`;
      semanticDomSidecars.set(locator, semanticDom);
      for (const resource of resources.values()) {
        resourceSidecars.set(resource.contentHash, resource.bytes);
        resourcesByUrlHash.set(resource.urlHash, resource);
      }
      const resourceRefs = [...resources.values()]
        .map((resource) => resource.urlHash)
        .sort(compareUtf16);
      candidates.push({
        stageId,
        screenId: candidate.screenId,
        targetRef,
        htmlArtifactHash: htmlHash,
        screenshotArtifactHash: screenshotHash,
        semanticDom: { locator, hash: sha256(semanticDom), byteLength: semanticDom.byteLength },
        resourceRefs,
        status: "rendered",
        failureCodes: [],
        elements,
        roleReceipts,
        observationHash: hashCanonicalJson({ elements, roleReceipts }),
      });
    } catch (error) {
      if (error instanceof CandidateSourceError) {
        reject(error.failureCode);
      } else if (error instanceof StitchRenderedSemanticsInfrastructureErrorV2) {
        throw error;
      } else {
        throw infrastructure("STITCH_RENDERER_V2_UNEXPECTED", phase, error);
      }
    } finally {
      await context?.browser()?.close().catch(() => undefined);
    }
  }

  if (!chromiumVersion) {
    const launched = await strictContext(profile);
    chromiumVersion = launched.version;
    await launched.context.browser()?.close().catch(() => undefined);
  }
  let artifact: StitchRenderedSemanticsV2;
  try {
    artifact = StitchRenderedSemanticsV2Schema.parse({
      schema: "setfarm.stitch-rendered-semantics.v2",
      policy: STITCH_RENDERED_SEMANTICS_POLICY_V2,
      generationTargetsHash: hashCanonicalJson(generationTargets),
      directResponseEvidenceHash: hashCanonicalJson(directResponseEvidence),
      renderer: {
        engine: "chromium",
        playwrightVersion: PLAYWRIGHT_VERSION,
        chromiumRevision: CHROMIUM_REVISION,
        chromiumVersion,
      },
      profile,
      resources: [...resourcesByUrlHash.values()].map((resource) => ({
        urlHash: resource.urlHash,
        resourceType: resource.resourceType,
        contentHash: resource.contentHash,
        byteLength: resource.bytes.byteLength,
        locator: `stitch/render-resources/${resource.contentHash}.bin`,
      })).sort((left, right) => compareUtf16(left.urlHash, right.urlHash)),
      candidates,
    });
  } catch (error) {
    throw infrastructure("STITCH_RENDERER_V2_ARTIFACT_INVALID", "artifact_validation", error);
  }
  return {
    artifact,
    artifactHash: hashCanonicalJson(artifact),
    sidecars: { semanticDom: semanticDomSidecars, resources: resourceSidecars },
  };
}

export async function writeStitchRenderedSemanticsV2(
  repo: string,
  capture: StitchRenderedSemanticsCaptureV2,
): Promise<void> {
  try {
    const artifact = StitchRenderedSemanticsV2Schema.parse(capture.artifact);
    if (hashCanonicalJson(artifact) !== capture.artifactHash) {
      throw new Error("Rendered-semantics v2 artifact hash does not match its canonical payload");
    }
    for (const candidate of artifact.candidates) {
      if (!candidate.semanticDom) continue;
      const bytes = capture.sidecars.semanticDom.get(candidate.semanticDom.locator);
      if (
        !bytes
        || bytes.byteLength !== candidate.semanticDom.byteLength
        || sha256(bytes) !== candidate.semanticDom.hash
      ) {
        throw new Error(`Semantic DOM sidecar mismatch: ${candidate.screenId}`);
      }
    }
    for (const resource of artifact.resources) {
      const bytes = capture.sidecars.resources.get(resource.contentHash);
      if (!bytes || bytes.byteLength !== resource.byteLength || sha256(bytes) !== resource.contentHash) {
        throw new Error(`Render resource sidecar mismatch: ${resource.contentHash}`);
      }
    }
    for (const [locator, bytes] of capture.sidecars.semanticDom) {
      const target = path.join(repo, locator);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    for (const [hash, bytes] of capture.sidecars.resources) {
      const target = path.join(repo, "stitch", "render-resources", `${hash}.bin`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const target = path.join(repo, "stitch", "STITCH_RENDERED_SEMANTICS_V2.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${canonicalJsonStringify(artifact)}\n`, "utf8");
  } catch (error) {
    throw infrastructure("STITCH_RENDERER_V2_SIDECAR_INVALID", "sidecar_write", error);
  }
}

function replayResourceCaptures(
  artifact: StitchRenderedSemanticsV2,
  bytesByHash: ReadonlyMap<string, Buffer>,
): Map<string, ResourceCapture> {
  const captures = new Map<string, ResourceCapture>();
  for (const resource of artifact.resources) {
    const bytes = bytesByHash.get(resource.contentHash)!;
    captures.set(resource.urlHash, {
      url: resource.urlHash,
      urlHash: resource.urlHash,
      resourceType: resource.resourceType,
      contentHash: resource.contentHash,
      contentType: resource.resourceType === "script" ? "application/javascript" : "text/css",
      bytes,
    });
  }
  return captures;
}

export async function verifyStitchRenderedSemanticsReplayV2(input: Readonly<{
  repo: string;
  expected?: unknown;
}>): Promise<StitchRenderedSemanticsV2> {
  const artifactPath = path.join(input.repo, "stitch", "STITCH_RENDERED_SEMANTICS_V2.json");
  let artifact: StitchRenderedSemanticsV2;
  let text: string;
  try {
    text = await readFile(artifactPath, "utf8");
    artifact = StitchRenderedSemanticsV2Schema.parse(input.expected ?? JSON.parse(text));
  } catch (error) {
    throw infrastructure("STITCH_RENDERER_V2_SIDECAR_INVALID", "replay_read", error);
  }
  if (canonicalJsonStringify(artifact) !== text.trim()) {
    throw new StitchRenderedSemanticsInfrastructureErrorV2(
      "STITCH_RENDERER_V2_SIDECAR_INVALID",
      "replay_read",
      "Rendered-semantics v2 artifact is noncanonical",
    );
  }
  if (
    artifact.renderer.playwrightVersion !== PLAYWRIGHT_VERSION
    || artifact.renderer.chromiumRevision !== CHROMIUM_REVISION
  ) {
    throw new StitchRenderedSemanticsInfrastructureErrorV2(
      "STITCH_RENDERER_V2_REVISION_MISMATCH",
      "replay_read",
      "Rendered-semantics v2 producer revision differs from the active compiler lock",
    );
  }
  const resourceBytes = new Map<string, Buffer>();
  try {
    for (const resource of artifact.resources) {
      const bytes = await readFile(path.join(input.repo, resource.locator));
      if (bytes.byteLength !== resource.byteLength || sha256(bytes) !== resource.contentHash) {
        throw new Error(`Render resource hash mismatch: ${resource.contentHash}`);
      }
      resourceBytes.set(resource.contentHash, bytes);
    }
  } catch (error) {
    throw infrastructure("STITCH_RENDERER_V2_SIDECAR_INVALID", "replay_read", error);
  }

  const launched = await strictContext(artifact.profile, "replay_render");
  try {
    if (launched.version !== artifact.renderer.chromiumVersion) {
      throw new StitchRenderedSemanticsInfrastructureErrorV2(
        "STITCH_RENDERER_V2_REVISION_MISMATCH",
        "replay_render",
        "Chromium runtime version differs from captured semantics v2",
      );
    }
    for (const candidate of artifact.candidates) {
      if (candidate.status !== "rendered" || !candidate.semanticDom) continue;
      let bytes: Buffer;
      try {
        bytes = await readFile(path.join(input.repo, candidate.semanticDom.locator));
        if (bytes.byteLength !== candidate.semanticDom.byteLength || sha256(bytes) !== candidate.semanticDom.hash) {
          throw new Error(`Semantic DOM hash mismatch: ${candidate.screenId}`);
        }
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_SIDECAR_INVALID", "replay_read", error);
      }
      const page = await launched.context.newPage();
      try {
        const resourcesByUrlHash = replayResourceCaptures(artifact, resourceBytes);
        const violations = new Set<string>();
        await page.route("**/*", async (route) => {
          const urlHash = sha256(route.request().url());
          const resource = resourcesByUrlHash.get(urlHash);
          if (!resource || !candidate.resourceRefs.includes(urlHash)) {
            violations.add(route.request().url());
            await route.abort("blockedbyclient");
            return;
          }
          await route.fulfill({ status: 200, contentType: resource.contentType, body: resource.bytes });
        });
        try {
          await page.setContent(bytes.toString("utf8"), { waitUntil: "networkidle", timeout: 30_000 });
          await settleRenderedDocument(page);
        } catch (error) {
          throw infrastructure("STITCH_RENDERER_V2_DOCUMENT_RENDER_FAILED", "replay_render", error);
        }
        if (violations.size > 0) {
          throw new StitchRenderedSemanticsInfrastructureErrorV2(
            "STITCH_RENDERER_V2_REPLAY_MISMATCH",
            "replay_render",
            `Offline replay requested unsealed resources: ${[...violations].slice(0, 5).join(", ")}`,
          );
        }
        let elements: StitchRenderedElementV2[];
        let roleReceipts: StitchGetByRoleReceiptV2[];
        try {
          elements = await assignRefsAndObserve(page, "verify");
          roleReceipts = [];
          for (const receipt of candidate.roleReceipts) {
            roleReceipts.push(await replayRoleReceipt(page, receipt));
          }
        } catch (error) {
          throw infrastructure("STITCH_RENDERER_V2_REPLAY_MISMATCH", "replay_observation", error);
        }
        const observationHash = hashCanonicalJson({ elements, roleReceipts });
        if (
          canonicalJsonStringify(elements) !== canonicalJsonStringify(candidate.elements)
          || canonicalJsonStringify(roleReceipts) !== canonicalJsonStringify(candidate.roleReceipts)
          || observationHash !== candidate.observationHash
        ) {
          throw new StitchRenderedSemanticsInfrastructureErrorV2(
            "STITCH_RENDERER_V2_REPLAY_MISMATCH",
            "replay_observation",
            `Offline rendered semantics v2 differ: ${candidate.screenId}`,
          );
        }
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await launched.context.browser()?.close().catch(() => undefined);
  }
  return artifact;
}
