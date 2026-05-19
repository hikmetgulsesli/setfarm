import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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

  it("parses Stitch screens from structured and embedded MCP response shapes", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /function collectScreensFromResult\(result\)/);
    assert.match(source, /node\.structuredContent\?\.screens/);
    assert.match(source, /node\.structured_content\?\.screens/);
    assert.match(source, /jsonPayloadsFromToolText\(item\.text\)/);
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
