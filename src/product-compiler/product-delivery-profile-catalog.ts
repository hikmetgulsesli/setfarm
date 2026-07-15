import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  getStackTopologyCatalogContract,
  STACK_TOPOLOGY_CATALOG_VERSION,
} from "./stack-topology-catalog.js";
import {
  PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION,
  productEvidenceCapabilityPolicyHashV1,
} from "./product-evidence-capability-policy.js";

export const PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION = "1.2.0";

const ProductClassV1Schema = z.enum([
  "utility",
  "operations",
  "game",
  "content",
  "commerce",
  "developer_tool",
  "service",
  "other",
]);

const DeliveryPlatformV1Schema = z.enum(["web", "mobile", "desktop", "api", "cli", "game"]);
const DeliveryTechStackV1Schema = z.enum([
  "vite-react",
  "nextjs",
  "static-html",
  "browser-game",
  "node-express",
  "python-web",
  "node-cli",
  "python-cli",
  "react-native-expo",
  "android-native",
  "ios-native",
  "desktop-electron",
]);
const DeliveryDatabaseV1Schema = z.enum(["none", "postgres", "sqlite", "external"]);

export const ProductDeliveryProfileV1Schema = z.object({
  schema: z.literal("setfarm.product-delivery-profile.v1"),
  id: z.enum([
    "PROFILE_WEB_REACT_EXACT_V1",
    "PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1",
  ]),
  version: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION),
  productClasses: z.array(ProductClassV1Schema).min(1).max(20),
  delivery: z.object({
    platform: DeliveryPlatformV1Schema,
    techStack: DeliveryTechStackV1Schema,
    designRequired: z.boolean(),
    allowedDatabases: z.array(DeliveryDatabaseV1Schema).min(1).max(4),
  }).strict(),
  stackPackId: z.enum(["vite-react-web-app", "browser-game-canvas"]),
  design: z.object({
    policy: z.literal("stitch-required"),
    conversionPolicy: z.literal("wrap_jsx"),
    projection: z.literal("exact_stitch_screen_index_v4"),
    producerId: z.literal("setfarm.stitch-screen-index-v4"),
  }).strict(),
  runtimeAdapter: z.literal("browser"),
  topology: z.object({
    catalogVersion: z.literal(STACK_TOPOLOGY_CATALOG_VERSION),
    descriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  evidenceCapabilities: z.object({
    policySchema: z.literal("setfarm.product-evidence-capability-policy.v1"),
    policyVersion: z.literal(PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION),
    policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
}).strict();

export type ProductDeliveryProfileV1 = z.infer<typeof ProductDeliveryProfileV1Schema>;

export const ProductDeliveryProfileCatalogV1Schema = z.object({
  schema: z.literal("setfarm.product-delivery-profile-catalog.v1"),
  version: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION),
  profiles: z.array(ProductDeliveryProfileV1Schema).length(2),
}).strict().superRefine((value, context) => {
  const profileIds = value.profiles.map((profile) => profile.id);
  if (new Set(profileIds).size !== profileIds.length) {
    context.addIssue({ code: "custom", path: ["profiles"], message: "Delivery profile IDs must be unique" });
  }
  const classes = value.profiles.flatMap((profile) => profile.productClasses);
  if (new Set(classes).size !== classes.length) {
    context.addIssue({ code: "custom", path: ["profiles"], message: "Each activated product class must have one delivery owner" });
  }
});

export type ProductDeliveryProfileCatalogV1 = z.infer<typeof ProductDeliveryProfileCatalogV1Schema>;

export const ProductDeliverySelectionV1Schema = z.object({
  schema: z.literal("setfarm.product-delivery-selection.v1"),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  profileId: ProductDeliveryProfileV1Schema.shape.id,
  productClass: ProductClassV1Schema,
  delivery: ProductDeliveryProfileV1Schema.shape.delivery,
  stackPackId: ProductDeliveryProfileV1Schema.shape.stackPackId,
  design: ProductDeliveryProfileV1Schema.shape.design,
  runtimeAdapter: ProductDeliveryProfileV1Schema.shape.runtimeAdapter,
  topology: ProductDeliveryProfileV1Schema.shape.topology,
  evidenceCapabilities: ProductDeliveryProfileV1Schema.shape.evidenceCapabilities,
  selectionBasis: z.enum(["product_class", "explicit_stack_prefix"]),
  requestedStackPackId: z.string().min(1).max(160).optional(),
}).strict();

export type ProductDeliverySelectionV1 = z.infer<typeof ProductDeliverySelectionV1Schema>;

export type ProductDeliverySelectionDiagnosticV1 = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type ProductDeliverySelectionResultV1 =
  | Readonly<{
      status: "selected";
      selection: ProductDeliverySelectionV1;
      selectionHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductDeliverySelectionDiagnosticV1[];
    }>;

function profile(input: Omit<
  ProductDeliveryProfileV1,
  "schema" | "version" | "topology" | "evidenceCapabilities"
>): ProductDeliveryProfileV1 {
  const topology = getStackTopologyCatalogContract(input.stackPackId);
  if (!topology) throw new Error(`PRODUCT_DELIVERY_TOPOLOGY_PROFILE_MISSING:${input.stackPackId}`);
  return ProductDeliveryProfileV1Schema.parse({
    schema: "setfarm.product-delivery-profile.v1",
    version: PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION,
    ...input,
    topology: {
      catalogVersion: topology.identity.version,
      descriptorHash: topology.identity.contentHash,
    },
    evidenceCapabilities: {
      policySchema: "setfarm.product-evidence-capability-policy.v1",
      policyVersion: PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION,
      policyHash: productEvidenceCapabilityPolicyHashV1(),
    },
  });
}

const PRODUCT_DELIVERY_PROFILE_CATALOG = ProductDeliveryProfileCatalogV1Schema.parse({
  schema: "setfarm.product-delivery-profile-catalog.v1",
  version: PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION,
  profiles: [
    profile({
      id: "PROFILE_WEB_REACT_EXACT_V1",
      productClasses: ["utility", "operations"],
      delivery: {
        platform: "web",
        techStack: "vite-react",
        designRequired: true,
        allowedDatabases: ["none"],
      },
      stackPackId: "vite-react-web-app",
      design: {
        policy: "stitch-required",
        conversionPolicy: "wrap_jsx",
        projection: "exact_stitch_screen_index_v4",
        producerId: "setfarm.stitch-screen-index-v4",
      },
      runtimeAdapter: "browser",
    }),
    profile({
      id: "PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1",
      productClasses: ["game"],
      delivery: {
        platform: "game",
        techStack: "browser-game",
        designRequired: true,
        allowedDatabases: ["none"],
      },
      stackPackId: "browser-game-canvas",
      design: {
        policy: "stitch-required",
        conversionPolicy: "wrap_jsx",
        projection: "exact_stitch_screen_index_v4",
        producerId: "setfarm.stitch-screen-index-v4",
      },
      runtimeAdapter: "browser",
    }),
  ],
});

export function getProductDeliveryProfileCatalogV1(): ProductDeliveryProfileCatalogV1 {
  return structuredClone(PRODUCT_DELIVERY_PROFILE_CATALOG);
}

export function productDeliveryProfileCatalogHashV1(): string {
  return hashCanonicalJson(PRODUCT_DELIVERY_PROFILE_CATALOG);
}

export function canonicalProductDeliveryProfileCatalogV1(): string {
  return canonicalJsonStringify(PRODUCT_DELIVERY_PROFILE_CATALOG);
}

export function resolveProductDeliverySelectionV1(input: Readonly<{
  productClass: string;
  requestedStackPackId?: string;
}>): ProductDeliverySelectionResultV1 {
  const productClass = ProductClassV1Schema.safeParse(input.productClass);
  if (!productClass.success) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PRODUCT_DELIVERY_CLASS_INVALID",
        path: "/product/class",
        message: `Product class ${JSON.stringify(input.productClass)} is not a ProductSpec v1 class`,
      }],
    };
  }
  const catalog = getProductDeliveryProfileCatalogV1();
  const selected = catalog.profiles.find((candidate) => candidate.productClasses.includes(productClass.data));
  if (!selected) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PRODUCT_DELIVERY_PROFILE_UNSUPPORTED",
        path: "/product/class",
        message: `Product Compiler v3 has no activated delivery profile for ${productClass.data}`,
      }],
    };
  }
  const requestedStackPackId = String(input.requestedStackPackId || "").trim();
  if (requestedStackPackId && requestedStackPackId !== selected.stackPackId) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PRODUCT_DELIVERY_EXPLICIT_STACK_UNSUPPORTED",
        path: "/delivery/techStack",
        message: `Explicit stack ${requestedStackPackId} is not the activated ${selected.stackPackId} profile for ${productClass.data}`,
      }],
    };
  }
  const catalogHash = productDeliveryProfileCatalogHashV1();
  const selection = ProductDeliverySelectionV1Schema.parse({
    schema: "setfarm.product-delivery-selection.v1",
    catalogVersion: catalog.version,
    catalogHash,
    profileId: selected.id,
    productClass: productClass.data,
    delivery: selected.delivery,
    stackPackId: selected.stackPackId,
    design: selected.design,
    runtimeAdapter: selected.runtimeAdapter,
    topology: selected.topology,
    evidenceCapabilities: selected.evidenceCapabilities,
    selectionBasis: requestedStackPackId ? "explicit_stack_prefix" : "product_class",
    ...(requestedStackPackId ? { requestedStackPackId } : {}),
  });
  const canonicalBytes = canonicalJsonStringify(selection);
  return {
    status: "selected",
    selection,
    selectionHash: hashCanonicalJson(selection),
    canonicalBytes,
  };
}

export function verifyProductDeliverySelectionV1(input: unknown): ProductDeliverySelectionV1 {
  const parsed = ProductDeliverySelectionV1Schema.parse(input);
  const current = resolveProductDeliverySelectionV1({
    productClass: parsed.productClass,
    ...(parsed.requestedStackPackId ? { requestedStackPackId: parsed.requestedStackPackId } : {}),
  });
  if (
    current.status !== "selected"
    || canonicalJsonStringify(current.selection) !== canonicalJsonStringify(parsed)
  ) {
    throw new Error("PRODUCT_DELIVERY_SELECTION_CATALOG_MISMATCH");
  }
  return parsed;
}
