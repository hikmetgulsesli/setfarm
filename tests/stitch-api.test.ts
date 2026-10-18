import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import {
  collectScreenCandidatesFromResult,
  mergeScreenEntries,
  partitionDirectScreenCandidates,
} from "../scripts/stitch-response-parser.mjs";
import {
  StitchExplicitProviderRejection,
  assertToolResultOk,
  stitchCliFailureOutput,
} from "../scripts/stitch-api.mjs";
import {
  parseStitchStageProviderRejectionProcessEnvelopeV1,
} from "../src/product-compiler/stitch-stage-provider-rejection-v1.js";
import { validStitchHtml, validStitchPng } from "./product-compiler/fixtures/stitch-artifacts.js";

describe("stitch-api partial list recovery", () => {
  it("emits typed provider rejection only for top-level MCP isError", () => {
    let explicit: unknown;
    try {
      assertToolResultOk({
        isError: true,
        content: [{
          type: "text",
          text: "Request rejected token=secret-value",
        }],
      }, "generate_screen_from_text");
    } catch (error) {
      explicit = error;
    }
    assert.ok(explicit instanceof StitchExplicitProviderRejection);
    const typedOutput = stitchCliFailureOutput(explicit);
    const parsed = parseStitchStageProviderRejectionProcessEnvelopeV1({
      stdout: "",
      stderr: typedOutput.stderr,
    });
    assert.equal(parsed.diagnostic, "Request rejected token=[REDACTED]");

    let authorization: unknown;
    try {
      assertToolResultOk({
        isError: true,
        content: [{
          type: "text",
          text: "Authorization: Bearer FAKE_SECRET_123",
        }],
      }, "generate_screen_from_text");
    } catch (error) {
      authorization = error;
    }
    assert.ok(authorization instanceof StitchExplicitProviderRejection);
    const authorizationEnvelope = parseStitchStageProviderRejectionProcessEnvelopeV1({
      stdout: "",
      stderr: stitchCliFailureOutput(authorization).stderr,
    });
    assert.equal(authorizationEnvelope.diagnostic, "Authorization=[REDACTED]");
    assert.doesNotMatch(authorizationEnvelope.diagnostic, /Bearer|FAKE_SECRET_123/);

    for (const authorizationDiagnostic of [
      "Authorization: Digest username=alice, response=FAKE_SECRET_789",
      "Authorization: Bearer FIRST,FAKE_SECRET_789",
      "Authorization: Bearer FIRST_LINE\nFAKE_SECRET_CONTINUATION_999",
    ]) {
      let compoundAuthorization: unknown;
      try {
        assertToolResultOk({
          isError: true,
          content: [{ type: "text", text: authorizationDiagnostic }],
        }, "generate_screen_from_text");
      } catch (error) {
        compoundAuthorization = error;
      }
      assert.ok(compoundAuthorization instanceof StitchExplicitProviderRejection);
      const compoundEnvelope = parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: stitchCliFailureOutput(compoundAuthorization).stderr,
      });
      assert.equal(compoundEnvelope.diagnostic, "Authorization=[REDACTED]");
      assert.doesNotMatch(
        compoundEnvelope.diagnostic,
        /alice|FIRST|FAKE_SECRET_789|FAKE_SECRET_CONTINUATION_999/,
      );
    }

    for (const bearerDiagnostic of [
      "Bearer: FAKE_SECRET_456",
      "bearer=FAKE_SECRET_456",
      'Bearer: "FAKE\\\"_SECRET"',
      "Bearer: FIRST,FAKE_SECRET_789",
    ]) {
      let bearer: unknown;
      try {
        assertToolResultOk({
          isError: true,
          content: [{ type: "text", text: bearerDiagnostic }],
        }, "generate_screen_from_text");
      } catch (error) {
        bearer = error;
      }
      assert.ok(bearer instanceof StitchExplicitProviderRejection);
      const bearerEnvelope = parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: stitchCliFailureOutput(bearer).stderr,
      });
      assert.equal(bearerEnvelope.diagnostic, "Bearer=[REDACTED]");
      assert.doesNotMatch(bearerEnvelope.diagnostic, /FIRST|FAKE|SECRET/);
    }

    for (const structuredContent of [
      {
        screens: [{
          id: "partial-screen",
          title: "Partial Screen",
          htmlUrl: "https://example.invalid/partial.html",
        }],
      },
      { htmlUrl: "https://example.invalid/orphan-partial.html" },
    ]) {
      let partial: unknown;
      try {
        assertToolResultOk({
          isError: true,
          structuredContent,
          content: [{ type: "text", text: "provider reported a partial failure" }],
        }, "generate_screen_from_text");
      } catch (error) {
        partial = error;
      }
      assert.ok(partial instanceof Error);
      assert.equal(partial instanceof StitchExplicitProviderRejection, false);
      assert.throws(() => parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: stitchCliFailureOutput(partial).stderr,
      }));
    }

    let lookalike: unknown;
    try {
      assertToolResultOk({
        content: [{
          type: "text",
          text: JSON.stringify({ isError: true, message: "quota prose" }),
        }],
      }, "generate_screen_from_text");
    } catch (error) {
      lookalike = error;
    }
    assert.ok(lookalike instanceof Error);
    assert.equal(lookalike instanceof StitchExplicitProviderRejection, false);
    assert.throws(() => parseStitchStageProviderRejectionProcessEnvelopeV1({
      stdout: "",
      stderr: stitchCliFailureOutput(lookalike).stderr,
    }));
  });

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

  it("provides an attempt-owned direct command with no hidden generation replay", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");
    const start = source.indexOf("'generate-all-screens-attempt'");
    const end = source.indexOf("\n  },\n};", start);
    const command = source.slice(start, end);

    assert.ok(start > 0);
    assert.match(source, /async function rpcOnce\(method, params = \{\}\)/);
    assert.match(source, /async function generateScreenFromTextOnce\(args\)/);
    assert.match(command, /await initializeOnce\(\)/);
    assert.match(command, /await generateScreenFromTextOnce/);
    assert.match(command, /setfarm\.stitch-attempt-transport\.v1/);
    assert.doesNotMatch(command, /rotateKey|list_screens|mergeTrackedScreens|STITCH_GENERATE_ALL_RETRY_ATTEMPTS/);
  });

  it("seals one exact Stitch project identity without screen heuristics or hidden retries", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");
    const start = source.indexOf("'ensure-project-identity'");
    const end = source.indexOf("\n  },", start);
    const command = source.slice(start, end);

    assert.ok(start > 0);
    assert.match(command, /setfarm\.stitch-project-identity\.v1/);
    assert.match(command, /await initializeOnce\(\)/);
    assert.match(command, /rpcOnce\('tools\/call'/);
    assert.match(command, /String\(project\.title \|\| project\.displayName \|\| project\.name \|\| ''\) === name/);
    assert.match(command, /STITCH_PROJECT_IDENTITY_AMBIGUOUS/);
    assert.doesNotMatch(command, /htmlCount|trackedCount|rotateKey|callTool\(|includes\(name/);
  });

  it("can force a fresh Stitch project after an empty cached project failure", () => {
    const source = fs.readFileSync("scripts/stitch-api.mjs", "utf-8");

    assert.match(source, /STITCH_FORCE_NEW_PROJECT/);
    assert.match(source, /const forceNewProject = process\.env\.STITCH_FORCE_NEW_PROJECT === '1'/);
    assert.match(source, /forceNewProject \? null : await callTool\('list_projects'/);
    assert.match(source, /\.stitch-screens-' \+ existing\.projectId \+ '\.json/);
  });

  it("atomically removes stale output when a new download is not a valid PNG", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-download-"));
    const output = path.join(tmp, "screen.png");
    try {
      fs.writeFileSync(output, validStitchPng(1));
      assert.throws(() => execFileSync("node", [
        "scripts/stitch-api.mjs",
        "download",
        `data:image/png;base64,${Buffer.from("not-a-png").toString("base64")}`,
        output,
      ], { cwd: process.cwd(), stdio: "pipe" }));
      assert.equal(fs.existsSync(output), false);

      const expected = validStitchPng(2);
      execFileSync("node", [
        "scripts/stitch-api.mjs",
        "download",
        `data:image/png;base64,${expected.toString("base64")}`,
        output,
      ], { cwd: process.cwd(), stdio: "pipe" });
      assert.deepEqual(fs.readFileSync(output), expected);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
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

  it("preserves every bounded JSON fence in one Stitch text item", () => {
    const result = {
      content: [{
        type: "text",
        text: [
          "```json",
          JSON.stringify({ screens: [product("screen-a")] }),
          "```",
          "provider note",
          "```json",
          JSON.stringify({ screens: [product("screen-b")] }),
          "```",
        ].join("\n"),
      }],
    };
    const candidates = collectScreenCandidatesFromResult(result);
    assert.deepEqual(candidates.map((item) => item.screenId).sort(), ["screen-a", "screen-b"]);
  });

  it("detects same-ID conflicts split across separate JSON fences", () => {
    const first = product();
    const second = {
      ...product(),
      title: "Conflicting Canvas",
      htmlCode: { downloadUrl: "https://example.invalid/conflict.html" },
    };
    const result = {
      content: [{
        type: "text",
        text: `\`\`\`json\n${JSON.stringify({ screens: [first] })}\n\`\`\`\n\`\`\`json\n${JSON.stringify({ screens: [second] })}\n\`\`\``,
      }],
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));
    assert.equal(partition.screens.length, 0);
    assert.deepEqual(partition.evidence[0]?.identityConflicts, ["html_url", "title"]);
  });

  it("never lets an explicit Untitled placeholder overwrite an exact title", () => {
    const exact = {
      screenId: "product",
      title: "Status Page - Status Utility",
      titleExplicit: true,
      responsePaths: ["$exact"],
    };
    const placeholder = {
      screenId: "product",
      title: "Untitled",
      titleExplicit: true,
      responsePaths: ["$placeholder"],
    };
    assert.equal(mergeScreenEntries(exact, placeholder).title, exact.title);
    assert.equal(mergeScreenEntries(placeholder, exact).title, exact.title);
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

  it("does not treat a resource-name fallback as a conflicting explicit title", () => {
    const partial = {
      name: "projects/1/screens/product",
      htmlCode: { downloadUrl: "https://example.invalid/product.html" },
    };
    const completed = {
      name: "projects/1/screens/product",
      title: "Status Page - Status Utility",
      htmlCode: { downloadUrl: "https://example.invalid/product.html" },
      screenshot: { downloadUrl: "https://example.invalid/product.png" },
    };
    const result = {
      structuredContent: { screens: [partial] },
      content: [{ type: "text", text: JSON.stringify({ screens: [completed] }) }],
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));

    assert.equal(partition.screens.length, 1);
    assert.equal(partition.evidence[0]?.title, "Status Page - Status Utility");
    assert.deepEqual(partition.evidence[0]?.identityConflicts, []);
  });

  it("preserves an unsafe provider screen ID as excluded evidence", () => {
    const unsafe = {
      screenId: "../unsafe",
      title: "Status Page - Status Utility",
      htmlCode: { downloadUrl: "https://example.invalid/unsafe.html" },
      screenshot: { downloadUrl: "https://example.invalid/unsafe.png" },
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult({ screens: [unsafe] }));

    assert.equal(partition.screens.length, 0);
    assert.equal(partition.evidence[0]?.screenId, "../unsafe");
    assert.equal(partition.evidence[0]?.disposition, "excluded_identity_conflict");
    assert.deepEqual(partition.evidence[0]?.identityConflicts, ["screen_id"]);
  });

  it("excludes same-ID response occurrences with conflicting output identity", () => {
    const first = product();
    const second = {
      ...product(),
      title: "Conflicting Status Canvas",
      htmlCode: { downloadUrl: "https://example.invalid/other.html" },
    };
    const result = {
      structuredContent: { screens: [first] },
      content: [{ type: "text", text: JSON.stringify({ screens: [second] }) }],
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));

    assert.equal(partition.screens.length, 0);
    assert.equal(partition.evidence[0]?.disposition, "excluded_identity_conflict");
    assert.deepEqual(partition.evidence[0]?.identityConflicts, ["html_url", "title"]);
  });

  it("does not splice HTML and screenshot evidence from separate incomplete occurrences", () => {
    const htmlOnly = {
      name: "projects/1/screens/product",
      title: "Status Page - Status Utility",
      htmlCode: { downloadUrl: "https://example.invalid/product.html" },
    };
    const screenshotOnly = {
      name: "projects/1/screens/product",
      title: "Status Page - Status Utility",
      screenshot: { downloadUrl: "https://example.invalid/product.png" },
    };
    const result = {
      structuredContent: { screens: [htmlOnly] },
      content: [{ type: "text", text: JSON.stringify({ screens: [screenshotOnly] }) }],
    };
    const partition = partitionDirectScreenCandidates(collectScreenCandidatesFromResult(result));

    assert.equal(partition.screens.length, 0);
    assert.equal(partition.evidence[0]?.disposition, "excluded_identity_conflict");
    assert.deepEqual(partition.evidence[0]?.identityConflicts, ["render_evidence_splice"]);
  });

  it("does not treat project resources as screens", () => {
    const result = { structuredContent: { name: "projects/1", title: "Project" } };
    assert.deepEqual(collectScreenCandidatesFromResult(result), []);
  });
});

// These cases catch obsolete outgoing model IDs, silent override rewriting, and
// hidden replay at the external boundary, while keeping request construction real.
function runGenerationCommandOffline(command: string, model?: string, mode = "accept") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-model-"));
  try {
    const capturePath = path.join(root, "requests.jsonl");
    const promptPath = path.join(root, "prompt.md");
    const outputDir = path.join(root, "output");
    const preloadPath = path.join(root, "transport.mjs");
    fs.writeFileSync(promptPath, "Generate the Status Page");
    const fixture = {
      html: validStitchHtml("<main><h1>Status Page</h1></main>").toString("base64"),
      png: validStitchPng(173).toString("base64"),
      capturePath,
      mode,
    };
    fs.writeFileSync(preloadPath, `
import { appendFileSync } from "node:fs";
const fixture = ${JSON.stringify(fixture)};
// Literal enum from the retained 2026-10-18 tools/list, independent of defaults.
const supported = new Set(["MODEL_ID_UNSPECIFIED", "GEMINI_3_8_FLASH", "GEMINI_3_5_FLASH_LITE"]);
globalThis.fetch = async (url, options) => {
  if (String(url) === "https://example.invalid/status.html") {
    return new Response(Buffer.from(fixture.html, "base64"));
  }
  if (String(url) === "https://example.invalid/status.png") {
    return new Response(Buffer.from(fixture.png, "base64"));
  }
  if (String(url) !== "https://stitch.googleapis.com/mcp" || !options?.body) {
    throw new Error("Unexpected external request: " + url);
  }
  const request = JSON.parse(options.body);
  appendFileSync(fixture.capturePath, JSON.stringify(request) + "\\n");
  let result;
  if (request.method === "initialize") {
    result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "offline-stitch", version: "1" } };
  } else if (request.method === "tools/call" && request.params.name === "generate_screen_from_text") {
    if (fixture.mode === "ambiguous") throw new TypeError("fetch failed after dispatch");
    if (fixture.mode === "reject" || !supported.has(request.params.arguments.modelId)) {
      result = { isError: true, content: [{ type: "text", text: "INVALID_ARGUMENT: unsupported modelId " + request.params.arguments.modelId }] };
    } else {
      result = { structuredContent: { screens: [{
        name: "projects/123/screens/status", title: "Status Page", width: "1280", height: "800",
        htmlCode: { downloadUrl: "https://example.invalid/status.html" },
        screenshot: { downloadUrl: "https://example.invalid/status.png" }
      }] } };
    }
  } else if (request.method === "tools/call" && request.params.name === "get_project") {
    result = { content: [{ type: "text", text: JSON.stringify({ name: "projects/123", title: "Status Utility", designMd: "# Status Utility" }) }] };
  } else {
    throw new Error("Unexpected RPC: " + JSON.stringify(request));
  }
  return Response.json({ jsonrpc: "2.0", id: request.id, result });
};
`);
    const args = command === "generate-screen" ? ["123", "Generate the Status Page"]
      : command === "generate-screen-safe" ? ["123", "Generate the Status Page", "Status Page"]
      : command === "generate-all-screens" ? ["123", promptPath]
      : ["123", promptPath, outputDir];
    if (model !== undefined) args.push("DESKTOP", model);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !key.startsWith("STITCH_") && key !== "NODE_OPTIONS"));
    const execution = spawnSync(process.execPath, [
      "--import", preloadPath, path.resolve("scripts/stitch-api.mjs"), command, ...args,
    ], { cwd: root, env: { ...env, STITCH_API_KEY: "offline-dummy-only" }, encoding: "utf8", timeout: 15_000 });
    assert.equal(execution.error, undefined);
    const requests = fs.readFileSync(capturePath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const artifactRoot = command === "generate-all-screens-attempt" ? outputDir : path.join(root, "stitch");
    return {
      exitCode: execution.status,
      stdout: execution.stdout,
      stderr: execution.stderr,
      requests,
      artifacts: fs.existsSync(artifactRoot) ? fs.readdirSync(artifactRoot).sort() : [],
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("stitch-api live model request compatibility", () => {
  for (const command of ["generate-screen", "generate-screen-safe", "generate-all-screens", "generate-all-screens-attempt"]) {
    for (const model of [undefined, "GEMINI_3_5_FLASH_LITE"]) {
      it(`${command} sends ${model ?? "the supported default"} in actual request JSON`, () => {
        const result = runGenerationCommandOffline(command, model);
        const generation = result.requests.filter((request) => request.params?.name === "generate_screen_from_text");
        assert.equal(generation.length, 1);
        assert.equal(generation[0].params.arguments.modelId, model ?? "GEMINI_3_8_FLASH");
        assert.equal(generation[0].params.arguments.deviceType, "DESKTOP");
        assert.equal(generation[0].params.arguments.projectId, "123");
        assert.equal(result.exitCode, 0, result.stderr);
        assert.equal(JSON.parse(result.stdout).screens[0].title, "Status Page");
        if (command !== "generate-screen") {
          assert.deepEqual(result.artifacts, ["status.html", "status.png"]);
        }
      });
    }
  }

  for (const mode of ["reject", "ambiguous"]) {
    it(`does not replay exact-attempt generation after ${mode}`, () => {
      const result = runGenerationCommandOffline("generate-all-screens-attempt", "GEMINI_3_5_FLASH_LITE", mode);
      assert.equal(result.exitCode, 1);
      assert.deepEqual(result.requests.map((request) => request.method === "tools/call" ? request.params.name : request.method),
        ["initialize", "generate_screen_from_text"]);
      assert.equal(result.requests[1].params.arguments.modelId, "GEMINI_3_5_FLASH_LITE");
      assert.deepEqual(result.artifacts, []);
      if (mode === "reject") {
        const rejection = parseStitchStageProviderRejectionProcessEnvelopeV1({ stdout: result.stdout, stderr: result.stderr });
        assert.equal(rejection.classification, "explicit_mcp_error_before_accepted_result");
      } else {
        assert.match(result.stderr, /fetch failed after dispatch/);
        assert.doesNotMatch(result.stderr, /setfarm.stitch-stage-provider-rejection.v1/);
      }
    });
  }

  it("preserves explicit unsupported model bytes and reports rejection without fallback", () => {
    const result = runGenerationCommandOffline("generate-all-screens-attempt", " GEMINI_3_5_FLASH_LITE ");
    assert.equal(result.exitCode, 1);
    assert.equal(result.requests.length, 2);
    assert.equal(result.requests[1].params.arguments.modelId, " GEMINI_3_5_FLASH_LITE ");
    assert.deepEqual(result.artifacts, []);
  });
});
