import { z } from "zod";

import { canonicalJsonStringify } from "../canonical-json.js";
import {
  ProductSpecV1Schema,
  ProductSpecV3ProposalSchema,
  type ProductSpecV1,
  type ProductSpecV3Proposal,
} from "../schemas/product-spec-v1.js";
import {
  extractTaskRequirementLedgerV1,
} from "../requirements/task-requirements-v1.js";
import { RequirementIdSchema, hasUniqueStrings } from "../schemas/common-v1.js";
import {
  compileProductEvidenceCapabilitiesV1,
} from "../product-evidence-capability-policy.js";

const RejectionCodeSchema = z.enum([
  "PRODUCT_SPEC_TASK_AMBIGUOUS",
  "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
  "PRODUCT_SPEC_REQUIREMENT_CONFLICT",
  "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
]);

export const ProductSpecRejectionV1Schema = z.object({
  schema: z.literal("setfarm.product-spec-rejection.v1"),
  sourceTaskHash: z.string().regex(/^[a-f0-9]{64}$/),
  reasons: z.array(z.object({
    code: RejectionCodeSchema,
    requirementRefs: z.array(RequirementIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "ProductSpec rejection requirement refs must be unique",
    }),
    message: z.string().min(1).max(4_000),
  }).strict()).min(1).max(100),
}).strict();

export type ProductSpecRejectionV1 = z.infer<typeof ProductSpecRejectionV1Schema>;

export type ProductSpecProposalDiagnosticV1 = Readonly<{
  code: string;
  path: string;
  message: string;
  reference?: string;
}>;

export type CanonicalProductSpecProposalResultV1 =
  | Readonly<{
      status: "canonicalized";
      productSpec: ProductSpecV3Proposal;
      canonicalBytes: string;
      sourceTaskHash: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductSpecProposalDiagnosticV1[];
    }>;

function diagnostic(
  code: string,
  path: string,
  message: string,
  reference?: string,
): ProductSpecProposalDiagnosticV1 {
  return { code, path, message, ...(reference ? { reference } : {}) };
}

function schemaDiagnostics(error: z.ZodError): ProductSpecProposalDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic(
    "PRODUCT_SPEC_PROPOSAL_SCHEMA_INVALID",
    issue.path.length > 0 ? `/${issue.path.join("/")}` : "",
    issue.message,
  ));
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withoutPlannerCapabilityRefs(proposal: unknown): unknown {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return proposal;
  const value = proposal as Record<string, unknown>;
  if (!Array.isArray(value["evidencePredicates"])) return proposal;
  return {
    ...value,
    evidencePredicates: value["evidencePredicates"].map((predicate) =>
      predicate && typeof predicate === "object" && !Array.isArray(predicate)
        ? { ...(predicate as Record<string, unknown>), capabilityRefs: [] }
        : predicate),
  };
}

/**
 * Setfarm owns source clauses and canonical bytes. The planner owns semantic
 * classification and bindings, but cannot alter, omit, or invent task clauses.
 */
export function canonicalizeProductSpecV3Proposal(input: Readonly<{
  task: string;
  proposal: unknown;
  authoritativeDelivery?: Readonly<{
    platform: string;
    techStack: string;
    designRequired?: boolean;
    allowedDatabases?: readonly string[];
    stackPackId?: string;
    evidenceCapabilityPolicyHash?: string;
  }>;
}>): CanonicalProductSpecProposalResultV1 {
  let ledger;
  try {
    ledger = extractTaskRequirementLedgerV1(input.task);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_SPEC_REQUIREMENT_SOURCE_INVALID",
        "/requirements",
        error instanceof Error ? error.message : String(error),
      )],
    };
  }

  const base = ProductSpecV1Schema.safeParse(withoutPlannerCapabilityRefs(input.proposal));
  if (!base.success) {
    return { status: "rejected", diagnostics: schemaDiagnostics(base.error) };
  }
  if (!base.data.delivery || !base.data.requirements || !base.data.traceability) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_SPEC_PROPOSAL_TRACEABILITY_REQUIRED",
        "/traceability",
        "V3 ProductSpec must declare delivery, exact task requirements, and semantic traceability",
      )],
    };
  }

  const diagnostics: ProductSpecProposalDiagnosticV1[] = [];
  const proposedById = new Map(base.data.requirements.map((requirement) => [requirement.id, requirement]));
  const expectedIds = new Set(ledger.requirements.map((requirement) => requirement.id));
  if (proposedById.size !== base.data.requirements.length) {
    diagnostics.push(diagnostic(
      "PRODUCT_SPEC_REQUIREMENT_ID_DUPLICATE",
      "/requirements",
      "Planner proposal repeats a task requirement ID",
    ));
  }
  ledger.requirements.forEach((expected, index) => {
    const proposed = proposedById.get(expected.id);
    if (!proposed) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_REQUIREMENT_MISSING",
        `/requirements/${index}`,
        `Planner proposal omitted exact task clause ${expected.id}`,
      ));
      return;
    }
    const proposedSource = {
      id: proposed.id,
      normalizedClause: proposed.normalizedClause,
      clauseHash: proposed.clauseHash,
      sources: proposed.sources,
    };
    if (canonicalJsonStringify(proposedSource) !== canonicalJsonStringify(expected)) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_REQUIREMENT_SOURCE_MISMATCH",
        `/requirements/${index}`,
        `Planner proposal changed source-owned clause bytes for ${expected.id}`,
      ));
    }
  });
  base.data.requirements.forEach((requirement, index) => {
    if (!expectedIds.has(requirement.id)) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_REQUIREMENT_INVENTED",
        `/requirements/${index}`,
        `Planner proposal invented requirement ${requirement.id}`,
      ));
    }
  });
  if (base.data.traceability.sourceTaskHash !== ledger.sourceHash) {
    diagnostics.push(diagnostic(
      "PRODUCT_SPEC_TASK_HASH_MISMATCH",
      "/traceability/sourceTaskHash",
      "Planner proposal does not bind the exact task source hash",
    ));
  }
  if (input.authoritativeDelivery) {
    if (base.data.delivery.platform !== input.authoritativeDelivery.platform) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_DELIVERY_PLATFORM_MISMATCH",
        "/delivery/platform",
        `Planner platform ${base.data.delivery.platform} conflicts with authoritative stack platform ${input.authoritativeDelivery.platform}`,
      ));
    }
    if (base.data.delivery.techStack !== input.authoritativeDelivery.techStack) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_DELIVERY_STACK_MISMATCH",
        "/delivery/techStack",
        `Planner stack ${base.data.delivery.techStack} conflicts with authoritative stack ${input.authoritativeDelivery.techStack}`,
      ));
    }
    if (
      input.authoritativeDelivery.designRequired !== undefined
      && base.data.delivery.designRequired !== input.authoritativeDelivery.designRequired
    ) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_DELIVERY_DESIGN_POLICY_MISMATCH",
        "/delivery/designRequired",
        `Planner designRequired=${base.data.delivery.designRequired} conflicts with authoritative profile designRequired=${input.authoritativeDelivery.designRequired}`,
      ));
    }
    if (
      input.authoritativeDelivery.allowedDatabases
      && !input.authoritativeDelivery.allowedDatabases.includes(base.data.delivery.database)
    ) {
      diagnostics.push(diagnostic(
        "PRODUCT_SPEC_DELIVERY_DATABASE_UNSUPPORTED",
        "/delivery/database",
        `Planner database ${base.data.delivery.database} is not activated by the authoritative delivery profile`,
      ));
    }
  }
  if (diagnostics.length > 0) return { status: "rejected", diagnostics };

  const requirements = ledger.requirements.map((source) => {
    const semantic = proposedById.get(source.id)!;
    return {
      ...source,
      classification: semantic.classification,
      expectedSemanticKinds: [...semantic.expectedSemanticKinds].sort(compareUtf16),
    };
  });
  const bindings = base.data.traceability.bindings.map((binding) => ({
    ...binding,
    requirementRefs: [...binding.requirementRefs].sort(compareUtf16),
  })).sort((left, right) => compareUtf16(
    `${left.semanticKind}\0${left.semanticRef}`,
    `${right.semanticKind}\0${right.semanticRef}`,
  ));
  let canonicalCandidate: ProductSpecV1 = ProductSpecV1Schema.parse({
    ...base.data,
    requirements,
    traceability: {
      schema: "setfarm.product-requirement-traceability.v1" as const,
      sourceTaskHash: ledger.sourceHash,
      bindings,
    },
  });
  if (input.authoritativeDelivery?.stackPackId) {
    const compiled = compileProductEvidenceCapabilitiesV1({
      productSpec: ProductSpecV1Schema.parse(canonicalCandidate),
      stackPackId: input.authoritativeDelivery.stackPackId,
    });
    if (compiled.status === "rejected") {
      return {
        status: "rejected",
        diagnostics: compiled.diagnostics.map((item) =>
          diagnostic(item.code, item.path, item.message, item.reference)),
      };
    }
    if (
      input.authoritativeDelivery.evidenceCapabilityPolicyHash
      && compiled.policyHash !== input.authoritativeDelivery.evidenceCapabilityPolicyHash
    ) {
      return {
        status: "rejected",
        diagnostics: [diagnostic(
          "PRODUCT_SPEC_EVIDENCE_CAPABILITY_POLICY_MISMATCH",
          "/evidencePredicates",
          "Selected delivery profile does not bind the active evidence capability policy",
        )],
      };
    }
    canonicalCandidate = compiled.productSpec;
  }
  const parsed = ProductSpecV3ProposalSchema.safeParse(canonicalCandidate);
  if (!parsed.success) {
    return { status: "rejected", diagnostics: schemaDiagnostics(parsed.error) };
  }
  const canonicalBytes = canonicalJsonStringify(parsed.data);
  return {
    status: "canonicalized",
    productSpec: parsed.data,
    canonicalBytes,
    sourceTaskHash: ledger.sourceHash,
  };
}

export function canonicalizeProductSpecRejectionV1(input: Readonly<{
  task: string;
  rejection: unknown;
}>): ProductSpecRejectionV1 {
  const ledger = extractTaskRequirementLedgerV1(input.task);
  const parsed = ProductSpecRejectionV1Schema.parse(input.rejection);
  if (parsed.sourceTaskHash !== ledger.sourceHash) {
    throw new Error("PRODUCT_SPEC_REJECTION_TASK_HASH_MISMATCH");
  }
  const requirementIds = new Set(ledger.requirements.map((requirement) => requirement.id));
  parsed.reasons.forEach((reason) => {
    reason.requirementRefs.forEach((reference) => {
      if (!requirementIds.has(reference)) {
        throw new Error(`PRODUCT_SPEC_REJECTION_REQUIREMENT_UNKNOWN:${reference}`);
      }
    });
  });
  return ProductSpecRejectionV1Schema.parse({
    ...parsed,
    reasons: parsed.reasons.map((reason) => ({
      ...reason,
      requirementRefs: [...reason.requirementRefs].sort(compareUtf16),
    })).sort((left, right) => compareUtf16(
      `${left.code}\0${left.requirementRefs.join(",")}\0${left.message}`,
      `${right.code}\0${right.requirementRefs.join(",")}\0${right.message}`,
    )),
  });
}
