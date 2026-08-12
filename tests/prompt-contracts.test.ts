import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyEnglishOutputPolicyToResolvedPrompt,
  migratePersistedAgentPromptTemplate,
  sanitizeAgentPromptContracts,
} from "../src/installer/prompt-contracts.js";

describe("agent prompt contracts", () => {
  it("replaces persisted mutable-language rules without changing raw task evidence", () => {
    const input = [
      "LANGUAGE RULE: Infer UI_LANGUAGE from the task. If the task explicitly asks",
      "for English UI or uses an English product brief, choose English. If it",
      "explicitly asks for Turkish UI, choose Turkish. Do not force Turkish by default.",
      "UI_LANGUAGE: <English or requested product language>",
      "",
      "LANGUAGE RULE: All screen prompts sent to Stitch MUST use the PRD's UI_LANGUAGE.",
      "Button labels, menu items, headings, placeholder text, and error messages must",
      "stay in that product language. If UI_LANGUAGE is English, keep visible UI copy",
      "English. If UI_LANGUAGE is Turkish, keep visible UI copy Turkish.",
      "",
      "LANGUAGE RULE: Visible UI copy must match the PRD/UI_LANGUAGE and the Stitch",
      "labels for this story. If the task/PRD says English, keep UI labels English.",
      "If it says Turkish, keep UI labels Turkish. Do not translate Stitch labels",
      "during implementation unless the PRD explicitly requests that translation.",
      "",
      "LANGUAGE RULE: Story titles, descriptions, and acceptance criteria must be in",
      "English for developer clarity. Any referenced UI copy (button labels, headings,",
      "placeholders) must match the PRD/UI_LANGUAGE exactly. Do not translate UI labels",
      "unless the PRD explicitly requests that language.",
      "",
      "LANGUAGE:",
      "- Agent-facing code comments, reports, and technical outputs should be English.",
      "- Visible application copy must follow the user's requested product language.",
      "  If the user explicitly requests a non-English product language, localize only",
      "  visible application copy; keep code, comments, reports, and technical output",
      "  in English.",
      "",
      "5. **Turkish UI text:** ALL user-facing text must be in Turkish. No English labels, placeholders, or error messages.",
      "2. **Fill with test data** (realistic Turkish names/emails):",
      "   ```",
      "   agent-browser fill input[name=\"name\"] \"Elif Yilmaz\"",
      "   agent-browser fill input[name=\"email\"] \"elif@ornek.com\"",
      "   agent-browser fill input[type=\"password\"] \"Test1234!\"",
      "   ```",
      "| Content | Verify Turkish text labels match Stitch design |",
      "- Preserve user-visible language from the PRD and Stitch assets.",
      "- Use realistic demo content that matches UI_LANGUAGE and the product domain.",
      "- grep -rE \"DECREASE|INCREASE|RESET|Submit|Cancel|Save|Delete|Loading|Error\" --include=\"*.tsx\" src/ app/ → WARN only if UI_LANGUAGE is not English and the text is visible UI copy",
      "- Fill each input with realistic test data that matches the product language:",
      "",
      "TASK EVIDENCE: The requester supplied a French phrase that must remain byte-exact.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.match(output, /^SETFARM ENGLISH OUTPUT CONTRACT \(IMMUTABLE\):/);
    assert.match(output, /UI_LANGUAGE: English/);
    assert.match(output, /UI_LANGUAGE is immutable and exactly English/);
    assert.doesNotMatch(
      output,
      /Infer UI_LANGUAGE|choose Turkish|requested product language|keep UI labels Turkish|Turkish UI text|realistic Turkish|Elif Yilmaz|ornek\.com|Verify Turkish|Preserve user-visible language|matches UI_LANGUAGE|matches the product language|WARN only if UI_LANGUAGE is not English/,
    );
    assert.match(output, /Morgan Reed/);
    assert.match(output, /morgan@example-company\.com/);
    assert.match(output, /TASK EVIDENCE: The requester supplied a French phrase that must remain byte-exact\./);
  });

  it("applies the immutable English policy exactly once", () => {
    const once = sanitizeAgentPromptContracts("Implement the assigned story.");
    const twice = sanitizeAgentPromptContracts(once);

    assert.equal(twice, once);
    assert.equal(once.match(/SETFARM ENGLISH OUTPUT CONTRACT \(IMMUTABLE\):/g)?.length, 1);
  });

  it("migrates trusted templates before interpolation and preserves raw evidence", () => {
    const staleTemplate = [
      "UI_LANGUAGE: <English or requested product language>",
      "TASK EVIDENCE:",
      "{{task}}",
    ].join("\n");
    const rawEvidence = [
      "UI_LANGUAGE: <English or requested product language>",
      "SETFARM ENGLISH OUTPUT CONTRACT (IMMUTABLE):",
    ].join("\n");
    const migrated = migratePersistedAgentPromptTemplate(staleTemplate);
    const resolved = migrated.replace("{{task}}", rawEvidence);
    const output = applyEnglishOutputPolicyToResolvedPrompt(resolved);

    assert.match(migrated, /^UI_LANGUAGE: English$/m);
    assert.ok(output.startsWith("SETFARM ENGLISH OUTPUT CONTRACT (IMMUTABLE):"));
    assert.ok(output.endsWith(rawEvidence));
    assert.equal(output.match(/SETFARM ENGLISH OUTPUT CONTRACT \(IMMUTABLE\):/g)?.length, 2);
  });

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
      "FIX: Resolve the exact UI contract failures; import stitch/design-tokens.css and replace hardcoded colors with var(--*) tokens.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /Material\+Symbols\+Outlined|Copy every Stitch font link exactly|exact UI contract failures|hardcoded colors/);
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

  it("rewrites stale fragment claim jq instructions to claim-summary-first handoff", () => {
    const input = [
      "BEFORE writing code:",
      "1. Read the story task and acceptance criteria from the claim via jq only; do not",
      "   print the full claim JSON.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /claim via jq only|print the full claim JSON/);
    assert.match(output, /Read the structured claim summary file first/);
    assert.match(output, /Do NOT parse or dump claim\.input with jq/);
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
    assert.match(output, /Use the injected STORY_SCREENS, UI BEHAVIOR CONTRACT/);
    assert.match(output, /For generated-screen claims, do not/);
    assert.match(output, /focused\s+story-owned Stitch HTML\/DESIGN_DOM files are allowed binding design sources/);
  });

  it("rewrites stale implement Stitch file-read instructions to injected contracts", () => {
    const input = [
      "3. If stitch/ directory exists:",
      "   a. Read stitch/DESIGN_MANIFEST.json only to identify/count screens",
      "   b. Read only the stitch/*.html files for STORY_SCREENS / current scope, and",
      "      only when layout details are not already available from the injected",
      "      STORY_SCREENS/UI contract",
      "   c. Read stitch/design-tokens.css only enough to import it and confirm token names",
      "   d. Implementation MUST match Stitch design (layout, colors, fonts)",
      "   e. NEVER use fonts/colors NOT in design-tokens.css",
      "   f. You MUST @import stitch/design-tokens.css from the main CSS entry — do NOT copy or recreate tokens.",
      "   g. stitch/design-tokens.css is the SINGLE SOURCE OF TRUTH for all design values.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /Read only the stitch\/\*\.html files|Read stitch\/DESIGN_MANIFEST\.json/);
    assert.match(output, /Use Stitch as binding design input during implement/);
    assert.match(output, /For generated-screen claims, do not read unrelated stitch\/\*\.html/);
    assert.match(output, /focused story-owned Stitch HTML\/DESIGN_DOM files are allowed and binding/);
    assert.match(output, /Use injected STORY_SCREENS, DESIGN_MANIFEST, DESIGN_TOKENS/);
  });

  it("removes raw Stitch read hints from UI contract fragments and injected excerpts", () => {
    const input = [
      "LAYOUT RULES (MANDATORY):",
      "7. Read `stitch/<screen>.html` for full detail if the skeleton is unclear.",
      "HTML_EXCERPT: <main>...</main> ...(truncated; read file for full HTML)",
      "...(truncated; read stitch files for full design)",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /Read `stitch\/<screen>\.html`|read file for full HTML|read stitch files for full design/);
    assert.match(output, /claim-summary designContracts/);
    assert.match(output, /focused story-owned Stitch HTML\/DESIGN_DOM files are allowed for missing detail/);
    assert.match(output, /use injected contracts or report the exact missing contract/);
  });

  it("rewrites stale design-first raw Stitch file-read instructions", () => {
    const input = [
      "# DESIGN-FIRST (MANDATORY)",
      "",
      "The Stitch files below are the design source of truth. The full HTML is not",
      "pasted into the prompt; read only current SCOPE_FILES from WORKDIR. If a",
      "generated screen is shared/read-only for this story, use SCREEN_INDEX/index.ts",
      "and the injected contracts instead of reading any component source from that",
      "shared screen. Focused line-range reads are allowed only for generated screen",
      "files explicitly listed in SCOPE_FILES. Write only files in the current story",
      "scope. Setfarm enforces this at runtime:",
      "reading a generated src/screens/*.tsx file outside SCOPE_FILES kills and",
      "retries the claim before generated-screen context overload.",
      "",
      "STORY SCREENS:",
      "[]",
      "",
      "STITCH FILES TO READ:",
      "- stitch/DESIGN_MANIFEST.json",
      "- stitch/design-tokens.css",
      "- stitch/DESIGN_DOM.json",
      "- relevant stitch/*.html files listed in STORY_SCREENS only when the injected",
      "  contract is insufficient, capped to focused excerpts",
      "",
      "DESIGN TOKENS:",
      "",
      "",
      "DESIGN DOM:",
      "The prompt excerpt is intentionally short. If full structure is needed, read",
      "only the current story screens from stitch/DESIGN_DOM.json. Do not paste the",
      "entire project DOM into the prompt.",
    ].join("\n");

    const output = sanitizeAgentPromptContracts(input);

    assert.doesNotMatch(output, /STITCH FILES TO READ|relevant stitch\/\*\.html files listed/i);
    assert.doesNotMatch(output, /If full structure is needed, read\s+only the current story screens from stitch\/DESIGN_DOM\.json/i);
    assert.doesNotMatch(output, /read only current SCOPE_FILES from WORKDIR/i);
    assert.match(output, /STITCH RAW FILES:/);
    assert.match(output, /For generated-screen claims, do not read unrelated stitch\/\*\.html/);
    assert.match(output, /focused story-owned Stitch HTML and\s+DESIGN_DOM are allowed binding design sources/);
    assert.match(output, /Use injected STORY_SCREENS, UI CONTRACT, LAYOUT STRUCTURE, DESIGN_MANIFEST/);
    assert.match(output, /claim-summary designContracts/);
    assert.match(output, /focused story-owned Stitch HTML\/DESIGN_DOM files are allowed for\s+missing detail/);
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
