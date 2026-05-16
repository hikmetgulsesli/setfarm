import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStackContract } from "../dist/installer/stack-contract/reconcile.js";
import { applyLibraryPackContext } from "../dist/installer/library-packs/context.js";
import { readLibraryPackSelection } from "../dist/installer/library-packs/ledger.js";
import { selectLibraryPacks } from "../dist/installer/library-packs/select.js";

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

describe("library pack selection", () => {
  it("selects creative canvas guidance for browser games without dashboard packs", () => {
    const repo = tmpDir("library-game");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      });

      const stackContract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a playable browser arcade game with score, levels, keyboard controls, and restart.",
      });
      const selection = selectLibraryPacks({
        stackContract,
        taskText: "Build a playable browser arcade game with score, levels, keyboard controls, and restart.",
      });
      const ids = selection.selected.map((pack) => pack.id);

      assert.equal(stackContract.packId, "browser-game-canvas");
      assert.deepEqual(ids, ["creative-canvas"]);
      assert.equal(ids.includes("forms-validation"), false);
      assert.equal(ids.includes("charts-data-viz"), false);
      assert.equal(ids.includes("ui-shadcn-radix"), false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("selects UI, icons, forms, and charts for dashboard/data tools", () => {
    const repo = tmpDir("library-dashboard");
    try {
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      });

      const stackContract = resolveStackContract({
        repoPath: repo,
        taskText: "Build an operations dashboard with KPI charts, data tables, filters, forms, settings dialogs, and navigation icons.",
      });
      const selection = selectLibraryPacks({
        stackContract,
        taskText: "Build an operations dashboard with KPI charts, data tables, filters, forms, settings dialogs, and navigation icons.",
        designText: "Sidebar navigation, table, dialog, form field, chart legend, and icon toolbar.",
      });
      const ids = new Set(selection.selected.map((pack) => pack.id));

      assert.equal(stackContract.packId, "vite-react-web-app");
      assert.equal(ids.has("ui-shadcn-radix"), true);
      assert.equal(ids.has("icons-lucide"), true);
      assert.equal(ids.has("forms-validation"), true);
      assert.equal(ids.has("charts-data-viz"), true);
      assert.equal(ids.has("creative-canvas"), false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps simple static pages free of unnecessary library packs", () => {
    const repo = tmpDir("library-static");
    try {
      writeText(path.join(repo, "index.html"), "<main>Simple page</main>\n");
      const stackContract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a simple static HTML landing page.",
      });
      const selection = selectLibraryPacks({
        stackContract,
        taskText: "Build a simple static HTML landing page.",
      });

      assert.equal(stackContract.packId, "static-html-site");
      assert.equal(selection.status, "none");
      assert.deepEqual(selection.selected, []);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("applies library pack context and persists selected packs in the ledger", () => {
    const repo = tmpDir("library-context");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      });
      const stackContract = resolveStackContract({
        repoPath: repo,
        taskText: "Build a dashboard with charts, forms, and navigation icons.",
      });
      const context: Record<string, string> = {
        repo,
        task: "Build a dashboard with charts, forms, and navigation icons.",
        design_rules: "Use dialog, chart, form field, table, and toolbar icon patterns.",
      };

      const selection = applyLibraryPackContext(context, { repoPath: repo, stackContract });

      assert.equal(selection.status, "selected");
      assert.match(context.library_pack_ids, /ui-shadcn-radix/);
      assert.match(context.library_packs, /Authority:/);
      assert.match(context.library_prompt, /Library defaults never override Stitch/);
      assert.equal(readLibraryPackSelection(repo)?.schema, "setfarm.library-packs.v1");
      assert.match(fs.readFileSync(path.join(repo, ".git/info/exclude"), "utf-8"), /^\.setfarm\/$/m);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
