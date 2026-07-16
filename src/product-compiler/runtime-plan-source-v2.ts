import { createHash } from "node:crypto";

import { canonicalJsonStringify } from "./canonical-json.js";
import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";

export type RuntimePlanSourceResultV2 =
  | Readonly<{
      status: "resolved";
      productSpec: ProductSpecV2;
      sourceHash: string;
      diagnostics: readonly CompilationDiagnosticV1[];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: readonly string[];
      diagnostics: readonly CompilationDiagnosticV1[];
    }>;

function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function reject(
  sourceHash: string,
  code: string,
  message: string,
): Extract<RuntimePlanSourceResultV2, { status: "rejected" }> {
  const diagnostic: CompilationDiagnosticV1 = {
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "source",
    severity: "error",
    message,
    artifactHash: sourceHash,
    provenance: [],
    suggestions: [],
  };
  return { status: "rejected", rejectionCodes: [code], diagnostics: [diagnostic] };
}

/**
 * Reads only the compiler-owned ProductSpec v2 projection. V1 is an immutable
 * legacy artifact and is deliberately not a source from which v2 authority can
 * be reconstructed.
 */
export function resolveCanonicalProductSpecV2FromPlan(input: Readonly<{
  text: string;
}>): RuntimePlanSourceResultV2 {
  const sourceHash = sha256(input.text);
  const v2Blocks = [...input.text.matchAll(/```product-spec-v2\s*\n([\s\S]*?)\n```/g)];
  const legacyBlocks = [...input.text.matchAll(/```product-spec-v1\s*\n([\s\S]*?)\n```/g)];
  if (legacyBlocks.length > 0) {
    return reject(
      sourceHash,
      "PLAN_PRODUCT_SPEC_V2_LEGACY_PROJECTION_FORBIDDEN",
      "ProductSpec v1 cannot be promoted to v2 because it lacks exact control placement and surface-composition authority",
    );
  }
  if (v2Blocks.length !== 1) {
    return reject(
      sourceHash,
      "PLAN_PRODUCT_SPEC_V2_PROJECTION_COUNT_INVALID",
      `PLAN v2 runtime source requires exactly one canonical product-spec-v2 projection; observed ${v2Blocks.length}`,
    );
  }
  const projection = v2Blocks[0]![1]!.trim();
  let decoded: unknown;
  try {
    decoded = JSON.parse(projection);
  } catch {
    return reject(
      sourceHash,
      "PLAN_PRODUCT_SPEC_V2_JSON_INVALID",
      "PLAN ProductSpec v2 projection is not valid JSON",
    );
  }
  const parsed = ProductSpecV2Schema.safeParse(decoded);
  if (!parsed.success) {
    return reject(
      sourceHash,
      "PLAN_PRODUCT_SPEC_V2_SCHEMA_INVALID",
      `PLAN ProductSpec v2 projection violates its schema: ${parsed.error.issues[0]?.message || "schema mismatch"}`,
    );
  }
  if (canonicalJsonStringify(parsed.data) !== projection) {
    return reject(
      sourceHash,
      "PLAN_PRODUCT_SPEC_V2_PROJECTION_NON_CANONICAL",
      "PLAN ProductSpec v2 projection bytes are not Setfarm Canonical JSON v1",
    );
  }
  return {
    status: "resolved",
    productSpec: parsed.data,
    sourceHash,
    diagnostics: [],
  };
}
