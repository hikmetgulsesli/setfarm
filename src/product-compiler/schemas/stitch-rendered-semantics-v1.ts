import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { NormalizedRelativeLocatorSchema, Sha256Schema, hasUniqueStrings } from "./common-v1.js";

export const STITCH_RENDERED_SEMANTICS_POLICY_V1 = "chromium-css-cascade-contract-elements.v1" as const;

export const StitchRenderedElementV1Schema = z
  .object({
    elementRef: z.string().regex(/^E[0-9]{6}$/),
    sourceOrdinal: z.number().int().nonnegative().max(1_000_000),
    tagName: z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),
    ownSurfaceRef: z.string().min(1).max(500).nullable(),
    nearestSurfaceRef: z.string().min(1).max(500).nullable(),
    dataAction: z.string().min(1).max(500).nullable(),
    dataActionInput: z.string().min(1).max(2_000).nullable(),
    role: z.string().min(1).max(160).nullable(),
    ariaLabel: z.string().min(1).max(500).nullable(),
    href: z.string().min(1).max(2_000).nullable(),
    nativeControlKind: z.enum(["button", "link", "input", "textarea", "select"]).nullable(),
    interactiveRole: z.boolean(),
    renderState: z.enum(["rendered", "not_rendered"]),
    renderBlockers: z.array(z.enum([
      "hidden_attribute",
      "ancestor_display_none",
      "visibility_hidden",
      "content_visibility_hidden",
      "zero_opacity",
      "inert",
      "aria_hidden",
      "zero_geometry",
    ])).max(8).refine(hasUniqueStrings, { message: "Rendered blockers must be unique" }),
    enabled: z.boolean(),
    pointerOperable: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.renderBlockers.length === 0) !== (value.renderState === "rendered")) {
      context.addIssue({
        code: "custom",
        path: ["renderState"],
        message: "Rendered state must be derived from the exact blocker set",
      });
    }
    if (value.pointerOperable && (value.renderState !== "rendered" || !value.enabled)) {
      context.addIssue({
        code: "custom",
        path: ["pointerOperable"],
        message: "Pointer-operable elements must be rendered and enabled",
      });
    }
  });

const RendererIdentityV1Schema = z.object({
  engine: z.literal("chromium"),
  playwrightVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/).max(100),
  chromiumRevision: z.string().regex(/^\d+$/).max(20),
  chromiumVersion: z.string().regex(/^\d+(?:\.\d+){1,4}$/).max(100),
}).strict();

export const StitchRenderProfileV1Schema = z.object({
  id: z.enum(["desktop-1280x800.v1", "tablet-820x1180.v1", "mobile-390x844.v1"]),
  deviceType: z.enum(["DESKTOP", "TABLET", "MOBILE"]),
  width: z.number().int().positive().max(4_096),
  height: z.number().int().positive().max(4_096),
  deviceScaleFactor: z.literal(1),
  locale: z.literal("en-US"),
  timezoneId: z.literal("UTC"),
  colorScheme: z.literal("light"),
  reducedMotion: z.literal("reduce"),
}).strict().superRefine((value, context) => {
  const expected = value.deviceType === "DESKTOP"
    ? { id: "desktop-1280x800.v1", width: 1280, height: 800 }
    : value.deviceType === "TABLET"
      ? { id: "tablet-820x1180.v1", width: 820, height: 1180 }
      : { id: "mobile-390x844.v1", width: 390, height: 844 };
  if (value.id !== expected.id || value.width !== expected.width || value.height !== expected.height) {
    context.addIssue({ code: "custom", path: ["id"], message: "Render profile dimensions must match its canonical device identity" });
  }
});

const RenderResourceV1Schema = z.object({
  urlHash: Sha256Schema,
  resourceType: z.enum(["script", "stylesheet"]),
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative().max(8 * 1024 * 1024),
  locator: NormalizedRelativeLocatorSchema,
}).strict().superRefine((value, context) => {
  if (value.locator !== `stitch/render-resources/${value.contentHash}.bin`) {
    context.addIssue({ code: "custom", path: ["locator"], message: "Render resource locator must be content-addressed" });
  }
});

export const StitchRenderedCandidateFailureCodeV1Schema = z.enum([
  "HTML_INVALID",
  "SCREENSHOT_INVALID",
  "ARTIFACT_HASH_MISMATCH",
  "UNSAFE_SCREEN_ID",
  "DUPLICATE_CONTRACT_ATTRIBUTE",
  "UNSUPPORTED_EXECUTABLE_SCRIPT",
  "RESOURCE_POLICY_VIOLATION",
  "RESOURCE_DOWNLOAD_FAILED",
  "RESOURCE_CAPACITY_EXCEEDED",
  "NORMALIZATION_FAILED",
  "DOCUMENT_RENDER_TIMEOUT",
]);

export const StitchRenderedCandidateV1Schema = z.object({
  stageId: z.string().min(1).max(160),
  screenId: z.string().min(1).max(500),
  htmlArtifactHash: Sha256Schema.nullable(),
  screenshotArtifactHash: Sha256Schema.nullable(),
  semanticDom: z.object({
    locator: NormalizedRelativeLocatorSchema,
    hash: Sha256Schema,
    byteLength: z.number().int().positive().max(8 * 1024 * 1024),
  }).strict().nullable(),
  resourceRefs: z.array(Sha256Schema).max(1_000).refine(hasUniqueStrings, { message: "Candidate render resource refs must be unique" }),
  status: z.enum(["rendered", "source_rejected"]),
  failureCodes: z.array(StitchRenderedCandidateFailureCodeV1Schema).max(8).refine(hasUniqueStrings, { message: "Rendered-semantics failure codes must be unique" }),
  elements: z.array(StitchRenderedElementV1Schema).max(100_000),
  observationHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  const refs = value.elements.map((element) => element.elementRef);
  const ordinals = value.elements.map((element) => element.sourceOrdinal);
  if (!hasUniqueStrings(refs) || new Set(ordinals).size !== ordinals.length) {
    context.addIssue({ code: "custom", path: ["elements"], message: "Rendered elements must have unique refs and source ordinals" });
  }
  if (ordinals.some((ordinal, index) => index > 0 && ordinal <= ordinals[index - 1]!)) {
    context.addIssue({ code: "custom", path: ["elements"], message: "Rendered elements must be sorted by source ordinal" });
  }
  if (value.status === "rendered") {
    if (
      !value.htmlArtifactHash
      || !value.screenshotArtifactHash
      || !value.semanticDom
      || value.failureCodes.length > 0
      || value.observationHash !== hashCanonicalJson(value.elements)
    ) {
      context.addIssue({ code: "custom", path: ["status"], message: "Rendered candidates require exact DOM, elements, and observation hash without failure codes" });
    }
  } else if (value.semanticDom || value.elements.length > 0 || value.observationHash || value.failureCodes.length === 0) {
    context.addIssue({ code: "custom", path: ["status"], message: "Rejected candidate evidence must preserve typed failures without fabricated DOM observations" });
  }
});

export const StitchRenderedSemanticsV1Schema = z.object({
  schema: z.literal("setfarm.stitch-rendered-semantics.v1"),
  policy: z.literal(STITCH_RENDERED_SEMANTICS_POLICY_V1),
  generationTargetsHash: Sha256Schema,
  directResponseEvidenceHash: Sha256Schema,
  renderer: RendererIdentityV1Schema,
  profile: StitchRenderProfileV1Schema,
  resources: z.array(RenderResourceV1Schema).max(10_000),
  candidates: z.array(StitchRenderedCandidateV1Schema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  for (const [path, values] of [
    [["resources"], value.resources.map((resource) => resource.urlHash)],
    [["candidates"], value.candidates.map((candidate) => candidate.screenId)],
  ] as const) {
    if (!hasUniqueStrings(values)) context.addIssue({ code: "custom", path: [...path], message: "Rendered-semantics identities must be unique" });
  }
  if (value.resources.some((resource, index) => index > 0 && resource.urlHash <= value.resources[index - 1]!.urlHash)) {
    context.addIssue({ code: "custom", path: ["resources"], message: "Render resources must be canonically sorted" });
  }
  if (value.candidates.some((candidate, index) => index > 0 && candidate.screenId <= value.candidates[index - 1]!.screenId)) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Rendered candidates must be canonically sorted" });
  }
  const resourceHashes = new Set(value.resources.map((resource) => resource.urlHash));
  value.candidates.forEach((candidate, index) => {
    candidate.resourceRefs.forEach((hash) => {
      if (!resourceHashes.has(hash)) context.addIssue({ code: "custom", path: ["candidates", index, "resourceRefs"], message: "Candidate resource ref is absent from the sealed resource set" });
    });
  });
});

export type StitchRenderedElementV1 = z.infer<typeof StitchRenderedElementV1Schema>;
export type StitchRenderProfileV1 = z.infer<typeof StitchRenderProfileV1Schema>;
export type StitchRenderedCandidateV1 = z.infer<typeof StitchRenderedCandidateV1Schema>;
export type StitchRenderedSemanticsV1 = z.infer<typeof StitchRenderedSemanticsV1Schema>;
