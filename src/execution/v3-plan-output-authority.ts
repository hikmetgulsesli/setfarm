import type { ParsedOutput } from "../installer/steps/types.js";
import {
  ProductSpecRejectionV1Schema,
  canonicalizeProductSpecRejectionV1,
  canonicalizeProductSpecV3Proposal,
  type ProductSpecProposalDiagnosticV1,
  type ProductSpecRejectionV1,
} from "../product-compiler/producers/plan-product-spec-proposal.js";
import type { ProductSpecV3Proposal } from "../product-compiler/schemas/product-spec-v1.js";

const PRODUCT_SPEC_BLOCK_RE = /```product-spec-v1\s*\n([\s\S]*?)\n```/g;
const PRODUCT_SPEC_REJECTION_BLOCK_RE = /```product-spec-rejection-v1\s*\n([\s\S]*?)\n```/g;

export type V3PlanOutputAuthorityV1 =
  | Readonly<{
      status: "proposal";
      productSpec: ProductSpecV3Proposal;
      canonicalBytes: string;
      sourceTaskHash: string;
    }>
  | Readonly<{
      status: "rejection";
      rejection: ProductSpecRejectionV1;
    }>;

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
 * Resolve the sole typed PLAN v3 authority before legacy normalization,
 * supervisor prose classifiers, or generic retry handling can observe it.
 */
export function resolveV3PlanOutputAuthorityV1(input: Readonly<{
  task: string;
  parsed: ParsedOutput;
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

  const canonical = canonicalizeProductSpecV3Proposal({
    task: input.task,
    proposal: decodedBlock(proposals[0]!, "V3_PLAN_PRODUCT_SPEC_PROPOSAL_JSON_INVALID"),
  });
  if (canonical.status !== "canonicalized") {
    throw new V3PlanOutputRejectedError(
      "V3_PLAN_PRODUCT_SPEC_PROPOSAL_INVALID",
      canonical.diagnostics.slice(0, 20),
    );
  }
  return {
    status: "proposal",
    productSpec: canonical.productSpec,
    canonicalBytes: canonical.canonicalBytes,
    sourceTaskHash: canonical.sourceTaskHash,
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
