import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRetryFeedbackForCurrentSource } from "../src/installer/retry-feedback.js";

describe("retry feedback sanitization", () => {
  it("drops stale UI_CONTRACT feedback that no longer reproduces in current source", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-"));
    try {
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src/screens/GameBoard.tsx"), `
        /* Inline SVG icons - Material Symbols are not allowed per UI contract */
        export function GameBoard() {
          return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h16" /></svg>;
        }
      `);

      const feedback = [
        "DESIGN UYUMSUZLUK:",
        "src/screens/GameBoard.tsx:2 — UI_CONTRACT: Material Symbols/icon fonts are not allowed; replace with inline SVG components.",
        "DÜZELT:",
        "• Material Symbols/icon font/emoji ikonlarını inline SVG componentleriyle veya kurulu SVG icon library ile değiştir.",
      ].join("\n");

      assert.equal(sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo }), "");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("refreshes retry feedback when current source still has deterministic UI violations", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-active-"));
    try {
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src/screens/GameBoard.tsx"), `
        export function GameBoard() {
          return <span className="material-symbols-outlined transition-all">play_arrow</span>;
        }
      `);

      const feedback = [
        "DESIGN UYUMSUZLUK:",
        "src/screens/GameBoard.tsx:88 — UI_CONTRACT: Material Symbols/icon fonts are not allowed.",
        "DÜZELT: Kritik UI sözleşmesi hatalarını düzelt; stitch/design-tokens.css'i import et, hardcoded renkleri var(--*) ile değiştir.",
      ].join("\n");

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /src\/screens\/GameBoard\.tsx:3 — UI_CONTRACT: Material Symbols\/icon fonts are not allowed/);
      assert.match(output, /blanket transition-all is not allowed/);
      assert.match(output, /inline SVG components/);
      assert.doesNotMatch(output, /design-tokens\.css|hardcoded renkleri/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
