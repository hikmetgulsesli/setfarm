import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStackContract } from "../src/installer/stack-contract/reconcile.js";
import { readStackContract, stackContractPath, writeStackContract } from "../src/installer/stack-contract/ledger.js";
import { getStackPack, listStackPacks } from "../src/installer/stack-contract/packs.js";
import { applyStackContractContext } from "../src/installer/stack-contract/context.js";
import { parseStackPrefix, stripStackPrefix } from "../src/installer/stack-contract/prefix.js";
import { validateAllStackPacks } from "../src/installer/stack-contract/validators.js";
import { resolveProductDeliverySelectionV1 } from "../src/product-compiler/product-delivery-profile-catalog.js";

function tmpDir(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `setfarm-${name}-`));
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file: string, value = ""): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

describe("stack contract", () => {
  it("treats explicit task prefixes as authoritative stack selection", () => {
    const repo = tmpDir("stack-prefix");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        scripts: { build: "next build" },
      });
      writeText(path.join(repo, "app/page.tsx"), "");

      const game = resolveStackContract({ repoPath: repo, taskText: "game: Build a compact browser puzzle with keyboard controls." });
      assert.equal(game.packId, "browser-game-canvas");
      assert.equal(game.requestedPrefix, "game");
      assert.equal(game.normalizedTaskText, "Build a compact browser puzzle with keyboard controls.");
      assert.match(game.reason, /explicit task prefix/);

      const next = resolveStackContract({ repoPath: repo, taskText: "nextjs: Build a playable route editor game-like dashboard." });
      assert.equal(next.packId, "nextjs-web-app");
      assert.equal(next.requestedPrefix, "nextjs");

      const android = resolveStackContract({ repoPath: repo, taskText: "android: Build the same workflow for phones." });
      assert.equal(android.packId, "android-app");
      assert.equal(android.normalizedTaskText, "Build the same workflow for phones.");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("parses prefix aliases without treating ordinary colons as stack commands", () => {
    assert.deepEqual(parseStackPrefix("python: Build a FastAPI status API")?.packId, "python-web");
    assert.deepEqual(parseStackPrefix("python: Build a terminal backup tool")?.packId, "python-cli");
    assert.deepEqual(parseStackPrefix("rn: Build a mobile habit tracker")?.packId, "react-native-expo");
    assert.deepEqual(parseStackPrefix("react: Build a frontend dashboard")?.packId, "vite-react-web-app");
    assert.deepEqual(parseStackPrefix("frontend: Build an ops panel")?.packId, "vite-react-web-app");
    assert.deepEqual(parseStackPrefix("static: Build a simple docs page")?.packId, "static-html-site");
    assert.deepEqual(parseStackPrefix("backend: Build a REST service")?.packId, "node-express-api");
    assert.deepEqual(parseStackPrefix("node: Build a terminal release tool")?.packId, "node-cli");
    assert.deepEqual(parseStackPrefix("node: Build an Express API")?.packId, "node-express-api");
    assert.deepEqual(parseStackPrefix("typescript: Build a browser admin tool")?.packId, "vite-react-web-app");
    assert.deepEqual(parseStackPrefix("swiftui: Build an iPhone habit tracker")?.packId, "ios-app");
    assert.deepEqual(parseStackPrefix("kotlin: Build an Android field app")?.packId, "android-app");
    assert.deepEqual(parseStackPrefix("electron: Build a desktop notes app")?.packId, "desktop-electron");
    assert.equal(parseStackPrefix("Project: Build a web app"), null);
    assert.equal(stripStackPrefix("game: Build NeonSwitch"), "Build NeonSwitch");
  });

  it("detects Vite React projects from package evidence", () => {
    const repo = tmpDir("stack-vite");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0", "@vitejs/plugin-react": "^5.0.0" },
        scripts: { build: "vite build", dev: "vite" },
      });
      writeText(path.join(repo, "src/main.tsx"), "");

      const contract = resolveStackContract({ repoPath: repo, taskText: "Build a compact web dashboard." });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "vite-react-web-app");
      assert.equal(contract.confidence, "high");
      assert.match(contract.prompt, /Vite React stack contract/);
      assert.doesNotMatch(contract.prompt, /Next\.js routing/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects Next.js projects from package and route evidence", () => {
    const repo = tmpDir("stack-next");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        scripts: { build: "next build", dev: "next dev" },
      });
      writeText(path.join(repo, "next.config.mjs"), "export default {};\n");
      writeText(path.join(repo, "app/page.tsx"), "export default function Page() { return null; }\n");

      const contract = resolveStackContract({ repoPath: repo, taskText: "Build a Next.js admin app." });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "nextjs-web-app");
      assert.equal(contract.routeContract.router, "next");
      assert.match(contract.prompt, /Next\.js stack contract/);
      assert.doesNotMatch(contract.prompt, /Vite SPA/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("selects browser-game-canvas over generic Vite when the PRD is a browser game", () => {
    const repo = tmpDir("stack-game");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
        scripts: { build: "vite build", dev: "vite" },
      });

      const contract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a browser game called Tetris with playable falling blocks, scoring, pause, restart, and keyboard controls.",
      });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "browser-game-canvas");
      assert.match(contract.prompt, /game loop/);
      assert.match(contract.verification.visual.join("\n"), /gameplay/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not select browser-game-canvas for explicit non-game web tools", () => {
    const repo = tmpDir("stack-non-game-tool");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0", "@vitejs/plugin-react": "^5.0.0" },
        scripts: { build: "vite build", dev: "vite" },
      });

      const contract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a compact browser tool called StackLens Canary. Use a frontend web app stack, not a game. Compare module stack health across projects.",
      });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "vite-react-web-app");
      assert.doesNotMatch(contract.prompt, /game loop/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps coherent Next.js repository evidence stronger than generic game hints", () => {
    const repo = tmpDir("stack-next-game");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        scripts: { build: "next build" },
      });
      writeText(path.join(repo, "app/page.tsx"), "");

      const contract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a browser game inside this existing Next.js app.",
      });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "nextjs-web-app");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects static HTML projects without forcing a framework", () => {
    const repo = tmpDir("stack-static");
    try {
      writeText(path.join(repo, "index.html"), "<main>Hello</main>\n");
      const contract = resolveStackContract({ repoPath: repo, taskText: "Build a static HTML landing page." });
      assert.equal(contract.status, "resolved");
      assert.equal(contract.packId, "static-html-site");
      assert.equal(contract.routeContract.router, "static");
      assert.doesNotMatch(contract.prompt, /React|Next/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects Python CLI and Python web projects", () => {
    const cli = tmpDir("stack-python-cli");
    const web = tmpDir("stack-python-web");
    try {
      writeText(path.join(cli, "pyproject.toml"), "[project]\nname = \"tool\"\n");
      writeText(path.join(cli, "main.py"), "print('hello')\n");

      writeText(path.join(web, "requirements.txt"), "fastapi\nuvicorn\n");
      writeText(path.join(web, "main.py"), "from fastapi import FastAPI\napp = FastAPI()\n");

      assert.equal(resolveStackContract({ repoPath: cli, taskText: "Build a Python CLI tool." }).packId, "python-cli");
      assert.equal(resolveStackContract({ repoPath: web, taskText: "Build a Python API server." }).packId, "python-web");
    } finally {
      fs.rmSync(cli, { recursive: true, force: true });
      fs.rmSync(web, { recursive: true, force: true });
    }
  });

  it("detects Android and iOS project evidence", () => {
    const android = tmpDir("stack-android");
    const ios = tmpDir("stack-ios");
    try {
      writeText(path.join(android, "settings.gradle.kts"), "pluginManagement {}\n");
      writeText(path.join(android, "app/src/main/AndroidManifest.xml"), "<manifest />\n");

      writeText(path.join(ios, "MobileApp.xcodeproj/project.pbxproj"), "");
      writeText(path.join(ios, "ContentView.swift"), "import SwiftUI\n");

      assert.equal(resolveStackContract({ repoPath: android, taskText: "Build an Android app." }).packId, "android-app");
      assert.equal(resolveStackContract({ repoPath: ios, taskText: "Build an iPhone app." }).packId, "ios-app");
    } finally {
      fs.rmSync(android, { recursive: true, force: true });
      fs.rmSync(ios, { recursive: true, force: true });
    }
  });

  it("returns recoverable needs-reconcile status for unknown projects", () => {
    const repo = tmpDir("stack-unknown");
    try {
      const contract = resolveStackContract({ repoPath: repo, taskText: "Build something useful." });
      assert.equal(contract.status, "needs-reconcile");
      assert.equal(contract.packId, undefined);
      assert.match(contract.prompt, /Do not start implementation/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("persists stack contract ledger under ignored Setfarm artifacts", () => {
    const repo = tmpDir("stack-ledger");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      });

      const contract = resolveStackContract({ repoPath: repo, taskText: "Build a React app.", now: "2026-05-16T00:00:00.000Z" });
      const file = writeStackContract(repo, contract);
      assert.equal(file, stackContractPath(repo));
      assert.equal(readStackContract(repo)?.packId, "vite-react-web-app");
      assert.match(fs.readFileSync(path.join(repo, ".git/info/exclude"), "utf-8"), /^\.setfarm\/$/m);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("applies stack contract context keys and compatibility aliases", () => {
    const repo = tmpDir("stack-context");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      writeJson(path.join(repo, "package.json"), {
        dependencies: { next: "^16.0.0", react: "^19.0.0" },
        scripts: { build: "next build" },
      });

      const context: Record<string, string> = {
        repo,
        task: "Build a Next.js web app.",
      };
      const contract = applyStackContractContext(context);

      assert.equal(contract.packId, "nextjs-web-app");
      assert.equal(context.stack_pack_id, "nextjs-web-app");
      assert.match(context.stack_contract, /Pack: nextjs-web-app/);
      assert.match(context.stack_prompt, /Next\.js stack contract/);
      assert.match(context.stack_verification_contract, /build: npm run build/);
      assert.equal(context.detected_stack, "nextjs-web-app");
      assert.equal(context.stack_rules, context.stack_prompt);
      assert.equal(readStackContract(repo)?.packId, "nextjs-web-app");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("applies explicit prefix metadata into run context", () => {
    const repo = tmpDir("stack-prefix-context");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      const context: Record<string, string> = {
        repo,
        task: "game: Build NeonSwitch with settings and pause controls.",
      };
      const contract = applyStackContractContext(context);

      assert.equal(contract.packId, "browser-game-canvas");
      assert.equal(context.requested_stack_prefix, "game");
      assert.equal(context.task, "Build NeonSwitch with settings and pause controls.");
      assert.equal(context.platform, "game");
      assert.equal(context.tech_stack, "browser-game");
      assert.equal(context.stack_pack_id, "browser-game-canvas");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not let task prose or repo evidence overwrite a sealed Product Delivery stack", () => {
    const repo = tmpDir("sealed-delivery-context");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      writeText(path.join(repo, "index.html"), "<!doctype html><html></html>");
      const selected = resolveProductDeliverySelectionV1({ productClass: "utility" });
      assert.equal(selected.status, "selected");
      if (selected.status !== "selected") return;
      const context: Record<string, string> = {
        repo,
        task: "Build a static HTML landing page",
        product_delivery_stack_pack_id: "vite-react-web-app",
        product_delivery_selection: selected.canonicalBytes,
        product_delivery_selection_hash: selected.selectionHash,
        platform: "web",
        tech_stack: "vite-react",
      };
      const contract = applyStackContractContext(context);

      assert.equal(contract.packId, "vite-react-web-app");
      assert.equal(contract.confidence, "high");
      assert.match(contract.reason, /sealed Product Delivery authority/);
      assert.equal(context.stack_pack_id, "vite-react-web-app");
      assert.equal(context.detected_stack, "vite-react-web-app");
      assert.equal(context.tech_stack, "vite-react");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails closed when a sealed Product Delivery selection is tampered", () => {
    const selected = resolveProductDeliverySelectionV1({ productClass: "utility" });
    assert.equal(selected.status, "selected");
    if (selected.status !== "selected") return;

    assert.throws(
      () => applyStackContractContext({
        task: "Build a static HTML landing page",
        product_delivery_selection: selected.canonicalBytes,
        product_delivery_selection_hash: "0".repeat(64),
        product_delivery_stack_pack_id: "vite-react-web-app",
      }, { persist: false }),
      /PRODUCT_DELIVERY_SELECTION_HASH_MISMATCH/,
    );
  });

  it("exposes all initial stack packs with prompt fragments", () => {
    const ids = listStackPacks().map((pack) => pack.id).sort();
    assert.deepEqual(ids, [
      "android-app",
      "browser-game-canvas",
      "desktop-electron",
      "ios-app",
      "nextjs-web-app",
      "node-cli",
      "node-express-api",
      "python-cli",
      "python-web",
      "react-native-expo",
      "static-html-site",
      "vite-react-web-app",
    ]);
    for (const id of ids) {
      const pack = getStackPack(id);
      assert.ok(pack.prompt.length > 40, `${id} prompt should be useful`);
      assert.ok(pack.verification.build.length + pack.verification.smoke.length > 0, `${id} should define verification`);
      assert.ok(pack.targetResolutionRules && Object.keys(pack.targetResolutionRules).length > 0, `${id} should define target resolution rules`);
      assert.ok(pack.slugRules, `${id} should define slug rules`);
      assert.ok(pack.slugRuleTests && pack.slugRuleTests.length >= 2, `${id} should define slug rule tests`);
    }
  });

  it("keeps static HTML action handlers story-scoped to avoid setup ownership conflicts", () => {
    const pack = getStackPack("static-html-site");
    assert.equal(pack.targetResolutionRules.action_handler.template, "assets/js/{story_slug}/{action_id}.js");

    const setupHandoff = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "installer", "setup-handoff.ts"), "utf-8");
    assert.match(setupHandoff, /const storySlug = slugify\(storyId,\s*"story"\)/);
    assert.match(setupHandoff, /story_slug:\s*storySlug/);
  });

  it("validates all stack packs against the frozen contract schema", () => {
    const issues = validateAllStackPacks();
    assert.deepEqual(issues, []);
    assert.equal(getStackPack("android-app").conversionPolicy, "reference_only");
    assert.equal(getStackPack("ios-app").conversionPolicy, "reference_only");
  });
});
