import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyError } from "../dist/installer/error-taxonomy.js";

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
});
