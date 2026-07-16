import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import JSON5 from "json5";
import { chromium, type BrowserContext, type Page, type Route } from "playwright";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import { isValidStitchHtmlBytes, isValidStitchScreenshotBytes } from "../stitch-render-artifact.js";
import { parseStitchSemanticDomV1 } from "../stitch-semantic-dom-v1.js";
import { DesignGenerationTargetsV1Schema } from "../schemas/design-generation-targets-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "../schemas/stitch-direct-response-evidence-v2.js";
import {
  STITCH_RENDERED_SEMANTICS_POLICY_V1,
  StitchRenderedSemanticsV1Schema,
  type StitchRenderedCandidateV1,
  type StitchRenderedElementV1,
  type StitchRenderedSemanticsV1,
  type StitchRenderProfileV1,
} from "../schemas/stitch-rendered-semantics-v1.js";
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
  "data-surface-id",
  "role",
  "aria-label",
  "href",
]);

type ResourceCapture = Readonly<{
  urlHash: string;
  resourceType: "script" | "stylesheet";
  contentHash: string;
  bytes: Buffer;
}>;

export type StitchRenderedSemanticsSidecarsV1 = Readonly<{
  semanticDom: ReadonlyMap<string, Buffer>;
  resources: ReadonlyMap<string, Buffer>;
}>;

export type StitchRenderedSemanticsCaptureV1 = Readonly<{
  artifact: StitchRenderedSemanticsV1;
  artifactHash: string;
  sidecars: StitchRenderedSemanticsSidecarsV1;
}>;

export class StitchRenderedSemanticsInfrastructureError extends Error {
  readonly code:
    | "STITCH_RENDERER_BROWSER_UNAVAILABLE"
    | "STITCH_RENDERER_REVISION_MISMATCH"
    | "STITCH_RENDERER_REPLAY_MISMATCH"
    | "STITCH_RENDERER_SIDECAR_INVALID";

  constructor(code: StitchRenderedSemanticsInfrastructureError["code"], message: string) {
    super(`${code}:${message}`);
    this.name = "StitchRenderedSemanticsInfrastructureError";
    this.code = code;
  }
}

class CandidateSourceError extends Error {
  readonly failureCode: StitchRenderedCandidateV1["failureCodes"][number];
  constructor(failureCode: StitchRenderedCandidateV1["failureCodes"][number], message: string) {
    super(message);
    this.failureCode = failureCode;
  }
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
  if (/<\s*(?:iframe|object|embed)\b/i.test(html)) {
    throw new CandidateSourceError("RESOURCE_POLICY_VIOLATION", "Embedded browsing/plugin contexts are forbidden");
  }
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_full, attributes: string, body: string) => {
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) return "";
    const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) {
      let parsed: URL;
      try {
        parsed = new URL(src);
      } catch {
        throw new CandidateSourceError("RESOURCE_POLICY_VIOLATION", "Executable script URL is invalid");
      }
      if (parsed.protocol !== "https:" || parsed.hostname !== "cdn.tailwindcss.com") {
        throw new CandidateSourceError("UNSUPPORTED_EXECUTABLE_SCRIPT", "Only the compiler-approved Tailwind runtime may affect rendered semantics");
      }
      return `<script src="${parsed.toString().replace(/&/g, "&amp;")}"></script>`;
    }
    const match = body.match(/^\s*tailwind\.config\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) {
      if (!body.trim()) return "";
      throw new CandidateSourceError("UNSUPPORTED_EXECUTABLE_SCRIPT", "Inline executable source is outside the Tailwind data-only policy");
    }
    let config: unknown;
    try {
      config = JSON5.parse(match[1]!);
    } catch {
      throw new CandidateSourceError("UNSUPPORTED_EXECUTABLE_SCRIPT", "Tailwind configuration must be a data-only JSON5 value");
    }
    return `<script>tailwind.config=${JSON.stringify(config)};</script>`;
  });
}

function assertNoDuplicateContractAttributes(html: string): void {
  const duplicate = parseStitchSemanticDomV1(html).flatMap((element) =>
    element.duplicateAttributes.filter((attribute) => CONTRACT_ATTRIBUTES.has(attribute)));
  if (duplicate.length > 0) {
    throw new CandidateSourceError("DUPLICATE_CONTRACT_ATTRIBUTE", "Source repeats a machine-contract attribute");
  }
}

async function strictContext(profile: StitchRenderProfileV1): Promise<{ context: BrowserContext; version: string }> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new StitchRenderedSemanticsInfrastructureError(
      "STITCH_RENDERER_BROWSER_UNAVAILABLE",
      error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000),
    );
  }
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
}

async function settleRenderedDocument(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const global = globalThis as any;
    await global.document.fonts?.ready;
    await new Promise<void>((resolve) => global.requestAnimationFrame(() => global.requestAnimationFrame(() => resolve())));
  });
}

async function captureResources(page: Page): Promise<{
  captures: Map<string, ResourceCapture>;
  failure: () => CandidateSourceError | undefined;
}> {
  const captures = new Map<string, ResourceCapture>();
  let total = 0;
  let failure: CandidateSourceError | undefined;
  await page.route("**/*", async (route: Route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType !== "script" && resourceType !== "stylesheet") {
      await route.abort("blockedbyclient");
      return;
    }
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      await route.abort("blockedbyclient");
      return;
    }
    const allowed = resourceType === "script"
      ? url.protocol === "https:" && url.hostname === "cdn.tailwindcss.com"
      : url.protocol === "https:" && ["fonts.googleapis.com", "cdn.jsdelivr.net"].includes(url.hostname);
    if (!allowed) {
      await route.abort("blockedbyclient");
      return;
    }
    try {
      const response = await route.fetch({ timeout: 20_000 });
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      const body = Buffer.from(await response.body());
      if (body.byteLength > MAX_RESOURCE_BYTES || total + body.byteLength > MAX_TOTAL_RESOURCE_BYTES) {
        throw new CandidateSourceError("RESOURCE_CAPACITY_EXCEEDED", "Render resource capacity exceeded");
      }
      total += body.byteLength;
      captures.set(request.url(), {
        urlHash: sha256(request.url()),
        resourceType,
        contentHash: sha256(body),
        bytes: body,
      });
      await route.fulfill({ response, body });
    } catch (error) {
      await route.abort("failed");
      failure = error instanceof CandidateSourceError
        ? error
        : new CandidateSourceError("RESOURCE_DOWNLOAD_FAILED", "Render resource download failed");
    }
  });
  return { captures, failure: () => failure };
}

async function assignRefsAndObserve(
  page: Page,
  refMode: "assign" | "verify" = "assign",
): Promise<StitchRenderedElementV1[]> {
  return page.evaluate((mode) => {
    const global = globalThis as any;
    const document = global.document;
    const interactiveRoles = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch"]);
    const nativeTags = new Set(["button", "a", "input", "textarea", "select"]);
    const relevant = [...document.querySelectorAll("*")].filter((element: any) => {
      const tag = String(element.tagName || "").toLowerCase();
      return nativeTags.has(tag)
        || ["data-action", "data-action-input", "data-surface-id", "role", "aria-label", "href"]
          .some((attribute) => element.hasAttribute(attribute));
    });
    relevant.forEach((element: any, index: number) => {
      const expected = `E${String(index + 1).padStart(6, "0")}`;
      if (mode === "verify" && element.getAttribute("data-setfarm-element-ref") !== expected) {
        throw new Error(`STITCH_RENDERER_ELEMENT_REF_MISMATCH:${expected}`);
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
      const orderedBlockers: StitchRenderedElementV1["renderBlockers"] = blockerOrder
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
      const nativeControlKind: StitchRenderedElementV1["nativeControlKind"] = tagName === "a"
        ? "link"
        : ["button", "input", "textarea", "select"].includes(tagName)
          ? tagName as Exclude<StitchRenderedElementV1["nativeControlKind"], "link" | null>
          : null;
      const renderState: StitchRenderedElementV1["renderState"] = rendered ? "rendered" : "not_rendered";
      return {
        elementRef: `E${String(index + 1).padStart(6, "0")}`,
        sourceOrdinal: index,
        tagName,
        ownSurfaceRef: element.getAttribute("data-surface-id"),
        nearestSurfaceRef: nearestSurface?.getAttribute("data-surface-id") ?? null,
        dataAction: element.getAttribute("data-action"),
        dataActionInput: element.getAttribute("data-action-input"),
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
  htmlHash: string | null;
  screenshotHash: string | null;
  failureCode: StitchRenderedCandidateV1["failureCodes"][number];
}>): StitchRenderedCandidateV1 {
  return {
    stageId: input.stageId,
    screenId: input.screenId,
    htmlArtifactHash: input.htmlHash,
    screenshotArtifactHash: input.screenshotHash,
    semanticDom: null,
    resourceRefs: [],
    status: "source_rejected",
    failureCodes: [input.failureCode],
    elements: [],
    observationHash: null,
  };
}

export async function captureStitchRenderedSemanticsV1(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV1[];
  deviceType: string;
}>): Promise<StitchRenderedSemanticsCaptureV1> {
  const generationTargets = DesignGenerationTargetsV1Schema.parse(input.generationTargets);
  const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse(input.directResponseEvidence);
  const profile = renderProfile(input.deviceType);
  const artifactById = new Map(input.artifacts.map((artifact) => [artifact.screenId, artifact]));
  const stageById = new Map(directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => [candidate.screenId, batch.stageId] as const)));
  const semanticDomSidecars = new Map<string, Buffer>();
  const resourceSidecars = new Map<string, Buffer>();
  const resourcesByUrlHash = new Map<string, ResourceCapture>();
  const candidates: StitchRenderedCandidateV1[] = [];
  let chromiumVersion = "";

  for (const candidate of directResponseEvidence.batches.flatMap((batch) => batch.candidates)
    .sort((left, right) => compareUtf16(left.screenId, right.screenId))) {
    const stageId = stageById.get(candidate.screenId)!;
    const local = artifactById.get(candidate.screenId);
    const htmlBytes = local?.htmlBytes;
    const screenshotBytes = local?.screenshotBytes;
    const htmlHash = htmlBytes?.byteLength ? sha256(htmlBytes) : null;
    const screenshotHash = screenshotBytes?.byteLength ? sha256(screenshotBytes) : null;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(candidate.screenId)) {
      candidates.push(rejectedCandidate({ stageId, screenId: candidate.screenId, htmlHash, screenshotHash, failureCode: "UNSAFE_SCREEN_ID" }));
      continue;
    }
    if (!htmlBytes || !isValidStitchHtmlBytes(htmlBytes)) {
      candidates.push(rejectedCandidate({ stageId, screenId: candidate.screenId, htmlHash, screenshotHash, failureCode: "HTML_INVALID" }));
      continue;
    }
    if (!screenshotBytes || !isValidStitchScreenshotBytes(screenshotBytes)) {
      candidates.push(rejectedCandidate({ stageId, screenId: candidate.screenId, htmlHash, screenshotHash, failureCode: "SCREENSHOT_INVALID" }));
      continue;
    }
    if (
      candidate.htmlDownloadedArtifactHash !== htmlHash
      || candidate.screenshotDownloadedArtifactHash !== screenshotHash
    ) {
      candidates.push(rejectedCandidate({ stageId, screenId: candidate.screenId, htmlHash, screenshotHash, failureCode: "ARTIFACT_HASH_MISMATCH" }));
      continue;
    }

    let context: BrowserContext | undefined;
    try {
      const rawHtml = Buffer.from(htmlBytes).toString("utf8");
      assertNoDuplicateContractAttributes(rawHtml);
      const sanitizedHtml = sanitizeExecutableSource(rawHtml);
      const launched = await strictContext(profile);
      context = launched.context;
      chromiumVersion ||= launched.version;
      if (chromiumVersion !== launched.version) {
        throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_REVISION_MISMATCH", "Chromium version changed during one capture");
      }
      const page = await context.newPage();
      const resourceCapture = await captureResources(page);
      await page.setContent(sanitizedHtml, { waitUntil: "networkidle", timeout: 30_000 });
      const resourceFailure = resourceCapture.failure();
      if (resourceFailure) throw resourceFailure;
      await settleRenderedDocument(page);
      const elements = await assignRefsAndObserve(page);
      const semanticDom = await canonicalSemanticDom(page);
      const locator = `stitch/rendered-dom/${candidate.screenId}.html`;
      semanticDomSidecars.set(locator, semanticDom);
      const candidateResourceRefs: string[] = [];
      for (const resource of resourceCapture.captures.values()) {
        candidateResourceRefs.push(resource.urlHash);
        resourceSidecars.set(resource.contentHash, resource.bytes);
        resourcesByUrlHash.set(resource.urlHash, resource);
      }
      candidates.push({
        stageId,
        screenId: candidate.screenId,
        htmlArtifactHash: htmlHash,
        screenshotArtifactHash: screenshotHash,
        semanticDom: { locator, hash: sha256(semanticDom), byteLength: semanticDom.byteLength },
        resourceRefs: [...new Set(candidateResourceRefs)].sort(compareUtf16),
        status: "rendered",
        failureCodes: [],
        elements,
        observationHash: hashCanonicalJson(elements),
      });
    } catch (error) {
      if (error instanceof StitchRenderedSemanticsInfrastructureError) throw error;
      const failureCode = error instanceof CandidateSourceError
        ? error.failureCode
        : /timeout/i.test(error instanceof Error ? error.message : String(error))
          ? "DOCUMENT_RENDER_TIMEOUT"
          : "NORMALIZATION_FAILED";
      candidates.push(rejectedCandidate({ stageId, screenId: candidate.screenId, htmlHash, screenshotHash, failureCode }));
    } finally {
      await context?.browser()?.close();
    }
  }

  if (!chromiumVersion) {
    const launched = await strictContext(profile);
    chromiumVersion = launched.version;
    await launched.context.browser()?.close();
  }
  const artifact = StitchRenderedSemanticsV1Schema.parse({
    schema: "setfarm.stitch-rendered-semantics.v1",
    policy: STITCH_RENDERED_SEMANTICS_POLICY_V1,
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
  return {
    artifact,
    artifactHash: hashCanonicalJson(artifact),
    sidecars: { semanticDom: semanticDomSidecars, resources: resourceSidecars },
  };
}

export async function writeStitchRenderedSemanticsV1(
  repo: string,
  capture: StitchRenderedSemanticsCaptureV1,
): Promise<void> {
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
  const target = path.join(repo, "stitch", "STITCH_RENDERED_SEMANTICS.json");
  await writeFile(target, `${canonicalJsonStringify(capture.artifact)}\n`, "utf8");
}

export async function verifyStitchRenderedSemanticsReplayV1(input: Readonly<{
  repo: string;
  expected?: unknown;
}>): Promise<StitchRenderedSemanticsV1> {
  const artifactPath = path.join(input.repo, "stitch", "STITCH_RENDERED_SEMANTICS.json");
  const text = await readFile(artifactPath, "utf8");
  const artifact = StitchRenderedSemanticsV1Schema.parse(input.expected ?? JSON.parse(text));
  if (canonicalJsonStringify(artifact) !== text.trim()) {
    throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_SIDECAR_INVALID", "Rendered-semantics artifact is noncanonical");
  }
  if (
    artifact.renderer.playwrightVersion !== PLAYWRIGHT_VERSION
    || artifact.renderer.chromiumRevision !== CHROMIUM_REVISION
  ) {
    throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_REVISION_MISMATCH", "Rendered-semantics producer revision differs from the active compiler lock");
  }
  for (const resource of artifact.resources) {
    const bytes = await readFile(path.join(input.repo, resource.locator));
    if (bytes.byteLength !== resource.byteLength || sha256(bytes) !== resource.contentHash) {
      throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_SIDECAR_INVALID", `Render resource hash mismatch: ${resource.contentHash}`);
    }
  }
  const launched = await strictContext(artifact.profile);
  try {
    if (launched.version !== artifact.renderer.chromiumVersion) {
      throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_REVISION_MISMATCH", "Chromium runtime version differs from captured semantics");
    }
    for (const candidate of artifact.candidates) {
      if (candidate.status !== "rendered" || !candidate.semanticDom) continue;
      const bytes = await readFile(path.join(input.repo, candidate.semanticDom.locator));
      if (bytes.byteLength !== candidate.semanticDom.byteLength || sha256(bytes) !== candidate.semanticDom.hash) {
        throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_SIDECAR_INVALID", `Semantic DOM hash mismatch: ${candidate.screenId}`);
      }
      const page = await launched.context.newPage();
      await page.route("**/*", async (route) => {
        const resource = artifact.resources.find((entry) => entry.urlHash === sha256(route.request().url()));
        if (!resource || !candidate.resourceRefs.includes(resource.urlHash)) {
          await route.abort("blockedbyclient");
          return;
        }
        const resourceBytes = await readFile(path.join(input.repo, resource.locator));
        await route.fulfill({
          status: 200,
          contentType: resource.resourceType === "script" ? "application/javascript" : "text/css",
          body: resourceBytes,
        });
      });
      await page.setContent(bytes.toString("utf8"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settleRenderedDocument(page);
      const elements = await assignRefsAndObserve(page, "verify");
      await page.close();
      if (
        canonicalJsonStringify(elements) !== canonicalJsonStringify(candidate.elements)
        || hashCanonicalJson(elements) !== candidate.observationHash
      ) {
        throw new StitchRenderedSemanticsInfrastructureError("STITCH_RENDERER_REPLAY_MISMATCH", `Offline rendered semantics differ: ${candidate.screenId}`);
      }
    }
  } finally {
    await launched.context.browser()?.close();
  }
  return artifact;
}
