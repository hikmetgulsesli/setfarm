import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAgentPromptContracts } from "../dist/installer/prompt-contracts.js";

describe("agent prompt contracts", () => {
  it("removes stale Material Symbols font instructions from old workflow templates", () => {
    const input = [
      "DESIGN ENFORCEMENT (frontend stories — MANDATORY checklist before commit):",
      "- FONTS: Google Fonts <link> in layout <head> (NOT next/font for static exports).",
      "  :root must have --font-heading and --font-body CSS vars.",
      "  h1-h6 → var(--font-heading), body → var(--font-body).",
      "  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.",
      "  - If stitch/*.html or DESIGN_DOM contains Material Symbols icon names,",
      "    YOU MUST add this to index.html <head> or app/layout.tsx:",
      "    <link href=\"https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined\" rel=\"stylesheet\" />",
      "    Without this link, icons render as plain text instead of symbols.",
      "- NEVER: emoji icons, purple gradients, transition:all",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /YOU MUST add this to index\.html|Material\+Symbols\+Outlined|Without this link/);
    assert.match(output, /Do NOT add Material Symbols/);
    assert.match(output, /inline SVG components or an already-installed SVG icon library/);
    assert.match(output, /NEVER: emoji icons, icon fonts, Material Symbols/);
  });

  it("removes stale design-first icon-font instructions and generic retry fixes", () => {
    const input = [
      "DESIGN ENFORCEMENT (MANDATORY):",
      "- FONTS: copy every Google Fonts `<link>` from the Stitch HTML into",
      "  `index.html <head>`.",
      "  1. Copy every Stitch font link exactly.",
      "  2. If Stitch uses Material Symbols, include:",
      "     <link href=\"https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap\" rel=\"stylesheet\"/>",
      "  3. Do not skip font links from the Stitch HTML head.",
      "  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.",
      "- NEVER: emoji icons, purple gradients, transition: all, href=\"#\", empty",
      "DÜZELT: Kritik UI sözleşmesi hatalarını düzelt; stitch/design-tokens.css'i import et, hardcoded renkleri var(--*) ile değiştir.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /Material\+Symbols\+Outlined|Copy every Stitch font link exactly|Kritik UI sözleşmesi|hardcoded renkleri/);
    assert.match(output, /Do not copy\s+Material Symbols, Material Icons, or any icon-font links/);
    assert.match(output, /dead unhandled placeholder links/);
    assert.match(output, /Fix only the exact UI_CONTRACT lines above/);
  });

  it("rewrites stale href hash instructions without telling agents to change Stitch anchors into spans", () => {
    const input = [
      "- LINKS: NEVER use href=\"#\" or href=\"javascript:void(0)\" — these are dead links.",
      "  Every <Link> and <a> MUST point to a real project-specific route from PRD/Stitch/DESIGN_DOM.",
      "  If the destination page doesn't exist yet, create a minimal placeholder page with the route.",
      "  If a sidebar/navbar has navigation items, EVERY item MUST have a working href.",
      "  Before commit: grep -rn 'href=\"#\"' src/ — if ANY match found, you MUST fix them all.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /grep -rn 'href="#'|EVERY item MUST have a working href/);
    assert.match(output, /Preserve generated Stitch `<a>` tags, className, nesting and layout/);
    assert.match(output, /Do NOT replace anchors with `<span>`/);
  });
});
