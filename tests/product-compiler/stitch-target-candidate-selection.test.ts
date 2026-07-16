import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1 as selectCandidateProducer,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { produceDesignGenerationTargetsV1 } from "../../src/product-compiler/producers/design-targets.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { StitchTargetCandidateSelectionV1Schema } from "../../src/product-compiler/schemas/stitch-target-candidate-selection-v1.js";
import {
  validStitchHtml,
  validStitchPng,
  stitchDownloadReceipts,
  buildTestRenderedSemantics,
} from "./fixtures/stitch-artifacts.js";

const TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

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

function fixture() {
  const product = produceProductSpecV1({ task: TASK });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const target = targets.generationTargets.targets[0]!;
  const exactHtml = (variant: string) => validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}" data-variant="${variant}">`,
    '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
    '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
    "</main>",
  ].join(""), variant);
  const htmlA = exactHtml("a");
  const htmlB = exactHtml("b");
  const screenshot = validStitchPng(7);
  const candidates = [
    { screenId: "screen-a", htmlBytes: htmlA, screenshotBytes: screenshot },
    { screenId: "screen-b", htmlBytes: htmlB, screenshotBytes: screenshot },
    { screenId: "screen-helper", htmlBytes: validStitchHtml("<main>helper</main>", "helper"), screenshotBytes: screenshot },
  ];
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "project-selection",
    batches: [{
      stageId: "stage-001",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: candidates.map((candidate) => ({
        screenId: candidate.screenId,
        title: candidate.screenId === "screen-helper" ? "Helper Canvas" : target.expectedScreenTitle,
        responsePaths: [`$result.screens.${candidate.screenId}`],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(
          candidate.screenId,
          candidate.htmlBytes,
          candidate.screenshotBytes,
        ),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      })),
    }],
  };
  return {
    target,
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    candidates,
    expectedSelectedScreenId: [
      { screenId: "screen-a", htmlHash: sha256(htmlA), screenshotHash: sha256(screenshot) },
      { screenId: "screen-b", htmlHash: sha256(htmlB), screenshotHash: sha256(screenshot) },
    ].sort((left, right) => left.htmlHash.localeCompare(right.htmlHash)
      || left.screenshotHash.localeCompare(right.screenshotHash)
      || left.screenId.localeCompare(right.screenId))[0]!.screenId,
  };
}

describe("Stitch target candidate selection v1", () => {
  it("keeps historical v1 readable but refuses to activate it as clean-v3 binding authority", () => {
    const value = fixture();
    const legacy: any = structuredClone(value.directResponseEvidence);
    legacy.schema = "setfarm.stitch-direct-response-evidence.v1";
    for (const candidate of legacy.batches[0].candidates) {
      delete candidate.identityConflicts;
      delete candidate.htmlSourceRefHash;
      delete candidate.screenshotSourceRefHash;
      delete candidate.htmlDownloadedArtifactHash;
      delete candidate.screenshotDownloadedArtifactHash;
    }
    const active = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: legacy,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    assert.equal(active.status, "rejected");
    assert.deepEqual(active.rejectionCodes, ["DESIGN_CANDIDATE_DIRECT_EVIDENCE_VERSION_UNSUPPORTED"]);

    const historical = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: legacy,
      artifacts: value.candidates,
      authorityMode: "historical_read",
    });
    assert.equal(historical.status, "produced", JSON.stringify(historical.diagnostics));
    if (historical.status !== "produced") return;
    assert.equal(historical.candidateSelection.downloadReceiptPolicy, "historical_unverified");
    const bound = bindStitchTargetCandidateSelectionsV2({
      generationTargets: value.generationTargets,
      candidateSelection: historical.candidateSelection,
    });
    assert.equal(bound.status, "rejected");
    assert.deepEqual(bound.rejectionCodes, ["DESIGN_BINDING_V2_HISTORICAL_AUTHORITY_REJECTED"]);
  });

  it("preserves all variants and deterministically selects exact target semantics", () => {
    const value = fixture();
    const first = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    const second = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: [...value.candidates].reverse(),
      authorityMode: "clean_v3",
    });
    assert.equal(first.status, "produced", JSON.stringify(first.diagnostics));
    assert.equal(second.status, "produced", JSON.stringify(second.diagnostics));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.deepEqual(second.candidateSelection, first.candidateSelection);
    assert.equal(first.candidateSelection.candidates.length, 3);
    assert.equal(first.candidateSelection.selections[0]!.selectedScreenId, value.expectedSelectedScreenId);
    assert.deepEqual(
      first.candidateSelection.selections[0]!.evaluations
        .filter((item) => item.qualificationTier === "exact_target_semantics")
        .map((item) => item.screenId)
        .sort(),
      ["screen-a", "screen-b"],
    );
    assert.equal(
      first.candidateSelection.selections[0]!.evaluations
        .find((item) => item.screenId === "screen-helper")?.qualificationTier,
      "renderable_stage_candidate",
    );

    const bound = bindStitchTargetCandidateSelectionsV2({
      generationTargets: value.generationTargets,
      candidateSelection: first.candidateSelection,
    });
    assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
    if (bound.status !== "produced") return;
    assert.equal(bound.responseBindings.schema, "setfarm.stitch-target-response-bindings.v2");
    assert.equal(bound.responseBindings.bindings[0]!.responseScreenId, value.expectedSelectedScreenId);
    assert.equal(bound.responseBindings.candidateSelectionHash, hashCanonicalJson(first.candidateSelection));
  });

  it("fails closed while retaining candidate evidence when exact-title semantics are incomplete", () => {
    const value = fixture();
    const incomplete = value.candidates.map((candidate) => ({
      ...candidate,
      ...(candidate.screenId !== "screen-helper"
        ? { htmlBytes: Buffer.from(`<html><main data-surface-id="${value.target.surfaceRef}"></main></html>`) }
        : {}),
    }));
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: incomplete,
      authorityMode: "clean_v3",
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_CANDIDATE_SELECTION_UNRESOLVED"), true);
    assert.equal(result.candidateSelection?.candidates.length, 3);
    assert.equal(result.candidateSelection?.selections[0]?.selectedScreenId, null);
  });

  it("excludes an invalid short HTML variant before deterministic ranking", () => {
    const value = fixture();
    const artifacts = value.candidates.map((candidate) => candidate.screenId === "screen-a"
      ? {
          ...candidate,
          htmlBytes: Buffer.from([
            "<!doctype html><html><body>",
            `<main data-surface-id="${value.target.surfaceRef}">`,
            '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
            '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
            "</main></body></html>",
          ].join(""), "utf8"),
        }
      : candidate);
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts,
      authorityMode: "clean_v3",
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;
    assert.equal(result.candidateSelection.selections[0]!.selectedScreenId, "screen-b");
    const invalid = result.candidateSelection.selections[0]!.evaluations
      .find((evaluation) => evaluation.screenId === "screen-a");
    assert.equal(invalid?.qualificationTier, "excluded_missing_local_artifact");
    assert.equal(invalid?.rejectionCodes.includes("CANDIDATE_LOCAL_HTML_INVALID"), true);
  });

  it("does not treat action markers on non-actionable elements as implemented controls", () => {
    const value = fixture();
    const misplaced = value.candidates.map((candidate) => ({
      ...candidate,
      ...(candidate.screenId !== "screen-helper"
        ? {
            htmlBytes: validStitchHtml([
              `<main data-surface-id="${value.target.surfaceRef}">`,
              '<div role="button" data-action="ACT_REFRESH_STATUS">Refresh</div>',
              '<div data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</div>',
              "</main>",
            ].join(""), "misplaced-actions"),
          }
        : {}),
    }));
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: misplaced,
      authorityMode: "historical_read",
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_CANDIDATE_SELECTION_UNRESOLVED"), true);
    const exactTitleEvaluation = result.candidateSelection?.selections[0]?.evaluations
      .find((evaluation) => evaluation.screenId === "screen-a");
    assert.equal(exactTitleEvaluation?.qualificationTier, "exact_title_incomplete_semantics");
    assert.equal(exactTitleEvaluation?.rejectionCodes.includes("CANDIDATE_ACTION_SET_MISMATCH"), true);
    assert.equal(exactTitleEvaluation?.rejectionCodes.includes("CANDIDATE_ACTION_INPUT_SET_MISMATCH"), true);
    assert.equal(
      exactTitleEvaluation?.semanticChecks.some((check) =>
        check.semanticRef.endsWith("@non_actionable_element") && check.disposition === "unexpected"),
      true,
    );
  });

  for (const [name, body] of [
    ["prefixed attributes", (surfaceRef: string) => [
      `<main x-data-surface-id="${surfaceRef}">`,
      '<button x-data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button x-data-action="ACT_SET_PAUSED" x-data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join("")],
    ["template content", (surfaceRef: string) => [
      "<template>",
      `<main data-surface-id="${surfaceRef}">`,
      '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main></template>",
    ].join("")],
    ["hidden utility classes", (surfaceRef: string) => [
      `<main data-surface-id="${surfaceRef}">`,
      '<div class="hidden"><button data-action="ACT_REFRESH_STATUS">Refresh</button></div>',
      '<button class="invisible" data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join("")],
  ] as const) {
    it(`does not qualify ${name} as rendered contract semantics`, () => {
      const value = fixture();
      const artifacts = value.candidates.map((candidate) => candidate.screenId === "screen-helper"
        ? candidate
        : { ...candidate, htmlBytes: validStitchHtml(body(value.target.surfaceRef), name) });
      const result = selectStitchTargetCandidatesV1({
        generationTargets: value.generationTargets,
        directResponseEvidence: value.directResponseEvidence,
        artifacts,
        authorityMode: "historical_read",
      });
      assert.equal(result.status, "rejected");
      assert.equal(result.candidateSelection?.selections[0]?.selectedScreenId, null);
    });
  }

  it("rejects rendered native or ARIA controls without an exact action contract", () => {
    const value = fixture();
    const html = validStitchHtml([
      `<main data-surface-id="${value.target.surfaceRef}">`,
      '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "<button>Undeclared Help</button>",
      '<a href="/evil">Evil</a>',
      '<div role="switch">Unbound switch</div>',
      "</main>",
    ].join(""), "unexpected-controls");
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates.map((candidate) => candidate.screenId === "screen-helper"
        ? candidate
        : { ...candidate, htmlBytes: html }),
      authorityMode: "historical_read",
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.candidateSelection?.selections[0]?.evaluations[0]?.rejectionCodes
        .includes("CANDIDATE_CONTROL_SET_MISMATCH"),
      true,
    );
  });

  it("rejects duplicate machine-contract attributes", () => {
    const value = fixture();
    const html = validStitchHtml([
      `<main data-surface-id="${value.target.surfaceRef}">`,
      '<button data-action="ACT_REFRESH_STATUS" data-action="ACT_SET_PAUSED">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join(""), "duplicate-attributes");
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates.map((candidate) => candidate.screenId === "screen-helper"
        ? candidate
        : { ...candidate, htmlBytes: html }),
      authorityMode: "historical_read",
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.candidateSelection?.selections[0]?.evaluations[0]?.rejectionCodes
        .includes("CANDIDATE_CONTROL_SET_MISMATCH"),
      true,
    );
  });

  it("does not parse controls from unclosed raw-text elements", () => {
    const value = fixture();
    const html = validStitchHtml([
      `<main data-surface-id="${value.target.surfaceRef}">`,
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      '<script><button data-action="ACT_REFRESH_STATUS">forged refresh</button>',
    ].join(""), "raw-text");
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates.map((candidate) => candidate.screenId === "screen-helper"
        ? candidate
        : { ...candidate, htmlBytes: html }),
      authorityMode: "historical_read",
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.candidateSelection?.selections[0]?.evaluations[0]?.rejectionCodes
        .includes("CANDIDATE_ACTION_SET_MISMATCH"),
      true,
    );
  });

  it("requires attempt-bound download receipts when active v3 policy requests them", () => {
    const value = fixture();
    const directResponseEvidence = structuredClone(value.directResponseEvidence);
    for (const candidate of directResponseEvidence.batches[0]!.candidates) {
      const artifact = value.candidates.find((item) => item.screenId === candidate.screenId)!;
      Object.assign(candidate, stitchDownloadReceipts(candidate.screenId, artifact.htmlBytes!, artifact.screenshotBytes!));
    }
    const produced = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    if (produced.status !== "produced") return;
    assert.equal(produced.candidateSelection.downloadReceiptPolicy, "required");

    delete directResponseEvidence.batches[0]!.candidates[0]!.htmlDownloadedArtifactHash;
    const fallback = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    assert.equal(fallback.status, "produced", JSON.stringify(fallback.diagnostics));
    if (fallback.status !== "produced") return;
    assert.equal(fallback.candidateSelection.selections[0]!.selectedScreenId, "screen-b");
    assert.equal(
      fallback.candidateSelection.selections[0]!.evaluations
        .find((item) => item.screenId === "screen-a")?.rejectionCodes
        .includes("CANDIDATE_DOWNLOAD_RECEIPT_MISSING"),
      true,
    );

    delete directResponseEvidence.batches[0]!.candidates[1]!.htmlDownloadedArtifactHash;
    const rejected = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.candidateSelection?.selections[0]?.selectedScreenId, null);
  });

  it("binds an accessibility outcome independently from its owning action control", () => {
    const value = fixture();
    const generationTargets = structuredClone(value.generationTargets);
    generationTargets.targets[0]!.requiredObservableSelectors = [{
      observableRef: "OBS_REFRESHED_STATUS",
      actionRef: "ACT_REFRESH_STATUS",
      selector: {
        kind: "accessibility",
        surfaceRef: value.target.surfaceRef,
        role: "status",
        name: "Status display",
        actionRef: "ACT_REFRESH_STATUS",
      },
    }];
    const artifacts = value.candidates.map((candidate) => ({
      ...candidate,
      ...(candidate.screenId !== "screen-helper"
        ? {
            htmlBytes: validStitchHtml([
              `<main data-surface-id="${value.target.surfaceRef}">`,
              '<p role="status" aria-label="Status display">Ready</p>',
              '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
              '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
              "</main>",
            ].join(""), "status-observable"),
          }
        : {}),
    }));
    const result = selectStitchTargetCandidatesV1({
      generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts,
      authorityMode: "historical_read",
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;
    assert.deepEqual(
      result.candidateSelection.selections[0]!.evaluations
        .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
        .map((evaluation) => evaluation.screenId)
        .sort(),
      ["screen-a", "screen-b"],
    );
    const selected = result.candidateSelection.selections[0]!.evaluations
      .find((evaluation) => evaluation.screenId === result.candidateSelection.selections[0]!.selectedScreenId);
    assert.equal(
      selected?.semanticChecks.find((check) => check.semanticRef === "OBS_REFRESHED_STATUS")?.disposition,
      "exact",
    );
  });

  it("rejects forged ranking or selection even when the artifact is otherwise well-shaped", () => {
    const value = fixture();
    const result = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;
    const forged = structuredClone(result.candidateSelection);
    forged.selections[0]!.rankedQualifiedScreenIds.reverse();
    forged.selections[0]!.selectedScreenId = forged.selections[0]!.rankedQualifiedScreenIds[0]!;
    assert.equal(StitchTargetCandidateSelectionV1Schema.safeParse(forged).success, false);
  });

  it("changes canonical selection authority when any preserved candidate bytes change", () => {
    const value = fixture();
    const first = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: value.candidates,
      authorityMode: "clean_v3",
    });
    const changedArtifacts = value.candidates.map((candidate) => candidate.screenId === "screen-helper"
      ? { ...candidate, htmlBytes: Buffer.from("<html><body>changed helper</body></html>") }
      : candidate);
    const second = selectStitchTargetCandidatesV1({
      generationTargets: value.generationTargets,
      directResponseEvidence: value.directResponseEvidence,
      artifacts: changedArtifacts,
      authorityMode: "clean_v3",
    });
    assert.equal(first.status, "produced", JSON.stringify(first.diagnostics));
    assert.equal(second.status, "produced", JSON.stringify(second.diagnostics));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.notEqual(hashCanonicalJson(first.candidateSelection), hashCanonicalJson(second.candidateSelection));
  });
});
