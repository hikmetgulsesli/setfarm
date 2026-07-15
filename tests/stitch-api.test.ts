import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  collectScreenCandidatesFromResult,
  partitionDirectScreenCandidates,
} from "../scripts/stitch-response-parser.mjs";

describe("stitch-api partial list recovery", () => {
  it("merges tracked screens into partial Stitch API lists", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function mergeTrackedScreens\(projectId, screens\)/);
    assert.match(source, /screenList = mergeTrackedScreens\(projectId, screenList\)/);
    assert.match(source, /screens = mergeTrackedScreens\(projectId, screens\)/);
    assert.match(source, /htmlFile: `\$\{screenId\}\.html`/);
    assert.match(source, /HTML-CACHE/);
  });

  it("keeps batch generation on a long enough RPC timeout", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function rpcTimeoutMs\(\)/);
    assert.match(source, /STITCH_RPC_TIMEOUT_MS/);
    assert.match(source, /600_000/);
    assert.match(source, /AbortSignal\.timeout\(rpcTimeoutMs\(\)\)/);
    assert.doesNotMatch(source, /AbortSignal\.timeout\(300_000\)/);
  });

  it("uses the list_screens parser for zero-screen batch recovery", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /const listedScreens = parseScreenList\(listResult\)/);
    assert.match(source, /screens\.push\(\.\.\.listedScreens\)/);
    assert.doesNotMatch(source, /const listed = parseScreens\(listResult\)/);
  });

  it("delegates Stitch response parsing to the bounded response-schema decoder", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");
    const parser = fs.readFileSync("scripts/stitch-response-parser.mjs", "utf-8");

    assert.match(source, /collectScreenCandidatesFromResult/);
    assert.match(source, /partitionDirectScreenCandidates/);
    assert.doesNotMatch(source, /function screenSourceArrays/);
    assert.match(parser, /function screenEntriesAtResponseBoundary/);
    assert.doesNotMatch(parser, /for \(const child of Object\.values/);
    assert.match(source, /describeToolResultShape\(result\)/);
  });

  it("fails explicit MCP tool errors before treating the response as generated screens", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function assertToolResultOk\(result, toolName\)/);
    assert.match(source, /result\?\.isError/);
    assert.match(source, /toolResultError\(result\)/);
    assert.match(source, /assertToolResultOk\(result, 'generate_screen_from_text'\)/);
    assert.match(source, /async function generateScreenFromText\(args\)/);
  });

  it("includes redacted Stitch text diagnostics for zero-screen responses", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function redactDiagnosticText\(text\)/);
    assert.match(source, /AQ\\\.\[A-Za-z0-9_-\]\+/);
    assert.match(source, /function toolResultTextSample\(result, maxLength = 700\)/);
    assert.match(source, /textSample: textSample \|\| undefined/);
    assert.match(source, /0-screen Stitch response:/);
    assert.match(source, /diagnostic: screens\.length === 0 \? zeroScreenDiagnostic : undefined/);
  });

  it("rotates backup Stitch API keys only for key and quota failures", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function loadApiKeys\(\)/);
    assert.match(source, /function processApiKeys\(\)/);
    assert.match(source, /const fromProcess = processApiKeys\(\)/);
    assert.match(source, /if \(fromProcess\.length > 0\) return fromProcess/);
    assert.match(source, /STITCH_API_KEYS/);
    assert.match(source, /\^STITCH_API_KEY_\\d\+\$/);
    assert.match(source, /function rotateKey\(reason\)/);
    assert.match(source, /function shouldRotateForStitchFailure\(text\)/);
    assert.match(source, /async function generateScreenFromText\(args\)/);
    assert.match(source, /retryableEmptyResponse/);
    assert.match(source, /resource exhausted/);
    assert.match(source, /api key not valid/);
    const rotateBody = source.slice(source.indexOf("function shouldRotateForStitchFailure"));
    assert.doesNotMatch(rotateBody, /service unavailable|temporarily unavailable|\\b503\\b/);
  });

  it("can force a fresh Stitch project after an empty cached project failure", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /STITCH_FORCE_NEW_PROJECT/);
    assert.match(source, /const forceNewProject = process\.env\.STITCH_FORCE_NEW_PROJECT === '1'/);
    assert.match(source, /forceNewProject \? null : await callTool\('list_projects'/);
    assert.match(source, /\.stitch-screens-' \+ existing\.projectId \+ '\.json/);
  });
});

describe("stitch-api direct response identity", () => {
  const helper = (id: string, title: string) => ({
    name: `projects/1/screens/${id}`,
    title,
    width: "512",
    height: "512",
    htmlCode: { downloadUrl: `https://example.invalid/${id}.html` },
  });
  const product = (id = "product") => ({
    name: `projects/1/screens/${id}`,
    title: "Status Page - Status Utility",
    width: "2560",
    height: "2048",
    htmlCode: { downloadUrl: `https://example.invalid/${id}.html` },
    screenshot: { downloadUrl: `https://example.invalid/${id}.png` },
  });

  it("excludes code canvas nodes by render evidence without title reconciliation", () => {
    const result = {
      structuredContent: {
        outputComponents: [
          { design: { screens: [helper("three", "Three.js")] } },
          { design: { screens: [helper("shader", "Shader")] } },
          { design: { screens: [product()] } },
        ],
      },
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));

    assert.equal(partition.candidates.length, 3);
    assert.deepEqual(partition.screens.map((screen) => screen.screenId), ["product"]);
    assert.deepEqual(partition.excluded.map((screen) => screen.screenId), ["three", "shader"]);
    assert.deepEqual(
      partition.evidence.filter((item) => item.disposition === "excluded_missing_render_evidence")
        .map((item) => ({ id: item.screenId, missing: item.missingEvidence })),
      [
        { id: "shader", missing: ["screenshot"] },
        { id: "three", missing: ["screenshot"] },
      ],
    );
  });

  it("ignores arbitrary nested design.screens descendants", () => {
    const result = {
      structuredContent: {
        screens: [product()],
        debug: { nested: { design: { screens: [product("rogue")] } } },
      },
    };
    const candidates = collectScreenCandidatesFromResult(result);

    assert.deepEqual(candidates.map((screen) => screen.screenId), ["product"]);
  });

  it("records the exact snake-case response boundary when the transport uses it", () => {
    const result = {
      structured_content: {
        output_components: [{ design: { screens: [product()] } }],
      },
    };
    const evidence = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result)).evidence;

    assert.deepEqual(evidence[0]?.responsePaths, [
      "$result.structured_content.output_components[0].design.screens[0]",
    ]);
  });

  it("merges structured and embedded direct evidence without losing richer fields", () => {
    const partial = {
      name: "projects/1/screens/product",
      title: "Status Page - Status Utility",
      htmlCode: { downloadUrl: "https://example.invalid/product.html" },
    };
    const result = {
      structuredContent: { outputComponents: [{ design: { screens: [partial] } }] },
      content: [{
        type: "text",
        text: JSON.stringify({ outputComponents: [{ design: { screens: [product()] } }] }),
      }],
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));

    assert.equal(partition.screens.length, 1);
    assert.equal(partition.screens[0]?.screenshotUrl, "https://example.invalid/product.png");
    assert.equal(partition.evidence[0]?.responsePaths.length, 2);
  });

  it("does not treat project resources as screens", () => {
    const result = { structuredContent: { name: "projects/1", title: "Project" } };
    assert.deepEqual(collectScreenCandidatesFromResult(result), []);
  });
});
