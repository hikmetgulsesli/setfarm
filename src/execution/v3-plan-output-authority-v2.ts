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
import type { ProductDeliverySelectionV1 } from "../product-compiler/product-delivery-profile-catalog.js";
import type { CompilerOwnedPersistenceProjectionEvidenceV1 } from "../product-compiler/producers/compiler-owned-persistence-projection.js";
import type { ProductSpecV2 } from "../product-compiler/schemas/product-spec-v2.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../product-compiler/bounded-canonical-json.js";
import { PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES } from "../product-compiler/producers/plan-semantic-proposal-v2.js";

const PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE = /```plan-semantic-proposal-v2\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_V2_BLOCK_RE = /```product-spec-v2\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_REJECTION_BLOCK_RE = /```product-spec-rejection-v1\s*\n([\s\S]*?)\n```/g;
const LEGACY_TYPED_BLOCK_RE = /```(?:plan-semantic-proposal-v1|product-spec-v1)\s*\n([\s\S]*?)\n```/g;
export const PLAN_V2_PRD_MAX_BYTES = 4 * 1024 * 1024;

export type V3PlanOutputAuthorityV2 =
  | Readonly<{
      status: "proposal";
      productSpec: ProductSpecV2;
      canonicalBytes: string;
      sourceTaskHash: string;
      deliverySelection: ProductDeliverySelectionV1;
      deliverySelectionHash: string;
      deliverySelectionCanonicalBytes: string;
      persistenceProjectionEvidence: CompilerOwnedPersistenceProjectionEvidenceV1;
      sourceTransport: "semantic_proposal_v2";
      sourceProposalHash: string;
    }>
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

/** New runs accept primary v2 semantics only; no lossy v1 upgrade exists. */
export function resolveV3PlanOutputAuthorityV2(input: Readonly<{
  task: string;
  parsed: ParsedOutput;
  requestedStackPackId?: string;
}>): V3PlanOutputAuthorityV2 {
  const prd = prdText(input.parsed);
  const semantic = blocks(prd, PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE);
  const rejections = blocks(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE);
  const projected = blocks(prd, PRODUCT_SPEC_V2_BLOCK_RE);
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
      "The planner must submit primary plan-semantic-proposal-v2, not compiler-owned ProductSpec bytes",
    );
  }
  if (semantic.length + rejections.length !== 1) {
    throw rejection(
      `V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:${semantic.length}:${rejections.length}`,
      "/prd",
      `PLAN must emit exactly one v2 semantic proposal or typed rejection; observed ${semantic.length} proposal(s) and ${rejections.length} rejection(s)`,
    );
  }
  if (rejections.length === 1) {
    const parsed = ProductSpecRejectionV1Schema.parse(boundedParsedSnapshot(
      decode(rejections[0]!, "V3_PLAN_V2_REJECTION_JSON_INVALID"),
      "V3_PLAN_V2_REJECTION_INPUT_INVALID",
    ));
    return {
      status: "rejection",
      rejection: canonicalizeProductSpecRejectionV1({ task: input.task, rejection: parsed }),
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
  const canonicalPrd = prd.replace(PLAN_SEMANTIC_PROPOSAL_V2_BLOCK_RE, () => {
    count += 1;
    return `\`\`\`product-spec-v2\n${input.authority.canonicalBytes}\n\`\`\``;
  });
  if (count !== 1 || blocks(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE).length !== 0) {
    throw rejection(
      "V3_PLAN_V2_CANONICAL_PROJECTION_SOURCE_MISMATCH",
      "/prd",
      "Canonical v2 PLAN projection requires one unchanged semantic proposal source",
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
