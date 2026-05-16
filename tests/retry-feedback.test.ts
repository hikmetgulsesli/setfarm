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
        "DESIGN MISMATCH:",
        "src/screens/GameBoard.tsx:2 — UI_CONTRACT: Material Symbols/icon fonts are not allowed; replace with inline SVG components.",
        "FIX:",
        "• Replace Material Symbols/icon font/emoji icons with inline SVG components or an installed SVG icon library.",
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
        "DESIGN MISMATCH:",
        "src/screens/GameBoard.tsx:88 — UI_CONTRACT: Material Symbols/icon fonts are not allowed.",
        "FIX: Resolve the exact UI contract failures; import stitch/design-tokens.css and replace hardcoded colors with var(--*) tokens.",
      ].join("\n");

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /src\/screens\/GameBoard\.tsx:3 — UI_CONTRACT: Material Symbols\/icon fonts are not allowed/);
      assert.match(output, /blanket transition-all is not allowed/);
      assert.match(output, /inline SVG components/);
      assert.doesNotMatch(output, /design-tokens\.css|hardcoded colors/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rewrites shared type retry advice when type files are outside story scope", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-scope-"));
    try {
      fs.writeFileSync(path.join(repo, ".story-scope-files"), "src/screens/GameBoard.tsx\nsrc/screens/MainMenu.tsx\n");
      const feedback = [
        "FEEDBACK:",
        "- src/screens/GameBoard.tsx:121 — ghost cell uses `as Cell`; update Cell type to include ghost variants.",
      ].join("\n");

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /keep the shared Cell type unchanged; use a local render\/display type in the owned screen/);
      assert.match(output, /SCOPE NOTE/);
      assert.match(output, /Do not edit shared domain\/type files/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps shared type retry advice when type files are explicitly scoped", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-type-scope-"));
    try {
      fs.writeFileSync(path.join(repo, ".story-scope-files"), "src/screens/GameBoard.tsx\nsrc/types/domain.ts\n");
      const feedback = "- src/types/domain.ts:15 — update Cell type to include ghost variants.";

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /update Cell type to include ghost variants/);
      assert.doesNotMatch(output, /SCOPE NOTE/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
