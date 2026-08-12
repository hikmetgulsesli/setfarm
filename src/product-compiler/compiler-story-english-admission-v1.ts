import { createHash } from "node:crypto";

import {
  compilerEnglishAdmissionLedgerDesignRequiredV1,
  inspectCompilerEnglishAdmissionLedgerAuthorityV1,
  type CompilerEnglishAdmissionLedgerAuthorityV1,
} from "../execution/compiler-english-admission-ledger-v1.js";
import {
  compileStoryPublicationRowsV1,
  type StoryPublicationRowV1,
} from "../installer/story-ops.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  CompilerStoryEnglishAdmissionReceiptV1Schema,
  type CompilerStoryEnglishAdmissionReceiptV1,
} from "./schemas/compiler-story-english-admission-receipt-v1.js";

const MAX_CANONICAL_PROJECTION_BYTES_V1 = 4_000_000;
const Sha256PatternV1 = /^[a-f0-9]{64}$/;

type CompilerStoryEnglishAdmissionStateV1 = Readonly<{
  receipt: CompilerStoryEnglishAdmissionReceiptV1;
  rows: readonly StoryPublicationRowV1[];
}>;

const stateByAuthorityV1 = new WeakMap<object, CompilerStoryEnglishAdmissionStateV1>();

export type CompilerStoryEnglishAdmissionAuthorityV1 = Readonly<{
  schema: "setfarm.compiler-story-english-admission-authority.v1";
  receiptHash: string;
}>;

const DesignSourceContextKeysV1 = [
  "design_source_attempt_id",
  "design_source_authority_hash",
  "design_source_request_hash",
  "design_source_output_seal_hash",
  "design_source_product_spec_hash",
  "design_source_generation_targets_hash",
] as const;

function exactRequiredContextValueV1(
  context: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = context[key];
  if (typeof value !== "string" || value.length < 1) {
    throw new Error(`COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_VALUE_INVALID:${key}`);
  }
  return value;
}

function exactSha256ContextValueV1(
  context: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = exactRequiredContextValueV1(context, key);
  if (!Sha256PatternV1.test(value)) {
    throw new Error(`COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_HASH_INVALID:${key}`);
  }
  return value;
}

export function compilerStoryEnglishAdmissionContextProjectionV1(
  context: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const productSemanticsVersion = exactRequiredContextValueV1(
    context,
    "product_semantics_version",
  );
  const productSpecSchema = exactRequiredContextValueV1(context, "product_spec_schema");
  const planEnglishAuthorityVersion = exactRequiredContextValueV1(
    context,
    "plan_english_authority_version",
  );
  const designRequiredText = exactRequiredContextValueV1(context, "design_required");
  if (productSemanticsVersion !== "v2"
    || productSpecSchema !== "setfarm.product-spec.v2"
    || planEnglishAuthorityVersion !== "compiler_english_surface_v1"
    || !["true", "false"].includes(designRequiredText)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_CONTRACT_INVALID");
  }
  const designRequired = designRequiredText === "true";
  const designValues = Object.fromEntries(DesignSourceContextKeysV1.map((key) => [
    key,
    context[key],
  ]));
  let designAuthority: Readonly<Record<string, unknown>>;
  if (!designRequired) {
    if (Object.values(designValues).some((value) => value !== undefined && value !== "")) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_UNEXPECTED_DESIGN_AUTHORITY");
    }
    designAuthority = Object.freeze({ disposition: "design_not_required" });
  } else {
    const attemptId = exactRequiredContextValueV1(context, "design_source_attempt_id");
    if (attemptId.length > 500) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_DESIGN_ATTEMPT_ID_INVALID");
    }
    designAuthority = Object.freeze({
      disposition: "accepted_design_source_attempt",
      attemptId,
      authorityHash: exactSha256ContextValueV1(context, "design_source_authority_hash"),
      requestHash: exactSha256ContextValueV1(context, "design_source_request_hash"),
      outputSealHash: exactSha256ContextValueV1(context, "design_source_output_seal_hash"),
      productSpecHash: exactSha256ContextValueV1(context, "design_source_product_spec_hash"),
      generationTargetsHash: exactSha256ContextValueV1(
        context,
        "design_source_generation_targets_hash",
      ),
    });
  }
  let screenMap: unknown;
  try {
    screenMap = JSON.parse(exactRequiredContextValueV1(context, "screen_map"));
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_SCREEN_MAP_INVALID");
  }
  if (!Array.isArray(screenMap)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_SCREEN_MAP_INVALID");
  }
  return Object.freeze({
    schema: "setfarm.compiler-story-english-admission-context-projection.v1",
    productSemanticsVersion: "v2",
    productSpecSchema: "setfarm.product-spec.v2",
    productSpecHash: exactSha256ContextValueV1(context, "product_spec_hash"),
    productSpecSourceTaskHash: exactSha256ContextValueV1(
      context,
      "product_spec_source_task_hash",
    ),
    planEnglishAuthorityVersion: "compiler_english_surface_v1",
    planEnglishAdmissionReceiptHash: exactSha256ContextValueV1(
      context,
      "plan_english_admission_receipt_hash",
    ),
    designRequired,
    designAuthority,
    screenMapHash: hashCanonicalJson(screenMap),
  });
}

export function compilerStoryEnglishAdmissionImmutableRowsV1(
  rows: readonly Pick<
    StoryPublicationRowV1,
    | "storyIndex"
    | "storyId"
    | "title"
    | "description"
    | "dependsOn"
    | "scopeTargets"
    | "requestedDependencies"
    | "sharedEditRequests"
    | "scopeDescription"
  >[],
): readonly Readonly<Record<string, number | string | null>>[] {
  return Object.freeze(rows.map((row) => Object.freeze({
    storyIndex: row.storyIndex,
    storyId: row.storyId,
    title: row.title,
    description: row.description,
    dependsOn: row.dependsOn,
    scopeTargets: row.scopeTargets,
    requestedDependencies: row.requestedDependencies,
    sharedEditRequests: row.sharedEditRequests,
    scopeDescription: row.scopeDescription,
  })));
}

function sha256TextV1(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function screenMapFromProjectionV1(projection: string): unknown {
  const lines = projection.split("\n");
  const candidates = lines.filter((line) => line.startsWith("SCREEN_MAP: "));
  if (candidates.length !== 1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_SCREEN_MAP_COUNT_INVALID");
  }
  let screenMap: unknown;
  try {
    screenMap = JSON.parse(candidates[0]!.slice("SCREEN_MAP: ".length));
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_SCREEN_MAP_INVALID");
  }
  if (!Array.isArray(screenMap)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_SCREEN_MAP_INVALID");
  }
  return screenMap;
}

export function compileCompilerStoryEnglishAdmissionV1(input: Readonly<{
  claimId: number;
  runId: string;
  stepDbId: string;
  workflowStepId: "stories";
  planAuthority: CompilerEnglishAdmissionLedgerAuthorityV1;
  designAuthoritySubjectHash: string;
  rawOutput: string;
  expectedOutput: string;
  finalContext: Readonly<Record<string, string>>;
}>): CompilerStoryEnglishAdmissionAuthorityV1 {
  if (Buffer.byteLength(input.rawOutput, "utf8") > MAX_CANONICAL_PROJECTION_BYTES_V1
    || input.rawOutput !== input.expectedOutput) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_PROJECTION_MISMATCH");
  }
  if (!Sha256PatternV1.test(input.designAuthoritySubjectHash)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_DESIGN_AUTHORITY_INVALID");
  }
  const parent = inspectCompilerEnglishAdmissionLedgerAuthorityV1(input.planAuthority);
  const designRequired = compilerEnglishAdmissionLedgerDesignRequiredV1(input.planAuthority);
  if (parent.runId !== input.runId
    || input.finalContext["product_spec_schema"] !== parent.productSpecSchema
    || input.finalContext["product_spec_hash"] !== parent.productSpecHash
    || input.finalContext["product_spec_source_task_hash"] !== parent.sourceTaskHash
    || input.finalContext["plan_english_authority_version"] !== parent.authorityVersion
    || input.finalContext["plan_english_admission_receipt_hash"] !== input.planAuthority.receiptHash
    || input.finalContext["design_required"] !== String(designRequired)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_PLAN_BINDING_INVALID");
  }

  const rows = compileStoryPublicationRowsV1(input.rawOutput);
  if (rows.length < 1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_STORY_SET_EMPTY");
  }
  const screenMap = screenMapFromProjectionV1(input.rawOutput);
  let contextScreenMap: unknown;
  try {
    contextScreenMap = JSON.parse(input.finalContext["screen_map"] ?? "");
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_SCREEN_MAP_INVALID");
  }
  const canonicalProjectionHash = sha256TextV1(input.rawOutput);
  const orderedStoryRowsHash = hashCanonicalJson(rows);
  const screenMapHash = hashCanonicalJson(screenMap);
  if (hashCanonicalJson(contextScreenMap) !== screenMapHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CONTEXT_SCREEN_MAP_MISMATCH");
  }
  const admissionContextHash = hashCanonicalJson(
    compilerStoryEnglishAdmissionContextProjectionV1(input.finalContext),
  );
  const subjectHash = hashCanonicalJson({
    parentPlanReceiptHash: input.planAuthority.receiptHash,
    sourceTaskHash: parent.sourceTaskHash,
    productSpecHash: parent.productSpecHash,
    setupIdentityHash: parent.setupIdentityHash,
    designAuthoritySubjectHash: input.designAuthoritySubjectHash,
    admissionContextHash,
    canonicalProjectionHash,
    orderedStoryRowsHash,
    screenMapHash,
    storyCount: rows.length,
  });
  const receipt = Object.freeze(CompilerStoryEnglishAdmissionReceiptV1Schema.parse({
    schema: "setfarm.compiler-story-english-admission-receipt.v1",
    authorityVersion: "compiler_story_english_surface_v1",
    admissionScope: "compiler_owned_story_publication_surface",
    productionAuthority: false,
    claimId: input.claimId,
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    parentPlanReceiptHash: input.planAuthority.receiptHash,
    sourceTaskHash: parent.sourceTaskHash,
    productSpecHash: parent.productSpecHash,
    setupIdentityHash: parent.setupIdentityHash,
    designAuthoritySubjectHash: input.designAuthoritySubjectHash,
    admissionContextHash,
    canonicalProjectionHash,
    orderedStoryRowsHash,
    screenMapHash,
    storyCount: rows.length,
    subjectHash,
  }));
  const authority = Object.freeze({
    schema: "setfarm.compiler-story-english-admission-authority.v1" as const,
    receiptHash: hashCanonicalJson(receipt),
  });
  stateByAuthorityV1.set(authority, Object.freeze({ receipt, rows }));
  return authority;
}

export function compilerStoryEnglishAdmissionStateV1(
  authority: CompilerStoryEnglishAdmissionAuthorityV1,
): CompilerStoryEnglishAdmissionStateV1 {
  const state = authority && typeof authority === "object"
    ? stateByAuthorityV1.get(authority)
    : undefined;
  if (!state) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_AUTHORITY_UNAUTHENTICATED");
  }
  return state;
}
