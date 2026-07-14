import { createHash } from "node:crypto";

import { adaptLegacyPlan } from "./adapters/legacy-plan.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import type { ProductSpecV1 } from "./schemas/product-spec-v1.js";
import { ProductSpecV3ProposalSchema } from "./schemas/product-spec-v1.js";

export type RuntimePlanSourceResult =
  | Readonly<{
      status: "resolved";
      productSpec: ProductSpecV1;
      sourceHash: string;
      diagnostics: CompilationDiagnosticV1[];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

function sourceHash(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function sourceDiagnostic(input: {
  code: string;
  message: string;
  sourceHash: string;
}): CompilationDiagnosticV1 {
  return {
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "source",
    severity: "error",
    message: input.message,
    artifactHash: input.sourceHash,
    provenance: [],
    suggestions: [],
  };
}

/**
 * Resolves only the one canonical ProductSpec projection emitted by PLAN v3.
 * Legacy prose remains a compatibility view and can never become a second
 * semantic interpretation path.
 */
export function resolveCanonicalProductSpecFromPlan(input: Readonly<{
  text: string;
  locator?: string;
  requireV3Proposal?: boolean;
}>): RuntimePlanSourceResult {
  const hash = sourceHash(input.text);
  const blocks = [...input.text.matchAll(/```product-spec-v1\s*\n([\s\S]*?)\n```/g)];
  if (blocks.length !== 1) {
    const diagnostic = sourceDiagnostic({
      code: "PLAN_PRODUCT_SPEC_PROJECTION_COUNT_INVALID",
      message: `PLAN v3 requires exactly one canonical product-spec-v1 projection; observed ${blocks.length}`,
      sourceHash: hash,
    });
    return { status: "rejected", rejectionCodes: [diagnostic.code], diagnostics: [diagnostic] };
  }
  const adapter = adaptLegacyPlan({
    source: {
      schema: "setfarm.source-artifact-ref.v1",
      hash,
      mediaType: "text/markdown",
      locator: input.locator ?? "pipeline/plan.md",
      byteLength: Buffer.byteLength(input.text, "utf8"),
    },
    text: input.text,
  });
  if (!adapter.candidate) {
    return {
      status: "rejected",
      rejectionCodes: [...new Set(adapter.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => item.code))].sort(),
      diagnostics: adapter.diagnostics,
    };
  }
  const projection = blocks[0]![1]!.trim();
  if (canonicalJsonStringify(adapter.candidate) !== projection) {
    const diagnostic = sourceDiagnostic({
      code: "PLAN_PRODUCT_SPEC_PROJECTION_NON_CANONICAL",
      message: "PLAN ProductSpec projection bytes are not Setfarm Canonical JSON v1",
      sourceHash: hash,
    });
    return { status: "rejected", rejectionCodes: [diagnostic.code], diagnostics: [diagnostic] };
  }
  if (input.requireV3Proposal) {
    const proposal = ProductSpecV3ProposalSchema.safeParse(adapter.candidate);
    if (!proposal.success) {
      const diagnostic = sourceDiagnostic({
        code: "PLAN_PRODUCT_SPEC_V3_CONTRACT_INCOMPLETE",
        message: `PLAN ProductSpec lacks the v3 requirement/observable contract: ${proposal.error.issues[0]?.message || "schema mismatch"}`,
        sourceHash: hash,
      });
      return { status: "rejected", rejectionCodes: [diagnostic.code], diagnostics: [diagnostic] };
    }
  }
  return {
    status: "resolved",
    productSpec: adapter.candidate,
    sourceHash: hash,
    diagnostics: adapter.diagnostics,
  };
}
