import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

function writeHtml(filePath: string, body: string): void {
  const filler = "<p>design-token</p>".repeat(80);
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}${filler}</body></html>`);
}

describe("stitch-to-jsx", () => {
  it("skips PRD pseudo screens and invalid HTML, while honoring htmlFile", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-jsx-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "prd-screen", title: "Counter App PRD" },
        { screenId: "invalid-screen", title: "Invalid Screen" },
        { screenId: "main-screen", title: "Home Screen", htmlFile: "main-screen-custom.html" },
      ]));

      writeHtml(path.join(stitchDir, "prd-screen.html"), "<main><h1>PRD</h1></main>");
      fs.writeFileSync(path.join(stitchDir, "invalid-screen.html"), "<html></html>");
      writeHtml(path.join(stitchDir, "main-screen-custom.html"), "<main><button>Add</button></main>");

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const screensDir = path.join(tmp, "src", "screens");
      assert.equal(fs.existsSync(path.join(screensDir, "CounterAppPrd.tsx")), false);
      assert.equal(fs.existsSync(path.join(screensDir, "InvalidScreen.tsx")), false);
      assert.equal(fs.existsSync(path.join(screensDir, "HomeScreen.tsx")), true);

      const index = JSON.parse(fs.readFileSync(path.join(screensDir, "SCREEN_INDEX.json"), "utf-8"));
      assert.deepEqual(index.map((s: any) => s.title), ["Home Screen"]);
      assert.equal(index[0].buttons, 1);
      assert.deepEqual(index[0].actions, [
        { id: "add-1", kind: "button", label: "Add", index: 0 },
      ]);

      const code = fs.readFileSync(path.join(screensDir, "HomeScreen.tsx"), "utf-8");
      assert.match(code, /export type HomeScreenActionId = "add-1";/);
      assert.match(code, /actions\?: Partial<Record<HomeScreenActionId, \(\) => void>>;/);
      assert.match(code, /<button type="button" data-action-id="add-1" onClick=\{actions\?\.\["add-1"\]\}>Add<\/button>/);

      const barrel = fs.readFileSync(path.join(screensDir, "index.ts"), "utf-8");
      assert.equal(barrel, 'export { HomeScreen } from "./HomeScreen";\nexport type { HomeScreenProps, HomeScreenActionId } from "./HomeScreen";\n');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("deduplicates barrel exports when Stitch returns repeated screen titles", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-barrel-dedupe-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "gameplay-a", title: "Gameplay - GateGlide Lite" },
        { screenId: "gameplay-b", title: "Gameplay - GateGlide Lite" },
        { screenId: "settings-a", title: "Game Settings - GateGlide Lite" },
        { screenId: "settings-b", title: "Game Settings - GateGlide Lite" },
      ]));
      writeHtml(path.join(stitchDir, "gameplay-a.html"), "<main><button>Start</button></main>");
      writeHtml(path.join(stitchDir, "gameplay-b.html"), "<main><button>Restart</button></main>");
      writeHtml(path.join(stitchDir, "settings-a.html"), "<main><button>Save</button></main>");
      writeHtml(path.join(stitchDir, "settings-b.html"), "<main><button>Back</button></main>");

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(tmp, "src", "screens", "SCREEN_INDEX.json"), "utf-8"));
      assert.equal(index.length, 4);

      const barrel = fs.readFileSync(path.join(tmp, "src", "screens", "index.ts"), "utf-8");
      assert.equal((barrel.match(/export \{ GameplayGateglideLite \}/g) || []).length, 1);
      assert.equal((barrel.match(/export type \{ GameplayGateglideLiteProps/g) || []).length, 1);
      assert.equal((barrel.match(/export \{ GameSettingsGateglideLite \}/g) || []).length, 1);
      assert.equal((barrel.match(/export type \{ GameSettingsGateglideLiteProps/g) || []).length, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("removes full-width utilities from positioned elements with both horizontal insets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-positioned-width-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "dashboard-screen", title: "Dashboard Screen" },
      ]));
      writeHtml(path.join(stitchDir, "dashboard-screen.html"), `
        <main>
          <header class="fixed top-0 left-16 right-0 z-50 w-full min-w-full bg-white">Toolbar</header>
          <section class="absolute left-[4rem] right-0 w-screen">Panel</section>
          <div class="relative left-16 right-0 w-full">Normal flow</div>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "DashboardScreen.tsx"), "utf-8");
      assert.match(code, /className="fixed top-0 left-16 right-0 z-50 bg-white"/);
      assert.match(code, /className="absolute left-\[4rem\] right-0"/);
      assert.match(code, /className="relative left-16 right-0 w-full"/);
      assert.doesNotMatch(code, /fixed[^"]*\bw-full\b/);
      assert.doesNotMatch(code, /fixed[^"]*\bmin-w-full\b/);
      assert.doesNotMatch(code, /absolute[^"]*\bw-screen\b/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("normalizes SVG filter primitive tag casing for React JSX", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-svg-filter-tags-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "glow-screen", title: "Glow Screen" },
      ]));
      writeHtml(path.join(stitchDir, "glow-screen.html"), `
        <main>
          <svg viewbox="0 0 100 100">
            <filter id="glow">
              <fegaussianblur stddeviation="2"></fegaussianblur>
              <fecolormatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></fecolormatrix>
              <femerge><femergenode></femergenode></femerge>
            </filter>
          </svg>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GlowScreen.tsx"), "utf-8");
      assert.match(code, /<feGaussianBlur stdDeviation="2"><\/feGaussianBlur>/);
      assert.match(code, /<feColorMatrix type="matrix"/);
      assert.match(code, /<feMerge><feMergeNode><\/feMergeNode><\/feMerge>/);
      assert.doesNotMatch(code, /<fegaussianblur|<fecolormatrix|<femerge/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits stable action ids for generated screen controls", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-actions-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "game-screen", title: "Game Board" },
      ]));
      writeHtml(path.join(stitchDir, "game-screen.html"), `
        <main>
          <button class="primary">Start Game</button>
          <button aria-label="pause"><span>Pause</span></button>
          <button type="submit">Restart</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameBoard.tsx"), "utf-8");
      assert.match(code, /export type GameBoardActionId = "start-game-1" \| "pause-2" \| "restart-3";/);
      assert.match(code, /export interface GameBoardProps/);
      assert.match(code, /<button className="primary" type="button" data-action-id="start-game-1" onClick=\{actions\?\.\["start-game-1"\]\}>Start Game<\/button>/);
      assert.match(code, /<button aria-label="pause" type="button" data-action-id="pause-2" onClick=\{actions\?\.\["pause-2"\]\}>/);
      assert.match(code, /<button type="submit" data-action-id="restart-3" onClick=\{actions\?\.\["restart-3"\]\}>Restart<\/button>/);
      assert.doesNotMatch(code, /textContent|innerText|querySelector/);

      const index = JSON.parse(fs.readFileSync(path.join(tmp, "src", "screens", "SCREEN_INDEX.json"), "utf-8"));
      assert.deepEqual(index[0].actions.map((action: any) => action.id), ["start-game-1", "pause-2", "restart-3"]);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("uses accessible names for icon-only generated button action ids", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-icon-action-labels-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "toolbar-screen", title: "Toolbar Screen" },
      ]));
      writeHtml(path.join(stitchDir, "toolbar-screen.html"), `
        <main>
          <button title="Offline Mode"><span class="material-symbols-outlined">cloud_off</span></button>
          <button aria-label="Terrain"><span class="material-symbols-outlined">terrain</span></button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ToolbarScreen.tsx"), "utf-8");
      assert.match(code, /export type ToolbarScreenActionId = "offline-mode-1" \| "terrain-2";/);
      assert.match(code, /<button title="Offline Mode" type="button" data-action-id="offline-mode-1" onClick=\{actions\?\.\["offline-mode-1"\]\}>/);
      assert.match(code, /<button aria-label="Terrain" type="button" data-action-id="terrain-2" onClick=\{actions\?\.\["terrain-2"\]\}>/);

      const index = JSON.parse(fs.readFileSync(path.join(tmp, "src", "screens", "SCREEN_INDEX.json"), "utf-8"));
      assert.deepEqual(index[0].actions.map((action: any) => action.label), ["Offline Mode", "Terrain"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("derives semantic action ids from Material icon controls without polluting visible labels", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-material-action-labels-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "clinic-toolbar", title: "Clinic Toolbar" },
      ]));
      writeHtml(path.join(stitchDir, "clinic-toolbar.html"), `
        <main>
          <button><span class="material-symbols-outlined">cloud_off</span></button>
          <button><span data-icon="priority_high" class="material-symbols-outlined">priority_high</span>Escalate</button>
          <a href="#consent"><span class="material-symbols-outlined">description</span></a>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ClinicToolbar.tsx"), "utf-8");
      assert.match(code, /export type ClinicToolbarActionId = "cloud-off-1" \| "escalate-2" \| "description-1";/);
      assert.match(code, /data-action-id="cloud-off-1"/);
      assert.match(code, /data-action-id="escalate-2"/);
      assert.match(code, /data-action-id="description-1"/);
      assert.doesNotMatch(code, /priority-high-escalate/);

      const index = JSON.parse(fs.readFileSync(path.join(tmp, "src", "screens", "SCREEN_INDEX.json"), "utf-8"));
      assert.deepEqual(index[0].actions.map((action: any) => action.label), ["Cloud Off", "Escalate", "Description"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits typed actions for generated screen links", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-link-actions-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "menu-screen", title: "Main Menu" },
      ]));
      writeHtml(path.join(stitchDir, "menu-screen.html"), `
        <main>
          <a href="#" class="nav-link">Help</a>
          <button>Start Game</button>
          <a href="/settings" onclick="return false">Settings</a>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "MainMenu.tsx"), "utf-8");
      assert.match(code, /export type MainMenuActionId = "start-game-1" \| "help-1" \| "settings-2";/);
      assert.match(code, /<a href="#" className="nav-link" data-action-id="help-1" onClick=\{\(event\) => \{ event\.preventDefault\(\); actions\?\.\["help-1"\]\?\.\(\); \}\}>Help<\/a>/);
      assert.match(code, /<a href="\/settings" data-action-id="settings-2" onClick=\{\(event\) => \{ event\.preventDefault\(\); actions\?\.\["settings-2"\]\?\.\(\); \}\}>Settings<\/a>/);
      assert.doesNotMatch(code, /onclick=/);

      const index = JSON.parse(fs.readFileSync(path.join(tmp, "src", "screens", "SCREEN_INDEX.json"), "utf-8"));
      assert.equal(index[0].buttons, 1);
      assert.equal(index[0].links, 2);
      assert.deepEqual(index[0].actions, [
        { id: "start-game-1", kind: "button", label: "Start Game", index: 0 },
        { id: "help-1", kind: "link", label: "Help", href: "#", index: 0 },
        { id: "settings-2", kind: "link", label: "Settings", href: "/settings", index: 1 },
      ]);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("converts Material Symbols spans into lucide-react SVG components", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "controls-screen", title: "Controls Help" },
      ]));
      writeHtml(path.join(stitchDir, "controls-screen.html"), `
        <main>
          <span aria-hidden="true" class="material-symbols-outlined text-primary transition-all">warning</span>
          <span title="Triggers visual warning when limit is exceeded." class="material-symbols-outlined text-outline text-[16px] cursor-help">info</span>
          <button><span class="material-symbols-outlined">help_center</span>Help Center</button>
          <button class="transition-all"><span data-icon="rotate_right" aria-hidden="true" focusable="false" class="material-symbols-outlined text-[18px]">rotate_right</span>Rotate</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ControlsHelp.tsx"), "utf-8");
      assert.match(code, /import \{ CircleHelp, Info, RotateCw, TriangleAlert \} from "lucide-react";/);
      assert.match(code, /<TriangleAlert className="text-primary transition-colors" aria-hidden=\{true\} focusable="false" \/>/);
      assert.match(code, /<Info className="text-outline text-\[16px\] cursor-help" aria-hidden=\{true\} focusable="false" \/>/);
      assert.match(code, /<CircleHelp aria-hidden=\{true\} focusable="false" \/>Help Center/);
      assert.match(code, /<RotateCw className="text-\[18px\]" aria-hidden=\{true\} focusable="false" \/>Rotate/);
      assert.match(code, /<button className="transition-colors"/);
      assert.equal((code.match(/aria-hidden/g) || []).length, 4);
      assert.equal((code.match(/focusable=/g) || []).length, 4);
      assert.doesNotMatch(code, /<Info[^>]*\stitle=/);
      assert.doesNotMatch(code, /material-symbols|Material Symbols|>warning<|>help_center<|>rotate_right</);
      assert.doesNotMatch(code, /transition-all/);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sanitizes Stitch style blocks before writing runtime CSS", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-style-sanitize-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "settings-screen", title: "Settings Screen" },
      ]));
      writeHtml(path.join(stitchDir, "settings-screen.html"), `
        <style>
          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-size: 24px;
          }
          .toggle {
            transition: all 0.2s;
            background: theme('colors.primary-container');
            box-shadow: 0 0 8px theme('colors.outline-variant');
          }
        </style>
        <main><button><span class="material-symbols-outlined">style</span>Style</button></main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const css = fs.readFileSync(path.join(tmp, "src", "index.css"), "utf-8");
      const code = fs.readFileSync(path.join(tmp, "src", "screens", "SettingsScreen.tsx"), "utf-8");
      assert.doesNotMatch(css, /material-symbols|Material Symbols|font-family:\s*['"]?Material/i);
      assert.doesNotMatch(css, /transition:\s*all/i);
      assert.doesNotMatch(css, /theme\(/i);
      assert.match(css, /background: var\(--color-primary-container\);/);
      assert.match(css, /box-shadow: 0 0 8px var\(--color-outline-variant\);/);
      assert.match(css, /transition: color, background-color, border-color, box-shadow, opacity, transform 0\.2s;/);
      assert.match(code, /Palette/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps pointer Material Symbols to build-safe lucide icon exports", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-touch-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "controls-screen", title: "Controls Help" },
      ]));
      writeHtml(path.join(stitchDir, "controls-screen.html"), `
        <main>
          <span class="material-symbols-outlined text-[18px]">touch_app</span>
          <span class="material-symbols-outlined text-[16px]">mouse</span>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ControlsHelp.tsx"), "utf-8");
      assert.match(code, /import \{ MousePointerClick \} from "lucide-react";/);
      assert.match(code, /<MousePointerClick className="text-\[18px\]" aria-hidden=\{true\} focusable="false" \/>/);
      assert.match(code, /<MousePointerClick className="text-\[16px\]" aria-hidden=\{true\} focusable="false" \/>/);
      assert.doesNotMatch(code, /HandPointer|touch_app|>mouse<|material-symbols/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps key Material Symbol to a deterministic lucide icon", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-key-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "vault-screen", title: "Vault Screen" },
      ]));
      writeHtml(path.join(stitchDir, "vault-screen.html"), `
        <main>
          <button><span class="material-symbols-outlined">key</span>Collect Key</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "VaultScreen.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Key \} from "lucide-react";/);
      assert.match(code, /<Key/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|>key</);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps restore Material Symbol used by generated reset controls", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-restore-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "restore-screen", title: "Restore Screen" },
      ]));
      writeHtml(path.join(stitchDir, "restore-screen.html"), `
        <main>
          <button><span class="material-symbols-outlined">restore</span>Restore defaults</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "RestoreScreen.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ RotateCcw \} from "lucide-react";/);
      assert.match(code, /<RotateCcw/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|>restore</);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps exit_to_app Material Symbol used by generated exit controls", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-exit-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "exit-screen", title: "Exit Screen" },
      ]));
      writeHtml(path.join(stitchDir, "exit-screen.html"), `
        <main>
          <button><span class="material-symbols-outlined">exit_to_app</span>Exit to menu</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ExitScreen.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ LogOut \} from "lucide-react";/);
      assert.match(code, /<LogOut/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|>exit_to_app</);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps common app navigation Material Symbols to semantic lucide icons instead of Circle", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-nav-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "nav-screen", title: "Return Desk Navigation" },
      ]));
      writeHtml(path.join(stitchDir, "nav-screen.html"), `
        <main>
          <a href="#"><span class="material-symbols-outlined">dashboard</span>Dashboard</a>
          <a href="#"><span class="material-symbols-outlined">assignment_return</span>Triage</a>
          <a href="#"><span class="material-symbols-outlined">inventory_2</span>Inventory</a>
          <a href="#"><span class="material-symbols-outlined">analytics</span>Reports</a>
          <button><span class="material-symbols-outlined">sort</span>Sort</button>
          <button><span class="material-symbols-outlined">notifications</span></button>
          <button><span class="material-symbols-outlined">edit_note</span>Editor</button>
          <button><span class="material-symbols-outlined">desktop_windows</span>Workspace Display</button>
          <button><span class="material-symbols-outlined">table_rows</span>Data List</button>
          <button><span class="material-symbols-outlined">view_kanban</span>Visual Board</button>
          <button><span class="material-symbols-outlined">train</span>Train</button>
          <button><span class="material-symbols-outlined">data_object</span>Data Object</button>
          <button><span class="material-symbols-outlined">database</span>Database</button>
          <button><span class="material-symbols-outlined">dataset</span>Dataset</button>
          <button><span class="material-symbols-outlined">menu_book</span>Guide</button>
          <button><span class="material-symbols-outlined">rebase_edit</span>Rebase</button>
          <button><span class="material-symbols-outlined">add_box</span>Create</button>
          <button><span class="material-symbols-outlined">swap_horiz</span>Swap</button>
          <button><span class="material-symbols-outlined">route</span>Route</button>
          <button><span class="material-symbols-outlined">south_east</span>South East</button>
          <button><span class="material-symbols-outlined">sync_alt</span>Sync Alt</button>
          <button><span class="material-symbols-outlined">timer</span>Timer</button>
          <button><span class="material-symbols-outlined">schedule</span>ETA</button>
          <button><span class="material-symbols-outlined">group</span>Crew</button>
          <button><span class="material-symbols-outlined">sync</span>Sync</button>
          <button><span class="material-symbols-outlined">expand_more</span>Expand</button>
          <button><span class="material-symbols-outlined">local_hospital</span>Clinic</button>
          <button><span class="material-symbols-outlined">medical_services</span>Medical</button>
          <button><span class="material-symbols-outlined">queue</span>Queue</button>
          <button><span class="material-symbols-outlined">tv_options_parental</span>Display Options</button>
          <button><span class="material-symbols-outlined">clinical_notes</span>Clinical Notes</button>
          <button><span class="material-symbols-outlined">progress_activity</span>Progress</button>
          <button><span class="material-symbols-outlined">sync_problem</span>Sync Problem</button>
          <button><span class="material-symbols-outlined">folder_open</span>Folder Open</button>
          <button><span class="material-symbols-outlined">folder_off</span>Folder Off</button>
          <button><span class="material-symbols-outlined">filter_list_off</span>Filter Off</button>
          <button><span class="material-symbols-outlined">groups</span>Teams</button>
          <button><span class="material-symbols-outlined">lightbulb</span>Idea</button>
          <button><span class="material-symbols-outlined">cleaning_services</span>Cleanup</button>
          <button><span class="material-symbols-outlined">notifications_active</span>Active Alert</button>
          <button><span class="material-symbols-outlined">cloud_off</span>Offline</button>
          <button><span class="material-symbols-outlined">contact_support</span>Contact support</button>
          <button><span class="material-symbols-outlined">person_add</span>Add Person</button>
          <button><span class="material-symbols-outlined">contact_phone</span>Contact</button>
          <button><span class="material-symbols-outlined">call</span>Call</button>
          <button><span class="material-symbols-outlined">mail</span>Mail</button>
          <button><span class="material-symbols-outlined">restart_alt</span>Restart</button>
          <button><span class="material-symbols-outlined">priority_high</span>Priority</button>
          <button><span class="material-symbols-outlined">login</span>Login</button>
          <button><span class="material-symbols-outlined">star</span>Star</button>
          <button><span class="material-symbols-outlined">favorite</span>Favorite</button>
          <button><span class="material-symbols-outlined">ecg_heart</span>Vitals</button>
          <button><span class="material-symbols-outlined">speed</span>Speed</button>
          <button><span class="material-symbols-outlined">trending_up</span>Trend</button>
          <button><span class="material-symbols-outlined">precision_manufacturing</span>Factory</button>
          <button><span class="material-symbols-outlined">list_alt</span>Work List</button>
          <button><span class="material-symbols-outlined">sensors</span>Sensor</button>
          <button><span class="material-symbols-outlined">arrow_drop_down</span>Dropdown</button>
          <button><span class="material-symbols-outlined">arrow_drop_up</span>Dropdown Up</button>
          <button><span class="material-symbols-outlined">change_history</span>Change History</button>
          <button><span class="material-symbols-outlined">assignment_ind</span>Assignment</button>
          <button><span class="material-symbols-outlined">build</span>Build</button>
          <button><span class="material-symbols-outlined">edit_document</span>Edit Document</button>
          <button><span class="material-symbols-outlined">flight</span>Flight</button>
          <button><span class="material-symbols-outlined">flight_land</span>Landing</button>
          <button><span class="material-symbols-outlined">flight_takeoff</span>Takeoff</button>
          <button><span class="material-symbols-outlined">group_remove</span>Remove Group</button>
          <button><span class="material-symbols-outlined">meeting_room</span>Gate Room</button>
          <button><span class="material-symbols-outlined">grid_view</span>Grid</button>
          <button><span class="material-symbols-outlined">drag_indicator</span>Drag</button>
          <button><span class="material-symbols-outlined">open_in_full</span>Open Full</button>
          <button><span class="material-symbols-outlined">pending_actions</span>Pending</button>
          <button><span class="material-symbols-outlined">monitoring</span>Monitoring</button>
          <button><span class="material-symbols-outlined">monitor</span>Monitor</button>
          <button><span class="material-symbols-outlined">monitor_heart</span>Monitor Heart</button>
          <button><span class="material-symbols-outlined">filter_alt</span>Filter Alt</button>
          <button><span class="material-symbols-outlined">power</span>Power</button>
          <button><span class="material-symbols-outlined">wifi_off</span>Wifi Off</button>
          <button><span class="material-symbols-outlined">report</span>Report</button>
          <button><span class="material-symbols-outlined">person_search</span>Find Person</button>
          <button><span class="material-symbols-outlined">unfold_more</span>Unfold</button>
          <button><span class="material-symbols-outlined">block</span>Block</button>
          <button><span class="material-symbols-outlined">fact_check</span>Fact Check</button>
          <button><span class="material-symbols-outlined">warehouse</span>Warehouse</button>
          <button><span class="material-symbols-outlined">airline_seat_recline_normal</span>Seat</button>
          <button><span class="material-symbols-outlined">bed</span>Room Bed</button>
          <button><span class="material-symbols-outlined">format_list_numbered</span>Numbered Queue</button>
          <button><span class="material-symbols-outlined">how_to_reg</span>Registered</button>
          <button><span class="material-symbols-outlined">vital_signs</span>Vitals</button>
          <button><span class="material-symbols-outlined">density_medium</span>Medium density</button>
          <button><span class="material-symbols-outlined">density_small</span>Small density</button>
          <button><span class="material-symbols-outlined">deployed_code</span>Package</button>
          <button><span class="material-symbols-outlined">engineering</span>Engineering</button>
          <button><span class="material-symbols-outlined">label</span>Label</button>
          <button><span class="material-symbols-outlined">local_shipping</span>Shipping</button>
          <button><span class="material-symbols-outlined">location_on</span>Location</button>
          <button><span class="material-symbols-outlined">map</span>Map</button>
          <button><span class="material-symbols-outlined">near_me</span>Navigate</button>
          <button><span class="material-symbols-outlined">reorder</span>Reorder</button>
          <button><span class="material-symbols-outlined">support_agent</span>Support</button>
          <button><span class="material-symbols-outlined">task_alt</span>Task done</button>
          <button><span class="material-symbols-outlined">terminal</span>Terminal</button>
          <button><span class="material-symbols-outlined">toggle_on</span>Toggle On</button>
          <button><span class="material-symbols-outlined">keyboard</span>Keyboard</button>
          <button><span class="material-symbols-outlined">music_note</span>Music</button>
          <button><span class="material-symbols-outlined">keyboard_arrow_left</span>Move Left</button>
          <button><span class="material-symbols-outlined">keyboard_arrow_right</span>Move Right</button>
          <button><span class="material-symbols-outlined">graphic_eq</span>Equalizer</button>
          <button><span class="material-symbols-outlined">volume_up</span>Volume</button>
          <button><span class="material-symbols-outlined">volume_mute</span>Muted Volume</button>
          <button><span class="material-symbols-outlined">fast_forward</span>Fast forward</button>
          <button><span class="material-symbols-outlined">visibility</span>Visible</button>
          <button><span class="material-symbols-outlined">rocket_launch</span>Launch</button>
          <button><span class="material-symbols-outlined">blur_on</span>Focus effect</button>
          <button><span class="material-symbols-outlined">style</span>Visual style</button>
          <button><span class="material-symbols-outlined">bolt</span>Power signal</button>
          <button><span class="material-symbols-outlined">checklist</span>Checklist</button>
          <button><span class="material-symbols-outlined">dns</span>Server</button>
          <button><span class="material-symbols-outlined">done_all</span>All done</button>
          <button><span class="material-symbols-outlined">help_outline</span>Help outline</button>
          <button><span class="material-symbols-outlined">history</span>History</button>
          <button><span class="material-symbols-outlined">notification_important</span>Important alert</button>
          <button><span class="material-symbols-outlined">view_week</span>Week view</button>
          <a href="#"><span class="material-symbols-outlined">help</span>Help</a>
          <a href="#"><span class="material-symbols-outlined">logout</span>Logout</a>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ReturnDeskNavigation.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Activity, Armchair, ArrowLeftRight, ArrowUpDown, AudioWaveform, BadgeAlert, BadgeCheck, Ban, BarChart3, Bed, Bell, BellRing, Bolt, BookOpen, Braces, BriefcaseMedical, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, CircleHelp, ClipboardCheck, ClipboardList, ClipboardPlus, Clock, CloudOff, Columns3, Database, DoorOpen, Expand, Eye, Factory, FastForward, FilePenLine, FileWarning, Filter, FilterX, FolderOpen, FolderX, Gauge, GitCompareArrows, Grid3X3, GripHorizontal, GripVertical, HardHat, Headphones, Heart, HeartPulse, History, Hospital, Kanban, Keyboard, LayoutDashboard, Lightbulb, ListChecks, ListOrdered, ListTodo, LoaderCircle, LogIn, LogOut, Mail, Map, MapPin, Monitor, MonitorCog, MoveDownRight, Music, Navigation, Package, PackageCheck, PackageSearch, Palette, Pencil, Phone, PhoneCall, Plane, PlaneLanding, PlaneTakeoff, PlusSquare, Power, RadioTower, RefreshCcw, RefreshCw, RefreshCwOff, Rocket, RotateCcw, Route, Rows2, Rows3, Server, Sparkles, Star, Tag, Terminal, Timer, ToggleRight, Train, TrendingUp, Triangle, Truck, UserCheck, UserMinus, UserPlus, UserSearch, Users, UsersRound, Volume2, VolumeX, Warehouse, WifiOff, Wrench \} from "lucide-react";/);
      assert.match(code, /<LayoutDashboard/);
      assert.match(code, /<PackageCheck/);
      assert.match(code, /<PackageSearch/);
      assert.match(code, /<BarChart3/);
      assert.match(code, /<ArrowUpDown/);
      assert.match(code, /<Bell/);
      assert.match(code, /<Pencil/);
      assert.match(code, /<Monitor/);
      assert.match(code, /<Rows3/);
      assert.match(code, /<Kanban/);
      assert.match(code, /<Train/);
      assert.match(code, /<Braces/);
      assert.match(code, /<Database/);
      assert.match(code, /<BookOpen/);
      assert.match(code, /<GitCompareArrows/);
      assert.match(code, /<PlusSquare/);
      assert.match(code, /<ArrowLeftRight/);
      assert.match(code, /<Route/);
      assert.match(code, /<MoveDownRight/);
      assert.match(code, /<RefreshCcw/);
      assert.match(code, /<Timer/);
      assert.match(code, /<Clock/);
      assert.match(code, /<Users/);
      assert.match(code, /<RefreshCw/);
      assert.match(code, /<ChevronDown/);
      assert.match(code, /<ChevronUp/);
      assert.match(code, /<Triangle/);
      assert.match(code, /<Hospital/);
      assert.match(code, /<BriefcaseMedical/);
      assert.match(code, /<ListOrdered/);
      assert.match(code, /<MonitorCog/);
      assert.match(code, /<ClipboardPlus/);
      assert.match(code, /<LoaderCircle/);
      assert.match(code, /<RefreshCwOff/);
      assert.match(code, /<FolderOpen/);
      assert.match(code, /<FolderX/);
      assert.match(code, /<FilterX/);
      assert.match(code, /<UsersRound/);
      assert.match(code, /<Lightbulb/);
      assert.match(code, /<Sparkles/);
      assert.match(code, /<BellRing/);
      assert.match(code, /<Bolt/);
      assert.match(code, /<ListChecks/);
      assert.match(code, /<Server/);
      assert.match(code, /<CheckCheck/);
      assert.match(code, /<History/);
      assert.match(code, /<Columns3/);
      assert.match(code, /<CloudOff/);
      assert.match(code, /<CircleHelp/);
      assert.match(code, /<UserPlus/);
      assert.match(code, /<PhoneCall/);
      assert.match(code, /<Phone/);
      assert.match(code, /<Mail/);
      assert.match(code, /<RotateCcw/);
      assert.match(code, /<BadgeAlert/);
      assert.match(code, /<LogIn/);
      assert.match(code, /<Star/);
      assert.match(code, /<Heart/);
      assert.match(code, /<HeartPulse/);
      assert.match(code, /<Gauge/);
      assert.match(code, /<TrendingUp/);
      assert.match(code, /<Factory/);
      assert.match(code, /<ListTodo/);
      assert.match(code, /<RadioTower/);
      assert.match(code, /<ClipboardCheck/);
      assert.match(code, /<Wrench/);
      assert.match(code, /<FilePenLine/);
      assert.match(code, /<Plane/);
      assert.match(code, /<PlaneLanding/);
      assert.match(code, /<PlaneTakeoff/);
      assert.match(code, /<UserMinus/);
      assert.match(code, /<DoorOpen/);
      assert.match(code, /<Grid3X3/);
      assert.match(code, /<GripVertical/);
      assert.match(code, /<Expand/);
      assert.match(code, /<ClipboardList/);
      assert.match(code, /<Activity/);
      assert.match(code, /<Monitor/);
      assert.match(code, /<Filter/);
      assert.match(code, /<Power/);
      assert.match(code, /<WifiOff/);
      assert.match(code, /<FileWarning/);
      assert.match(code, /<UserSearch/);
      assert.match(code, /<ChevronsUpDown/);
      assert.match(code, /<Ban/);
      assert.match(code, /<BadgeCheck/);
      assert.match(code, /<Warehouse/);
      assert.match(code, /<Armchair/);
      assert.match(code, /<Bed/);
      assert.match(code, /<UserCheck/);
      assert.match(code, /<Rows2/);
      assert.match(code, /<Package/);
      assert.match(code, /<HardHat/);
      assert.match(code, /<Tag/);
      assert.match(code, /<Truck/);
      assert.match(code, /<MapPin/);
      assert.match(code, /<Map/);
      assert.match(code, /<Navigation/);
      assert.match(code, /<GripHorizontal/);
      assert.match(code, /<Headphones/);
      assert.match(code, /<Terminal/);
      assert.match(code, /<ToggleRight/);
      assert.match(code, /<Keyboard/);
      assert.match(code, /<ChevronLeft/);
      assert.match(code, /<ChevronRight/);
      assert.match(code, /<Music/);
      assert.match(code, /<AudioWaveform/);
      assert.match(code, /<Volume2/);
      assert.match(code, /<VolumeX/);
      assert.match(code, /<FastForward/);
      assert.match(code, /<Eye/);
      assert.match(code, /<Rocket/);
      assert.match(code, /<CircleHelp/);
      assert.match(code, /<LogOut/);
      assert.doesNotMatch(code, /\bCircle\b/);
      assert.doesNotMatch(code, /\bBadgeHelp\b/);
      assert.doesNotMatch(code, /material-symbols/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps data usage Material Symbol used by dashboard screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-data-usage-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "stack-health", title: "Stack Health Dashboard" },
      ]));
      writeHtml(path.join(stitchDir, "stack-health.html"), `
        <main>
          <button><span class="material-symbols-outlined">data_usage</span>Usage</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "StackHealthDashboard.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Database \} from "lucide-react";/);
      assert.match(code, /<Database/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|>data_usage</);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps analytics dashboard Material Symbols used by operational screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-analytics-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "analytics-console", title: "Analytics Console" },
      ]));
      writeHtml(path.join(stitchDir, "analytics-console.html"), `
        <main>
          <button><span class="material-symbols-outlined">arrow_right_alt</span>Open</button>
          <button><span class="material-symbols-outlined">blur_off</span>Disable focus</button>
          <button><span class="material-symbols-outlined">memory</span>Runtime</button>
          <button><span class="material-symbols-outlined">pie_chart</span>Mix</button>
          <button><span class="material-symbols-outlined">query_stats</span>Query stats</button>
          <button><span class="material-symbols-outlined">stacked_line_chart</span>Trend</button>
          <button><span class="material-symbols-outlined">tips_and_updates</span>Advice</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "AnalyticsConsole.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ ArrowRight, BarChart3, Cpu, EyeOff, Lightbulb, PieChart, TrendingUp \} from "lucide-react";/);
      assert.match(code, /<ArrowRight/);
      assert.match(code, /<EyeOff/);
      assert.match(code, /<Cpu/);
      assert.match(code, /<PieChart/);
      assert.match(code, /<BarChart3/);
      assert.match(code, /<TrendingUp/);
      assert.match(code, /<Lightbulb/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|arrow_right_alt|blur_off|query_stats/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps API and risk Material Symbols used by generated dashboards", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-api-risk-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "risk-console", title: "Risk Console" },
      ]));
      writeHtml(path.join(stitchDir, "risk-console.html"), `
        <main>
          <button><span class="material-symbols-outlined">api</span>API</button>
          <button><span class="material-symbols-outlined">delete_sweep</span>Clear</button>
          <button><span class="material-symbols-outlined">donut_small</span>Share</button>
          <button><span class="material-symbols-outlined">gpp_bad</span>Risk</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "RiskConsole.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Braces, PieChart, ShieldAlert, Trash2 \} from "lucide-react";/);
      assert.match(code, /<Braces/);
      assert.match(code, /<Trash2/);
      assert.match(code, /<PieChart/);
      assert.match(code, /<ShieldAlert/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|delete_sweep|donut_small|gpp_bad/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps content workflow Material Symbols used by generated dashboards", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-content-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "content-workflow", title: "Content Workflow" },
      ]));
      writeHtml(path.join(stitchDir, "content-workflow.html"), `
        <main>
          <button><span class="material-symbols-outlined">article</span>Article</button>
          <button><span class="material-symbols-outlined">circle</span>Status</button>
          <button><span class="material-symbols-outlined">dynamic_feed</span>Feed</button>
          <button><span class="material-symbols-outlined">inbox</span>Inbox</button>
          <button><span class="material-symbols-outlined">notes</span>Notes</button>
          <button><span class="material-symbols-outlined">rule</span>Rule</button>
          <button><span class="material-symbols-outlined">sync_saved_locally</span>Saved</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ContentWorkflow.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Circle, FileText, Inbox, Rows3, Ruler, Save, StickyNote \} from "lucide-react";/);
      assert.match(code, /<FileText/);
      assert.match(code, /<Circle/);
      assert.match(code, /<Rows3/);
      assert.match(code, /<Inbox/);
      assert.match(code, /<StickyNote/);
      assert.match(code, /<Ruler/);
      assert.match(code, /<Save/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|dynamic_feed|sync_saved_locally/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps system topology Material Symbols used by generated dashboards", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-topology-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "system-topology", title: "System Topology" },
      ]));
      writeHtml(path.join(stitchDir, "system-topology.html"), `
        <main>
          <button><span class="material-symbols-outlined">account_tree</span>Topology</button>
          <button><span class="material-symbols-outlined">error_outline</span>Error</button>
          <button><span class="material-symbols-outlined">flag</span>Flag</button>
          <button><span class="material-symbols-outlined">insights</span>Insights</button>
          <button><span class="material-symbols-outlined">lan</span>Network</button>
          <button><span class="material-symbols-outlined">storage</span>Storage</button>
          <button><span class="material-symbols-outlined">title</span>Title</button>
          <button><span class="material-symbols-outlined">work</span>Work</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "SystemTopology.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Briefcase, CircleAlert, Database, Flag, GitBranch, Lightbulb, Network, Type \} from "lucide-react";/);
      assert.match(code, /<GitBranch/);
      assert.match(code, /<CircleAlert/);
      assert.match(code, /<Flag/);
      assert.match(code, /<Lightbulb/);
      assert.match(code, /<Network/);
      assert.match(code, /<Database/);
      assert.match(code, /<Type/);
      assert.match(code, /<Briefcase/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|account_tree|error_outline/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps network and risk trend Material Symbols used by generated dashboards", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-network-risk-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "network-risk", title: "Network Risk" },
      ]));
      writeHtml(path.join(stitchDir, "network-risk.html"), `
        <main>
          <button><span class="material-symbols-outlined">cloud</span>Cloud</button>
          <button><span class="material-symbols-outlined">gpp_maybe</span>Risk</button>
          <button><span class="material-symbols-outlined">router</span>Router</button>
          <button><span class="material-symbols-outlined">show_chart</span>Trend</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "NetworkRisk.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Cloud, Router, ShieldAlert, TrendingUp \} from "lucide-react";/);
      assert.match(code, /<Cloud/);
      assert.match(code, /<ShieldAlert/);
      assert.match(code, /<Router/);
      assert.match(code, /<TrendingUp/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|gpp_maybe|show_chart/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps compact dashboard utility Material Symbols used by generated navigation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-dashboard-utility-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "dashboard-utility", title: "Dashboard Utility" },
      ]));
      writeHtml(path.join(stitchDir, "dashboard-utility.html"), `
        <main>
          <button><span class="material-symbols-outlined">horizontal_rule</span>Minimize</button>
          <button><span class="material-symbols-outlined">open_in_new</span>Open</button>
          <button><span class="material-symbols-outlined">clear_all</span>Clear filters</button>
          <button><span class="material-symbols-outlined">dataset_linked</span>Linked dataset</button>
          <button><span class="material-symbols-outlined">science</span>Experiment</button>
          <button><span class="material-symbols-outlined">code</span>Code</button>
          <button><span class="material-symbols-outlined">language</span>Language</button>
          <button><span class="material-symbols-outlined">smartphone</span>Mobile</button>
          <button><span class="material-symbols-outlined">bug_report</span>Defect</button>
          <button><span class="material-symbols-outlined">lens</span>Status dot</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "DashboardUtility.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
      assert.match(code, /import \{ Bug, Circle, Code, DatabaseZap, ExternalLink, FlaskConical, Languages, ListX, Minus, Smartphone \} from "lucide-react";/);
      assert.match(code, /<Bug/);
      assert.match(code, /<Circle/);
      assert.match(code, /<Minus/);
      assert.match(code, /<ExternalLink/);
      assert.match(code, /<ListX/);
      assert.match(code, /<DatabaseZap/);
      assert.match(code, /<FlaskConical/);
      assert.match(code, /<Code/);
      assert.match(code, /<Languages/);
      assert.match(code, /<Smartphone/);
      assert.doesNotMatch(code, /\bBadgeHelp\b|material-symbols|horizontal_rule|open_in_new|clear_all|dataset_linked|science|smartphone|bug_report|lens/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps generated screen conversion build-safe when Stitch uses an unmapped Material Symbol", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-unknown-icon-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "unknown-icon-screen", title: "Unknown Icon Screen" },
      ]));
      writeHtml(path.join(stitchDir, "unknown-icon-screen.html"), `
        <main>
          <button><span class="material-symbols-outlined">domain_specific_unknown_icon</span>Action</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "UnknownIconScreen.tsx"), "utf-8");
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "warning");
      assert.equal(iconReport.severity, "supervisor_fixable");
      assert.deepEqual(iconReport.icons, [{ iconName: "domain_specific_unknown_icon", count: 1 }]);
      assert.match(code, /import \{ BadgeHelp \} from "lucide-react";/);
      assert.doesNotMatch(code, /material-symbols|domain_specific_unknown_icon/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps settings and policy Material Symbols used by game config screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-game-config-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "game-settings", title: "Game Settings" },
      ]));
      writeHtml(path.join(stitchDir, "game-settings.html"), `
        <main>
          <button><span class="material-symbols-outlined">settings_input_component</span>Config</button>
          <button><span class="material-symbols-outlined">shield</span>Safety</button>
          <button><span class="material-symbols-outlined">leaderboard</span>Scores</button>
          <button><span class="material-symbols-outlined">pause_circle</span>Pause</button>
          <button><span class="material-symbols-outlined">play_circle</span>Resume</button>
          <button><span class="material-symbols-outlined">replay</span>Restart</button>
          <button><span class="material-symbols-outlined">device_reset</span>Reset Device</button>
          <button><span class="material-symbols-outlined">cancel</span>Cancel</button>
          <button><span class="material-symbols-outlined">face</span>Profile</button>
          <button><span class="material-symbols-outlined">keyboard_return</span>Return</button>
          <button><span class="material-symbols-outlined">power_settings_new</span>Power</button>
          <button><span class="material-symbols-outlined">layers</span>Layers</button>
          <button><span class="material-symbols-outlined">stars</span>Bonus</button>
          <button><span class="material-symbols-outlined">trophy</span>Trophy</button>
          <button><span class="material-symbols-outlined">emoji_events</span>Events</button>
          <button><span class="material-symbols-outlined">sports_esports</span>Controls</button>
          <input type="range" min="1" max="3" value="2" oninput="syncValue(this.value)" />
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameSettings.tsx"), "utf-8");
      assert.match(code, /import \{ Ban, CirclePause, CirclePlay, CornerDownLeft, Gamepad2, Layers, Power, RefreshCcw, RotateCcw, Shield, SlidersHorizontal, Smile, Sparkles, Trophy \} from "lucide-react";/);
      assert.match(code, /<Ban/);
      assert.match(code, /<CirclePause/);
      assert.match(code, /<CirclePlay/);
      assert.match(code, /<CornerDownLeft/);
      assert.match(code, /<Layers/);
      assert.match(code, /<Power/);
      assert.match(code, /<RefreshCcw/);
      assert.match(code, /<RotateCcw/);
      assert.match(code, /<SlidersHorizontal/);
      assert.match(code, /<Shield/);
      assert.match(code, /<Smile/);
      assert.match(code, /<Sparkles/);
      assert.match(code, /<Trophy/);
      assert.match(code, /<Gamepad2/);
      assert.doesNotMatch(code, /\boninput=|\bonInput="syncValue/);
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
      assert.deepEqual(iconReport.icons, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("maps common browser-game telemetry Material Symbols used by Stitch game screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-game-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "index.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "game-icons", title: "Game Icons" },
      ]));
      writeHtml(path.join(stitchDir, "game-icons.html"), `
        <main>
          <span class="material-symbols-outlined">local_fire_department</span>
          <span class="material-symbols-outlined">local_gas_station</span>
          <span class="material-symbols-outlined">straighten</span>
          <span class="material-symbols-outlined">ads_click</span>
          <span class="material-symbols-outlined">electric_bolt</span>
          <span class="material-symbols-outlined">equalizer</span>
          <span class="material-symbols-outlined">volume_down</span>
          <span class="material-symbols-outlined">vibration</span>
          <span class="material-symbols-outlined">wifi</span>
          <span class="material-symbols-outlined">wifi_tethering</span>
          <span class="material-symbols-outlined">directions_car</span>
          <span class="material-symbols-outlined">flash_on</span>
          <span class="material-symbols-outlined">hub</span>
          <span class="material-symbols-outlined">interests</span>
          <span class="material-symbols-outlined">keyboard_alt</span>
          <span class="material-symbols-outlined">keyboard_arrow_down</span>
          <span class="material-symbols-outlined">keyboard_voice</span>
          <span class="material-symbols-outlined">scoreboard</span>
          <span class="material-symbols-outlined">settings_suggest</span>
          <span class="material-symbols-outlined">space_bar</span>
          <span class="material-symbols-outlined">token</span>
          <span class="material-symbols-outlined">trip_origin</span>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameIcons.tsx"), "utf-8");
      assert.match(code, /Car/);
      assert.match(code, /AudioWaveform/);
      assert.match(code, /ChevronDown/);
      assert.match(code, /CircleDot/);
      assert.match(code, /Coins/);
      assert.match(code, /Flame/);
      assert.match(code, /Fuel/);
      assert.match(code, /Keyboard/);
      assert.match(code, /Mic/);
      assert.match(code, /MousePointerClick/);
      assert.match(code, /Network/);
      assert.match(code, /RadioTower/);
      assert.match(code, /Ruler/);
      assert.match(code, /Settings2/);
      assert.match(code, /Shapes/);
      assert.match(code, /Space/);
      assert.match(code, /Trophy/);
      assert.match(code, /Vibrate/);
      assert.match(code, /Volume1/);
      assert.match(code, /Zap/);
      const iconReport = JSON.parse(fs.readFileSync(path.join(tmp, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(iconReport.status, "pass");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles JSX-style className Material Symbol markup from Stitch exports", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-jsx-icons-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "menu-screen", title: "Main Menu" },
      ]));
      writeHtml(path.join(stitchDir, "menu-screen.html"), `
        <main>
          <button className="transition-all">
            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
            Play
          </button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "MainMenu.tsx"), "utf-8");
      assert.match(code, /import \{ Play \} from "lucide-react";/);
      assert.match(code, /<button className="transition-colors"/);
      assert.match(code, /<Play className="text-\[20px\]" aria-hidden=\{true\} focusable="false" \/>/);
      assert.doesNotMatch(code, /material-symbols|Material Symbols|>play_arrow<|transition-all/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("normalizes already self-closed void tags into valid JSX", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-void-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "error-screen", title: "Error State" },
      ]));
      writeHtml(path.join(stitchDir, "error-screen.html"), "<main><p>Error<br/>Try again</p></main>");

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ErrorState.tsx"), "utf-8");
      assert.match(code, /Error<br \/>Try again/);
      assert.doesNotMatch(code, /<br\/ \/>/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("normalizes SVG attributes into JSX names", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-svg-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "loading-screen", title: "Loading Screen" },
      ]));
      writeHtml(path.join(stitchDir, "loading-screen.html"), `
        <main>
          <svg viewbox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink">
            <defs>
              <lineargradient id="a" gradientunits="userSpaceOnUse" gradienttransform="rotate(45)"><stop stop-color="#fff"></stop></lineargradient>
              <radialgradient id="b"></radialgradient>
              <pattern id="p" patternunits="userSpaceOnUse" patterncontentunits="objectBoundingBox"></pattern>
              <mask id="m" maskunits="userSpaceOnUse" maskcontentunits="objectBoundingBox"></mask>
              <clippath id="c" clippathunits="objectBoundingBox"><path></path></clippath>
              <foreignobject></foreignobject>
              <textpath href="#label">Label</textpath>
            </defs>
            <circle stroke-width="3" stroke-linecap="round"></circle>
            <path fill-rule="evenodd" clip-rule="evenodd" xlink:href="#shape"></path>
          </svg>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "LoadingScreen.tsx"), "utf-8");
      assert.match(code, /viewBox=/);
      assert.match(code, /xmlnsXlink=/);
      assert.match(code, /strokeWidth=/);
      assert.match(code, /strokeLinecap=/);
      assert.match(code, /fillRule=/);
      assert.match(code, /clipRule=/);
      assert.match(code, /<linearGradient/);
      assert.match(code, /gradientUnits=/);
      assert.match(code, /gradientTransform=/);
      assert.match(code, /patternUnits=/);
      assert.match(code, /patternContentUnits=/);
      assert.match(code, /maskUnits=/);
      assert.match(code, /maskContentUnits=/);
      assert.match(code, /clipPathUnits=/);
      assert.match(code, /<\/linearGradient>/);
      assert.match(code, /<radialGradient/);
      assert.match(code, /<clipPath/);
      assert.match(code, /<foreignObject/);
      assert.match(code, /<textPath/);
      assert.match(code, /xlinkHref=/);
      assert.doesNotMatch(code, /viewbox=|stroke-width=|fill-rule=|clip-rule=|patternunits=|patterncontentunits=|gradientunits=|gradienttransform=|maskunits=|maskcontentunits=|clippathunits=|xlink:href=|lineargradient|radialgradient|clippath|foreignobject|textpath/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("normalizes JSX-only numeric and boolean attribute values", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-attrs-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "modal-screen", title: "New Record Modal" },
      ]));
      writeHtml(path.join(stitchDir, "modal-screen.html"), `
        <main>
          <label for="note">Not</label>
          <input type="checkbox" checked="" required="">
          <textarea id="note" rows="3" maxlength="120" readonly="true"></textarea>
          <div role="slider" aria-valuemin="0" aria-valuemax="10" aria-valuenow="8" aria-level="2"></div>
          <button tabindex="0" disabled="false">Save</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "NewRecordModal.tsx"), "utf-8");
      assert.match(code, /htmlFor="note"/);
      assert.match(code, /rows=\{3\}/);
      assert.match(code, /maxLength=\{120\}/);
      assert.match(code, /checked=\{true\}/);
      assert.match(code, /required=\{true\}/);
      assert.match(code, /readOnly=\{true\}/);
      assert.match(code, /aria-valuemin=\{0\}/);
      assert.match(code, /aria-valuemax=\{10\}/);
      assert.match(code, /aria-valuenow=\{8\}/);
      assert.match(code, /aria-level=\{2\}/);
      assert.match(code, /tabIndex=\{0\}/);
      assert.match(code, /disabled=\{false\}/);
      assert.doesNotMatch(code, /rows="3"|maxlength=|checked=""|required=""|readonly=|aria-valuemin="0"|aria-valuemax="10"|aria-valuenow="8"|aria-level="2"|tabindex=/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("normalizes multiline HTML comments before JSX parsing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-comments-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "history-screen", title: "History Screen" },
      ]));
      writeHtml(path.join(stitchDir, "history-screen.html"), `
        <main>
          <!--
            <div class="hidden">
              <span>History Empty</span>
            </div>
          -->
          <section>Records</section>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "HistoryScreen.tsx"), "utf-8");
      assert.match(code, /\{\/\*[\s\S]*History Empty[\s\S]*\*\/\}/);
      assert.doesNotMatch(code, /<!--|-->/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("wraps style tag CSS so braces do not break JSX parsing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-style-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "calendar-screen", title: "Calendar Picker" },
      ]));
      writeHtml(path.join(stitchDir, "calendar-screen.html"), `
        <main>
          <input type="date">
          <style>
            ::-webkit-calendar-picker-indicator { opacity: 0; cursor: pointer; }
          </style>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "CalendarPicker.tsx"), "utf-8");
      assert.match(code, /<style>\{`[\s\S]*::-webkit-calendar-picker-indicator \{ opacity: 0; cursor: pointer; \}[\s\S]*`\}<\/style>/);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("escapes literal text braces in preformatted content without breaking JSX expressions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-pre-braces-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "game-over", title: "Game Over" },
      ]));
      writeHtml(path.join(stitchDir, "game-over.html"), `
        <main>
          <!-- keep this comment as JSX comment -->
          <style>.panel { color: red; }</style>
          <pre>Final_State: {
  "score": 142850,
  "active_piece": null
}
Awaiting input...</pre>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameOver.tsx"), "utf-8");
      assert.match(code, /Final_State: &#123;/);
      assert.match(code, /&#125;\s+Awaiting input/);
      assert.match(code, /<style>\{`\.panel \{ color: red; \}`\}<\/style>/);
      assert.match(code, /\{\/\* keep this comment as JSX comment \*\/\}/);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps CSS custom properties valid in JSX inline style objects", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-inline-style-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "options-screen", title: "Game Options" },
      ]));
      writeHtml(path.join(stitchDir, "options-screen.html"), `
        <main>
          <input type="range" style="--tw-accent: #bdc2ff; accent-color: #bdc2ff">
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameOptions.tsx"), "utf-8");
      assert.match(code, /style=\{\{"--tw-accent": "#bdc2ff", accentColor: "#bdc2ff"\} as any\}/);
      assert.doesNotMatch(code, /-TwAccent/);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("drops Stitch responsive inline style declarations that are invalid React CSSProperties", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-responsive-inline-style-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "analytics-screen", title: "Analytics Screen" },
      ]));
      writeHtml(path.join(stitchDir, "analytics-screen.html"), `
        <main>
          <header class="fixed left-16 md:left-64" style="width: calc(100% - 64px); md:width: calc(100% - 256px); padding-left: 16px; md:padding-left: 272px;">Header</header>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "AnalyticsScreen.tsx"), "utf-8");
      assert.match(code, /style=\{\{width: "calc\(100% - 64px\)", paddingLeft: "16px"\}\}/);
      assert.doesNotMatch(code, /\bmd: "/);

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map(d => d.messageText), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("extracts build-safe design tokens from Google font URLs", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-token-css-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(stitchDir, { recursive: true });
      writeHtml(path.join(stitchDir, "main.html"), `
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <script id="tailwind-config">
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  body: ["Hanken Grotesk", "sans-serif"],
                  mono: ["JetBrains Mono", "monospace"],
                },
                colors: { surface: "#101116" }
              }
            }
          };
        </script>
      `);

      execFileSync("node", ["scripts/stitch-api.mjs", "extract-tokens", stitchDir], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const css = fs.readFileSync(path.join(stitchDir, "design-tokens.css"), "utf-8");
      assert.match(css, /--font-body: Hanken Grotesk, sans-serif;/);
      assert.match(css, /--font-google-0: "Hanken Grotesk";/);
      assert.doesNotMatch(css, /100\.\.900;1,100\.\.900/);
      const fontGoogleLine = css.split(/\r?\n/).find(line => line.includes("--font-google-0")) || "";
      assert.equal((fontGoogleLine.match(/;/g) || []).length, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("writes runtime CSS for Stitch utility classes used by generated screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-runtime-css-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "index.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
      fs.writeFileSync(path.join(stitchDir, "design-tokens.css"), [
        ":root {",
        "  --color-background: #0f172a;",
        "  --color-surface: #081425;",
        "  --color-surface-container: #111827;",
        "  --color-on-surface: #d8e3fb;",
        "  --color-outline-variant: #3e4850;",
        "  --font-body-md: Inter;",
        "  --spacing-gutter: 0.75rem;",
        "  --spacing-hud-safe-area: 32px;",
        "  --radius-DEFAULT: 0.125rem;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "game-screen", title: "Game Board" },
      ]));
      writeHtml(path.join(stitchDir, "game-screen.html"), `
        <style>
          .scanlines { pointer-events: none; }
          .grid-perspective { transform: perspective(1000px) rotateX(60deg); }
          @keyframes pulse-move { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        </style>
        <main class="bg-grid px-gutter p-gutter pb-hud-safe-area bg-surface text-on-surface dark:bg-surface hover:bg-surface-container dark:hover:bg-surface-container">
          <div class="scanlines"></div>
          <div class="absolute bottom-hud-safe-area left-hud-safe-area right-hud-safe-area">HUD</div>
          <div class="grid-perspective"></div>
          <div class="w-grid-block h-grid-block tetromino-i machined-border"></div>
          <button class="min-touch h-touch-target text-label-sm font-label-sm font-body-md border-outline-variant rounded-DEFAULT neon-glow-red">Start</button>
          <span class="ghost-piece text-display-lg font-display-lg"></span>
          <span class="score-readout text-display-xl font-display-xl"></span>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });
      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const css = fs.readFileSync(path.join(tmp, "src", "index.css"), "utf-8");
      assert.match(css, /@import '\.\.\/stitch\/design-tokens\.css';/);
      assert.equal((css.match(/SETFARM_STITCH_RUNTIME_UTILITIES_START/g) || []).length, 1);
      assert.equal((css.match(/SETFARM_STITCH_CUSTOM_CSS_START/g) || []).length, 1);
      assert.match(css, /\.scanlines \{ pointer-events: none; \}/);
      assert.match(css, /\.grid-perspective \{ transform: perspective\(1000px\) rotateX\(60deg\); \}/);
      assert.match(css, /@keyframes pulse-move/);
      assert.match(css, /\.text-label-sm \{ font-size: 0\.75rem; line-height: 1rem; \}/);
      assert.match(css, /\.text-display-xl \{ font-size: 4\.5rem; line-height: 1; \}/);
      assert.match(css, /\.font-label-sm \{ font-weight: 600; letter-spacing: 0\.02em; \}/);
      assert.match(css, /\.font-display-xl \{ font-weight: 900; \}/);
      assert.match(css, /\.tetromino-i \{ background: var\(--tetromino-i, #38bdf8\);/);
      assert.match(css, /\.w-grid-block \{ width: clamp\(1\.1rem, 5vw, 1\.85rem\); \}/);
      assert.match(css, /\.min-touch \{ min-width: 44px; min-height: 44px; \}/);
      assert.match(css, /\.bg-grid \{ background-image:/);
      assert.match(css, /\.bg-surface \{ background-color: var\(--color-surface\); \}/);
      assert.match(css, /\.text-on-surface \{ color: var\(--color-on-surface\); \}/);
      assert.match(css, /\.border-outline-variant \{ border-color: var\(--color-outline-variant\); \}/);
      assert.match(css, /\.p-gutter \{ padding: var\(--spacing-gutter\); \}/);
      assert.match(css, /\.pb-hud-safe-area \{ padding-bottom: var\(--spacing-hud-safe-area\); \}/);
      assert.match(css, /\.bottom-hud-safe-area \{ bottom: var\(--spacing-hud-safe-area\); \}/);
      assert.match(css, /\.left-hud-safe-area \{ left: var\(--spacing-hud-safe-area\); \}/);
      assert.match(css, /\.right-hud-safe-area \{ right: var\(--spacing-hud-safe-area\); \}/);
      assert.match(css, /\.font-body-md \{ font-family: var\(--font-body-md\), sans-serif; \}/);
      assert.match(css, /\.rounded-DEFAULT \{ border-radius: var\(--radius-DEFAULT\); \}/);
      assert.ok(css.includes(".dark .dark\\:bg-surface { background-color: var(--color-surface); }"));
      assert.ok(css.includes(".hover\\:bg-surface-container:hover { background-color: var(--color-surface-container); }"));
      assert.ok(css.includes(".dark .dark\\:hover\\:bg-surface-container:hover { background-color: var(--color-surface-container); }"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("adds no-repeat policy to generated scene background images", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stitch-scene-bg-"));
    try {
      const stitchDir = path.join(tmp, "stitch");
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.mkdirSync(stitchDir, { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "index.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
      fs.writeFileSync(path.join(stitchDir, "design-tokens.css"), ":root { --color-surface: #10131a; }\n");
      fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "gameplay-screen", title: "Gameplay Screen" },
      ]));
      writeHtml(path.join(stitchDir, "gameplay-screen.html"), `
        <main>
          <div class="absolute inset-0 bg-[url('image-gameplay-bg')] bg-cover bg-center opacity-30" data-alt="Large gameplay background"></div>
          <button>Start Game</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "GameplayScreen.tsx"), "utf-8");
      assert.match(code, /className="absolute inset-0 bg-\[url\('image-gameplay-bg'\)\] bg-cover bg-center opacity-30 bg-no-repeat"/);

      const css = fs.readFileSync(path.join(tmp, "src", "index.css"), "utf-8");
      assert.match(css, /\.bg-no-repeat \{ background-repeat: no-repeat; \}/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

});
