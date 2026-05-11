import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyError, sanitizeDesignMismatchFeedback } from "../dist/installer/error-taxonomy.js";

describe("error taxonomy", () => {
  it("keeps design mismatch suggestions specific to reported UI contract failures", () => {
    const classified = classifyError([
      "DESIGN UYUMSUZLUK:",
      "src/screens/GameBoard.tsx:145 — UI_CONTRACT: Material Symbols/icon fonts are not allowed",
      "src/screens/GameBoard.tsx:164 — UI_CONTRACT: blanket transition-all is not allowed",
    ].join("\n"));

    assert.equal(classified.category, "DESIGN_MISMATCH");
    assert.match(classified.suggestion, /inline SVG components/);
    assert.match(classified.suggestion, /scoped transition properties/);
    assert.doesNotMatch(classified.suggestion, /design-tokens\.css|hardcoded colors/);
  });

  it("rewrites stale generic design mismatch feedback before retry prompts reuse it", () => {
    const feedback = sanitizeDesignMismatchFeedback([
      "DESIGN UYUMSUZLUK:",
      "src/screens/GameBoard.tsx:145 — UI_CONTRACT: Material Symbols/icon fonts are not allowed",
      "src/screens/GameBoard.tsx:164 — UI_CONTRACT: blanket transition-all is not allowed",
      "DÜZELT: Kritik UI sözleşmesi hatalarını düzelt; stitch/design-tokens.css'i import et, hardcoded renkleri var(--*) ile değiştir.",
    ].join("\n"));

    assert.match(feedback, /DÜZELT:\n• replace icon fonts\/emoji with inline SVG components/);
    assert.match(feedback, /• replace transition-all\/transition: all with scoped transition properties/);
    assert.doesNotMatch(feedback, /Kritik UI sözleşmesi|hardcoded renkleri/);
  });
});
