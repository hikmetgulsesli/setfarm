import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { selectStitchTargetCandidatesV2 } from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
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
  StitchRenderedCandidateV2Schema,
  StitchRenderedElementV2Schema,
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
  readonlyDisplay?: boolean;
  displayInputType?: "text" | "email";
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
  if (options.readonlyDisplay) {
    statusObservable.selector.role = "textbox";
    statusObservable.selector.name = "Display value";
    statusObservable.assertions = [
      { phase: "after", property: "value", operator: "equals", expected: "ready" },
      { phase: "after", property: "visibility", operator: "equals", expected: true },
      { phase: "reload", property: "value", operator: "equals", expected: "ready" },
      { phase: "reload", property: "visibility", operator: "equals", expected: true },
    ];
  }
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
    observable.selector.kind === "accessibility" && observable.selector.role !== "button")!;
  assert.equal(statusSelector.selector.kind, "accessibility");
  if (statusSelector.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusAccessibilitySelector = statusSelector.selector;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusAccessibilitySelector.surfaceRef)!;
  const status = options.readonlyDisplay
    ? `<input type="${options.displayInputType ?? "text"}" readonly aria-label="Display value" value="ready">`
    : `<div ${options.hiddenStatus ? "hidden " : ""}role="${statusAccessibilitySelector.role}" aria-label="Game status">Playing</div>`;
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

function expandCandidates(
  value: ReturnType<typeof fixture>,
  extraHtmlByCandidate: readonly string[],
): ReturnType<typeof fixture> {
  const baseCandidate = value.directResponseEvidence.batches[0]!.candidates[0]!;
  const baseHtml = value.artifacts[0]!.htmlBytes.toString("utf8");
  const screenshotBytes = value.artifacts[0]!.screenshotBytes;
  const artifacts = extraHtmlByCandidate.map((extraHtml, index) => {
    const screenId = `${baseCandidate.screenId}-${String(index).padStart(3, "0")}`;
    const htmlBytes = Buffer.from(baseHtml.replace("</body>", `${extraHtml}</body>`), "utf8");
    return { screenId, htmlBytes, screenshotBytes };
  });
  return {
    ...value,
    directResponseEvidence: {
      ...value.directResponseEvidence,
      batches: [{
        ...value.directResponseEvidence.batches[0]!,
        candidates: artifacts.map((artifact, index) => ({
          ...baseCandidate,
          screenId: artifact.screenId,
          responsePaths: [`$result.screens[${index}]`],
          ...stitchDownloadReceipts(
            artifact.screenId,
            artifact.htmlBytes,
            artifact.screenshotBytes,
          ),
        })),
      }],
    },
    artifacts,
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

  it("follows one same-origin Tailwind redirect and seals the final runtime bytes", async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      requests.push(url);
      if (url === "https://cdn.tailwindcss.com/?plugins=forms,container-queries") {
        return new Response(null, {
          status: 302,
          headers: { location: "/3.4.17?plugins=forms@0.5.10,container-queries@0.1.1" },
        });
      }
      if (
        url
        === "https://cdn.tailwindcss.com/3.4.17?plugins=forms@0.5.10,container-queries@0.1.1"
      ) {
        return new Response("/* sealed Tailwind runtime */", {
          status: 200,
          headers: { "content-type": "application/javascript" },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;
    try {
      const value = fixture({
        scriptMarkup: '<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>',
      });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(capture.artifact.candidates[0]!.status, "rendered");
      assert.deepEqual(requests, [
        "https://cdn.tailwindcss.com/?plugins=forms,container-queries",
        "https://cdn.tailwindcss.com/3.4.17?plugins=forms@0.5.10,container-queries@0.1.1",
      ]);
      assert.equal(capture.artifact.resources.length, 1);
      assert.equal(capture.artifact.resources[0]!.resourceType, "script");
      const resource = [...capture.sidecars.resources.values()][0]!;
      assert.equal(resource.toString("utf8"), "/* sealed Tailwind runtime */");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reuses one immutable resource capture across multiple rendered candidates", async () => {
    const originalFetch = globalThis.fetch;
    const scriptUrl = "https://cdn.tailwindcss.com/3.4.17";
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(`/* response ${requests} */`, {
        status: 200,
        headers: { "content-type": "application/javascript" },
      });
    }) as typeof fetch;
    try {
      const value = expandCandidates(
        fixture({ scriptMarkup: `<script src="${scriptUrl}"></script>` }),
        ["", ""],
      );
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(requests, 1);
      assert.deepEqual(
        capture.artifact.candidates.map((candidate) => candidate.status),
        ["rendered", "rendered"],
      );
      assert.equal(capture.artifact.resources.length, 1);
      assert.equal(
        [...capture.sidecars.resources.values()][0]!.toString("utf8"),
        "/* response 1 */",
      );
      assert.deepEqual(
        capture.artifact.candidates.map((candidate) => candidate.resourceRefs),
        [[capture.artifact.resources[0]!.urlHash], [capture.artifact.resources[0]!.urlHash]],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("source-rejects 1,001 candidate resources before outbound work", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(Buffer.alloc(0), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }) as typeof fetch;
    try {
      const images = Array.from({ length: 1_001 }, (_, index) =>
        `<img alt="" src="https://lh3.googleusercontent.com/aida-public/candidate-${index}">`).join("");
      const value = fixture({ extraHtml: images });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(requests, 0);
      assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
      assert.deepEqual(
        capture.artifact.candidates[0]!.failureCodes,
        ["RESOURCE_CAPACITY_EXCEEDED"],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("source-rejects 10,001 aggregate resources before outbound work", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      throw new Error("Aggregate capacity must reject before fetch");
    }) as typeof fetch;
    try {
      const extras = Array.from({ length: 11 }, (_, candidateIndex) =>
        Array.from({ length: 910 }, (_, resourceIndex) =>
          `<img alt="" src="https://lh3.googleusercontent.com/aida-public/aggregate-${candidateIndex}-${resourceIndex}">`).join(""));
      const value = expandCandidates(fixture(), extras);
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(requests, 0);
      assert.equal(capture.artifact.resources.length, 0);
      assert.deepEqual(
        capture.artifact.candidates.map((candidate) => candidate.failureCodes),
        Array.from({ length: 11 }, () => ["RESOURCE_CAPACITY_EXCEEDED"]),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("charges failed chunked bodies to the capture-wide network budget", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1024 * 1024));
          controller.enqueue(new Uint8Array(1024 * 1024));
          controller.enqueue(new Uint8Array([requests]));
          controller.close();
        },
      }), {
        status: 200,
        headers: { "content-type": "application/javascript" },
      });
    }) as typeof fetch;
    try {
      const extras = Array.from({ length: 10 }, (_, index) =>
        `<script src="https://cdn.tailwindcss.com/oversized-${index}"></script>`);
      const value = expandCandidates(fixture(), extras);
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(requests, 4);
      assert.deepEqual(
        capture.artifact.candidates.map((candidate) => candidate.failureCodes),
        Array.from({ length: 10 }, () => ["RESOURCE_CAPACITY_EXCEEDED"]),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("cancels a declared oversized body before reading it", async () => {
    const originalFetch = globalThis.fetch;
    let cancellations = 0;
    globalThis.fetch = (async () => new Response(new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("Oversized declared body must not be read");
      },
      cancel() {
        cancellations += 1;
      },
    }), {
      status: 200,
      headers: {
        "content-length": String(3 * 1024 * 1024),
        "content-type": "application/javascript",
      },
    })) as typeof fetch;
    try {
      const value = fixture({
        scriptMarkup: '<script src="https://cdn.tailwindcss.com/oversized"></script>',
      });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(cancellations, 1);
      assert.deepEqual(
        capture.artifact.candidates[0]!.failureCodes,
        ["RESOURCE_CAPACITY_EXCEEDED"],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves the typed prefetch phase when native fetch throws offline", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("offline fixture"), { code: "ECONNRESET" }),
      });
    }) as typeof fetch;
    try {
      const value = fixture({ scriptMarkup: '<script src="https://cdn.tailwindcss.com"></script>' });
      await assert.rejects(
        captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" }),
        (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
          && error.code === "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"
          && error.phase === "resource_prefetch",
      );
      assert.equal(requests, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("cancels a non-success response body before reporting infrastructure", async () => {
    const originalFetch = globalThis.fetch;
    let cancellations = 0;
    globalThis.fetch = (async () => new Response(new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("Non-success response body must not be read");
      },
      cancel() {
        cancellations += 1;
      },
    }), {
      status: 500,
      headers: { "content-type": "text/plain" },
    })) as typeof fetch;
    try {
      const value = fixture({
        scriptMarkup: '<script src="https://cdn.tailwindcss.com/unavailable"></script>',
      });
      await assert.rejects(
        captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" }),
        (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
          && error.code === "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"
          && error.phase === "resource_prefetch",
      );
      assert.equal(cancellations, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("source-rejects a Tailwind redirect outside the exact resource origin", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/runtime.js" },
      });
    }) as typeof fetch;
    try {
      const value = fixture({
        scriptMarkup: '<script src="https://cdn.tailwindcss.com"></script>',
      });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(capture.artifact.candidates[0]!.status, "source_rejected");
      assert.deepEqual(
        capture.artifact.candidates[0]!.failureCodes,
        ["UNSUPPORTED_EXECUTABLE_SCRIPT"],
      );
      assert.equal(requests, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("seals approved Google font bytes inside the declared stylesheet", async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      requests.push(url);
      if (url === "https://fonts.googleapis.com/css2?family=Test&display=swap") {
        assert.match(new Headers(init?.headers).get("user-agent") ?? "", /Chrome\//u);
        return new Response(
          '@font-face{font-family:"Test";src:url("https://fonts.gstatic.com/s/test/v1/test.woff2") format("woff2")}',
          { status: 200, headers: { "content-type": "text/css; charset=utf-8" } },
        );
      }
      if (url === "https://fonts.gstatic.com/s/test/v1/test.woff2") {
        return new Response(Uint8Array.from([0, 1, 2]), {
          status: 200,
          headers: { "content-type": "font/woff2" },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;
    try {
      const value = fixture({
        extraHtml: [
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Test&amp;display=swap">',
          '<style>main{font-family:"Test"}</style>',
        ].join(""),
      });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(capture.artifact.candidates[0]!.status, "rendered");
      assert.deepEqual(requests, [
        "https://fonts.googleapis.com/css2?family=Test&display=swap",
        "https://fonts.gstatic.com/s/test/v1/test.woff2",
      ]);
      assert.equal(capture.artifact.resources.length, 1);
      assert.equal(capture.artifact.resources[0]!.resourceType, "stylesheet");
      const stylesheet = [...capture.sidecars.resources.values()][0]!.toString("utf8");
      assert.match(stylesheet, /data:font\/woff2;base64,AAEC/u);
      assert.doesNotMatch(stylesheet, /fonts\.gstatic\.com/u);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("seals approved Stitch image bytes as an identity-bound render resource", async () => {
    const originalFetch = globalThis.fetch;
    const imageUrl = "https://lh3.googleusercontent.com/aida-public/exact-image";
    let requests = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      assert.equal(url, imageUrl);
      requests += 1;
      return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }) as typeof fetch;
    try {
      const value = fixture({
        extraHtml: `<img alt="Decorative system avatar" src="${imageUrl}">`,
      });
      const capture = await captureStitchRenderedSemanticsV2({
        ...value,
        deviceType: "DESKTOP",
      });
      assert.equal(capture.artifact.candidates[0]!.status, "rendered");
      assert.equal(requests, 1);
      assert.equal(capture.artifact.resources.length, 1);
      assert.equal(capture.artifact.resources[0]!.resourceType, "image");
      assert.equal(capture.artifact.resources[0]!.contentType, "image/jpeg");
      assert.deepEqual(
        [...capture.sidecars.resources.values()][0],
        Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      );
      assert.deepEqual(
        capture.artifact.candidates[0]!.resourceRefs,
        [capture.artifact.resources[0]!.urlHash],
      );
      const semanticDom = [...capture.sidecars.semanticDom.values()][0]!.toString("utf8");
      assert.match(semanticDom, /lh3\.googleusercontent\.com\/aida-public\/exact-image/u);
      const root = await mkdtemp(path.join(tmpdir(), "setfarm-rendered-image-v2-"));
      roots.push(root);
      await writeStitchRenderedSemanticsV2(root, capture);
      assert.deepEqual(
        await verifyStitchRenderedSemanticsReplayV2({ repo: root }),
        capture.artifact,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
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


describe("native input state and recorded-shape replay", { concurrency: 1 }, () => {
  it("observes normalized DOM input properties for every native input only", async () => {
    const value = fixture({ readonlyDisplay: true, extraHtml: [
      '<input aria-label="Default type">',
      '<input type="not-a-type" readonly aria-label="Invalid type defaults to text">',
      '<input type="TEXT" readonly contenteditable="true" aria-label="Editable ancestor flag">',
      '<input type="text" readonly="false" aria-label="Boolean readonly attribute">',
      '<div contenteditable="true"><input type="text" readonly aria-label="Inherited editable state"></div>',
      '<input type="text" aria-readonly="true" aria-label="ARIA only">',
      '<input type="text" disabled aria-label="Disabled only">',
      '<input type="checkbox" readonly aria-label="Checkbox">',
      '<input type="radio" readonly aria-label="Radio">',
      '<input type="range" readonly aria-label="Range">',
      '<div role="textbox" aria-readonly="true" aria-label="Non-native">ready</div>',
    ].join("") });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    const candidate = capture.artifact.candidates[0]!;
    assert.equal(candidate.status, "rendered");
    const expected = [
      ["Display value", "text", true, false],
      ["Default type", "text", false, false],
      ["Invalid type defaults to text", "text", true, false],
      ["Editable ancestor flag", "text", true, true],
      ["Boolean readonly attribute", "text", true, false],
      ["Inherited editable state", "text", true, true],
      ["ARIA only", "text", false, false],
      ["Disabled only", "text", false, false],
      ["Checkbox", "checkbox", true, false],
      ["Radio", "radio", true, false],
      ["Range", "range", true, false],
    ] as const;
    const inputs = candidate.elements.filter((element) => element.tagName === "input");
    assert.equal(inputs.length, expected.length);
    for (const [label, inputType, readOnly, contentEditable] of expected) {
      const element: any = inputs.find((item) => item.ariaLabel === label);
      assert.equal(element?.nativeControlKind, "input", label);
      assert.deepEqual(element.nativeInputState, { inputType, readOnly, contentEditable }, label);
    }
    for (const element of candidate.elements.filter((item) => item.tagName !== "input")) {
      assert.equal(Object.hasOwn(element, "nativeInputState"), false, element.tagName);
    }
    assert.equal(candidate.observationHash, hashCanonicalJson({ elements: candidate.elements, roleReceipts: candidate.roleReceipts }));
  });

  it("strictly validates complete native-only state and all-or-none candidate shapes", async () => {
    const value = fixture({ readonlyDisplay: true, extraHtml: '<input type="text" aria-label="Second input">' });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    const candidate: any = structuredClone(capture.artifact.candidates[0]!);
    for (const element of candidate.elements) {
      if (element.tagName === "input") element.nativeInputState = { inputType: "text", readOnly: true, contentEditable: false };
    }
    const rehash = (item: any) => {
      item.observationHash = hashCanonicalJson({ elements: item.elements, roleReceipts: item.roleReceipts });
      return item;
    };
    rehash(candidate);
    assert.equal(StitchRenderedCandidateV2Schema.safeParse(candidate).success, true);
    const native = candidate.elements.find((element: any) => element.tagName === "input");
    for (const state of [
      {}, { inputType: "text", readOnly: true },
      { inputType: "text", contentEditable: false }, { readOnly: true, contentEditable: false },
      { inputType: "text", readOnly: true, contentEditable: false, ariaReadOnly: true },
      { inputType: "", readOnly: true, contentEditable: false },
      { inputType: "x".repeat(51), readOnly: true, contentEditable: false },
      { inputType: 1, readOnly: true, contentEditable: false },
      { inputType: "text", readOnly: "true", contentEditable: false },
      { inputType: "text", readOnly: true, contentEditable: "false" },
      null,
    ]) {
      assert.equal(StitchRenderedElementV2Schema.safeParse({ ...native, nativeInputState: state }).success, false, JSON.stringify(state));
    }
    for (const mismatch of [
      { tagName: "div", nativeControlKind: null },
      { tagName: "input", nativeControlKind: null },
      { tagName: "div", nativeControlKind: "input" },
    ]) {
      assert.equal(StitchRenderedElementV2Schema.safeParse({ ...native, ...mismatch }).success, false, JSON.stringify(mismatch));
    }
    const mixed = structuredClone(candidate);
    delete mixed.elements.find((element: any) => element.tagName === "input").nativeInputState;
    assert.equal(StitchRenderedCandidateV2Schema.safeParse(rehash(mixed)).success, false, "mixed state must fail after valid rehash");
    const legacy = structuredClone(candidate);
    for (const element of legacy.elements) delete element.nativeInputState;
    assert.equal(StitchRenderedCandidateV2Schema.safeParse(rehash(legacy)).success, true);
    const staleHash = structuredClone(candidate);
    staleHash.elements.find((element: any) => element.tagName === "input").nativeInputState.readOnly = false;
    assert.equal(StitchRenderedCandidateV2Schema.safeParse(staleHash).success, false, "state is covered by observation hash");
  });

  it("round-trips new native state and detects semantic changes behind valid sidecar hashes", async () => {
    const value = fixture({ readonlyDisplay: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-native-input-replay-v2-"));
    roots.push(root);
    await writeStitchRenderedSemanticsV2(root, capture);
    assert.deepEqual(await verifyStitchRenderedSemanticsReplayV2({ repo: root }), capture.artifact);
    const sourceCandidate = capture.artifact.candidates[0]!;
    const dom = capture.sidecars.semanticDom.get(sourceCandidate.semanticDom!.locator)!;
    for (const [label, mutate] of [
      ["readonly", (html: string) => html.replace(/ readonly(?:="")?/, "")],
      ["type", (html: string) => html.replace('type="text"', 'type="email"')],
      ["contenteditable", (html: string) => html.replace('type="text"', 'type="text" contenteditable="true"')],
    ] as const) {
      const bytes = Buffer.from(mutate(dom.toString("utf8")), "utf8");
      assert.notDeepEqual(bytes, dom, label);
      if (label === "type") {
        // Email without a datalist preserves the textbox receipt. A fresh genuine
        // capture proves old census fields/receipts cannot cause this mismatch.
        const emailValue = fixture({ readonlyDisplay: true, displayInputType: "email" });
        assert.doesNotMatch(emailValue.artifacts[0]!.htmlBytes.toString("utf8"), /\blist\s*=/u);
        const emailCapture = await captureStitchRenderedSemanticsV2({ ...emailValue, deviceType: "DESKTOP" });
        const emailCandidate = emailCapture.artifact.candidates[0]!;
        assert.equal(emailCandidate.status, "rendered");
        const oldElementFields = (elements: readonly unknown[]) => elements.map((element) => {
          const { nativeInputState: _state, ...recordedFields } = element as Record<string, unknown>;
          return recordedFields;
        });
        assert.deepEqual(oldElementFields(emailCandidate.elements), oldElementFields(sourceCandidate.elements));
        assert.deepEqual(emailCandidate.roleReceipts, sourceCandidate.roleReceipts);
        const onlyTypeChanged: any = structuredClone(sourceCandidate.elements);
        const textInput = onlyTypeChanged.find((element: any) => element.ariaLabel === "Display value");
        assert.deepEqual(textInput.nativeInputState, { inputType: "text", readOnly: true, contentEditable: false });
        textInput.nativeInputState.inputType = "email";
        assert.deepEqual(emailCandidate.elements, onlyTypeChanged,
          "native inputType must be the only changed observed field");
        assert.deepEqual(emailCapture.sidecars.semanticDom.get(emailCandidate.semanticDom!.locator), bytes,
          "fresh email capture must seal the exact controlled replay DOM");
      }
      const changed = structuredClone(capture.artifact);
      const candidate = changed.candidates[0]!;
      candidate.semanticDom = {
        ...candidate.semanticDom!, hash: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.byteLength,
      };
      // Deliberately reseal only a disposable test sidecar. Recorded observation
      // and all its state fields stay fixed so replay equality must detect it.
      await writeStitchRenderedSemanticsV2(root, {
        artifact: changed, artifactHash: hashCanonicalJson(changed),
        sidecars: { resources: capture.sidecars.resources, semanticDom: new Map([[candidate.semanticDom.locator, bytes]]) },
      });
      await assert.rejects(verifyStitchRenderedSemanticsReplayV2({ repo: root }),
        (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
          && error.code === "STITCH_RENDERER_V2_REPLAY_MISMATCH" && error.phase === "replay_observation", label);
    }
    await writeStitchRenderedSemanticsV2(root, capture);
    await writeFile(path.join(root, sourceCandidate.semanticDom!.locator), "tampered", "utf8");
    await assert.rejects(verifyStitchRenderedSemanticsReplayV2({ repo: root }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_SIDECAR_INVALID" && error.phase === "replay_read");
  });

  it("replays a synthetic legacy shape unchanged and never enriches it for readonly admission", async () => {
    const value = fixture({ readonlyDisplay: true });
    const capture = await captureStitchRenderedSemanticsV2({ ...value, deviceType: "DESKTOP" });
    // Construct a disposable legacy fixture before sealing it; no saved or
    // historical artifact is upgraded, rewritten, or promoted.
    const legacy: any = structuredClone(capture.artifact);
    const candidate = legacy.candidates[0];
    for (const element of candidate.elements) delete element.nativeInputState;
    candidate.observationHash = hashCanonicalJson({ elements: candidate.elements, roleReceipts: candidate.roleReceipts });
    const originalHash = candidate.observationHash;
    const originalBytes = JSON.stringify(legacy);
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-legacy-input-replay-v2-"));
    roots.push(root);
    await writeStitchRenderedSemanticsV2(root, { ...capture, artifact: legacy, artifactHash: hashCanonicalJson(legacy) });
    const artifactPath = path.join(root, "stitch", "STITCH_RENDERED_SEMANTICS_V2.json");
    const recordedBytes = await readFile(artifactPath);
    const domPath = path.join(root, candidate.semanticDom.locator);
    const recordedDom = await readFile(domPath);
    const replayed = await verifyStitchRenderedSemanticsReplayV2({ repo: root });
    assert.deepEqual(await readFile(artifactPath), recordedBytes, "legacy replay must not rewrite recorded artifact bytes");
    assert.deepEqual(await readFile(domPath), recordedDom, "legacy replay must not rewrite recorded DOM bytes");
    assert.equal(JSON.stringify(legacy), originalBytes);
    assert.deepEqual(replayed, legacy);
    assert.equal(replayed.candidates[0]!.observationHash, originalHash);
    for (const element of replayed.candidates[0]!.elements) assert.equal(Object.hasOwn(element, "nativeInputState"), false);
    const selection = selectStitchTargetCandidatesV2({ ...value, renderedSemantics: replayed });
    assert.equal(selection.status, "rejected");
    assert.equal(selection.candidateSelection.selections[0]!.evaluations[0]!.rejectionCodes
      .includes("CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL"), true);

    // Recorded-shape projection may drop only nativeInputState, never an old field.
    const changedDom = Buffer.from(recordedDom.toString("utf8").replace(
      `data-action="${value.placement.actionRef}"`, 'data-action="ACT_CHANGED"',
    ), "utf8");
    assert.notDeepEqual(changedDom, recordedDom);
    const changedLegacy = structuredClone(legacy);
    changedLegacy.candidates[0].semanticDom.hash = createHash("sha256").update(changedDom).digest("hex");
    changedLegacy.candidates[0].semanticDom.byteLength = changedDom.byteLength;
    await writeStitchRenderedSemanticsV2(root, {
      artifact: changedLegacy, artifactHash: hashCanonicalJson(changedLegacy),
      sidecars: { resources: capture.sidecars.resources, semanticDom: new Map([[candidate.semanticDom.locator, changedDom]]) },
    });
    await assert.rejects(verifyStitchRenderedSemanticsReplayV2({ repo: root }),
      (error: unknown) => error instanceof StitchRenderedSemanticsInfrastructureErrorV2
        && error.code === "STITCH_RENDERER_V2_REPLAY_MISMATCH" && error.phase === "replay_observation");
  });
});
