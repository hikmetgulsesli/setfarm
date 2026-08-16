import { Buffer } from "node:buffer";

import { canonicalJsonStringify } from "./canonical-json.js";
import {
  DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1,
  parseDesignSourceSemanticRetryEvidenceV1,
  type DesignSourceSemanticRetryEvidenceV1,
} from "./design-source-semantic-retry-evidence-v1.js";

const CORRECTION_BY_REASON_CODE = Object.freeze({
  CANDIDATE_ACTION_INPUT_SET_MISMATCH:
    "Render only the declared action input contract with its exact expected binding.",
  CANDIDATE_CONTROL_SLOT_SET_MISMATCH:
    "Render every and only declared physical control slot with exact data-action and data-control-slot on the same actionable element.",
  CANDIDATE_DOWNLOAD_RECEIPT_MISMATCH:
    "Return download receipts whose hashes and byte lengths exactly bind every accepted local artifact.",
  CANDIDATE_DOWNLOAD_RECEIPT_MISSING:
    "Return complete download receipts for every accepted local artifact.",
  CANDIDATE_LOCAL_HTML_INVALID:
    "Emit exactly one valid declared local HTML artifact for every requested screen.",
  CANDIDATE_LOCAL_HTML_MISSING:
    "Emit exactly one valid local HTML artifact for every requested screen.",
  CANDIDATE_LOCAL_HTML_UNEXPECTED:
    "Emit no undeclared local HTML artifacts.",
  CANDIDATE_LOCAL_SCREENSHOT_INVALID:
    "Emit exactly one valid declared local screenshot artifact for every requested screen.",
  CANDIDATE_LOCAL_SCREENSHOT_MISSING:
    "Emit exactly one valid local screenshot artifact for every requested screen.",
  CANDIDATE_LOCAL_SCREENSHOT_UNEXPECTED:
    "Emit no undeclared local screenshot artifacts.",
  CANDIDATE_OBSERVABLE_SET_MISMATCH:
    "Expose every and only declared observable selector and role receipt with its exact expected value.",
  CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED:
    "Regenerate source without forbidden executable or resource behavior while preserving the typed target contract.",
  CANDIDATE_RENDERED_TARGET_MISMATCH:
    "Preserve the exact rendered target identity for the requested typed target.",
  CANDIDATE_RENDER_EVIDENCE_INCOMPLETE:
    "Regenerate complete HTML, screenshot, semantic, and role-receipt evidence for the unchanged typed target.",
  CANDIDATE_RESPONSE_IDENTITY_CONFLICT:
    "Emit one unambiguous screen identity for every response path and typed target.",
  CANDIDATE_SCREEN_ID_UNSAFE:
    "Use a stable safe ASCII screen identifier for every rendered screen.",
  CANDIDATE_SURFACE_SET_MISMATCH:
    "Render every and only declared surface ref exactly once.",
  CANDIDATE_TITLE_MISMATCH:
    "Preserve the exact expected screen title from the typed target contract.",
  CANDIDATE_UNDECLARED_ACTION:
    "Remove undeclared actions unless the exact typed contract declares them.",
  CANDIDATE_UNDECLARED_ACTION_INPUT:
    "Remove undeclared action inputs unless the exact typed contract declares them.",
  CANDIDATE_UNDECLARED_CONTROL_SLOT:
    "Remove undeclared control slots unless the exact typed contract declares them.",
  CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL:
    "Remove undeclared interactive controls or make them non-actionable unless the exact typed contract declares them.",
  CANDIDATE_UNDECLARED_SURFACE:
    "Remove undeclared surfaces unless the exact typed contract declares them.",
  DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE:
    "Regenerate the unchanged typed stage because the previous provider call returned no accepted local result.",
  ARTIFACT_HASH_MISMATCH:
    "Regenerate artifacts whose bytes exactly match their declared content hashes.",
  DUPLICATE_CONTRACT_ATTRIBUTE:
    "Emit each contract attribute exactly once on its declared element.",
  HTML_INVALID:
    "Regenerate valid selected HTML for the unchanged typed target.",
  INVALID_CONTRACT_ATTRIBUTE:
    "Emit only valid contract attribute names and values from the typed target.",
  OBSERVABLE_BEFORE_VISIBLE_MISSING:
    "Make every required observable role visible before its declared action.",
  OBSERVABLE_ROLE_CARDINALITY_MISMATCH:
    "Resolve every observable role to exactly its declared cardinality.",
  RESOURCE_CAPACITY_EXCEEDED:
    "Keep declared resources within the fixed per-resource and aggregate capacity limits.",
  RESOURCE_POLICY_VIOLATION:
    "Use only resources admitted by the fixed resource policy.",
  SCREENSHOT_INVALID:
    "Regenerate a valid screenshot for the unchanged typed target.",
  TARGET_IDENTITY_UNRESOLVED:
    "Preserve the exact typed target identity and expected screen title.",
  UNSAFE_SCREEN_ID:
    "Use a stable safe ASCII screen identifier for the selected screen.",
  UNSUPPORTED_EXECUTABLE_SCRIPT:
    "Remove unsupported executable scripts while preserving the typed target contract.",
} satisfies Readonly<Record<string, string>>);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function genericDesignSourceRetryCorrectionLinesV1(
  reasonCodes: readonly string[],
): readonly string[] {
  return [...new Set(reasonCodes)]
    .sort(compareUtf16)
    .flatMap((code) => {
      const correction = CORRECTION_BY_REASON_CODE[code as keyof typeof CORRECTION_BY_REASON_CODE];
      return correction === undefined ? [] : [correction];
    });
}

export function compileDesignSourceSemanticRetryCorrectionsV1(input: Readonly<{
  evidence: DesignSourceSemanticRetryEvidenceV1;
  stageId: string;
  reasonCodes: readonly string[];
}>): readonly string[] {
  const evidence = parseDesignSourceSemanticRetryEvidenceV1(input.evidence);
  const genericLines = genericDesignSourceRetryCorrectionLinesV1(input.reasonCodes);
  const stage = evidence.stages.find((candidate) => candidate.stageId === input.stageId);
  if (stage === undefined) return genericLines;

  const targetedLines = stage.targets.flatMap((target) => target.requirements.map((requirement) =>
    `semantic_requirement: ${canonicalJsonStringify({
      expectedCount: requirement.expectedCount,
      ...(requirement.expectedValue === null ? {} : { expectedValue: requirement.expectedValue }),
      kind: requirement.kind,
      semanticRef: requirement.semanticRef,
      targetRef: target.targetRef,
    })}`));
  const lines = [...genericLines, ...targetedLines];
  if (
    lines.length > DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumCorrectionRecordsPerStage
    || Buffer.byteLength(lines.join("\n"), "utf8")
      > DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumCorrectionBytesPerStage
  ) {
    return Buffer.byteLength(genericLines.join("\n"), "utf8")
      <= DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumCorrectionBytesPerStage
      ? genericLines
      : [];
  }
  return lines;
}
