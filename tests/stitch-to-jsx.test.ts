import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
      assert.match(code, /xlinkHref=/);
      assert.doesNotMatch(code, /viewbox=|stroke-width=|fill-rule=|clip-rule=|xlink:href=/);
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
          <textarea id="note" rows="3" maxlength="120" readonly="true"></textarea>
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
      assert.match(code, /readOnly=\{true\}/);
      assert.match(code, /tabIndex=\{0\}/);
      assert.match(code, /disabled=\{false\}/);
      assert.doesNotMatch(code, /rows="3"|maxlength=|readonly=|tabindex=/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
