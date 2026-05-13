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

  it("removes stale generated-screen focused-read loopholes", () => {
    const input = [
      "- If a screen file is only in SHARED_FILES, do NOT cat/read/sed the full",
      "  file. Use src/screens/SCREEN_INDEX.json, src/screens/index.ts,",
      "  COMPONENT REGISTRY, STORY_SCREENS, and UI BEHAVIOR CONTRACT for",
      "  component names, props, and action IDs.",
      "- Never read every src/screens/*.tsx file in one turn. If exact detail is",
      "  still needed, inspect one relevant file with a focused line range.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /If exact detail is\s+still needed, inspect one relevant file/i);
    assert.doesNotMatch(output, /do NOT cat\/read\/sed the full\s+file/i);
    assert.match(output, /do NOT use read, cat, sed,\s+head, tail, rg, grep, find, awk, node, or python/i);
    assert.match(output, /Focused line-range inspection is allowed only for generated screen files\s+explicitly listed in SCOPE_FILES/i);
    assert.match(output, /Shared\/read-only generated screens must\s+be consumed through SCREEN_INDEX\/index\.ts and injected contracts only/i);
  });

  it("removes stale implement-time full reference read requirements", () => {
    const input = [
      "## BEFORE Writing Any Code",
      "",
      "You MUST read these reference files before starting implementation:",
      "1. **references/design-standards.md** — Frontend design rules (MANDATORY)",
      "2. **references/backend-standards.md** — Backend/API/DB rules (MANDATORY)",
      "3. **references/web-guidelines.md** — Accessibility, forms, performance (MANDATORY)",
      "",
      "Follow ALL rules in these references. Violations will cause your PR to be REJECTED.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /You MUST read these reference files|backend-standards\.md\*\* — Backend\/API\/DB rules \(MANDATORY\)/);
    assert.match(output, /Do NOT read full `references\/\*\.md` files during implement/);
    assert.match(output, /Backend\/API\/DB standards apply\s+only to backend\/API\/database story scope/);
    assert.match(output, /do not load unrelated backend\/security\/SQL guidance\s+into the session/);
  });

  it("rewrites stale claim jq instructions to claim-summary-first handoff", () => {
    const input = [
      "BEFORE writing code:",
      "0. If PREVIOUS FAILURE is non-empty: analyze what went wrong.",
      "1. Read the story description and acceptance criteria from the claim with jq.",
      "   Do NOT cat the full claim JSON. Do NOT paste large prompt/context files into",
      "   the session.",
      "2. Continue normally.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /from the claim with jq|Do NOT cat the full claim JSON/i);
    assert.match(output, /Read the structured claim summary file first/);
    assert.match(output, /supervisorMemory, previousFailure/);
    assert.match(output, /Do NOT parse or dump claim\.input with jq, sed, head, cat, node loops/);
  });

  it("rewrites stale implement instructions that tell agents to read raw Stitch DOM", () => {
    const input = [
      "DESIGN DOM:",
      "Use stitch/DESIGN_DOM.json from WORKDIR when element-level detail is needed.",
      "Read only the screen ids listed in STORY_SCREENS. Do NOT paste or process the",
      "full project DOM in the session.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /Use stitch\/DESIGN_DOM\.json from WORKDIR/);
    assert.match(output, /Use only the injected STORY_SCREENS, UI BEHAVIOR CONTRACT/);
    assert.match(output, /Do NOT read raw stitch\/\*\.html, \.stitch-screens\*\.json, or full/);
    assert.match(output, /gateway enforces this/);
  });

  it("rewrites stale Design DOM nav/control rules that caused layout removal", () => {
    const input = [
      "DESIGN DOM RULES (MANDATORY — FOLLOW EXACTLY):",
      "- Every in-scope nav link must route to the correct page/modal",
      "- onClick={() => {}} is FORBIDDEN — if a button has no functionality, do not render it",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /nav link must route to the correct page\/modal|do not render it/);
    assert.match(output, /preserve the generated `<a>` tag/);
    assert.match(output, /do not replace it with `<span>`/);
    assert.match(output, /Preserve generated control structure/);
    assert.match(output, /Do not remove Stitch controls/);
  });
});
