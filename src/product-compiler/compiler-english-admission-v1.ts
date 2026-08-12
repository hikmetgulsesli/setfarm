import { createHash } from "node:crypto";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  CompilerEnglishAdmissionReceiptV1Schema,
  type CompilerEnglishAdmissionReceiptV1,
} from "./schemas/compiler-english-admission-receipt-v1.js";
import { ProductSpecV1EnglishWriteSchema } from "./schemas/product-spec-v1.js";
import { ProductSpecV2EnglishWriteSchema } from "./schemas/product-spec-v2.js";
import { renderLegacyPrd } from "./renderers/legacy-prd.js";
import { renderProductSpecV2Compatibility } from "./renderers/product-spec-v2-compatibility.js";

const MAX_PRD_CODE_UNITS_V1 = 4_000_000;
const receiptByAuthorityV1 = new WeakMap<object, CompilerEnglishAdmissionReceiptV1>();

export type CompilerEnglishAdmissionAuthorityV1 = Readonly<{
  schema: "setfarm.compiler-english-admission-authority.v1";
  receiptHash: string;
}>;

function boundedContextValueV1(
  context: Readonly<Record<string, string>>,
  key: string,
  maximumCodeUnits: number,
): string {
  const value = context[key];
  if (typeof value !== "string" || value.length < 1 || value.length > maximumCodeUnits) {
    throw new Error(`COMPILER_ENGLISH_ADMISSION_CONTEXT_INVALID:${key}`);
  }
  return value;
}

function sha256TextV1(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function compileCompilerEnglishAdmissionV1(input: Readonly<{
  claimId: number;
  runId: string;
  stepDbId: string;
  workflowStepId: "plan";
  productSpec: unknown;
  finalContext: Readonly<Record<string, string>>;
}>): CompilerEnglishAdmissionAuthorityV1 {
  let candidateSchema: unknown;
  if (input.productSpec && typeof input.productSpec === "object") {
    const prototype = Object.getPrototypeOf(input.productSpec) as object | null;
    const descriptor = Object.getOwnPropertyDescriptor(input.productSpec, "schema");
    if ((prototype !== Object.prototype && prototype !== null)
      || !descriptor
      || !("value" in descriptor)) {
      throw new Error("COMPILER_ENGLISH_ADMISSION_PRODUCT_SPEC_OBJECT_INVALID");
    }
    candidateSchema = descriptor.value;
  }
  const productSpec = candidateSchema === "setfarm.product-spec.v2"
    ? ProductSpecV2EnglishWriteSchema.parse(input.productSpec)
    : ProductSpecV1EnglishWriteSchema.parse(input.productSpec);
  if (!productSpec.delivery || !productSpec.traceability) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_PRODUCT_SPEC_INCOMPLETE");
  }

  const renderedPrd = productSpec.schema === "setfarm.product-spec.v2"
    ? renderProductSpecV2Compatibility(productSpec)
    : renderLegacyPrd(productSpec);
  const prdBodyMarker = "\nPRD:\n";
  const prdBodyIndex = renderedPrd.indexOf(prdBodyMarker);
  if (prdBodyIndex < 0) throw new Error("COMPILER_ENGLISH_ADMISSION_PRD_PROJECTION_INVALID");
  const expectedPrd = renderedPrd.slice(prdBodyIndex + prdBodyMarker.length);

  const productSpecHash = hashCanonicalJson(productSpec);
  const sourceTaskHash = productSpec.traceability.sourceTaskHash;
  if (boundedContextValueV1(input.finalContext, "product_spec_schema", 100) !== productSpec.schema
    || boundedContextValueV1(input.finalContext, "product_spec_hash", 64) !== productSpecHash
    || boundedContextValueV1(input.finalContext, "product_spec_source_task_hash", 64) !== sourceTaskHash
    || boundedContextValueV1(input.finalContext, "ui_language", 20) !== "English"
    || boundedContextValueV1(input.finalContext, "project_name", 500) !== productSpec.product.name
    || boundedContextValueV1(input.finalContext, "project_display_name", 500) !== productSpec.product.name
    || boundedContextValueV1(input.finalContext, "app_title", 500) !== productSpec.product.name
    || boundedContextValueV1(input.finalContext, "ui_vision_summary", 4_000)
      !== productSpec.delivery.uiVisionSummary) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_CONTEXT_BINDING_INVALID");
  }

  const prd = boundedContextValueV1(input.finalContext, "prd", MAX_PRD_CODE_UNITS_V1);
  if (prd !== expectedPrd) throw new Error("COMPILER_ENGLISH_ADMISSION_PRD_BINDING_INVALID");
  const setupIdentity = Object.freeze({
    projectName: boundedContextValueV1(input.finalContext, "project_name", 500),
    projectDisplayName: boundedContextValueV1(input.finalContext, "project_display_name", 500),
    projectSlug: boundedContextValueV1(input.finalContext, "project_slug", 500),
    appTitle: boundedContextValueV1(input.finalContext, "app_title", 500),
  });
  const prdHash = sha256TextV1(prd);
  const setupIdentityHash = hashCanonicalJson(setupIdentity);
  const subjectHash = hashCanonicalJson({
    productSpecSchema: productSpec.schema,
    sourceTaskHash,
    productSpecHash,
    prdHash,
    setupIdentityHash,
  });
  const receipt = Object.freeze(CompilerEnglishAdmissionReceiptV1Schema.parse({
    schema: "setfarm.compiler-english-admission-receipt.v1",
    authorityVersion: "compiler_english_surface_v1",
    admissionScope: "compiler_owned_english_publication_surface",
    productionAuthority: false,
    claimId: input.claimId,
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    productSpecSchema: productSpec.schema,
    sourceTaskHash,
    productSpecHash,
    prdHash,
    setupIdentityHash,
    subjectHash,
  }));
  const authority = Object.freeze({
    schema: "setfarm.compiler-english-admission-authority.v1" as const,
    receiptHash: hashCanonicalJson(receipt),
  });
  receiptByAuthorityV1.set(authority, receipt);
  return authority;
}

export function compilerEnglishAdmissionReceiptV1(
  authority: CompilerEnglishAdmissionAuthorityV1,
): CompilerEnglishAdmissionReceiptV1 {
  const receipt = authority && typeof authority === "object"
    ? receiptByAuthorityV1.get(authority)
    : undefined;
  if (!receipt) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_AUTHORITY_UNAUTHENTICATED");
  }
  return receipt;
}
