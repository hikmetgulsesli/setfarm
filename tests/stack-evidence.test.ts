import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evidenceClassesForStep,
  isBrowserRuntimeStack,
  stackRuntimeKind,
} from "../dist/installer/stack-evidence.js";
import { getStackPack } from "../dist/installer/stack-contract/packs.js";
import type { StackContract } from "../dist/installer/stack-contract/types.js";

function contract(packId: string): StackContract {
  const pack = getStackPack(packId as any);
  return {
    schema: "setfarm.stack-contract.v1",
    status: "resolved",
    packId: pack.id,
    label: pack.label,
    confidence: "high",
    reason: "test",
    taskHints: [],
    evidence: [],
    setup: pack.setup,
    fileContract: pack.fileContract,
    routeContract: pack.routeContract,
    verification: pack.verification,
    prompt: pack.prompt,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

test("browser runtime detection is stack-pack driven", () => {
  assert.equal(isBrowserRuntimeStack(contract("vite-react-web-app")), true);
  assert.equal(isBrowserRuntimeStack(contract("nextjs-web-app")), true);
  assert.equal(isBrowserRuntimeStack(contract("android-app")), false);
  assert.equal(isBrowserRuntimeStack(contract("ios-app")), false);
  assert.equal(isBrowserRuntimeStack(contract("node-express-api")), false);
});

test("quality evidence classes change by runtime kind", () => {
  assert.deepEqual(evidenceClassesForStep("qa-test", contract("vite-react-web-app")), ["smoke", "dom", "visual"]);
  assert.deepEqual(evidenceClassesForStep("qa-test", contract("android-app")), ["smoke"]);
  assert.deepEqual(evidenceClassesForStep("security-gate", contract("ios-app")), ["security"]);
  assert.deepEqual(evidenceClassesForStep("deploy", contract("node-express-api")), ["deploy"]);
});

test("runtime kind separates browser, native, server, and cli stacks", () => {
  assert.equal(stackRuntimeKind(contract("vite-react-web-app")), "browser");
  assert.equal(stackRuntimeKind(contract("react-native-expo")), "native");
  assert.equal(stackRuntimeKind(contract("python-web")), "server");
  assert.equal(stackRuntimeKind(contract("python-cli")), "cli");
});

test("vite stack declares deterministic runtime and tool preflight contracts", () => {
  const pack = getStackPack("vite-react-web-app");
  assert.equal(pack.runtime?.portPolicy, "allocated_by_mc");
  assert.equal(pack.runtime?.portBand, "preview");
  assert.match(pack.runtime?.previewCommand || "", /--strictPort/);
  assert.ok(pack.toolPreflight?.some((tool) => tool.tool === "agent-browser" && tool.required));
});

test("stack evidence delegates runtime decisions to stack modules", () => {
  const source = readFileSync(new URL("../src/installer/stack-evidence.ts", import.meta.url), "utf-8");
  assert.match(source, /stackModuleForContract/);
  assert.doesNotMatch(source, /const BROWSER_PACKS/);
});
