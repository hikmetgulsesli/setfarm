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
});
