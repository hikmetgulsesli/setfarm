import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceStitchTargetCandidateSelectionFailureV1 } from "../../src/product-compiler/producers/stitch-target-candidate-selection-failure.js";
import { selectStitchTargetCandidatesV1 as selectCandidateProducer } from "../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { produceDesignGenerationTargetsV1 } from "../../src/product-compiler/producers/design-targets.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import {
  StitchTargetCandidateSelectionFailureV1Schema,
  stitchTargetCandidateSelectionFailureFingerprintBasisV1,
  type StitchTargetCandidateSelectionFailureV1,
} from "../../src/product-compiler/schemas/stitch-target-candidate-selection-failure-v1.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
  buildTestRenderedSemantics,
} from "./fixtures/stitch-artifacts.js";

const TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

function selectStitchTargetCandidatesV1(
  input: Parameters<typeof selectCandidateProducer>[0],
) {
  return selectCandidateProducer({
    ...input,
    ...(input.authorityMode === "clean_v3"
      && input.renderedSemantics === undefined
      && (input.directResponseEvidence as { schema?: string })?.schema === "setfarm.stitch-direct-response-evidence.v2"
      ? { renderedSemantics: buildTestRenderedSemantics(input) }
      : {}),
  });
}

function withoutFingerprint(
  value: StitchTargetCandidateSelectionFailureV1,
): Omit<StitchTargetCandidateSelectionFailureV1, "fingerprint"> {
  const { fingerprint: _fingerprint, ...rest } = value;
  return rest;
}

function fixture(semantics: "exact" | "incomplete") {
  const product = produceProductSpecV1({ task: TASK });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const target = targets.generationTargets.targets[0]!;
  const actionMarkup = semantics === "exact"
    ? target.requiredActionRefs.map((actionRef) => {
        const inputs = target.requiredActionInputs.find((input) => input.actionRef === actionRef);
        const inputRefs = inputs?.inputFields.map((field) => `${actionRef}.${field}`).join(" ");
        return `<button data-action="${actionRef}"${inputRefs ? ` data-action-input="${inputRefs}"` : ""}>${actionRef}</button>`;
      }).join("")
    : "";
  const htmlBytes = validStitchHtml(
    `<main data-surface-id="${target.surfaceRef}">${actionMarkup}</main>`,
    `candidate-failure-${semantics}`,
  );
  const screenshotBytes = validStitchPng(73);
  const candidate = { screenId: "screen-candidate", htmlBytes, screenshotBytes };
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "project-candidate-failure",
    batches: [{
      stageId: "stage-candidate-failure",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId: candidate.screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens.0"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(candidate.screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  return {
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts: [candidate],
  };
}

function unresolvedFailure(): StitchTargetCandidateSelectionFailureV1 {
  const value = fixture("incomplete");
  const result = selectStitchTargetCandidatesV1({
    ...value,
    authorityMode: "clean_v3",
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.rejectionCodes.includes("DESIGN_CANDIDATE_SELECTION_UNRESOLVED"), true);
  assert.ok(result.candidateSelection);
  assert.ok(result.candidateSelectionFailure);
  assert.equal(
    result.candidateSelectionFailure.candidateSelectionHash,
    hashCanonicalJson(result.candidateSelection),
  );
  return result.candidateSelectionFailure;
}

describe("Stitch target candidate selection failure v1", () => {
  it("attaches a strict typed failure only to a valid unresolved selection authority", () => {
    const failure = unresolvedFailure();
    assert.equal(failure.schema, "setfarm.stitch-target-candidate-selection-failure.v1");
    assert.equal(failure.owner, "stitch_generation_orchestrator");
    assert.deepEqual(failure.retry, {
      disposition: "retry_after_authority_delta",
      sameAuthorityRetryForbidden: true,
      maxAttempts: 1,
    });
    assert.equal(failure.expectedDelta.kind, "candidate_authority_change");
    assert.equal(failure.expectedDelta.requiredAuthorityHash, "candidateSelectionHash");
    assert.equal(
      failure.expectedDelta.fromCandidateSelectionHash,
      failure.candidateSelectionHash,
    );
    assert.deepEqual(
      failure.targetFailures[0]!.rejectionCodes,
      [...failure.targetFailures[0]!.rejectionCodes].sort(),
    );
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse(failure).success, true);

    const exact = fixture("exact");
    const produced = selectStitchTargetCandidatesV1({ ...exact, authorityMode: "clean_v3" });
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    assert.equal("candidateSelectionFailure" in produced, false);

    const invalid = selectStitchTargetCandidatesV1({
      generationTargets: {},
      directResponseEvidence: {},
      artifacts: [],
      authorityMode: "clean_v3",
    });
    assert.equal(invalid.status, "rejected");
    assert.equal(invalid.candidateSelection, undefined);
    assert.equal(invalid.candidateSelectionFailure, undefined);
  });

  it("keeps the retry identity independent from diagnostic prose and rejects unknown narrative fields", () => {
    const failure = unresolvedFailure();
    const candidateSelection = fixture("incomplete");
    const selectionResult = selectStitchTargetCandidatesV1({
      ...candidateSelection,
      authorityMode: "clean_v3",
    });
    assert.equal(selectionResult.status, "rejected");
    assert.ok(selectionResult.candidateSelection);
    const reproduced = produceStitchTargetCandidateSelectionFailureV1(
      selectionResult.candidateSelection,
    );
    assert.equal(reproduced.fingerprint, failure.fingerprint);
    assert.equal(
      JSON.stringify(stitchTargetCandidateSelectionFailureFingerprintBasisV1(failure))
        .includes("message"),
      false,
    );
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse({
      ...failure,
      narrative: "wording must never affect retry identity",
    }).success, false);
  });

  it("changes the fingerprint with canonical authority or evaluation deltas", () => {
    const failure = unresolvedFailure();
    const changedAuthority = structuredClone(failure);
    changedAuthority.generationTargetsHash = "1".repeat(64);
    changedAuthority.fingerprint = hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(withoutFingerprint(changedAuthority)),
    );
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse(changedAuthority).success, true);
    assert.notEqual(changedAuthority.fingerprint, failure.fingerprint);

    const changedEvaluation = structuredClone(failure);
    const check = changedEvaluation.targetFailures[0]!.evaluations[0]!.semanticChecks
      .find((item) => item.disposition !== "exact")!;
    check.observedCount = check.expectedCount + 1;
    check.elementRefs = Array.from(
      { length: check.observedCount },
      (_, index) => `E${String(900_001 + index).padStart(6, "0")}`,
    );
    check.disposition = check.expectedCount === 0 ? "unexpected" : "duplicate";
    changedEvaluation.fingerprint = hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(withoutFingerprint(changedEvaluation)),
    );
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse(changedEvaluation).success, true);
    assert.notEqual(changedEvaluation.fingerprint, failure.fingerprint);
  });

  it("rejects forged fingerprints and expected deltas that do not start from failed authority", () => {
    const failure = unresolvedFailure();
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse({
      ...failure,
      fingerprint: "0".repeat(64),
    }).success, false);

    const forgedDelta = structuredClone(failure);
    forgedDelta.expectedDelta.fromCandidateSelectionHash = "2".repeat(64);
    forgedDelta.fingerprint = hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(withoutFingerprint(forgedDelta)),
    );
    assert.equal(StitchTargetCandidateSelectionFailureV1Schema.safeParse(forgedDelta).success, false);
  });
});
