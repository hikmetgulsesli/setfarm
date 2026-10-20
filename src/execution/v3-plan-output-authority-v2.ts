import type { ParsedOutput } from "../installer/steps/types.js";
import {
  ProductSpecRejectionV1Schema,
  canonicalizeProductSpecRejectionV1,
  type ProductSpecProposalDiagnosticV1,
  type ProductSpecRejectionV1,
} from "../product-compiler/producers/plan-product-spec-proposal.js";
import {
  compilePlanSemanticProposalV2,
} from "../product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  compilePlanProductBuildProposalV1,
} from "../product-compiler/producers/plan-product-build-proposal-v1.js";
import type { ProductDeliverySelectionV1 } from "../product-compiler/product-delivery-profile-catalog.js";
import type { CompilerOwnedPersistenceProjectionEvidenceV1 } from "../product-compiler/producers/compiler-owned-persistence-projection.js";
import type { ProductSpecV2 } from "../product-compiler/schemas/product-spec-v2.js";
import type {
  ProductRuntimeBehaviorContractV1,
  ProductRuntimeBehaviorProposalV1,
} from "../product-compiler/schemas/product-runtime-behavior-contract-v1.js";
import type {
  PlanProductBuildAuthorityV1,
  PlanProductBuildReferenceMapV1,
} from "../product-compiler/schemas/plan-product-build-proposal-v1.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../product-compiler/bounded-canonical-json.js";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES } from "../product-compiler/producers/plan-semantic-proposal-v2.js";

const PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE = /```plan-semantic-proposal-v2\s*\n([\s\S]*?)\n```/g;
const PLAN_PRODUCT_BUILD_PROPOSAL_V1_BLOCK_RE = /```plan-product-build-proposal-v1\s*\n([\s\S]*?)\n```/g;
const PLAN_RUNTIME_BEHAVIOR_PROPOSAL_V1_BLOCK_RE = /```plan-runtime-behavior-proposal-v1\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_V2_BLOCK_RE = /```product-spec-v2\s*\n([\s\S]*?)\n```/g;
const PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_V1_BLOCK_RE = /```product-runtime-behavior-contract-v1\s*\n([\s\S]*?)\n```/g;
const PLAN_PRODUCT_BUILD_AUTHORITY_V1_BLOCK_RE = /```plan-product-build-authority-v1\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_REJECTION_BLOCK_RE = /```product-spec-rejection-v1\s*\n([\s\S]*?)\n```/g;
const BARE_PLAN_REJECTION_V1_RE = /^\s*STATUS: done\r?\n\s*```product-spec-rejection-v1\r?\n([\s\S]*?)\r?\n```\s*$/u;
const LEGACY_TYPED_BLOCK_RE = /```(?:plan-semantic-proposal-v1|product-spec-v1)\s*\n([\s\S]*?)\n```/g;
export const PLAN_V2_PRD_MAX_BYTES = 4 * 1024 * 1024;

type V3PlanProposalAuthorityBaseV2 = Readonly<{
  status: "proposal";
  productSpec: ProductSpecV2;
  canonicalBytes: string;
  sourceTaskHash: string;
  deliverySelection: ProductDeliverySelectionV1;
  deliverySelectionHash: string;
  deliverySelectionCanonicalBytes: string;
  persistenceProjectionEvidence: CompilerOwnedPersistenceProjectionEvidenceV1;
}>;

export type V3PlanOutputAuthorityV2 =
  | (V3PlanProposalAuthorityBaseV2 & Readonly<{
      sourceTransport: "semantic_proposal_v2";
      sourceProposalHash: string;
    }>)
  | (V3PlanProposalAuthorityBaseV2 & Readonly<{
      sourceTransport: "product_build_proposal_v1";
      sourceProposalHash: string;
      sourceSemanticProposalHash: string;
      runtimeBehaviorProposal: ProductRuntimeBehaviorProposalV1;
      runtimeBehaviorProposalCanonicalBytes: string;
      runtimeBehaviorProposalHash: string;
      runtimeBehaviorContract: ProductRuntimeBehaviorContractV1;
      runtimeBehaviorCanonicalBytes: string;
      planProductBuildReferenceMap: PlanProductBuildReferenceMapV1;
      planProductBuildAuthority: PlanProductBuildAuthorityV1;
      planProductBuildAuthorityCanonicalBytes: string;
    }>)
  | Readonly<{
      status: "rejection";
      rejection: ProductSpecRejectionV1;
    }>;

type ProposalAuthorityV2 = Extract<V3PlanOutputAuthorityV2, { status: "proposal" }>;

export class V3PlanOutputV2RejectedError extends Error {
  readonly diagnostics: readonly ProductSpecProposalDiagnosticV1[];

  constructor(code: string, diagnostics: readonly ProductSpecProposalDiagnosticV1[]) {
    super(code);
    this.name = "V3PlanOutputV2RejectedError";
    this.diagnostics = diagnostics.map((diagnostic) => ({ ...diagnostic }));
  }
}

function rejection(code: string, path: string, message: string): V3PlanOutputV2RejectedError {
  return new V3PlanOutputV2RejectedError(code, [{ code, path, message }]);
}

function blocks(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]!);
    if (matches.length === 2) break; // cardinality authority needs only 0, 1, or 2+
  }
  pattern.lastIndex = 0;
  return matches;
}

function decode(raw: string, code: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw rejection(code, "", "PLAN typed artifact is not valid JSON");
  }
}

function prdText(parsed: ParsedOutput): string {
  const raw = parsed.prd;
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw !== "string") {
    throw rejection(
      "V3_PLAN_V2_PRD_TYPE_INVALID",
      "/prd",
      "PLAN prd must be an exact string",
    );
  }
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > PLAN_V2_PRD_MAX_BYTES) {
    throw rejection(
      "V3_PLAN_V2_PRD_TOO_LARGE",
      "/prd",
      `PLAN prd exceeds ${PLAN_V2_PRD_MAX_BYTES} UTF-8 bytes`,
    );
  }
  return raw;
}

function boundedParsedSnapshot(value: unknown, code: string): unknown {
  try {
    const bytes = canonicalJsonBytesBounded(value, {
      maxBytes: PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw rejection(code, "", "PLAN typed artifact exceeds bounded canonical authority");
  }
}

function isPlanWhitespace(code: number): boolean {
  return (code >= 0x09 && code <= 0x0d)
    || code === 0x20 || code === 0xa0 || code === 0x1680
    || (code >= 0x2000 && code <= 0x200a)
    || code === 0x2028 || code === 0x2029 || code === 0x202f
    || code === 0x205f || code === 0x3000 || code === 0xfeff;
}

/** Inspect only the leading envelope, with constant auxiliary state and no body scan. */
function selectsBarePlanRejectionV1(raw: string): boolean {
  let cursor = 0;
  while (cursor < raw.length && isPlanWhitespace(raw.charCodeAt(cursor))) cursor += 1;
  const statusLine = "STATUS: done";
  if (!raw.startsWith(statusLine, cursor)) return false;
  cursor += statusLine.length;
  if (raw.charCodeAt(cursor) === 0x0d) cursor += 1;
  if (raw.charCodeAt(cursor) !== 0x0a) return false;
  cursor += 1;
  while (cursor < raw.length && isPlanWhitespace(raw.charCodeAt(cursor))) cursor += 1;
  const openingFence = "```product-spec-rejection-v1";
  if (!raw.startsWith(openingFence, cursor)) return false;
  cursor += openingFence.length;
  if (raw.charCodeAt(cursor) === 0x0d) cursor += 1;
  return raw.charCodeAt(cursor) === 0x0a;
}

function readBarePlanRejectionV1(raw: string | undefined, parsed: ParsedOutput): string | undefined {
  if (raw === undefined) return undefined;
  const bytes = Buffer.byteLength(raw, "utf8");
  const selected = selectsBarePlanRejectionV1(raw);
  const hasPrd = parsed.prd !== undefined && parsed.prd !== null && parsed.prd !== "";
  if (bytes > PLAN_V2_PRD_MAX_BYTES && (selected || !hasPrd)) {
    throw rejection(
      "V3_PLAN_V2_RAW_OUTPUT_TOO_LARGE",
      "/rawOutput",
      `Bare PLAN refusal exceeds ${PLAN_V2_PRD_MAX_BYTES} UTF-8 bytes`,
    );
  }
  if (!selected) return undefined;
  // Only a byte-bounded selected candidate reaches the full-body matcher or decoder.
  const match = BARE_PLAN_REJECTION_V1_RE.exec(raw);
  if (!match || match[1]!.includes("\n```")) {
    throw rejection(
      "V3_PLAN_V2_BARE_REJECTION_TRANSPORT_INVALID",
      "/rawOutput",
      "Bare PLAN refusal must be the entire exact STATUS and rejection-fence output",
    );
  }
  if (hasPrd || Object.keys(parsed).some((key) => key !== "status" && key !== "prd")) {
    throw rejection(
      "V3_PLAN_V2_BARE_REJECTION_PARSED_SIBLING_FORBIDDEN",
      "/rawOutput",
      "Bare PLAN refusal cannot coexist with PRD or other parsed output keys",
    );
  }
  return match[1]!;
}

function decodePlanRejectionV1(task: string, raw: string): ProductSpecRejectionV1 {
  const parsed = ProductSpecRejectionV1Schema.parse(boundedParsedSnapshot(
    decode(raw, "V3_PLAN_V2_REJECTION_JSON_INVALID"),
    "V3_PLAN_V2_REJECTION_INPUT_INVALID",
  ));
  return canonicalizeProductSpecRejectionV1({ task, rejection: parsed });
}

/** New v2 prompts emit one atomic build proposal; semantic-only v2 stays readable. */
export function resolveV3PlanOutputAuthorityV2(input: Readonly<{
  task: string;
  parsed: ParsedOutput;
  rawOutput?: string;
  requestedStackPackId?: string;
  allowSemanticOnlyCompatibility?: boolean;
}>): V3PlanOutputAuthorityV2 {
  const bareRejection = readBarePlanRejectionV1(input.rawOutput, input.parsed);
  if (bareRejection !== undefined) {
    return { status: "rejection", rejection: decodePlanRejectionV1(input.task, bareRejection) };
  }
  const prd = prdText(input.parsed);
  const builds = blocks(prd, PLAN_PRODUCT_BUILD_PROPOSAL_V1_BLOCK_RE);
  const semantic = blocks(prd, PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE);
  const splitBehavior = blocks(prd, PLAN_RUNTIME_BEHAVIOR_PROPOSAL_V1_BLOCK_RE);
  const rejections = blocks(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE);
  const projected = [
    ...blocks(prd, PRODUCT_SPEC_V2_BLOCK_RE),
    ...blocks(prd, PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_V1_BLOCK_RE),
    ...blocks(prd, PLAN_PRODUCT_BUILD_AUTHORITY_V1_BLOCK_RE),
  ];
  const legacy = blocks(prd, LEGACY_TYPED_BLOCK_RE);
  if (legacy.length > 0) {
    throw rejection(
      "V3_PLAN_V2_LEGACY_SEMANTICS_FORBIDDEN",
      "/prd",
      "Product semantics v1 cannot be upgraded because surfaceRefs does not distinguish physical placement from affected surfaces",
    );
  }
  if (projected.length > 0) {
    throw rejection(
      "V3_PLAN_V2_COMPILER_PROJECTION_FORBIDDEN",
      "/prd",
      "The planner must submit one primary plan-product-build-proposal-v1, not compiler-owned projection bytes",
    );
  }
  if (splitBehavior.length > 0) {
    throw rejection(
      "V3_PLAN_V2_SPLIT_BEHAVIOR_FORBIDDEN",
      "/prd",
      "Runtime behavior must be inside the same plan-product-build-proposal-v1 envelope as product semantics",
    );
  }
  const proposalCount = builds.length + semantic.length;
  if (proposalCount + rejections.length !== 1) {
    throw rejection(
      `V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:${proposalCount}:${rejections.length}`,
      "/prd",
      `PLAN must emit exactly one atomic v2 build proposal, explicit semantic-only compatibility proposal, or typed rejection; observed ${proposalCount} proposal(s) and ${rejections.length} rejection(s)`,
    );
  }
  if (rejections.length === 1) {
    return {
      status: "rejection",
      rejection: decodePlanRejectionV1(input.task, rejections[0]!),
    };
  }
  if (semantic.length === 1 && input.allowSemanticOnlyCompatibility !== true) {
    throw rejection(
      "V3_PLAN_V2_SEMANTIC_ONLY_COMPATIBILITY_NOT_AUTHORIZED",
      "/prd",
      "Semantic-only v2 is readable only for a claim issued before atomic product-build authority activation",
    );
  }
  if (builds.length === 1) {
    const compiled = compilePlanProductBuildProposalV1({
      task: input.task,
      proposal: decode(builds[0]!, "V3_PLAN_V2_PRODUCT_BUILD_JSON_INVALID"),
      ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
    });
    if (compiled.status !== "shadow_compiled") {
      throw new V3PlanOutputV2RejectedError(
        "V3_PLAN_V2_PRODUCT_BUILD_PROPOSAL_INVALID",
        compiled.diagnostics.slice(0, 20),
      );
    }
    return {
      status: "proposal",
      productSpec: compiled.productSpec,
      canonicalBytes: compiled.productSpecCanonicalBytes,
      sourceTaskHash: compiled.authority.source.sourceTaskHash,
      deliverySelection: compiled.deliverySelection,
      deliverySelectionHash: compiled.deliverySelectionHash,
      deliverySelectionCanonicalBytes: compiled.deliverySelectionCanonicalBytes,
      persistenceProjectionEvidence: compiled.persistenceProjectionEvidence,
      sourceTransport: "product_build_proposal_v1",
      sourceProposalHash: compiled.authority.source.envelopeHash,
      sourceSemanticProposalHash: compiled.semanticProposalHash,
      runtimeBehaviorProposal: compiled.runtimeBehaviorProposal,
      runtimeBehaviorProposalCanonicalBytes:
        canonicalJsonStringify(compiled.runtimeBehaviorProposal),
      runtimeBehaviorProposalHash:
        compiled.runtimeBehaviorContract.authority.proposalHash,
      runtimeBehaviorContract: compiled.runtimeBehaviorContract,
      runtimeBehaviorCanonicalBytes: canonicalJsonStringify(compiled.runtimeBehaviorContract),
      planProductBuildReferenceMap: compiled.referenceMap,
      planProductBuildAuthority: compiled.authority,
      planProductBuildAuthorityCanonicalBytes: compiled.canonicalAuthorityBytes,
    };
  }
  const compiled = compilePlanSemanticProposalV2({
    task: input.task,
    proposal: decode(semantic[0]!, "V3_PLAN_V2_SEMANTIC_JSON_INVALID"),
    ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
  });
  if (compiled.status !== "canonicalized") {
    throw new V3PlanOutputV2RejectedError(
      "V3_PLAN_V2_SEMANTIC_PROPOSAL_INVALID",
      compiled.diagnostics.slice(0, 20),
    );
  }
  return {
    status: "proposal",
    productSpec: compiled.productSpec,
    canonicalBytes: compiled.canonicalBytes,
    sourceTaskHash: compiled.sourceTaskHash,
    deliverySelection: compiled.deliverySelection,
    deliverySelectionHash: compiled.deliverySelectionHash,
    deliverySelectionCanonicalBytes: compiled.deliverySelectionCanonicalBytes,
    persistenceProjectionEvidence: compiled.persistenceProjectionEvidence,
    sourceTransport: "semantic_proposal_v2",
    sourceProposalHash: compiled.semanticProposalHash,
  };
}

export function projectCanonicalV3PlanParsedOutputV2(input: Readonly<{
  parsed: ParsedOutput;
  authority: ProposalAuthorityV2;
}>): ParsedOutput & { prd: string } {
  const prd = prdText(input.parsed);
  let count = 0;
  const sourcePattern = input.authority.sourceTransport === "product_build_proposal_v1"
    ? PLAN_PRODUCT_BUILD_PROPOSAL_V1_BLOCK_RE
    : PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE;
  const canonicalPrd = prd.replace(sourcePattern, () => {
    count += 1;
    if (input.authority.sourceTransport === "semantic_proposal_v2") {
      return `\`\`\`product-spec-v2\n${input.authority.canonicalBytes}\n\`\`\``;
    }
    return [
      `\`\`\`product-spec-v2\n${input.authority.canonicalBytes}\n\`\`\``,
      `\`\`\`product-runtime-behavior-contract-v1\n${input.authority.runtimeBehaviorCanonicalBytes}\n\`\`\``,
      `\`\`\`plan-product-build-authority-v1\n${input.authority.planProductBuildAuthorityCanonicalBytes}\n\`\`\``,
    ].join("\n");
  });
  const incompatibleSourceCount = input.authority.sourceTransport === "product_build_proposal_v1"
    ? blocks(prd, PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE).length
    : blocks(prd, PLAN_PRODUCT_BUILD_PROPOSAL_V1_BLOCK_RE).length;
  if (
    count !== 1
    || incompatibleSourceCount !== 0
    || blocks(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE).length !== 0
    || blocks(prd, PLAN_RUNTIME_BEHAVIOR_PROPOSAL_V1_BLOCK_RE).length !== 0
    || blocks(prd, PRODUCT_SPEC_V2_BLOCK_RE).length !== 0
    || blocks(prd, PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_V1_BLOCK_RE).length !== 0
    || blocks(prd, PLAN_PRODUCT_BUILD_AUTHORITY_V1_BLOCK_RE).length !== 0
  ) {
    throw rejection(
      "V3_PLAN_V2_CANONICAL_PROJECTION_SOURCE_MISMATCH",
      "/prd",
      "Canonical v2 PLAN projection requires one unchanged source matching its compiled authority",
    );
  }
  return { ...input.parsed, prd: canonicalPrd };
}

export function shouldRunLegacyProductSupervisorV2(input: Readonly<{
  protocol: "legacy" | "shadow" | "v3";
  stepId: string;
  planAuthority?: V3PlanOutputAuthorityV2;
}>): boolean {
  return !(
    input.protocol === "v3"
    && input.stepId === "plan"
    && input.planAuthority?.status === "proposal"
  );
}
