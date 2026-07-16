import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { resolveRuntimeIdentity, slugifyIdentity } from "../../runtime-identity.js";
import { parseStackPrefix } from "../../stack-contract/prefix.js";
import { getStackPack } from "../../stack-contract/packs.js";
import type { StackPackId } from "../../stack-contract/types.js";
import {
  ProductSpecV1Schema,
  ProductSpecV3ProposalSchema,
} from "../../../product-compiler/schemas/product-spec-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../../product-compiler/schemas/product-spec-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../../product-compiler/canonical-json.js";
import {
  ProductSpecRejectionV1Schema,
  canonicalizeProductSpecV3Proposal,
} from "../../../product-compiler/producers/plan-product-spec-proposal.js";
import { renderLegacyPrd } from "../../../product-compiler/renderers/legacy-prd.js";
import { renderProductSpecV2Compatibility } from "../../../product-compiler/renderers/product-spec-v2-compatibility.js";
import { recordObservation } from "../../observations.js";
import { verifyProductDeliverySelectionV1 } from "../../../product-compiler/product-delivery-profile-catalog.js";

const VALID_TECH_STACKS = new Set([
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

const VALID_PLATFORMS = new Set(["web", "mobile", "desktop", "api", "cli", "game"]);
const VALID_DB_REQUIRED = new Set(["none", "postgres", "sqlite", "external"]);
const VALID_UI_LANGUAGES = new Set(["english", "turkish"]);
const VALID_BOOLEAN = new Set(["true", "false"]);
const PLAN_CONTRACT_SCHEMA_VERSION = "setfarm.plan.v2.2";
const MIN_PRD_LENGTH = 2000;
const PRODUCT_SPEC_BLOCK_RE = /```product-spec-v1\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_V2_BLOCK_RE = /```product-spec-v2\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_REJECTION_BLOCK_RE = /```product-spec-rejection-v1\s*\n([\s\S]*?)\n```/g;

function productSpecBlocks(prd: string): RegExpMatchArray[] {
  return [...prd.matchAll(PRODUCT_SPEC_BLOCK_RE)];
}

function productSpecV2Blocks(prd: string): RegExpMatchArray[] {
  return [...prd.matchAll(PRODUCT_SPEC_V2_BLOCK_RE)];
}

function productSpecRejectionBlocks(prd: string): RegExpMatchArray[] {
  return [...prd.matchAll(PRODUCT_SPEC_REJECTION_BLOCK_RE)];
}

function parsedProductSpec(prd: string): ReturnType<typeof ProductSpecV1Schema.safeParse> | undefined {
  const blocks = productSpecBlocks(prd);
  if (blocks.length !== 1) return undefined;
  try {
    return ProductSpecV1Schema.safeParse(JSON.parse(blocks[0]![1]!));
  } catch {
    return undefined;
  }
}

function parsedProductSpecV2(prd: string): ReturnType<typeof ProductSpecV2Schema.safeParse> | undefined {
  const blocks = productSpecV2Blocks(prd);
  if (blocks.length !== 1) return undefined;
  try {
    return ProductSpecV2Schema.safeParse(JSON.parse(blocks[0]![1]!));
  } catch {
    return undefined;
  }
}

function canonicalExplicitStackContext(context: Record<string, string>): { platform: string; techStack: string } | null {
  const prefix = context["requested_stack_prefix"] || "";
  if (prefix) {
    const parsed = parseStackPrefix(`${prefix}: placeholder`);
    if (parsed) return { platform: parsed.platform, techStack: parsed.techStack };
  }

  const packId = context["stack_pack_id"] || context["detected_stack"] || "";
  if (packId) {
    try {
      const pack = getStackPack(packId as StackPackId);
      const techStack = pack.techStackAliases?.[0] || "";
      if (pack.platform && techStack) return { platform: pack.platform, techStack };
    } catch {
      return null;
    }
  }
  return null;
}

export function sealedDeliveryContext(context: Record<string, string>): {
  platform: string;
  techStack: string;
  designRequired: boolean;
  allowedDatabases: readonly string[];
  stackPackId: string;
  evidenceCapabilityPolicyHash: string;
} | null {
  const raw = context["product_delivery_selection"] || "";
  if (!raw) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("PRODUCT_DELIVERY_SELECTION_JSON_INVALID");
  }
  const selection = verifyProductDeliverySelectionV1(decoded);
  if (hashCanonicalJson(selection) !== context["product_delivery_selection_hash"]) {
    throw new Error("PRODUCT_DELIVERY_SELECTION_HASH_MISMATCH");
  }
  return {
    platform: selection.delivery.platform,
    techStack: selection.delivery.techStack,
    designRequired: selection.delivery.designRequired,
    allowedDatabases: selection.delivery.allowedDatabases,
    stackPackId: selection.stackPackId,
    evidenceCapabilityPolicyHash: selection.evidenceCapabilities.policyHash,
  };
}

const REQUIRED_PRD_SECTIONS = [
  "Context And Goals",
  "Data And State Contract",
  "Behavioral And Action Contract",
  "Product Surfaces",
  "Validation And Error Strategy",
  "System Contracts",
  "Platform Contract",
  "Testability Contract",
  "Out Of Scope",
];

function boolValue(value: string): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function hasSection(prd: string, section: string): boolean {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##+\\s+(?:\\d+\\.\\s*)?${escaped}\\b`, "im").test(prd);
}

function countContractBlocks(prd: string, pattern: RegExp): number {
  return (prd.match(pattern) || []).length;
}

function definedActionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  for (const match of prd.matchAll(/^#{3,6}\s+ACTION:\s*(ACT_[A-Z0-9_]+)\b/gim)) {
    ids.add(match[1]);
  }
  for (const match of prd.matchAll(/^\s*(?:[-*]\s*)?`?ACTION_ID`?\s*:\s*`?(ACT_[A-Z0-9_]+)\b/gim)) {
    ids.add(match[1]);
  }
  return ids;
}

function permittedActionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  for (const match of prd.matchAll(/^\s*[-*]\s*Permitted Actions:\s*(.+)$/gim)) {
    for (const action of match[1].matchAll(/\bACT_[A-Z0-9_]+\b/g)) {
      ids.add(action[0]);
    }
  }
  return ids;
}

function hasRuntimeLeak(parsed: ParsedOutput, prd: string): string[] {
  const errors: string[] = [];
  const forbiddenKeys = ["repo", "branch", "github_repo", "run_slug", "package_name", "app_title", "prd_screen_count"];
  for (const key of forbiddenKeys) {
    if (String(parsed[key] || "").trim()) {
      errors.push(`${key.toUpperCase()} is runtime-owned and must not be emitted by PLAN`);
    }
  }
  if (/^##+\s+(?:\d+\.\s*)?Screens\b/im.test(prd) || /\|\s*#\s*\|\s*Screen/i.test(prd)) {
    errors.push("PRD must not include a physical Screens table; use Product Surfaces only");
  }
  if (/\b(?:\/Users\/|\/home\/|\\Users\\|\$HOME\/|~\/|github\.com\/|feature-[-a-z0-9]+)/i.test(prd)) {
    errors.push("PRD must not include repo paths, local directories, GitHub URLs, or branch names");
  }
  if (/\bFULL_PRD_APPENDIX\b/i.test(prd)) {
    errors.push("PRD must not reference FULL_PRD_APPENDIX; DESIGN uses PRD_CONTEXT_SLICE only");
  }
  return errors;
}

export function normalize(parsed: ParsedOutput): void {
  if (parsed.project_slug) parsed.project_slug = slugifyIdentity(parsed.project_slug);
  if (parsed.tech_stack) parsed.tech_stack = parsed.tech_stack.toLowerCase().trim();
  if (parsed.platform) parsed.platform = parsed.platform.toLowerCase().trim();
  if (parsed.db_required) parsed.db_required = parsed.db_required.toLowerCase().trim();
  if (parsed.design_required) parsed.design_required = parsed.design_required.toLowerCase().trim();
  const prd = String(parsed.prd || "");
  const proposalBlocks = productSpecBlocks(prd);
  const proposalV2Blocks = productSpecV2Blocks(prd);
  const rejectionBlocks = productSpecRejectionBlocks(prd);
  if (proposalV2Blocks.length === 1 && proposalBlocks.length === 0 && rejectionBlocks.length === 0) {
    try {
      const candidate = ProductSpecV2Schema.parse(JSON.parse(proposalV2Blocks[0]![1]!));
      parsed.prd = prd.replace(
        proposalV2Blocks[0]![0],
        `\`\`\`product-spec-v2\n${canonicalJsonStringify(candidate)}\n\`\`\``,
      );
    } catch {
      // Validation reports the exact typed v2 projection error.
    }
  } else if (proposalBlocks.length === 1 && proposalV2Blocks.length === 0 && rejectionBlocks.length === 0) {
    try {
      const candidate = ProductSpecV1Schema.parse(JSON.parse(proposalBlocks[0]![1]!));
      parsed.prd = prd.replace(
        proposalBlocks[0]![0],
        `\`\`\`product-spec-v1\n${canonicalJsonStringify(candidate)}\n\`\`\``,
      );
    } catch {
      // Validation reports the exact typed proposal error.
    }
  } else if (rejectionBlocks.length === 1 && proposalBlocks.length === 0 && proposalV2Blocks.length === 0) {
    try {
      const rejection = ProductSpecRejectionV1Schema.parse(JSON.parse(rejectionBlocks[0]![1]!));
      parsed.prd = prd.replace(
        rejectionBlocks[0]![0],
        `\`\`\`product-spec-rejection-v1\n${canonicalJsonStringify(rejection)}\n\`\`\``,
      );
    } catch {
      // Validation reports the exact typed rejection error.
    }
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  const prd = String(parsed.prd || "");
  const typedProductSpecBlocks = productSpecBlocks(prd);
  const typedProductSpecV2Blocks = productSpecV2Blocks(prd);
  const typedRejectionBlocks = productSpecRejectionBlocks(prd);
  const typedArtifactCount = typedProductSpecBlocks.length
    + typedProductSpecV2Blocks.length
    + typedRejectionBlocks.length;
  if (typedArtifactCount > 1) {
    return {
      ok: false,
      errors: [`PLAN must emit exactly one typed ProductSpec proposal or rejection block (got: ${typedArtifactCount})`],
    };
  }
  if (typedRejectionBlocks.length === 1) {
    try {
      ProductSpecRejectionV1Schema.parse(JSON.parse(typedRejectionBlocks[0]![1]!));
      errors.push("Typed ProductSpec rejection requires upstream specification clarification; Setfarm will not guess product semantics");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Typed PLAN ProductSpec rejection is invalid: ${message.slice(0, 1_000)}`);
    }
    return { ok: false, errors };
  }
  if (typedProductSpecV2Blocks.length === 1) {
    try {
      const candidate = JSON.parse(typedProductSpecV2Blocks[0]![1]!);
      const result = ProductSpecV2Schema.safeParse(candidate);
      if (!result.success) {
        errors.push(`Typed PLAN ProductSpec v2 proposal is invalid: ${result.error.issues[0]?.message || "schema mismatch"}`);
      } else if (canonicalJsonStringify(result.data) !== typedProductSpecV2Blocks[0]![1]!.trim()) {
        errors.push("Typed PLAN ProductSpec v2 proposal was not canonicalized by Setfarm");
      }
      if ((parsed.status || "").toLowerCase() !== "done") {
        errors.push(`STATUS must be 'done' for a ProductSpec v2 proposal (got: '${parsed.status || ""}')`);
      }
      if (parsed.product_spec_schema && parsed.product_spec_schema !== "setfarm.product-spec.v2") {
        errors.push(`PRODUCT_SPEC_SCHEMA must match the typed v2 proposal (got: '${parsed.product_spec_schema}')`);
      }
    } catch {
      errors.push("Typed PLAN ProductSpec v2 projection must be valid canonical JSON");
    }
    return { ok: errors.length === 0, errors };
  }
  if (typedProductSpecBlocks.length === 1) {
    try {
      const candidate = JSON.parse(typedProductSpecBlocks[0]![1]!);
      const base = ProductSpecV1Schema.safeParse(candidate);
      const isV3Proposal = base.success
        && Boolean(base.data.delivery || base.data.requirements || base.data.traceability);
      if (isV3Proposal) {
        const result = ProductSpecV3ProposalSchema.safeParse(candidate);
        if (!result.success) {
          errors.push(`Typed PLAN ProductSpec proposal is invalid: ${result.error.issues[0]?.message || "schema mismatch"}`);
        } else if (canonicalJsonStringify(result.data) !== typedProductSpecBlocks[0]![1]!.trim()) {
          errors.push("Typed PLAN ProductSpec proposal was not canonicalized by Setfarm");
        }
        if ((parsed.status || "").toLowerCase() !== "done") {
          errors.push(`STATUS must be 'done' for a ProductSpec proposal (got: '${parsed.status || ""}')`);
        }
        if (parsed.product_spec_schema && parsed.product_spec_schema !== "setfarm.product-spec.v1") {
          errors.push(`PRODUCT_SPEC_SCHEMA must match the typed proposal (got: '${parsed.product_spec_schema}')`);
        }
        return { ok: errors.length === 0, errors };
      }
    } catch {
      // Legacy validation below reports malformed typed compatibility blocks.
    }
  }

  if ((parsed.contract_schema_version || "").trim() !== PLAN_CONTRACT_SCHEMA_VERSION) {
    errors.push(`CONTRACT_SCHEMA_VERSION must be '${PLAN_CONTRACT_SCHEMA_VERSION}' (got: '${parsed.contract_schema_version || ""}')`);
  }

  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }

  const projectName = String(parsed.project_name || "").trim();
  if (!projectName || projectName.length > 80) {
    errors.push(`PROJECT_NAME must be non-empty and <=80 chars (got: '${projectName}')`);
  }

  const projectSlug = String(parsed.project_slug || "").trim();
  if (!projectSlug || projectSlug !== slugifyIdentity(projectSlug) || projectSlug.length > 64) {
    errors.push(`PROJECT_SLUG must be kebab-case ASCII and <=64 chars (got: '${projectSlug}')`);
  }

  const platform = (parsed.platform || "").toLowerCase();
  if (!VALID_PLATFORMS.has(platform)) {
    errors.push(`PLATFORM must be one of ${[...VALID_PLATFORMS].join(", ")} (got: '${platform}')`);
  }

  const techStack = (parsed.tech_stack || "").toLowerCase();
  if (!VALID_TECH_STACKS.has(techStack)) {
    errors.push(`TECH_STACK must be one of ${[...VALID_TECH_STACKS].join(", ")} (got: '${techStack}')`);
  }

  const dbRequired = (parsed.db_required || "").toLowerCase();
  if (!VALID_DB_REQUIRED.has(dbRequired)) {
    errors.push(`DB_REQUIRED must be one of ${[...VALID_DB_REQUIRED].join(", ")} (got: '${dbRequired}')`);
  }

  const designRequired = (parsed.design_required || "").toLowerCase();
  if (!VALID_BOOLEAN.has(designRequired)) {
    errors.push(`DESIGN_REQUIRED must be true or false (got: '${designRequired}')`);
  }

  const uiVisionSummary = String(parsed.ui_vision_summary || "").trim();
  if (boolValue(designRequired) && uiVisionSummary.length < 80) {
    errors.push("UI_VISION_SUMMARY must be present and >=80 chars when DESIGN_REQUIRED=true");
  }

  const uiLanguage = (parsed.ui_language || "").toLowerCase();
  if (!VALID_UI_LANGUAGES.has(uiLanguage)) {
    errors.push(`UI_LANGUAGE must be one of ${[...VALID_UI_LANGUAGES].join(", ")} (got: '${parsed.ui_language || ""}')`);
  }

  if (prd.length < MIN_PRD_LENGTH) {
    errors.push(`PRD must be >=${MIN_PRD_LENGTH} chars (got: ${prd.length})`);
  }

  for (const section of REQUIRED_PRD_SECTIONS) {
    if (!hasSection(prd, section)) errors.push(`PRD missing section: ${section}`);
  }

  if (typedProductSpecBlocks.length > 0 || parsed.product_spec_schema) {
    if (typedProductSpecBlocks.length !== 1) {
      errors.push(`Typed PLAN must contain exactly one canonical product-spec-v1 projection (got: ${typedProductSpecBlocks.length})`);
    } else {
      try {
        const candidate = JSON.parse(typedProductSpecBlocks[0]![1]!);
        const result = ProductSpecV1Schema.safeParse(candidate);
        if (!result.success) {
          errors.push(`Typed PLAN ProductSpec is invalid: ${result.error.issues[0]?.message || "schema mismatch"}`);
        } else if (canonicalJsonStringify(result.data) !== typedProductSpecBlocks[0]![1]!.trim()) {
          errors.push("Typed PLAN ProductSpec projection must use Setfarm Canonical JSON v1 bytes");
        } else if (parsed.product_spec_schema && parsed.product_spec_schema !== result.data.schema) {
          errors.push(`PRODUCT_SPEC_SCHEMA must match the typed projection (got: '${parsed.product_spec_schema}')`);
        }
      } catch {
        errors.push("Typed PLAN ProductSpec projection must be valid canonical JSON");
      }
    }
  }

  if (boolValue(designRequired)) {
    if (countContractBlocks(prd, /\bSURF_[A-Z0-9_]+\b/g) === 0 && !/\bSURFACE_ID\s*:/i.test(prd)) {
      errors.push("DESIGN_REQUIRED=true requires Product Surfaces with SURF_* identifiers");
    }
    if (!/\bcontrol_hint\b|\bControl Hint\b|\bPermitted Actions\b/i.test(prd)) {
      errors.push("Product Surfaces must include permitted action/control hints for Stitch");
    }
    if (!/\bRepresentation\s*:\s*(standalone|inline)\b/i.test(prd)) {
      errors.push("Product Surfaces must declare Representation: standalone or inline");
    }
    if (!/\bDomain Hint\s*:/i.test(prd)) {
      errors.push("Product Surfaces must declare Domain Hint for deterministic scope target mapping");
    }
    if (!/\bDisplay Fields\s*:/i.test(prd)) {
      errors.push("Product Surfaces must declare Display Fields for scoped PRD_CONTEXT_SLICE construction");
    }
    if (/\bRepresentation\s*:\s*inline\b/i.test(prd) && !/\bHost Surface ID\s*:\s*SURF_[A-Z0-9_]+\b/i.test(prd)) {
      errors.push("Inline Product Surfaces must declare Host Surface ID: SURF_*");
    }
  }

  const definedActions = definedActionIds(prd);
  if (definedActions.size === 0 && countContractBlocks(prd, /\bACT_[A-Z0-9_]+\b/g) === 0 && !/\bACTION_ID\s*:/i.test(prd)) {
    errors.push("PRD must include Behavioral And Action Contract entries with ACT_* identifiers");
  }

  if (boolValue(designRequired)) {
    const missing = [...permittedActionIds(prd)].filter(actionId => !definedActions.has(actionId));
    if (missing.length > 0) {
      errors.push(`Every permitted action must have a Behavioral And Action Contract entry. Missing: ${missing.slice(0, 8).join(", ")}`);
    }
  }

  if (!/##+\s+(?:\d+\.\s*)?Out Of Scope\b[\s\S]*?(?:\n[-*]\s+\S|\nNo\s+)/i.test(prd)) {
    errors.push("Out Of Scope must include at least one explicit deny item");
  }

  const requiredContractMarkers = [
    ["mock_data_contract", /\bmock_data_contract\b|Mock Data Contract/i],
    ["data_access_contract", /\bdata_access_contract\b|Data Access Contract/i],
    ["environment_contract", /\benvironment_contract\b|Environment Contract/i],
    ["route_guard_policy", /\broute_guard_policy\b|Route Guard Policy/i],
  ] as const;
  for (const [name, pattern] of requiredContractMarkers) {
    if (!pattern.test(prd)) errors.push(`PRD missing required contract marker: ${name}`);
  }

  errors.push(...hasRuntimeLeak(parsed, prd));

  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context, runId } = ctx;
  normalize(parsed);
  const typedV2 = parsedProductSpecV2(String(parsed.prd || ""));
  const typed = parsedProductSpec(String(parsed.prd || ""));
  if (typedV2?.success) {
    const spec: ProductSpecV2 = typedV2.data;
    const rendered = renderProductSpecV2Compatibility(spec);
    const bodyMarker = "\nPRD:\n";
    const bodyIndex = rendered.indexOf(bodyMarker);
    if (bodyIndex < 0) throw new Error("PRODUCT_SPEC_V2_COMPATIBILITY_PROJECTION_INVALID");
    const header = rendered.slice(0, bodyIndex);
    const headerValue = (key: string): string => header.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
    parsed.contract_schema_version = PLAN_CONTRACT_SCHEMA_VERSION;
    parsed.status = "done";
    parsed.project_name = spec.product.name;
    parsed.project_slug = headerValue("PROJECT_SLUG");
    parsed.platform = spec.delivery.platform;
    parsed.tech_stack = spec.delivery.techStack;
    parsed.ui_language = spec.delivery.uiLanguage;
    parsed.db_required = spec.delivery.database;
    parsed.design_required = String(spec.delivery.designRequired);
    parsed.ui_vision_summary = spec.delivery.uiVisionSummary;
    parsed.product_spec_schema = spec.schema;
    parsed.prd = rendered.slice(bodyIndex + bodyMarker.length);
    context["product_semantics_version"] = "v2";
    context["product_spec_hash"] = hashCanonicalJson(spec);
    context["product_spec_source_task_hash"] = spec.traceability.sourceTaskHash;
    await recordObservation({
      runId,
      stepId: ctx.stepId,
      phase: "planning",
      checkId: "product_compiler.product_spec_v2_canonicalized",
      label: "Planner ProductSpec v2 canonicalized",
      status: "pass",
      summary: `Canonicalized ${spec.requirements.length} source requirements into ${spec.traceability.bindings.length} semantic bindings and ${spec.actions.flatMap((action) => action.controlPlacements).length} exact control slots.`,
      evidence: {
        schema: "setfarm.product-spec-proposal-evidence.v2",
        productSpecHash: context["product_spec_hash"],
        sourceTaskHash: spec.traceability.sourceTaskHash,
        sourceTransport: context["plan_source_transport"] || "semantic_proposal_v2",
        sourceProposalHash: context["plan_source_proposal_hash"] || null,
        deliveryProfileId: context["product_delivery_profile_id"] || null,
        deliverySelectionHash: context["product_delivery_selection_hash"] || null,
        deliveryCatalogHash: context["product_delivery_catalog_hash"] || null,
        stackPackId: context["product_delivery_stack_pack_id"] || context["stack_pack_id"] || null,
        conversionPolicy: context["product_delivery_conversion_policy"] || null,
        designProjection: context["product_delivery_design_projection"] || null,
        topologyDescriptorHash: context["product_delivery_topology_hash"] || null,
        persistenceProjectionHash: context["product_persistence_projection_hash"] || null,
        requirementRefs: spec.requirements.map((requirement) => requirement.id),
        controlSlotRefs: spec.actions.flatMap((action) =>
          action.controlPlacements.map((placement) => placement.id)),
      },
    });
  } else if (typed?.success && (typed.data.delivery || typed.data.requirements || typed.data.traceability)) {
    const authoritativeDelivery = sealedDeliveryContext(context) ?? canonicalExplicitStackContext(context);
    const canonical = canonicalizeProductSpecV3Proposal({
      task: context["task"] || "",
      proposal: typed.data,
      ...(authoritativeDelivery ? { authoritativeDelivery } : {}),
    });
    if (canonical.status !== "canonicalized") {
      throw new Error(`PRODUCT_SPEC_PROPOSAL_REJECTED:${canonical.diagnostics
        .slice(0, 20)
        .map((item) => `${item.code}:${item.path}:${item.message}`)
        .join(";")}`);
    }
    const spec = canonical.productSpec;
    const rendered = renderLegacyPrd(spec);
    const bodyMarker = "\nPRD:\n";
    const bodyIndex = rendered.indexOf(bodyMarker);
    if (bodyIndex < 0) throw new Error("PRODUCT_SPEC_COMPATIBILITY_PROJECTION_INVALID");
    const header = rendered.slice(0, bodyIndex);
    const headerValue = (key: string): string => header.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
    parsed.contract_schema_version = PLAN_CONTRACT_SCHEMA_VERSION;
    parsed.status = "done";
    parsed.project_name = spec.product.name;
    parsed.project_slug = headerValue("PROJECT_SLUG");
    parsed.platform = spec.delivery!.platform;
    parsed.tech_stack = spec.delivery!.techStack;
    parsed.ui_language = spec.delivery!.uiLanguage;
    parsed.db_required = spec.delivery!.database;
    parsed.design_required = String(spec.delivery!.designRequired);
    parsed.ui_vision_summary = spec.delivery!.uiVisionSummary;
    parsed.product_spec_schema = spec.schema;
    parsed.prd = rendered.slice(bodyIndex + bodyMarker.length);
    context["product_spec_hash"] = hashCanonicalJson(spec);
    context["product_spec_source_task_hash"] = canonical.sourceTaskHash;
    await recordObservation({
      runId,
      stepId: ctx.stepId,
      phase: "planning",
      checkId: "product_compiler.product_spec_proposal_canonicalized",
      label: "Planner ProductSpec canonicalized",
      status: "pass",
      summary: `Canonicalized ${spec.requirements!.length} source requirements into ${spec.traceability!.bindings.length} exact semantic bindings.`,
      evidence: {
        schema: "setfarm.product-spec-proposal-evidence.v1",
        productSpecHash: context["product_spec_hash"],
        sourceTaskHash: canonical.sourceTaskHash,
        sourceTransport: context["plan_source_transport"] || "product_spec_compatibility",
        sourceProposalHash: context["plan_source_proposal_hash"] || null,
        deliveryProfileId: context["product_delivery_profile_id"] || null,
        deliverySelectionHash: context["product_delivery_selection_hash"] || null,
        deliveryCatalogHash: context["product_delivery_catalog_hash"] || null,
        stackPackId: context["product_delivery_stack_pack_id"] || context["stack_pack_id"] || null,
        conversionPolicy: context["product_delivery_conversion_policy"] || null,
        designProjection: context["product_delivery_design_projection"] || null,
        topologyDescriptorHash: context["product_delivery_topology_hash"] || null,
        persistenceProjection: canonical.persistenceProjectionEvidence,
        requirementRefs: spec.requirements!.map((requirement) => requirement.id),
      },
    });
  }

  const identity = resolveRuntimeIdentity({
    runId,
    projectName: parsed.project_name,
    projectSlug: parsed.project_slug,
    explicitRepo: context["repo"] || context["REPO"] || "",
    explicitBranch: context["branch"] || context["BRANCH"] || "",
    explicitGithubRepo: context["github_repo"] || context["GITHUB_REPO"] || "",
  });

  context["project_name"] = identity.projectName;
  context["project_display_name"] = identity.projectName;
  context["project_slug"] = identity.projectSlug;
  context["run_slug"] = identity.runSlug;
  context["repo"] = identity.repo;
  context["branch"] = identity.branch;
  context["github_repo"] = identity.githubRepo;
  context["app_title"] = identity.appTitle;
  context["package_name"] = identity.packageName;
  const hasExplicitStackPrefix = Boolean(context["requested_stack_prefix"] && context["stack_pack_id"]);
  if (hasExplicitStackPrefix) {
    const canonical = canonicalExplicitStackContext(context);
    if (canonical) {
      context["platform"] = canonical.platform;
      context["tech_stack"] = canonical.techStack;
    }
  } else {
    context["platform"] = (parsed.platform || "").toLowerCase();
    context["tech_stack"] = (parsed.tech_stack || "").toLowerCase();
  }
  context["prd"] = parsed.prd || "";
  context["db_required"] = (parsed.db_required || "").toLowerCase();
  context["design_required"] = (parsed.design_required || "").toLowerCase();
  context["ui_language"] = parsed.ui_language || "English";
  context["contract_schema_version"] = parsed.contract_schema_version || PLAN_CONTRACT_SCHEMA_VERSION;
  context["ui_vision_summary"] = parsed.ui_vision_summary || "";
}
