import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  captureStitchRenderedSemanticsV2,
  openStitchRenderContextV2,
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
  inlineEventHandler?: boolean;
  inlineEventMarkup?: string;
  dataActionValueSuffix?: string;
  extraHtml?: string;
  rawTextStyleProbe?: boolean;
  scriptMarkup?: string;
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
    `<button data-action="${placement.actionRef}${options.dataActionValueSuffix ?? ""}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusAccessibilitySelector.surfaceRef}">${status}${options.duplicateStatus ? status : ""}</section>`,
    "</main>",
    options.inlineEventHandler
      ? "<svg onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\"></svg>"
      : "",
    options.inlineEventMarkup ?? "",
    options.extraHtml ?? "",
    options.rawTextStyleProbe
      ? `<style>button[data-action="${placement.actionRef} onclick='literal-raw-text'"]{display:none}</style>`
      : "",
    options.scriptMarkup ?? "",
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
  it("retries one transient browser-context closure before rendering", async () => {
    let launches = 0;
    let closes = 0;
    const context = { marker: "stable-context", on: () => undefined };
    const opened = await openStitchRenderContextV2({
      profile: {
        id: "desktop-1280x800.v1",
        deviceType: "DESKTOP",
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: "light",
        reducedMotion: "reduce",
      },
      phase: "browser_launch",
    }, {
      launchBrowser: async () => {
        launches += 1;
        return {
          version: () => "test-chromium",
          newContext: async () => {
            if (launches === 1) throw new Error("Target page, context or browser has been closed");
            return context as never;
          },
          close: async () => { closes += 1; },
        } as never;
      },
    });

    assert.equal(launches, 2);
    assert.equal(closes, 1);
    assert.equal(opened.version, "test-chromium");
    assert.equal(opened.context, context);
  });

  it("closes both failed browsers and preserves the typed error after retry exhaustion", async () => {
    let launches = 0;
    let closes = 0;
    await assert.rejects(
      openStitchRenderContextV2({
        profile: {
          id: "desktop-1280x800.v1",
          deviceType: "DESKTOP",
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          locale: "en-US",
          timezoneId: "UTC",
          colorScheme: "light",
          reducedMotion: "reduce",
        },
        phase: "browser_launch",
      }, {
        launchBrowser: async () => {
          launches += 1;
          return {
            version: () => "test-chromium",
            newContext: async () => {
              throw new Error("Target page, context or browser has been closed");
            },
            close: async () => { closes += 1; },
          } as never;
        },
      }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_BROWSER_UNAVAILABLE"
        && error.phase === "browser_launch",
    );
    assert.equal(launches, 2);
    assert.equal(closes, 2);
  });

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

  it("neutralizes inline event attributes before browser render", async () => {
    const value = fixture({ inlineEventHandler: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    const candidate = capture.artifact.candidates[0]!;

    assert.equal(candidate.status, "rendered");
    assert.deepEqual(candidate.failureCodes, []);
    assert.equal(
      candidate.elements.some((element) =>
        element.dataAction === value.placement.actionRef
        && element.dataControlSlot === value.placement.controlSlotRef),
      true,
    );
    assert.equal(candidate.htmlArtifactHash, createHash("sha256").update(value.artifacts[0]!.htmlBytes).digest("hex"));
  });

  it("neutralizes tokenizer edge-case handlers without changing neighboring attributes", async () => {
    const safeToNeutralize = [
      "<svg data-note=\">\" onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\"></svg>",
      "<style>@keyframes setfarm-handler-probe{from{opacity:.99}to{opacity:1}}</style><svg style=\"animation:setfarm-handler-probe 1ms\" onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\" onanimationstart=\"document.querySelector('[data-control-slot]').removeAttribute('data-control-slot')\"></svg>",
      "<style onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\">.safe{display:block}</style>",
      "<script onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\">tailwind.config={theme:{}}</script>",
    ];
    for (const inlineEventMarkup of safeToNeutralize) {
      const value = fixture({ inlineEventMarkup });
      const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
      const candidate = capture.artifact.candidates[0]!;
      assert.equal(candidate.status, "rendered", inlineEventMarkup);
      assert.equal(
        candidate.elements.some((element) =>
          element.dataAction === value.placement.actionRef
          && element.dataControlSlot === value.placement.controlSlotRef),
        true,
        inlineEventMarkup,
      );
    }

    const malformedSolidus = fixture({
      inlineEventMarkup:
        "<svg/onload=\"document.querySelector('[data-action]').removeAttribute('data-action')\"></svg>",
    });
    const malformedCapture = await captureStitchRenderedSemanticsV2({
      ...malformedSolidus,
      deviceType: "DESKTOP",
    });
    assert.equal(malformedCapture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      malformedCapture.artifact.candidates[0]!.failureCodes,
      ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
    );

    const embeddedText = fixture({ dataActionValueSuffix: " onclick='globalThis.forged=true'" });
    const embeddedCapture = await captureStitchRenderedSemanticsV2({
      ...embeddedText,
      deviceType: "DESKTOP",
    });
    assert.equal(
      embeddedCapture.artifact.candidates[0]!.elements.some((element) =>
        element.dataAction === embeddedText.placement.actionRef),
      false,
    );

    const rawText = fixture({ rawTextStyleProbe: true });
    const rawTextCapture = await captureStitchRenderedSemanticsV2({
      ...rawText,
      deviceType: "DESKTOP",
    });
    const rawTextControl = rawTextCapture.artifact.candidates[0]!.elements.find((element) =>
      element.dataAction === rawText.placement.actionRef);
    assert.equal(rawTextControl?.renderState, "rendered");
  });

  it("source-rejects structurally parsed executable URLs and script sources", async () => {
    const attacks = [
      "<a href=javascript:document.body.dataset.pwned=1>unsafe</a>",
      "<a href=\"java&#x73;cript:document.body.dataset.pwned=1\">unsafe</a>",
      "<a href=\"java&#x0a;script:document.body.dataset.pwned=1\">unsafe</a>",
      "<a xlink:href=\"javascript:document.body.dataset.pwned=1\">unsafe</a>",
    ];
    for (const extraHtml of attacks) {
      const value = fixture({ extraHtml });
      const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
      assert.equal(capture.artifact.candidates[0]!.status, "source_rejected", extraHtml);
      assert.deepEqual(
        capture.artifact.candidates[0]!.failureCodes,
        ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
        extraHtml,
      );
    }

    const script = fixture({ scriptMarkup: "<script src=https://evil.example/app.js></script>" });
    const scriptCapture = await captureStitchRenderedSemanticsV2({
      ...script,
      deviceType: "DESKTOP",
    });
    assert.equal(scriptCapture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      scriptCapture.artifact.candidates[0]!.failureCodes,
      ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
    );

    const rawText = fixture({ extraHtml: "<style>.unterminated{" });
    const rawTextCapture = await captureStitchRenderedSemanticsV2({
      ...rawText,
      deviceType: "DESKTOP",
    });
    assert.equal(rawTextCapture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(
      rawTextCapture.artifact.candidates[0]!.failureCodes,
      ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
    );
  });

  it("fails closed on per-candidate and aggregate HTML capacity", async () => {
    const oversized = fixture({ extraHtml: "x".repeat(2 * 1024 * 1024) });
    const oversizedCapture = await captureStitchRenderedSemanticsV2({
      ...oversized,
      deviceType: "DESKTOP",
    });
    assert.deepEqual(
      oversizedCapture.artifact.candidates[0]!.failureCodes,
      ["RESOURCE_CAPACITY_EXCEEDED"],
    );

    const aggregate = fixture();
    const aggregateCapture = await captureStitchRenderedSemanticsV2({
      ...aggregate,
      artifacts: [
        ...aggregate.artifacts,
        ...Array.from({ length: 4 }, (_, index) => ({
          screenId: `unused-capacity-${index}`,
          htmlBytes: Buffer.alloc(2 * 1024 * 1024, 0x20),
          screenshotBytes: validStitchPng(150 + index),
        })),
      ],
      deviceType: "DESKTOP",
    });
    assert.deepEqual(
      aggregateCapture.artifact.candidates[0]!.failureCodes,
      ["RESOURCE_CAPACITY_EXCEEDED"],
    );

    const nestingDepth = 5_000;
    const deeplyNested = fixture({
      extraHtml: `${"<div>".repeat(nestingDepth)}safe${"</div>".repeat(nestingDepth)}`,
    });
    const deeplyNestedCapture = await captureStitchRenderedSemanticsV2({
      ...deeplyNested,
      deviceType: "DESKTOP",
    });
    assert.deepEqual(
      deeplyNestedCapture.artifact.candidates[0]!.failureCodes,
      ["RESOURCE_CAPACITY_EXCEEDED"],
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
