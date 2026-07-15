import { canonicalJsonStringify } from "../canonical-json.js";
import {
  StitchBatchResponseV1Schema,
  type StitchBatchResponseV1,
} from "../schemas/design-generation-targets-v1.js";
import {
  StitchDirectBatchEvidenceV1Schema,
  StitchDirectScreenEvidenceV1Schema,
  type StitchDirectBatchEvidenceV1,
} from "../schemas/stitch-direct-response-evidence-v1.js";

export type DecodedStitchDirectBatchV1 =
  | Readonly<{
      status: "decoded";
      batch: StitchBatchResponseV1;
      evidenceBatch: StitchDirectBatchEvidenceV1;
    }>
  | Readonly<{
      status: "rejected";
      code:
        | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID"
        | "DESIGN_V3_RESPONSE_SOURCE_INVALID"
        | "DESIGN_V3_RENDERABLE_SCREEN_MISSING"
        | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH";
      diagnostic: string;
      evidenceBatch?: StitchDirectBatchEvidenceV1;
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
export function decodeStitchDirectBatchV1(input: Readonly<{
  stageId: string;
  targetRefs: string[];
  result: unknown;
}>): DecodedStitchDirectBatchV1 {
  const raw = input.result && typeof input.result === "object"
    ? input.result as Record<string, unknown>
    : {};
  const evidenceResult = StitchDirectScreenEvidenceV1Schema.array().max(1_000).safeParse(raw.directScreenEvidence);
  if (!evidenceResult.success) {
    return {
      status: "rejected",
      code: "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
      diagnostic: `DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID: ${evidenceResult.error.issues[0]?.message || "schema mismatch"}`,
    };
  }
  const evidenceBatchResult = StitchDirectBatchEvidenceV1Schema.safeParse({
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
  const reportedBatchResult = StitchBatchResponseV1Schema.safeParse({
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
      stageId: input.stageId,
      targetRefs: input.targetRefs,
      screens: admittedScreens,
    },
    evidenceBatch,
  };
}
