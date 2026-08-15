import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import JSON5 from "json5";
import {
  defaultTreeAdapter,
  parse,
  type DefaultTreeAdapterMap,
  type DefaultTreeAdapterTypes,
  type TreeAdapter,
} from "parse5";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "playwright";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import { isValidStitchHtmlBytes, isValidStitchScreenshotBytes } from "../stitch-render-artifact.js";
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
const MAX_CANDIDATE_RESOURCE_REFS = 1_000;
const MAX_CAPTURE_RESOURCES = 10_000;
const MAX_CAPTURE_RESOURCE_REQUESTS = 10_000;
const MAX_RESOURCE_REDIRECTS = 3;
const MAX_STYLESHEET_FONT_URLS = 128;
const GOOGLE_FONTS_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_HTML_BYTES = 8 * 1024 * 1024;
const MAX_HTML_ELEMENTS = 10_000;
const MAX_HTML_NODES = 50_000;
const MAX_HTML_DEPTH = 256;
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
  resourceType: "script" | "stylesheet" | "image";
  contentHash: string;
  contentType: string;
  bytes: Buffer;
}>;

type ResourcePrefetchLedger = {
  readonly signal: AbortSignal;
  readonly captures: Map<string, ResourceCapture>;
  readonly fonts: Map<string, Readonly<{ bytes: Buffer; contentType: string }>>;
  networkBytes: number;
  capturedBytes: number;
  requestCount: number;
};

type ResourceDeclaration = Readonly<{
  url: string;
  resourceType: ResourceCapture["resourceType"];
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

type SourceElement = DefaultTreeAdapterTypes.Element;
type SourceNode = DefaultTreeAdapterTypes.Node;
type SourceEdit = Readonly<{ startOffset: number; endOffset: number; replacement: string }>;

function sourceElements(document: DefaultTreeAdapterTypes.Document): SourceElement[] {
  const elements: SourceElement[] = [];
  const pending: Array<{ node: SourceNode; depth: number }> = [{ node: document, depth: 0 }];
  let nodeCount = 0;
  while (pending.length > 0) {
    const { node, depth } = pending.pop()!;
    nodeCount += 1;
    if (nodeCount > MAX_HTML_NODES || depth > MAX_HTML_DEPTH) {
      throw new CandidateSourceError(
        "RESOURCE_CAPACITY_EXCEEDED",
        "HTML tree exceeds the bounded node or depth capacity",
      );
    }
    if ("tagName" in node) {
      elements.push(node);
      if (elements.length > MAX_HTML_ELEMENTS) {
        throw new CandidateSourceError(
          "RESOURCE_CAPACITY_EXCEEDED",
          "HTML tree exceeds the bounded element capacity",
        );
      }
      if (node.tagName === "template" && "content" in node) {
        pending.push({ node: node.content, depth: depth + 1 });
      }
    }
    if ("childNodes" in node) {
      for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
        pending.push({ node: node.childNodes[index]!, depth: depth + 1 });
      }
    }
  }
  return elements;
}

function htmlTreeCapacityError(): CandidateSourceError {
  return new CandidateSourceError(
    "RESOURCE_CAPACITY_EXCEEDED",
    "HTML tree exceeds the bounded element, node, or depth capacity",
  );
}

function boundedSourceTreeAdapter(): TreeAdapter<DefaultTreeAdapterMap> {
  let elementCount = 0;
  let openElementDepth = 0;
  return {
    ...defaultTreeAdapter,
    createElement: (tagName, namespaceURI, attrs) => {
      elementCount += 1;
      if (elementCount > MAX_HTML_ELEMENTS) throw htmlTreeCapacityError();
      return defaultTreeAdapter.createElement(tagName, namespaceURI, attrs);
    },
    onItemPush: () => {
      openElementDepth += 1;
      if (openElementDepth > MAX_HTML_DEPTH) throw htmlTreeCapacityError();
    },
    onItemPop: () => {
      openElementDepth = Math.max(0, openElementDepth - 1);
    },
  };
}

function parseSourceDocument(html: string): DefaultTreeAdapterTypes.Document {
  return parse(html, {
    sourceCodeLocationInfo: true,
    treeAdapter: boundedSourceTreeAdapter(),
    onParseError: (error) => {
      throw new CandidateSourceError(
        error.code === "duplicate-attribute"
          ? "DUPLICATE_CONTRACT_ATTRIBUTE"
          : "UNSUPPORTED_EXECUTABLE_SCRIPT",
        `HTML tokenization failed closed: ${error.code}`,
      );
    },
  });
}

function qualifiedAttributeName(attribute: SourceElement["attrs"][number]): string {
  return `${attribute.prefix ? `${attribute.prefix}:` : ""}${attribute.name}`.toLowerCase();
}

function sourceAttribute(
  element: SourceElement,
  name: string,
): SourceElement["attrs"][number] | undefined {
  const expected = name.toLowerCase();
  return element.attrs.find((attribute) => qualifiedAttributeName(attribute) === expected);
}

function isExecutableUrl(value: string): boolean {
  return value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase().startsWith("javascript:");
}

function applySourceEdits(html: string, edits: readonly SourceEdit[]): string {
  const ordered = [...edits].sort((left, right) =>
    right.startOffset - left.startOffset || right.endOffset - left.endOffset);
  let cursor = html.length;
  let output = html;
  for (const edit of ordered) {
    if (
      !Number.isSafeInteger(edit.startOffset)
      || !Number.isSafeInteger(edit.endOffset)
      || edit.startOffset < 0
      || edit.endOffset < edit.startOffset
      || edit.endOffset > cursor
    ) {
      throw new CandidateSourceError(
        "UNSUPPORTED_EXECUTABLE_SCRIPT",
        "HTML source locations overlap or are outside the source",
      );
    }
    output = `${output.slice(0, edit.startOffset)}${edit.replacement}${output.slice(edit.endOffset)}`;
    cursor = edit.startOffset;
  }
  return output;
}

function sanitizeExecutableSource(html: string): string {
  const document = parseSourceDocument(html);
  const edits: SourceEdit[] = [];
  for (const element of sourceElements(document)) {
    const tagName = element.tagName.toLowerCase();
    if (["iframe", "object", "embed"].includes(tagName)) {
      throw new CandidateSourceError(
        "RESOURCE_POLICY_VIOLATION",
        "Embedded browsing/plugin contexts are forbidden",
      );
    }
    if (
      tagName === "meta"
      && sourceAttribute(element, "http-equiv")?.value.trim().toLowerCase() === "refresh"
    ) {
      throw new CandidateSourceError(
        "RESOURCE_POLICY_VIOLATION",
        "Meta refresh navigation is forbidden during rendered-semantics capture",
      );
    }
    for (const attribute of element.attrs) {
      const name = qualifiedAttributeName(attribute);
      if (name === "srcdoc") {
        throw new CandidateSourceError(
          "UNSUPPORTED_EXECUTABLE_SCRIPT",
          "Inline frame source documents are forbidden",
        );
      }
      if (["href", "xlink:href", "src", "action", "formaction"].includes(name)
        && isExecutableUrl(attribute.value)) {
        throw new CandidateSourceError(
          "UNSUPPORTED_EXECUTABLE_SCRIPT",
          "Executable URL attributes are forbidden",
        );
      }
    }

    const location = element.sourceCodeLocation;
    if (!location?.startTag) continue;
    if (tagName === "script") {
      if (!location.endTag) {
        throw new CandidateSourceError(
          "UNSUPPORTED_EXECUTABLE_SCRIPT",
          "Every script source must have one complete compiler-inspectable element",
        );
      }
      const type = sourceAttribute(element, "type")?.value.trim().toLowerCase();
      let replacement = "";
      if (!type || ["text/javascript", "application/javascript", "module"].includes(type)) {
        const src = sourceAttribute(element, "src");
        if (src) {
          const parsed = allowedResourceUrl(src.value, "script");
          replacement = `<script src="${parsed.replace(/&/g, "&amp;")}"></script>`;
        } else {
          const body = html.slice(location.startTag.endOffset, location.endTag.startOffset);
          const match = body.match(/^\s*tailwind\.config\s*=\s*([\s\S]*?)\s*;?\s*$/);
          if (!match) {
            if (body.trim()) {
              throw new CandidateSourceError(
                "UNSUPPORTED_EXECUTABLE_SCRIPT",
                "Inline executable source is outside the Tailwind data-only policy",
              );
            }
          } else {
            let config: unknown;
            try {
              config = JSON5.parse(match[1]!);
            } catch {
              throw new CandidateSourceError(
                "UNSUPPORTED_EXECUTABLE_SCRIPT",
                "Tailwind configuration must be a data-only JSON5 value",
              );
            }
            replacement = `<script>tailwind.config=${JSON.stringify(config)};</script>`;
          }
        }
      }
      edits.push({
        startOffset: location.startTag.startOffset,
        endOffset: location.endTag.endOffset,
        replacement,
      });
      continue;
    }
    for (const attribute of element.attrs) {
      const name = qualifiedAttributeName(attribute);
      if (!/^on[a-z][a-z0-9_-]*$/.test(name)) continue;
      const attributeLocation = location.attrs?.[name];
      if (!attributeLocation) {
        throw new CandidateSourceError(
          "UNSUPPORTED_EXECUTABLE_SCRIPT",
          "Inline event attribute lacks an exact source location",
        );
      }
      edits.push({
        startOffset: attributeLocation.startOffset,
        endOffset: attributeLocation.endOffset,
        replacement: "",
      });
    }
  }
  return applySourceEdits(html, edits);
}

type ResourceFetchKind = ResourceCapture["resourceType"] | "font";

function allowedResourceUrl(raw: string, resourceType: ResourceFetchKind): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CandidateSourceError("RESOURCE_POLICY_VIOLATION", "Render resource URL is invalid");
  }
  const allowed = parsed.protocol === "https:" && (
    resourceType === "script"
      ? parsed.hostname === "cdn.tailwindcss.com"
      : resourceType === "stylesheet"
        ? ["fonts.googleapis.com", "cdn.jsdelivr.net"].includes(parsed.hostname)
        : resourceType === "font"
          ? parsed.hostname === "fonts.gstatic.com"
          : parsed.hostname === "lh3.googleusercontent.com"
            && parsed.pathname.startsWith("/aida-public/")
  );
  if (!allowed || parsed.port !== "" || parsed.username !== "" || parsed.password !== "") {
    throw new CandidateSourceError(
      resourceType === "script" ? "UNSUPPORTED_EXECUTABLE_SCRIPT" : "RESOURCE_POLICY_VIOLATION",
      `Render ${resourceType} URL is outside the compiler allowlist`,
    );
  }
  parsed.hash = "";
  return parsed.toString();
}

function redirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function cancelResourceBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try {
    await body?.cancel();
  } catch (error) {
    throw infrastructure(
      "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
      "resource_prefetch",
      error,
    );
  }
}

async function readBoundedResourceBytes(
  response: Response,
  maxBytes: number,
  consumeBytes: (byteLength: number) => void,
): Promise<Buffer> {
  if (maxBytes < 0) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Declared render resources exceed the sealed byte capacity",
    );
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/u.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await cancelResourceBody(response.body);
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Declared render resources exceed the sealed byte capacity",
    );
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      consumeBytes(result.value.byteLength);
      total += result.value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch (error) {
          throw infrastructure(
            "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
            "resource_prefetch",
            error,
          );
        }
        throw new CandidateSourceError(
          "RESOURCE_CAPACITY_EXCEEDED",
          "Declared render resources exceed the sealed byte capacity",
        );
      }
      chunks.push(Buffer.from(result.value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function fetchAllowedResource(input: Readonly<{
  url: string;
  resourceType: ResourceFetchKind;
  signal: AbortSignal;
  maxBytes: number;
  consumeRequest(): void;
  consumeBytes(byteLength: number): void;
}>): Promise<Readonly<{
  bytes: Buffer;
  contentType: string | null;
  finalUrl: string;
}>> {
  if (input.maxBytes < 0) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Declared render resources exceed the sealed byte capacity",
    );
  }
  const initialOrigin = new URL(input.url).origin;
  let currentUrl = input.url;
  for (let redirects = 0; redirects <= MAX_RESOURCE_REDIRECTS; redirects += 1) {
    input.consumeRequest();
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: input.signal,
        ...(input.resourceType === "stylesheet"
            && new URL(currentUrl).hostname === "fonts.googleapis.com"
          ? {
              headers: {
                accept: "text/css,*/*;q=0.1",
                "user-agent": GOOGLE_FONTS_USER_AGENT,
              },
            }
          : {}),
      });
    } catch (error) {
      throw infrastructure(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        error,
      );
    }
    if (redirectStatus(response.status)) {
      const location = response.headers.get("location");
      await cancelResourceBody(response.body);
      if (!location || redirects === MAX_RESOURCE_REDIRECTS) {
        throw new StitchRenderedSemanticsInfrastructureErrorV2(
          "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
          "resource_prefetch",
          `Redirect limit or location failure for ${input.url}`,
        );
      }
      const nextUrl = allowedResourceUrl(
        new URL(location, currentUrl).toString(),
        input.resourceType,
      );
      if (new URL(nextUrl).origin !== initialOrigin) {
        throw new CandidateSourceError(
          input.resourceType === "script"
            ? "UNSUPPORTED_EXECUTABLE_SCRIPT"
            : "RESOURCE_POLICY_VIOLATION",
          "Render resource redirect left its exact approved origin",
        );
      }
      currentUrl = nextUrl;
      continue;
    }
    if (!response.ok) {
      await cancelResourceBody(response.body);
      throw new StitchRenderedSemanticsInfrastructureErrorV2(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        `HTTP ${response.status} for ${currentUrl}`,
      );
    }
    let bytes: Buffer;
    try {
      bytes = await readBoundedResourceBytes(response, input.maxBytes, input.consumeBytes);
    } catch (error) {
      if (error instanceof CandidateSourceError) throw error;
      throw infrastructure(
        "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
        "resource_prefetch",
        error,
      );
    }
    return {
      bytes,
      contentType: response.headers.get("content-type"),
      finalUrl: currentUrl,
    };
  }
  throw new StitchRenderedSemanticsInfrastructureErrorV2(
    "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
    "resource_prefetch",
    `Redirect resolution failed for ${input.url}`,
  );
}

type CssUrlEdit = Readonly<{ start: number; end: number; replacement: string }>;

async function inlineApprovedGoogleFontAssets(input: Readonly<{
  bytes: Buffer;
  stylesheetUrl: string;
  fetchFont(url: string): Promise<Readonly<{ bytes: Buffer; contentType: string }>>;
}>): Promise<Buffer> {
  if (new URL(input.stylesheetUrl).hostname !== "fonts.googleapis.com") return input.bytes;
  let css: string;
  try {
    css = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch {
    throw new CandidateSourceError(
      "RESOURCE_POLICY_VIOLATION",
      "Approved Google stylesheet is not valid UTF-8",
    );
  }
  const pattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"()]*?))\s*\)/giu;
  const matches = [...css.matchAll(pattern)];
  if (matches.length > MAX_STYLESHEET_FONT_URLS) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Approved Google stylesheet exceeds the font URL capacity",
    );
  }
  const edits: CssUrlEdit[] = [];
  for (const match of matches) {
    const raw = String(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!raw || raw.toLowerCase().startsWith("data:")) continue;
    let resolved: URL;
    try {
      resolved = new URL(raw, input.stylesheetUrl);
    } catch {
      continue;
    }
    if (resolved.hostname !== "fonts.gstatic.com") continue;
    const fontUrl = allowedResourceUrl(resolved.toString(), "font");
    const font = await input.fetchFont(fontUrl);
    const start = match.index;
    if (start === undefined) continue;
    edits.push({
      start,
      end: start + match[0].length,
      replacement: `url("data:${font.contentType};base64,${font.bytes.toString("base64")}")`,
    });
  }
  let output = css;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
  }
  return Buffer.from(output, "utf8");
}

function fontContentType(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".woff2")) return "font/woff2";
  if (pathname.endsWith(".woff")) return "font/woff";
  if (pathname.endsWith(".ttf")) return "font/ttf";
  if (pathname.endsWith(".otf")) return "font/otf";
  return "application/octet-stream";
}

function approvedStitchImageUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "lh3.googleusercontent.com"
    || !parsed.pathname.startsWith("/aida-public/")
  ) return null;
  return allowedResourceUrl(parsed.toString(), "image");
}

function approvedImageContentType(value: string | null): string {
  const contentType = String(value ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (["image/gif", "image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return contentType;
  }
  throw new CandidateSourceError(
    "RESOURCE_POLICY_VIOLATION",
    "Approved Stitch image returned an unsupported content type",
  );
}

function declaredResources(html: string): ResourceDeclaration[] {
  const resources: Array<{ url: string; resourceType: ResourceCapture["resourceType"] }> = [];
  for (const element of sourceElements(parseSourceDocument(html))) {
    if (element.tagName === "script") {
      const src = sourceAttribute(element, "src");
      if (src) {
        resources.push({
          url: allowedResourceUrl(src.value, "script"),
          resourceType: "script",
        });
      }
      continue;
    }
    if (element.tagName === "link") {
      const rel = sourceAttribute(element, "rel")?.value.toLowerCase().split(/\s+/) ?? [];
      const href = sourceAttribute(element, "href")?.value;
      if (rel.includes("stylesheet") && href !== undefined) {
        resources.push({
          url: allowedResourceUrl(href, "stylesheet"),
          resourceType: "stylesheet",
        });
      }
      continue;
    }
    if (element.tagName === "img") {
      const src = sourceAttribute(element, "src")?.value;
      const imageUrl = src === undefined ? null : approvedStitchImageUrl(src);
      if (imageUrl) resources.push({ url: imageUrl, resourceType: "image" });
    }
  }
  const unique = new Map(resources.map((resource) => [resource.url, resource] as const));
  if (unique.size > MAX_CANDIDATE_RESOURCE_REFS) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Rendered candidate exceeds the sealed resource-reference capacity",
    );
  }
  return [...unique.values()].sort((left, right) => compareUtf16(left.url, right.url));
}

function createResourcePrefetchLedger(): ResourcePrefetchLedger {
  return {
    signal: AbortSignal.timeout(20_000),
    captures: new Map(),
    fonts: new Map(),
    networkBytes: 0,
    capturedBytes: 0,
    requestCount: 0,
  };
}

function consumeResourceRequest(ledger: ResourcePrefetchLedger): void {
  if (ledger.requestCount >= MAX_CAPTURE_RESOURCE_REQUESTS) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Rendered capture exceeds the outbound resource-request capacity",
    );
  }
  ledger.requestCount += 1;
}

async function fetchResourceWithLedger(
  ledger: ResourcePrefetchLedger,
  url: string,
  resourceType: ResourceFetchKind,
): Promise<Readonly<{ bytes: Buffer; contentType: string | null; finalUrl: string }>> {
  if (ledger.networkBytes >= MAX_TOTAL_RESOURCE_BYTES) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Rendered capture exhausted the outbound resource byte capacity",
    );
  }
  const fetched = await fetchAllowedResource({
    url,
    resourceType,
    signal: ledger.signal,
    maxBytes: Math.min(
      MAX_RESOURCE_BYTES,
      MAX_TOTAL_RESOURCE_BYTES - ledger.networkBytes,
    ),
    consumeRequest: () => consumeResourceRequest(ledger),
    consumeBytes: (byteLength) => {
      ledger.networkBytes += byteLength;
    },
  });
  return fetched;
}

async function prefetchDeclaredResources(
  resources: readonly ResourceDeclaration[],
  ledger: ResourcePrefetchLedger,
): Promise<Map<string, ResourceCapture>> {
  const newResourceCount = resources.filter((resource) =>
    !ledger.captures.has(resource.url)).length;
  if (ledger.captures.size + newResourceCount > MAX_CAPTURE_RESOURCES) {
    throw new CandidateSourceError(
      "RESOURCE_CAPACITY_EXCEEDED",
      "Rendered capture exceeds the sealed resource-identity capacity",
    );
  }
  const candidateCaptures = new Map<string, ResourceCapture>();
  for (const resource of resources) {
    const existing = ledger.captures.get(resource.url);
    if (existing) {
      if (existing.resourceType !== resource.resourceType) {
        throw new CandidateSourceError(
          "RESOURCE_POLICY_VIOLATION",
          "One render resource URL cannot change its sealed resource type",
        );
      }
      candidateCaptures.set(resource.url, existing);
      continue;
    }
    const fetched = await fetchResourceWithLedger(ledger, resource.url, resource.resourceType);
    let bytes = fetched.bytes;
    if (resource.resourceType === "stylesheet") {
      bytes = await inlineApprovedGoogleFontAssets({
        bytes,
        stylesheetUrl: fetched.finalUrl,
        fetchFont: async (url) => {
          const cached = ledger.fonts.get(url);
          if (cached) return cached;
          const font = await fetchResourceWithLedger(ledger, url, "font");
          const captured = { bytes: font.bytes, contentType: fontContentType(url) };
          ledger.fonts.set(url, captured);
          return captured;
        },
      });
    }
    if (
      bytes.byteLength > MAX_RESOURCE_BYTES
      || ledger.capturedBytes + bytes.byteLength > MAX_TOTAL_RESOURCE_BYTES
    ) {
      throw new CandidateSourceError(
        "RESOURCE_CAPACITY_EXCEEDED",
        "Declared render resources exceed the sealed byte capacity",
      );
    }
    ledger.capturedBytes += bytes.byteLength;
    const capture: ResourceCapture = {
      ...resource,
      urlHash: sha256(resource.url),
      contentHash: sha256(bytes),
      contentType: resource.resourceType === "script"
        ? "application/javascript"
        : resource.resourceType === "stylesheet"
          ? "text/css"
          : approvedImageContentType(fetched.contentType),
      bytes,
    };
    ledger.captures.set(resource.url, capture);
    candidateCaptures.set(resource.url, capture);
  }
  return candidateCaptures;
}

export async function openStitchRenderContextV2(
  input: Readonly<{
    profile: StitchRenderProfileV1;
    phase?: "browser_launch" | "replay_render";
  }>,
  dependencies: Readonly<{
    launchBrowser?: () => Promise<Browser>;
  }> = {},
): Promise<{ context: BrowserContext; version: string }> {
  const phase = input.phase ?? "browser_launch";
  const launchBrowser = dependencies.launchBrowser ?? (() => chromium.launch({ headless: true }));
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let browser: Browser | undefined;
    try {
      browser = await launchBrowser();
      const version = browser.version();
      const context = await browser.newContext({
        viewport: { width: input.profile.width, height: input.profile.height },
        deviceScaleFactor: 1,
        locale: input.profile.locale,
        timezoneId: input.profile.timezoneId,
        colorScheme: input.profile.colorScheme,
        reducedMotion: input.profile.reducedMotion,
        serviceWorkers: "block",
        javaScriptEnabled: true,
      });
      context.on("page", (page) => {
        page.on("popup", (popup) => { void popup.close(); });
      });
      return { context, version };
    } catch (error) {
      lastError = error;
      await browser?.close().catch(() => undefined);
    }
  }
  throw infrastructure("STITCH_RENDERER_V2_BROWSER_UNAVAILABLE", phase, lastError);
}

async function strictContext(
  profile: StitchRenderProfileV1,
  phase: "browser_launch" | "replay_render" = "browser_launch",
): Promise<{ context: BrowserContext; version: string }> {
  return openStitchRenderContextV2({ profile, phase });
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

async function canonicalSemanticDom(
  page: Page,
  sealedImageUrls: readonly string[],
): Promise<Buffer> {
  const text = await page.evaluate((sealedImages) => {
    const global = globalThis as any;
    const document = global.document;
    const allowedImages = new Set(sealedImages);
    document.querySelectorAll("script,iframe,object,embed").forEach((element: any) => element.remove());
    document.querySelectorAll("img").forEach((element: any) => {
      if (!allowedImages.has(String(element.src))) element.removeAttribute("src");
      element.removeAttribute("srcset");
    });
    document.querySelectorAll("source,video,audio").forEach((element: any) => {
      element.removeAttribute("src");
      element.removeAttribute("srcset");
    });
    return `<!doctype html>${document.documentElement.outerHTML}`;
  }, sealedImageUrls);
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
  const aggregateHtmlBytes = input.artifacts.reduce(
    (total, artifact) => total + (artifact.htmlBytes?.byteLength ?? 0),
    0,
  );
  const sourcePreflightByScreenId = new Map<string, Readonly<{
    sanitizedHtml: string;
    resources: ResourceDeclaration[];
  }> | CandidateSourceError>();
  const aggregateDeclaredResourceUrls = new Set<string>();
  for (const candidate of directResponseEvidence.batches.flatMap((batch) => batch.candidates)) {
    const batch = batchByScreenId.get(candidate.screenId)!;
    const matchingTargets = batch.targetRefs
      .map((targetRef) => targetById.get(targetRef)!)
      .filter((target) => target.expectedScreenTitle === candidate.title);
    const local = artifactById.get(candidate.screenId);
    const htmlBytes = local?.htmlBytes;
    const screenshotBytes = local?.screenshotBytes;
    const htmlHash = htmlBytes?.byteLength ? sha256(htmlBytes) : null;
    const screenshotHash = screenshotBytes?.byteLength ? sha256(screenshotBytes) : null;
    if (
      matchingTargets.length !== 1
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(candidate.screenId)
      || !htmlBytes
      || !isValidStitchHtmlBytes(htmlBytes)
      || htmlBytes.byteLength > MAX_HTML_BYTES
      || aggregateHtmlBytes > MAX_TOTAL_HTML_BYTES
      || !screenshotBytes
      || !isValidStitchScreenshotBytes(screenshotBytes)
      || candidate.htmlDownloadedArtifactHash !== htmlHash
      || candidate.screenshotDownloadedArtifactHash !== screenshotHash
    ) continue;
    try {
      const sanitizedHtml = sanitizeExecutableSource(Buffer.from(htmlBytes).toString("utf8"));
      const resources = declaredResources(sanitizedHtml);
      sourcePreflightByScreenId.set(candidate.screenId, { sanitizedHtml, resources });
      resources.forEach((resource) => aggregateDeclaredResourceUrls.add(resource.url));
    } catch (error) {
      if (error instanceof CandidateSourceError) {
        sourcePreflightByScreenId.set(candidate.screenId, error);
      } else {
        throw infrastructure("STITCH_RENDERER_V2_UNEXPECTED", "source_validation", error);
      }
    }
  }
  const aggregateResourceCapacityExceeded =
    aggregateDeclaredResourceUrls.size > MAX_CAPTURE_RESOURCES;
  const resourcePrefetchLedger = createResourcePrefetchLedger();
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
    if (htmlBytes.byteLength > MAX_HTML_BYTES || aggregateHtmlBytes > MAX_TOTAL_HTML_BYTES) {
      reject("RESOURCE_CAPACITY_EXCEEDED");
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
      const sourcePreflight = sourcePreflightByScreenId.get(candidate.screenId);
      if (sourcePreflight instanceof CandidateSourceError) throw sourcePreflight;
      if (!sourcePreflight) {
        throw new StitchRenderedSemanticsInfrastructureErrorV2(
          "STITCH_RENDERER_V2_UNEXPECTED",
          "source_validation",
          `Eligible candidate lacks source preflight: ${candidate.screenId}`,
        );
      }
      if (aggregateResourceCapacityExceeded) {
        throw new CandidateSourceError(
          "RESOURCE_CAPACITY_EXCEEDED",
          "Rendered capture exceeds the aggregate resource-identity capacity",
        );
      }
      const { sanitizedHtml } = sourcePreflight;

      phase = "resource_prefetch";
      const resources = await prefetchDeclaredResources(
        sourcePreflight.resources,
        resourcePrefetchLedger,
      );

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
        semanticDom = await canonicalSemanticDom(
          page,
          [...resources.values()]
            .filter((resource) => resource.resourceType === "image")
            .map((resource) => resource.url),
        );
      } catch (error) {
        throw infrastructure("STITCH_RENDERER_V2_OBSERVATION_FAILED", phase, error);
      }
      const locator = `stitch/rendered-dom-v2/${candidate.screenId}.html`;
      semanticDomSidecars.set(locator, semanticDom);
      for (const resource of resources.values()) {
        resourceSidecars.set(resource.contentHash, resource.bytes);
        const existing = resourcesByUrlHash.get(resource.urlHash);
        if (
          existing
          && (
            existing.contentHash !== resource.contentHash
            || existing.resourceType !== resource.resourceType
            || existing.contentType !== resource.contentType
          )
        ) {
          throw new StitchRenderedSemanticsInfrastructureErrorV2(
            "STITCH_RENDERER_V2_ARTIFACT_INVALID",
            "artifact_validation",
            `Render resource identity changed within one capture: ${resource.urlHash}`,
          );
        }
        resourcesByUrlHash.set(resource.urlHash, existing ?? resource);
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
        ...(resource.resourceType === "image" ? { contentType: resource.contentType } : {}),
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
      contentType: resource.contentType
        ?? (resource.resourceType === "script" ? "application/javascript" : "text/css"),
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
