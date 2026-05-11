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
        { screenId: "prd-screen", title: "Sayaç Uygulaması PRD" },
        { screenId: "invalid-screen", title: "Invalid Screen" },
        { screenId: "main-screen", title: "Ana Sayfa", htmlFile: "main-screen-custom.html" },
      ]));

      writeHtml(path.join(stitchDir, "prd-screen.html"), "<main><h1>PRD</h1></main>");
      fs.writeFileSync(path.join(stitchDir, "invalid-screen.html"), "<html></html>");
      writeHtml(path.join(stitchDir, "main-screen-custom.html"), "<main><button>Ekle</button></main>");

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const screensDir = path.join(tmp, "src", "screens");
      assert.equal(fs.existsSync(path.join(screensDir, "SayacUygulamasiPrd.tsx")), false);
      assert.equal(fs.existsSync(path.join(screensDir, "InvalidScreen.tsx")), false);
      assert.equal(fs.existsSync(path.join(screensDir, "AnaSayfa.tsx")), true);

      const index = JSON.parse(fs.readFileSync(path.join(screensDir, "SCREEN_INDEX.json"), "utf-8"));
      assert.deepEqual(index.map((s: any) => s.title), ["Ana Sayfa"]);
      assert.equal(index[0].buttons, 1);
      assert.deepEqual(index[0].actions, [
        { id: "ekle-1", kind: "button", label: "Ekle", index: 0 },
      ]);

      const code = fs.readFileSync(path.join(screensDir, "AnaSayfa.tsx"), "utf-8");
      assert.match(code, /export type AnaSayfaActionId = "ekle-1";/);
      assert.match(code, /actions\?: Partial<Record<AnaSayfaActionId, \(\) => void>>;/);
      assert.match(code, /<button type="button" data-action-id="ekle-1" onClick=\{actions\?\.\["ekle-1"\]\}>Ekle<\/button>/);

      const barrel = fs.readFileSync(path.join(screensDir, "index.ts"), "utf-8");
      assert.equal(barrel, 'export { AnaSayfa } from "./AnaSayfa";\nexport type { AnaSayfaProps, AnaSayfaActionId } from "./AnaSayfa";\n');
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
          <span class="material-symbols-outlined text-primary transition-all">warning</span>
          <button class="transition-all"><span class="material-symbols-outlined text-[18px]">rotate_right</span>Rotate</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "ControlsHelp.tsx"), "utf-8");
      assert.match(code, /import \{ RotateCw, TriangleAlert \} from "lucide-react";/);
      assert.match(code, /<TriangleAlert className="text-primary transition-colors" aria-hidden=\{true\} focusable="false" \/>/);
      assert.match(code, /<RotateCw className="text-\[18px\]" aria-hidden=\{true\} focusable="false" \/>Rotate/);
      assert.match(code, /<button className="transition-colors"/);
      assert.doesNotMatch(code, /material-symbols|Material Symbols|>warning<|>rotate_right</);
      assert.doesNotMatch(code, /transition-all/);
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
        { screenId: "error-screen", title: "Hata Durumu" },
      ]));
      writeHtml(path.join(stitchDir, "error-screen.html"), "<main><p>Hata<br/>Tekrar dene</p></main>");

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "HataDurumu.tsx"), "utf-8");
      assert.match(code, /Hata<br \/>Tekrar dene/);
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
        { screenId: "loading-screen", title: "Yükleme Ekranı" },
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

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "YuklemeEkrani.tsx"), "utf-8");
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
        { screenId: "modal-screen", title: "Yeni Kayıt Modalı" },
      ]));
      writeHtml(path.join(stitchDir, "modal-screen.html"), `
        <main>
          <label for="note">Not</label>
          <input type="checkbox" checked="" required="">
          <textarea id="note" rows="3" maxlength="120" readonly="true"></textarea>
          <div role="slider" aria-valuemin="0" aria-valuemax="10" aria-valuenow="8" aria-level="2"></div>
          <button tabindex="0" disabled="false">Kaydet</button>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "YeniKayitModali.tsx"), "utf-8");
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
        { screenId: "history-screen", title: "Kayıtlar Ekranı" },
      ]));
      writeHtml(path.join(stitchDir, "history-screen.html"), `
        <main>
          <!--
            <div class="hidden">
              <span>Geçmiş Boş</span>
            </div>
          -->
          <section>Kayıtlar</section>
        </main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", tmp], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const code = fs.readFileSync(path.join(tmp, "src", "screens", "KayitlarEkrani.tsx"), "utf-8");
      assert.match(code, /\{\/\*[\s\S]*Geçmiş Boş[\s\S]*\*\/\}/);
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

});
