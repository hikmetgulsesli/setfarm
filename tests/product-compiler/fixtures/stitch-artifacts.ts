import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { isValidStitchHtmlBytes, isValidStitchScreenshotBytes } from "../../../src/product-compiler/stitch-render-artifact.js";
import { parseStitchSemanticDomV1, stitchSemanticAttribute } from "../../../src/product-compiler/stitch-semantic-dom-v1.js";
import { DesignGenerationTargetsV1Schema } from "../../../src/product-compiler/schemas/design-generation-targets-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "../../../src/product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV1Schema } from "../../../src/product-compiler/schemas/stitch-rendered-semantics-v1.js";
import type { StitchCandidateArtifactBytesV1 } from "../../../src/product-compiler/producers/stitch-target-candidate-selection.js";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.byteLength);
  output.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.byteLength);
  return output;
}

export function validStitchPng(seed = 1): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const pixel = Buffer.from([0, seed & 0xff, (seed * 17) & 0xff, (seed * 31) & 0xff, 0xff]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixel)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function validStitchHtml(body: string, marker = "fixture"): Buffer {
  return Buffer.from([
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>",
    `<!-- ${`${marker}-render-padding`.repeat(80)} -->`,
    body,
    "</body></html>",
  ].join(""), "utf8");
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function stitchDownloadReceipts(
  screenId: string,
  htmlBytes: Uint8Array,
  screenshotBytes: Uint8Array,
) {
  return {
    htmlSourceRefHash: sha256(`https://example.invalid/${screenId}.html`),
    screenshotSourceRefHash: sha256(`https://example.invalid/${screenId}.png`),
    htmlDownloadedArtifactHash: sha256(htmlBytes),
    screenshotDownloadedArtifactHash: sha256(screenshotBytes),
  };
}

/**
 * Test-only browser authority fixture. Browser capture itself is covered by
 * stitch-rendered-semantics.test.ts; synchronous compiler fixtures use this
 * explicit projection so their unit tests do not launch Chromium.
 */
export function buildTestRenderedSemantics(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV1[];
  deviceType?: "DESKTOP" | "TABLET" | "MOBILE";
}>) {
  const generationTargets = DesignGenerationTargetsV1Schema.parse(input.generationTargets);
  const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse(input.directResponseEvidence);
  const artifactById = new Map(input.artifacts.map((artifact) => [artifact.screenId, artifact]));
  const deviceType = input.deviceType ?? "DESKTOP";
  const profile = deviceType === "MOBILE"
    ? { id: "mobile-390x844.v1", deviceType, width: 390, height: 844 }
    : deviceType === "TABLET"
      ? { id: "tablet-820x1180.v1", deviceType, width: 820, height: 1180 }
      : { id: "desktop-1280x800.v1", deviceType, width: 1280, height: 800 };
  const interactiveRoles = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch"]);
  const candidates = directResponseEvidence.batches.flatMap((batch) => batch.candidates.map((candidate) => {
    const local = artifactById.get(candidate.screenId);
    const htmlBytes = local?.htmlBytes;
    const screenshotBytes = local?.screenshotBytes;
    const htmlHash = htmlBytes?.byteLength ? sha256(htmlBytes) : null;
    const screenshotHash = screenshotBytes?.byteLength ? sha256(screenshotBytes) : null;
    const rejected = (failureCode: string) => ({
      stageId: batch.stageId,
      screenId: candidate.screenId,
      htmlArtifactHash: htmlHash,
      screenshotArtifactHash: screenshotHash,
      semanticDom: null,
      resourceRefs: [],
      status: "source_rejected",
      failureCodes: [failureCode],
      elements: [],
      observationHash: null,
    });
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(candidate.screenId)) return rejected("UNSAFE_SCREEN_ID");
    if (!htmlBytes || !isValidStitchHtmlBytes(htmlBytes)) return rejected("HTML_INVALID");
    if (!screenshotBytes || !isValidStitchScreenshotBytes(screenshotBytes)) return rejected("SCREENSHOT_INVALID");
    if (
      candidate.htmlDownloadedArtifactHash !== htmlHash
      || candidate.screenshotDownloadedArtifactHash !== screenshotHash
    ) return rejected("ARTIFACT_HASH_MISMATCH");
    const parsed = parseStitchSemanticDomV1(Buffer.from(htmlBytes).toString("utf8"));
    const relevant = parsed.filter((element) =>
      ["button", "a", "input", "textarea", "select"].includes(element.tagName)
      || ["data-action", "data-action-input", "data-surface-id", "role", "aria-label", "href"]
        .some((attribute) => stitchSemanticAttribute(element, attribute) !== undefined));
    const elements = relevant.map((element, index) => {
      const tagName = element.tagName;
      const nativeControlKind = tagName === "a"
        ? "link"
        : ["button", "input", "textarea", "select"].includes(tagName)
          ? tagName
          : null;
      const rendered = element.rendered;
      return {
        elementRef: `E${String(index + 1).padStart(6, "0")}`,
        sourceOrdinal: index,
        tagName,
        ownSurfaceRef: stitchSemanticAttribute(element, "data-surface-id") ?? null,
        nearestSurfaceRef: element.activeSurfaceRef ?? null,
        dataAction: stitchSemanticAttribute(element, "data-action") ?? null,
        dataActionInput: stitchSemanticAttribute(element, "data-action-input") ?? null,
        role: stitchSemanticAttribute(element, "role") ?? null,
        ariaLabel: stitchSemanticAttribute(element, "aria-label") ?? null,
        href: stitchSemanticAttribute(element, "href") ?? null,
        nativeControlKind,
        interactiveRole: interactiveRoles.has((stitchSemanticAttribute(element, "role") ?? "").toLowerCase()),
        renderState: rendered ? "rendered" : "not_rendered",
        renderBlockers: rendered ? [] : ["ancestor_display_none", "zero_geometry"],
        enabled: !element.disabled,
        pointerOperable: rendered && !element.disabled,
      };
    });
    return {
      stageId: batch.stageId,
      screenId: candidate.screenId,
      htmlArtifactHash: htmlHash,
      screenshotArtifactHash: screenshotHash,
      semanticDom: {
        locator: `stitch/rendered-dom/${candidate.screenId}.html`,
        hash: htmlHash,
        byteLength: htmlBytes.byteLength,
      },
      resourceRefs: [],
      status: "rendered",
      failureCodes: [],
      elements,
      observationHash: hashCanonicalJson(elements),
    };
  })).sort((left, right) => left.screenId.localeCompare(right.screenId));
  return StitchRenderedSemanticsV1Schema.parse({
    schema: "setfarm.stitch-rendered-semantics.v1",
    policy: "chromium-css-cascade-contract-elements.v1",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    directResponseEvidenceHash: hashCanonicalJson(directResponseEvidence),
    renderer: {
      engine: "chromium",
      playwrightVersion: "1.60.0",
      chromiumRevision: "1223",
      chromiumVersion: "148.0.7778.96",
    },
    profile: {
      ...profile,
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      colorScheme: "light",
      reducedMotion: "reduce",
    },
    resources: [],
    candidates,
  });
}
