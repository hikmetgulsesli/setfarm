import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { produceDesignGenerationTargetsV1 } from "../../src/product-compiler/producers/design-targets.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import {
  captureStitchRenderedSemanticsV1,
  StitchRenderedSemanticsInfrastructureError,
  verifyStitchRenderedSemanticsReplayV1,
  writeStitchRenderedSemanticsV1,
} from "../../src/product-compiler/producers/stitch-rendered-semantics.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

const roots: string[] = [];

after(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fixture(body: (surfaceRef: string) => string) {
  const product = produceProductSpecV1({ task: TASK });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const target = targets.generationTargets.targets[0]!;
  const htmlBytes = validStitchHtml(body(target.surfaceRef), "rendered-semantics");
  const screenshotBytes = validStitchPng(91);
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "rendered-semantics-test",
    batches: [{
      stageId: "stage-rendered-semantics",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId: "screen-rendered-semantics",
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts("screen-rendered-semantics", htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  return {
    target,
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts: [{ screenId: "screen-rendered-semantics", htmlBytes, screenshotBytes }],
  };
}

describe("Stitch rendered semantics v1", { concurrency: 1 }, () => {
  it("uses the exact locked Chromium CSS cascade for responsive contract elements", async () => {
    const value = fixture((surfaceRef) => [
      "<style>",
      ".hidden{display:none}",
      "@media(min-width:768px){.md\\:flex{display:flex}.md\\:hidden{display:none}}",
      "</style>",
      `<main data-surface-id="${surfaceRef}">`,
      '<div class="hidden md:flex"><button data-action="ACT_REFRESH_STATUS">Desktop refresh</button></div>',
      '<div class="md:hidden"><button data-action="ACT_REFRESH_STATUS">Mobile refresh</button></div>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join(""));
    const capture = await captureStitchRenderedSemanticsV1({
      ...value,
      deviceType: "DESKTOP",
    });
    const candidate = capture.artifact.candidates[0]!;
    assert.equal(candidate.status, "rendered");
    assert.match(capture.artifact.renderer.playwrightVersion, /^\d+\.\d+\.\d+$/);
    assert.match(capture.artifact.renderer.chromiumRevision, /^\d+$/);
    assert.deepEqual(
      candidate.elements
        .filter((element) => element.dataAction === "ACT_REFRESH_STATUS")
        .map((element) => ({ state: element.renderState, blockers: element.renderBlockers })),
      [
        { state: "rendered", blockers: [] },
        { state: "not_rendered", blockers: ["ancestor_display_none", "zero_geometry"] },
      ],
    );
  });

  it("writes canonical sidecars and replays them with all network resources sealed", async () => {
    const value = fixture((surfaceRef) => [
      "<style>.hidden{display:none}@media(min-width:768px){.md\\:flex{display:flex}}</style>",
      `<main data-surface-id="${surfaceRef}">`,
      '<button class="hidden md:flex" data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join(""));
    const capture = await captureStitchRenderedSemanticsV1({ ...value, deviceType: "DESKTOP" });
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-rendered-semantics-"));
    roots.push(root);
    await writeStitchRenderedSemanticsV1(root, capture);
    const replayed = await verifyStitchRenderedSemanticsReplayV1({ repo: root });
    assert.deepEqual(replayed, capture.artifact);

    const semanticDom = replayed.candidates[0]!.semanticDom!;
    await writeFile(path.join(root, semanticDom.locator), "tampered", "utf8");
    await assert.rejects(
      verifyStitchRenderedSemanticsReplayV1({ repo: root }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureError
        && error.code === "STITCH_RENDERER_SIDECAR_INVALID",
    );
  });

  it("rejects executable application code without running it", async () => {
    const value = fixture((surfaceRef) => [
      `<main data-surface-id="${surfaceRef}">`,
      '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
      "<script>globalThis.applicationCodeRan=true</script>",
    ].join(""));
    const capture = await captureStitchRenderedSemanticsV1({ ...value, deviceType: "DESKTOP" });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(capture.artifact.candidates[0]!.failureCodes, ["UNSUPPORTED_EXECUTABLE_SCRIPT"]);
  });

  it("seals local artifacts to the direct-response download receipts", async () => {
    const value = fixture((surfaceRef) => [
      `<main data-surface-id="${surfaceRef}">`,
      '<button data-action="ACT_REFRESH_STATUS">Refresh</button>',
      '<button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused">Pause</button>',
      "</main>",
    ].join(""));
    const evidence = structuredClone(value.directResponseEvidence);
    evidence.batches[0]!.candidates[0]!.htmlDownloadedArtifactHash = "0".repeat(64);
    const capture = await captureStitchRenderedSemanticsV1({
      ...value,
      directResponseEvidence: evidence,
      deviceType: "DESKTOP",
    });
    assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
    assert.deepEqual(capture.artifact.candidates[0]!.failureCodes, ["ARTIFACT_HASH_MISMATCH"]);
  });
});
