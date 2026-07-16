import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  collectScreenCandidatesFromResult,
  mergeScreenEntries,
  partitionDirectScreenCandidates,
} from "../scripts/stitch-response-parser.mjs";
import { validStitchPng } from "./product-compiler/fixtures/stitch-artifacts.js";

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
