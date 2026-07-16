import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
  StitchCandidateSelectionInfrastructureErrorV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { DesignGenerationTargetsV2Schema } from "../../src/product-compiler/schemas/design-generation-targets-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { StitchTargetCandidateSelectionV2Schema } from "../../src/product-compiler/schemas/stitch-target-candidate-selection-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

type FixtureOptions = Readonly<{
  variants?: readonly ("a" | "b" | "helper")[];
  affectingOnlyControl?: boolean;
  duplicateInput?: boolean;
  duplicateCanvas?: boolean;
  extraSurface?: boolean;
  extraInteractive?: boolean;
  executableScript?: boolean;
}>;

function generationTargets(options: FixtureOptions) {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const productSpec: any = structuredClone(compiled.productSpec);
  const action = productSpec.actions[0]!;
  action.input.fields = [{ name: "phase", valueType: "string", required: true }];
  action.evidenceScenario.targetInputValues = { phase: "playing" };
  action.stateDeltas[0]!.valueFrom = { kind: "input", field: "phase" };
  const strictProductSpec = ProductSpecV2Schema.parse(productSpec);
  const result = produceDesignGenerationTargetsV2(strictProductSpec);
  assert.equal(result.status, "produced", JSON.stringify(result));
  if (result.status !== "produced") throw new Error("unreachable");
  if (!options.affectingOnlyControl) return result.generationTargets;
  const mutated: any = structuredClone(result.generationTargets);
  mutated.targets[0]!.affectingActionRefs.push("ACT_AFFECT_ONLY");
  mutated.targets[0]!.affectingActionRefs.sort();
  return DesignGenerationTargetsV2Schema.parse(mutated);
}

async function fixture(options: FixtureOptions = {}) {
  const targets = generationTargets(options);
  const target = targets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(statusObservable.selector.kind, "accessibility");
  if (statusObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusSurface = statusObservable.selector.surfaceRef;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusSurface)!;
  const variants = options.variants ?? ["a"];
  const screenshotBytes = validStitchPng(141);
  const artifacts = variants.map((variant, index) => {
    const isHelper = variant === "helper";
    const inputRef = `${placement.actionRef}.${placement.inputFields[0]}`;
    const htmlBytes = validStitchHtml([
      `<main data-surface-id="${target.surfaceRef}" data-variant="${variant}">`,
      `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}" data-action-input="${inputRef}${options.duplicateInput ? ` ${inputRef}` : ""}">Start Game</button>`,
      `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
      options.duplicateCanvas
        ? `<section data-surface-id="${canvasSurface}"><canvas></canvas></section>`
        : "",
      `<section data-surface-id="${statusSurface}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
      options.extraSurface
        ? '<aside data-surface-id="SURF_UNDECLARED_PANEL">Undeclared</aside>'
        : "",
      options.extraInteractive ? "<button>Uncontracted help</button>" : "",
      options.affectingOnlyControl
        ? '<button data-action="ACT_AFFECT_ONLY">Affected-only action</button>'
        : "",
      "</main>",
      options.executableScript ? "<script>globalThis.applicationCodeRan=true</script>" : "",
    ].join(""), `selection-v2-${variant}-${index}`);
    return {
      screenId: `screen-${variant}`,
      title: isHelper ? "Helper Canvas" : target.expectedScreenTitle,
      htmlBytes,
      screenshotBytes,
    };
  });
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "selection-v2-test",
    batches: [{
      stageId: "stage-selection-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: artifacts.map((artifact) => ({
        screenId: artifact.screenId,
        title: artifact.title,
        responsePaths: [`$result.screens.${artifact.screenId}`],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(
          artifact.screenId,
          artifact.htmlBytes,
          artifact.screenshotBytes,
        ),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      })),
    }],
  };
  const localArtifacts = artifacts.map(({ screenId, htmlBytes, screenshotBytes }) => ({
    screenId,
    htmlBytes,
    screenshotBytes,
  }));
  const rendered = await captureStitchRenderedSemanticsV2({
    generationTargets: targets,
    directResponseEvidence,
    artifacts: localArtifacts,
    deviceType: "DESKTOP",
  });
  return {
    target,
    placement,
    canvasSurface,
    statusSurface,
    generationTargets: targets,
    directResponseEvidence,
    artifacts: localArtifacts,
    renderedSemantics: rendered.artifact,
  };
}

describe("Stitch target candidate selection v2", { concurrency: 1 }, () => {
  it("regresses #2041, #2044, and #2045 through exact selection and response bindings v3", async () => {
    const value = await fixture({ variants: ["a", "b", "helper"] });
    const first = selectStitchTargetCandidatesV2(value);
    const second = selectStitchTargetCandidatesV2({
      ...value,
      artifacts: [...value.artifacts].reverse(),
    });
    assert.equal(first.status, "produced", JSON.stringify(first));
    assert.equal(second.status, "produced", JSON.stringify(second));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.deepEqual(second.candidateSelection, first.candidateSelection);
    assert.equal(first.candidateSelection.candidates.length, 3);

    const exactCandidates = first.candidateSelection.candidates
      .filter((candidate) => candidate.screenId !== "screen-helper")
      .sort((left, right) =>
        left.htmlArtifactHash!.localeCompare(right.htmlArtifactHash!)
        || left.screenshotArtifactHash!.localeCompare(right.screenshotArtifactHash!)
        || left.semanticObservationHash!.localeCompare(right.semanticObservationHash!)
        || left.screenId.localeCompare(right.screenId));
    const selection = first.candidateSelection.selections[0]!;
    assert.equal(selection.selectedScreenId, exactCandidates[0]!.screenId);
    assert.equal(selection.evaluations.length, 3, "every direct candidate must be evaluated");
    assert.equal(
      first.candidateSelection.candidates.find((candidate) =>
        candidate.screenId === "screen-helper")?.renderedStatus,
      "source_rejected",
    );

    const selectedEvaluation = selection.evaluations.find((evaluation) =>
      evaluation.screenId === selection.selectedScreenId)!;
    assert.deepEqual(
      selectedEvaluation.semanticChecks
        .filter((item) => item.kind === "control_slot")
        .map((item) => ({ ref: item.semanticRef, count: item.observedCount })),
      [{ ref: value.placement.controlSlotRef, count: 1 }],
      "#2045 affected canvas/status surfaces must not mint physical controls",
    );
    assert.deepEqual(
      selectedEvaluation.semanticChecks
        .filter((item) => item.kind === "surface_wrapper" && !item.semanticRef.includes("@"))
        .map((item) => item.semanticRef)
        .sort(),
      [value.target.surfaceRef, value.canvasSurface, value.statusSurface].sort(),
    );
    assert.equal(
      selectedEvaluation.semanticChecks.find((item) =>
        item.kind === "action_input" && item.semanticRef === `${value.placement.actionRef}.phase`)
        ?.disposition,
      "exact",
    );

    const selectedRendered = value.renderedSemantics.candidates.find((candidate) =>
      candidate.screenId === selection.selectedScreenId)!;
    const control = selectedRendered.elements.find((element) =>
      element.dataControlSlot === value.placement.controlSlotRef)!;
    assert.equal(control.tagName, "button");
    assert.equal(control.role, null, "#2041 native button must qualify through implicit semantics");
    assert.equal(control.nativeControlKind, "button");
    const statusReceipt = selectedRendered.roleReceipts.find((receipt) =>
      receipt.query.role === "status")!;
    assert.equal(statusReceipt.visibilityRequirement, "traceable_hidden_allowed");
    assert.deepEqual(statusReceipt.cardinality, { expected: 1, observed: 1, visible: 0 });

    const bound = bindStitchTargetCandidateSelectionsV3({
      generationTargets: value.generationTargets,
      candidateSelection: first.candidateSelection,
      renderedSemantics: value.renderedSemantics,
    });
    assert.equal(bound.status, "produced", JSON.stringify(bound));
    if (bound.status !== "produced") return;
    assert.equal(bound.responseBindings.schema, "setfarm.stitch-target-response-bindings.v3");
    const binding = bound.responseBindings.bindings[0]!;
    assert.equal(binding.targetHash, hashCanonicalJson(value.target));
    assert.equal(binding.surfaceBindings.length, 3);
    assert.equal(binding.controlSlotBindings.length, 1);
    assert.deepEqual(binding.controlSlotBindings[0]!.actionInputRefs, [
      `${value.placement.actionRef}.phase`,
    ]);
    assert.deepEqual(binding.actionInputBindings.map((item) => item.actionInputRef), [
      `${value.placement.actionRef}.phase`,
    ]);
    assert.equal(binding.actionInputBindings[0]!.elementRef, control.elementRef);
    assert.equal(binding.controlSlotBindings[0]!.elementRef, control.elementRef);
    assert.equal(binding.observableBindings.length, 3);
    assert.equal(
      binding.observableBindings.find((item) => item.selectorKind === "accessibility")
        ?.roleReceiptHash,
      hashCanonicalJson(statusReceipt),
    );
    assert.equal(binding.htmlSourceRefHash.length, 64);
    assert.equal(binding.htmlDownloadedArtifactHash, binding.htmlArtifactHash);
    assert.equal(binding.renderedHtmlArtifactHash, binding.htmlArtifactHash);

    const forged = structuredClone(first.candidateSelection);
    forged.selections[0]!.rankedQualifiedScreenIds.reverse();
    forged.selections[0]!.selectedScreenId = forged.selections[0]!.rankedQualifiedScreenIds[0]!;
    assert.equal(StitchTargetCandidateSelectionV2Schema.safeParse(forged).success, false);
  });

  it("does not turn an affecting-only action ref into a physical control contract", async () => {
    const value = await fixture({ affectingOnlyControl: true });
    const result = selectStitchTargetCandidatesV2(value);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    const evaluation = result.candidateSelection.selections[0]!.evaluations[0]!;
    assert.equal(evaluation.rejectionCodes.includes("CANDIDATE_UNDECLARED_ACTION"), true);
    assert.equal(evaluation.rejectionCodes.includes("CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL"), true);
    assert.deepEqual(
      evaluation.semanticChecks
        .filter((item) => item.kind === "control_slot")
        .map((item) => item.semanticRef),
      [value.placement.controlSlotRef],
    );
    assert.equal(
      evaluation.semanticChecks.some((item) => item.semanticRef === "ACT_AFFECT_ONLY"),
      false,
    );
  });

  it("rejects duplicate inputs, duplicate/undeclared surfaces, and uncontracted controls together", async () => {
    const value = await fixture({
      duplicateInput: true,
      duplicateCanvas: true,
      extraSurface: true,
      extraInteractive: true,
    });
    const result = selectStitchTargetCandidatesV2(value);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    const codes = result.candidateSelection.selections[0]!.evaluations[0]!.rejectionCodes;
    assert.equal(codes.includes("CANDIDATE_ACTION_INPUT_SET_MISMATCH"), true);
    assert.equal(codes.includes("CANDIDATE_SURFACE_SET_MISMATCH"), true);
    assert.equal(codes.includes("CANDIDATE_UNDECLARED_SURFACE"), true);
    assert.equal(codes.includes("CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL"), true);
  });

  it("preserves a renderer source rejection as candidate evidence instead of infrastructure", async () => {
    const value = await fixture({ executableScript: true });
    const result = selectStitchTargetCandidatesV2(value);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    const fact = result.candidateSelection.candidates[0]!;
    assert.equal(fact.renderedStatus, "source_rejected");
    assert.deepEqual(fact.semanticFailureCodes, ["UNSUPPORTED_EXECUTABLE_SCRIPT"]);
    assert.equal(
      result.candidateSelection.selections[0]!.evaluations[0]!.qualificationTier,
      "rendered_source_rejected",
    );
    assert.equal(
      result.candidateSelection.selections[0]!.evaluations[0]!.rejectionCodes
        .includes("CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED"),
      true,
    );
  });

  it("throws typed infrastructure errors for malformed or stale authority chains", async () => {
    const value = await fixture();
    assert.throws(
      () => selectStitchTargetCandidatesV2({
        ...value,
        generationTargets: {},
      }),
      (error: unknown) => error instanceof StitchCandidateSelectionInfrastructureErrorV2
        && error.code === "STITCH_SELECTION_V2_INPUT_INVALID"
        && error.phase === "input_validation",
    );

    const changedArtifacts = value.artifacts.map((artifact) => ({
      ...artifact,
      htmlBytes: Buffer.concat([Buffer.from(artifact.htmlBytes!), Buffer.from(" ")]),
    }));
    assert.throws(
      () => selectStitchTargetCandidatesV2({ ...value, artifacts: changedArtifacts }),
      (error: unknown) => error instanceof StitchCandidateSelectionInfrastructureErrorV2
        && error.code === "STITCH_SELECTION_V2_AUTHORITY_CHAIN_MISMATCH"
        && error.phase === "authority_chain_validation",
    );
    assert.notEqual(sha256(changedArtifacts[0]!.htmlBytes!), sha256(value.artifacts[0]!.htmlBytes!));
  });
});
