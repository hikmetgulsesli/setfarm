import type { ParsedOutput } from "../installer/steps/types.js";
import {
  ProductSpecRejectionV1Schema,
  canonicalizeProductSpecRejectionV1,
  canonicalizeProductSpecV3Proposal,
  type ProductSpecProposalDiagnosticV1,
  type ProductSpecRejectionV1,
} from "../product-compiler/producers/plan-product-spec-proposal.js";
import type { ProductSpecV3Proposal } from "../product-compiler/schemas/product-spec-v1.js";
import type {
  CompilerOwnedPersistenceProjectionEvidenceV1,
} from "../product-compiler/producers/compiler-owned-persistence-projection.js";
import {
  resolveProductDeliverySelectionV1,
  type ProductDeliverySelectionV1,
} from "../product-compiler/product-delivery-profile-catalog.js";

const PRODUCT_SPEC_BLOCK_RE = /```product-spec-v1\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_REJECTION_BLOCK_RE = /```product-spec-rejection-v1\s*\n([\s\S]*?)\n```/g;

export type V3PlanOutputAuthorityV1 =
  | Readonly<{
      status: "proposal";
      productSpec: ProductSpecV3Proposal;
      canonicalBytes: string;
      sourceTaskHash: string;
      deliverySelection: ProductDeliverySelectionV1;
      deliverySelectionHash: string;
      deliverySelectionCanonicalBytes: string;
      persistenceProjectionEvidence: CompilerOwnedPersistenceProjectionEvidenceV1;
    }>
  | Readonly<{
      status: "rejection";
      rejection: ProductSpecRejectionV1;
    }>;

type V3PlanProposalAuthorityV1 = Extract<
  V3PlanOutputAuthorityV1,
  Readonly<{ status: "proposal" }>
>;

export class V3PlanOutputRejectedError extends Error {
  readonly diagnostics: readonly ProductSpecProposalDiagnosticV1[];

  constructor(code: string, diagnostics: readonly ProductSpecProposalDiagnosticV1[]) {
    super(code);
    this.name = "V3PlanOutputRejectedError";
    this.diagnostics = diagnostics.map((diagnostic) => ({ ...diagnostic }));
  }
}

function rejection(
  code: string,
  path: string,
  message: string,
): V3PlanOutputRejectedError {
  return new V3PlanOutputRejectedError(code, [{ code, path, message }]);
}

function exactBlock(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]!);
}

function decodedBlock(raw: string, code: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw rejection(code, "", "PLAN typed artifact is not valid JSON");
  }
}

/**
 * Replace the sole planner proposal fence with the exact compiler-owned bytes
 * before the compatibility PLAN module validates or renders it. The caller's
 * parsed output is not mutated, and surrounding planner prose stays inert.
 */
export function projectCanonicalV3PlanParsedOutputV1(input: Readonly<{
  parsed: ParsedOutput;
  authority: V3PlanProposalAuthorityV1;
}>): ParsedOutput & { prd: string } {
  const prd = String(input.parsed.prd || "");
  let proposalCount = 0;
  const canonicalPrd = prd.replace(PRODUCT_SPEC_BLOCK_RE, () => {
    proposalCount += 1;
    return `\`\`\`product-spec-v1\n${input.authority.canonicalBytes}\n\`\`\``;
  });
  const rejectionCount = exactBlock(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE).length;
  if (proposalCount !== 1 || rejectionCount !== 0) {
    throw rejection(
      "V3_PLAN_CANONICAL_PROJECTION_SOURCE_MISMATCH",
      "/prd",
      `Canonical PLAN projection requires one unchanged proposal fence; observed ${proposalCount} proposal(s) and ${rejectionCount} rejection(s)`,
    );
  }
  return { ...input.parsed, prd: canonicalPrd };
}

/**
 * Resolve the sole typed PLAN v3 authority before legacy normalization,
 * supervisor prose classifiers, or generic retry handling can observe it.
 */
export function resolveV3PlanOutputAuthorityV1(input: Readonly<{
  task: string;
  parsed: ParsedOutput;
  requestedStackPackId?: string;
}>): V3PlanOutputAuthorityV1 {
  const prd = String(input.parsed.prd || "");
  const proposals = exactBlock(prd, PRODUCT_SPEC_BLOCK_RE);
  const rejections = exactBlock(prd, PRODUCT_SPEC_REJECTION_BLOCK_RE);
  if (proposals.length + rejections.length !== 1) {
    const code = `V3_PLAN_TYPED_PRODUCT_SPEC_REQUIRED:${proposals.length}:${rejections.length}`;
    throw rejection(
      code,
      "/prd",
      `PLAN must emit exactly one typed ProductSpec or rejection fence; observed ${proposals.length} proposal(s) and ${rejections.length} rejection(s)`,
    );
  }

  if (rejections.length === 1) {
    const structurallyValid = ProductSpecRejectionV1Schema.parse(decodedBlock(
      rejections[0]!,
      "V3_PLAN_PRODUCT_SPEC_REJECTION_JSON_INVALID",
    ));
    return {
      status: "rejection",
      rejection: canonicalizeProductSpecRejectionV1({
        task: input.task,
        rejection: structurallyValid,
      }),
    };
  }

  const proposed = decodedBlock(proposals[0]!, "V3_PLAN_PRODUCT_SPEC_PROPOSAL_JSON_INVALID");
  const semantic = canonicalizeProductSpecV3Proposal({
    task: input.task,
    proposal: proposed,
  });
  if (semantic.status !== "canonicalized") {
    throw new V3PlanOutputRejectedError(
      "V3_PLAN_PRODUCT_SPEC_PROPOSAL_INVALID",
      semantic.diagnostics.slice(0, 20),
    );
  }
  const delivery = resolveProductDeliverySelectionV1({
    productClass: semantic.productSpec.product.class,
    ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
  });
  if (delivery.status !== "selected") {
    throw new V3PlanOutputRejectedError(
      "V3_PLAN_PRODUCT_DELIVERY_PROFILE_REJECTED",
      delivery.diagnostics.slice(0, 20),
    );
  }
  const canonical = canonicalizeProductSpecV3Proposal({
    task: input.task,
    proposal: semantic.productSpec,
    authoritativeDelivery: {
      platform: delivery.selection.delivery.platform,
      techStack: delivery.selection.delivery.techStack,
      designRequired: delivery.selection.delivery.designRequired,
      allowedDatabases: delivery.selection.delivery.allowedDatabases,
      stackPackId: delivery.selection.stackPackId,
      evidenceCapabilityPolicyHash: delivery.selection.evidenceCapabilities.policyHash,
    },
  });
  if (canonical.status !== "canonicalized") {
    throw new V3PlanOutputRejectedError(
      "V3_PLAN_PRODUCT_DELIVERY_MISMATCH",
      canonical.diagnostics.slice(0, 20),
    );
  }
  return {
    status: "proposal",
    productSpec: canonical.productSpec,
    canonicalBytes: canonical.canonicalBytes,
    sourceTaskHash: canonical.sourceTaskHash,
    deliverySelection: delivery.selection,
    deliverySelectionHash: delivery.selectionHash,
    deliverySelectionCanonicalBytes: delivery.canonicalBytes,
    persistenceProjectionEvidence: canonical.persistenceProjectionEvidence,
  };
}

/** Legacy supervisor remains enabled everywhere except an accepted typed PLAN v3 proposal. */
export function shouldRunLegacyProductSupervisorV1(input: Readonly<{
  protocol: "legacy" | "shadow" | "v3";
  stepId: string;
  planAuthority?: V3PlanOutputAuthorityV1;
}>): boolean {
  return !(
    input.protocol === "v3"
    && input.stepId === "plan"
    && input.planAuthority?.status === "proposal"
  );
}
