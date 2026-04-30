import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkEntryPointImports, checkNativeButtonWiring } from "../scripts/smoke-test.mjs";

function withRepo(fn: (repo: string) => void) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-smoke-static-"));
  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fn(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

describe("smoke-test static rules", () => {
  it("ignores type-only imports from TS entry points", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import type { AppView } from "./BottomNav";',
        'const current: AppView = "today";',
        "export function App() { return null; }",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), 'export type AppView = "today" | "profile";\n');

      assert.deepEqual(checkEntryPointImports(repo), []);
    });
  });

  it("ignores inline type-only specifiers in mixed imports", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { type AppView, makeView } from "./BottomNav";',
        'const current: AppView = makeView("today");',
        "export { current };",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), [
        'export type AppView = "today" | "profile";',
        'export function makeView(view: AppView) { return view; }',
      ].join("\n"));

      assert.deepEqual(checkEntryPointImports(repo), []);
    });
  });

  it("does not treat type-only exports as runtime values", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { AppView } from "./BottomNav";',
        "export const current = AppView;",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), 'export { type AppView };\ntype AppView = "today" | "profile";\n');

      const issues = checkEntryPointImports(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /imports "AppView".*but target does not export it/);
    });
  });

  it("rejects data-smoke-ignore as a native button wiring bypass", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export function App() { return <button data-smoke-ignore>Profile</button>; }\n");

      const issues = checkNativeButtonWiring(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /button "Profile" has no onClick\/type="submit"\/disabled\/aria-disabled/);
    });
  });

  it("allows intentionally unavailable native buttons only when disabled", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <><button disabled>Soon</button><button aria-disabled="true">Later</button></>;',
        "}",
      ].join("\n"));

      assert.deepEqual(checkNativeButtonWiring(repo), []);
    });
  });

  it("keeps implement and verify prompts aligned with the button rule", () => {
    const implementPrompt = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/prompt.md"), "utf-8");
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");
    const verifyScript = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/07-verify/playwright-check.ts"), "utf-8");

    assert.ok(implementPrompt.includes("Do not use `data-smoke-ignore`"));
    assert.equal(implementPrompt.includes("or explicit `data-smoke-ignore`"), false);
    assert.equal(smokeScript.includes('hasAttribute("data-smoke-ignore")'), false);
    assert.equal(verifyScript.includes("hasAttribute('data-smoke-ignore')"), false);
  });
});
