import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  captureStitchRenderedSemanticsV2,
  StitchRenderedSemanticsInfrastructureErrorV2,
  verifyStitchRenderedSemanticsReplayV2,
  writeStitchRenderedSemanticsV2,
} from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  StitchGetByRoleReceiptV2Schema,
  StitchRenderedCandidateFailureCodeV2Schema,
} from "../../src/product-compiler/schemas/stitch-rendered-semantics-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const roots: string[] = [];

after(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fixture(options: Readonly<{
  hiddenStatus?: boolean;
  statusMustBeVisibleBefore?: boolean;
  duplicateStatus?: boolean;
  executableScript?: boolean;
  unclosedScript?: boolean;
  undeclaredStylesheet?: boolean;
  role?: string;
}> = {}) {
  const proposal = containedGamePlanProposalV2();
  const startObservable = proposal.actions[0].observables.find((observable: any) =>
    observable.key === "start_control");
  startObservable.selector = {
    kind: "accessibility",
    surfaceKey: "play_page",
    role: "button",
    name: "Start Game",
  };
  startObservable.assertions = [
    { phase: "before", property: "visibility", operator: "equals", expected: true },
    { phase: "after", property: "visibility", operator: "equals", expected: true },
  ];
  const statusObservable = proposal.actions[0].observables.find((observable: any) =>
    observable.key === "status_text");
  if (options.statusMustBeVisibleBefore) {
    statusObservable.assertions.unshift({
      phase: "before",
      property: "visibility",
      operator: "equals",
      expected: true,
    });
  }
  if (options.role) statusObservable.selector.role = options.role;

  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal,
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const targets = produceDesignGenerationTargetsV2(compiled.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets));
  if (targets.status !== "produced") throw new Error("unreachable");
  const target = targets.generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusSelector = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility" && observable.selector.name === "Game status")!;
  assert.equal(statusSelector.selector.kind, "accessibility");
  if (statusSelector.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusAccessibilitySelector = statusSelector.selector;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusAccessibilitySelector.surfaceRef)!;
  const status = `<div ${options.hiddenStatus ? "hidden " : ""}role="${statusAccessibilitySelector.role}" aria-label="Game status">Playing</div>`;
  const htmlBytes = validStitchHtml([
    options.undeclaredStylesheet
      ? '<style>@import url("https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.css");</style>'
      : "",
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusAccessibilitySelector.surfaceRef}">${status}${options.duplicateStatus ? status : ""}</section>`,
    "</main>",
    options.executableScript ? "<script>globalThis.applicationCodeRan=true</script>" : "",
    options.unclosedScript ? "<script>globalThis.unclosedApplicationCodeRan=true" : "",
  ].join(""), "rendered-semantics-v2");
  const screenshotBytes = validStitchPng(121);
  const screenId = "screen-rendered-semantics-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "rendered-semantics-v2-test",
    batches: [{
      stageId: "stage-rendered-semantics-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  return {
    target,
    placement,
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts: [{ screenId, htmlBytes, screenshotBytes }],
  };
}

describe("Stitch rendered semantics v2", { concurrency: 1 }, () => {
  it("binds implicit native-button and hidden after-only roles to exact browser receipts", async () => {
    const value = fixture({ hiddenStatus: true });
    const capture = await captureStitchRenderedSemanticsV2({
      ...value,
      deviceType: "DESKTOP",
    });
    const candidate = capture.artifact.candidates[0]!;
    assert.equal(candidate.status, "rendered");
    assert.equal(candidate.targetRef, value.target.targetId);

    const button = candidate.elements.find((element) =>
      element.dataControlSlot === value.placement.controlSlotRef)!;
    assert.equal(button.tagName, "button");
    assert.equal(button.role, null, "native button must not need a literal role attribute");
    assert.equal(button.dataAction, value.placement.actionRef);

    const buttonReceipt = candidate.roleReceipts.find((receipt) =>
      receipt.query.role === "button")!;
    assert.equal(buttonReceipt.query.method, "getByRole");
    assert.equal(buttonReceipt.query.name, "Start Game");
    assert.equal(buttonReceipt.visibilityRequirement, "must_be_visible_before");
    assert.deepEqual(buttonReceipt.phases, ["before", "after"]);
    assert.deepEqual(buttonReceipt.cardinality, { expected: 1, observed: 1, visible: 1 });
    assert.deepEqual(buttonReceipt.elementRefs, [button.elementRef]);
    const missingElementReceipt: any = structuredClone(buttonReceipt);
    missingElementReceipt.elementRefs = [];
    missingElementReceipt.nearestSurfaceRefs = [];
    missingElementReceipt.cardinality.observed = 0;
    assert.equal(StitchGetByRoleReceiptV2Schema.safeParse(missingElementReceipt).success, false);
    const ambiguousElementReceipt: any = structuredClone(buttonReceipt);
    ambiguousElementReceipt.elementRefs.push("E999999");
    ambiguousElementReceipt.nearestSurfaceRefs.push(buttonReceipt.surfaceRef);
    ambiguousElementReceipt.cardinality.observed = 2;
    assert.equal(StitchGetByRoleReceiptV2Schema.safeParse(ambiguousElementReceipt).success, false);

    const statusReceipt = candidate.roleReceipts.find((receipt) =>
      receipt.query.role === "status")!;
    assert.equal(statusReceipt.visibilityRequirement, "traceable_hidden_allowed");
    assert.deepEqual(statusReceipt.phases, ["after"]);
    assert.deepEqual(statusReceipt.cardinality, { expected: 1, observed: 1, visible: 0 });
    assert.equal(statusReceipt.nearestSurfaceRefs[0], statusReceipt.surfaceRef);
    assert.equal(
      candidate.observationHash,
      hashCanonicalJson({ elements: candidate.elements, roleReceipts: candidate.roleReceipts }),
    );
  });

  it("writes canonical v2 sidecars and replays elements plus role receipts fully offline", async () => {
    const value = fixture({ hiddenStatus: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-rendered-semantics-v2-"));
    roots.push(root);
    await writeStitchRenderedSemanticsV2(root, capture);
    const replayed = await verifyStitchRenderedSemanticsReplayV2({ repo: root });
    assert.deepEqual(replayed, capture.artifact);

    const semanticDom = replayed.candidates[0]!.semanticDom!;
    await writeFile(path.join(root, semanticDom.locator), "tampered", "utf8");
    await assert.rejects(
      verifyStitchRenderedSemanticsReplayV2({ repo: root }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_SIDECAR_INVALID"
        && error.phase === "replay_read",
    );
  });

  it("source-rejects a hidden before-visible observable without converting it to infrastructure", async () => {
    const value = fixture({ hiddenStatus: true, statusMustBeVisibleBefore: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      capture.artifact.candidates[0]!.failureCodes,
      ["OBSERVABLE_BEFORE_VISIBLE_MISSING"],
    );
  });

  it("source-rejects non-unique role evidence with exact cardinality semantics", async () => {
    const value = fixture({ duplicateStatus: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      capture.artifact.candidates[0]!.failureCodes,
      ["OBSERVABLE_ROLE_CARDINALITY_MISMATCH"],
    );
  });

  it("keeps unsafe application code as a typed source rejection", async () => {
    const value = fixture({ executableScript: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      capture.artifact.candidates[0]!.failureCodes,
      ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
    );

    const unclosed = fixture({ unclosedScript: true });
    const unclosedCapture = await captureStitchRenderedSemanticsV2({
      ...unclosed,
      deviceType: "DESKTOP",
    });
    assert.equal(unclosedCapture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      unclosedCapture.artifact.candidates[0]!.failureCodes,
      ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
    );
  });

  it("fails closed when source CSS discovers a resource outside the presealed first-level set", async () => {
    const value = fixture({ undeclaredStylesheet: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      capture.artifact.candidates[0]!.failureCodes,
      ["RESOURCE_POLICY_VIOLATION"],
    );
  });

  it("throws typed infrastructure phases for invalid inputs and unsupported browser roles", async () => {
    await assert.rejects(
      captureStitchRenderedSemanticsV2({
        generationTargets: {},
        directResponseEvidence: {},
        artifacts: [],
        deviceType: "DESKTOP",
      }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_INPUT_INVALID"
        && error.phase === "input_validation",
    );

    const value = fixture({ role: "not-a-playwright-role" });
    await assert.rejects(
      captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_INPUT_INVALID"
        && error.phase === "input_validation",
    );
    assert.equal(StitchRenderedCandidateFailureCodeV2Schema.safeParse("NORMALIZATION_FAILED").success, false);
  });
});
