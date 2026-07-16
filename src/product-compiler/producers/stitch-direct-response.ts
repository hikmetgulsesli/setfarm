import { canonicalJsonStringify } from "../canonical-json.js";
import {
  StitchDirectBatchEvidenceV2Schema,
  StitchDirectScreenEvidenceV2Schema,
  type StitchDirectBatchEvidenceV2,
} from "../schemas/stitch-direct-response-evidence-v2.js";
import {
  StitchBatchResponseV2Schema,
  type StitchBatchResponseV2,
} from "../schemas/stitch-target-candidate-selection-v1.js";

export type DecodedStitchDirectBatchV2 =
  | Readonly<{
      status: "decoded";
      batch: StitchBatchResponseV2;
      evidenceBatch: StitchDirectBatchEvidenceV2;
    }>
  | Readonly<{
      status: "rejected";
      code:
        | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID"
        | "DESIGN_V3_RESPONSE_SOURCE_INVALID"
        | "DESIGN_V3_RENDERABLE_SCREEN_MISSING"
        | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH";
      diagnostic: string;
      evidenceBatch?: StitchDirectBatchEvidenceV2;
    }>;

function compareScreens(items: Array<{ screenId: string; title: string }>) {
  return [...items].sort((left, right) => {
    if (left.screenId < right.screenId) return -1;
    if (left.screenId > right.screenId) return 1;
    return 0;
  });
}

/**
 * Seals the boundary between Stitch transport output and Product Compiler
 * identity. Only direct candidates with both code and visual render evidence
 * can become bindable product screens; title matching remains the downstream
 * exact target join and is deliberately absent here.
 */
export function decodeStitchDirectBatchV2(input: Readonly<{
  stageId: string;
  targetRefs: string[];
  result: unknown;
}>): DecodedStitchDirectBatchV2 {
  const raw = input.result && typeof input.result === "object"
    ? input.result as Record<string, unknown>
    : {};
  if (raw.directScreenEvidenceSchema !== "setfarm.stitch-direct-screen-evidence.v2") {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
      diagnostic: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID: missing direct screen evidence v2 transport discriminator",
    };
  }
  const evidenceResult = StitchDirectScreenEvidenceV2Schema.array().max(1_000).safeParse(raw.directScreenEvidence);
  if (!evidenceResult.success) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
      diagnostic: `DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID: ${evidenceResult.error.issues[0]?.message || "schema mismatch"}`,
    };
  }
  const evidenceBatchResult = StitchDirectBatchEvidenceV2Schema.safeParse({
    stageId: input.stageId,
    targetRefs: input.targetRefs,
    source: "direct",
    candidates: evidenceResult.data,
  });
  if (!evidenceBatchResult.success) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
      diagnostic: `DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID: ${evidenceBatchResult.error.issues[0]?.message || "batch schema mismatch"}`,
    };
  }
  const evidenceBatch = evidenceBatchResult.data;
  if (raw.screenSource !== "direct") {
    return {
      status: "rejected",
      code: "DESIGN_V3_RESPONSE_SOURCE_INVALID",
      diagnostic: `DESIGN_V3_RESPONSE_SOURCE_INVALID: expected direct, got ${String(raw.screenSource || "unknown")}`,
      evidenceBatch,
    };
  }
  const reportedBatchResult = StitchBatchResponseV2Schema.safeParse({
    schema: "setfarm.stitch-batch-response.v2",
    stageId: input.stageId,
    targetRefs: input.targetRefs,
    screens: Array.isArray(raw.screens)
      ? raw.screens.map((screen) => ({
          screenId: String((screen as any)?.screenId || ""),
          title: String((screen as any)?.title || ""),
        }))
      : [],
  });
  if (!reportedBatchResult.success) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH",
      diagnostic: `DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH: ${reportedBatchResult.error.issues[0]?.message || "reported screen schema mismatch"}`,
      evidenceBatch,
    };
  }
  const admittedScreens = evidenceBatch.candidates
    .filter((item) => item.disposition === "admitted_renderable_screen")
    .map((item) => ({ screenId: item.screenId, title: item.title }));
  const identityConflicts = evidenceBatch.candidates
    .filter((item) => item.disposition === "excluded_identity_conflict");
  if (identityConflicts.length > 0) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH",
      diagnostic: `DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH: direct response repeats screen identity with conflicting fields (${identityConflicts.map((item) => item.screenId).join(",")})`,
      evidenceBatch,
    };
  }
  if (admittedScreens.length === 0) {
    return {
      status: "rejected",
      code: "DESIGN_V3_RENDERABLE_SCREEN_MISSING",
      diagnostic: "DESIGN_V3_RENDERABLE_SCREEN_MISSING: direct response contained no screen with complete HTML and screenshot evidence",
      evidenceBatch,
    };
  }
  const generatedTotal = Number(raw.total);
  if (
    !Number.isInteger(generatedTotal) ||
    generatedTotal !== admittedScreens.length ||
    canonicalJsonStringify(compareScreens(reportedBatchResult.data.screens)) !==
      canonicalJsonStringify(compareScreens(admittedScreens))
  ) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH",
      diagnostic: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH: admitted evidence does not equal reported direct screens",
      evidenceBatch,
    };
  }
  return {
    status: "decoded",
    batch: {
      schema: "setfarm.stitch-batch-response.v2",
      stageId: input.stageId,
      targetRefs: input.targetRefs,
      screens: admittedScreens,
    },
    evidenceBatch,
  };
}
