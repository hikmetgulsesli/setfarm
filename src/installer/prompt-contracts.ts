/**
 * Last-mile prompt contract normalization.
 *
 * Runs after workflow input_template resolution so old in-flight runs and DB
 * templates cannot reintroduce instructions that contradict current guards.
 */

const MATERIAL_SYMBOLS_FONT_BLOCK =
  /  - If stitch\/\*\.html or DESIGN_DOM contains Material Symbols icon names,\n\s+YOU MUST add this to index\.html <head> or app\/layout\.tsx:\n\s+<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined" rel="stylesheet" \/>\n\s+Without this link, icons render as plain text instead of symbols\./g;

const DESIGN_FIRST_MATERIAL_SYMBOLS_BLOCK =
  /- FONTS: copy every Google Fonts `<link>` from the Stitch HTML into\n  `index\.html <head>`\.\n  1\. Copy every Stitch font link exactly\.\n  2\. If Stitch uses Material Symbols, include:\n     <link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:wght,FILL@100\.\.700,0\.\.1&display=swap" rel="stylesheet"\/>\n  3\. Do not skip font links from the Stitch HTML head\.\n  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica\./g;

const STALE_GENERIC_DESIGN_FIX =
  /DÜZELT:\s*Kritik UI sözleşmesi hatalarını düzelt;\s*stitch\/design-tokens\.css'i import et,\s*hardcoded renkleri var\(--\*\) ile değiştir\./g;

const STALE_HREF_HASH_LINK_BLOCK =
  /- LINKS: NEVER use href="#" or href="javascript:void\(0\)" — these are dead links\.\n\s+Every <Link> and <a> MUST point to a real project-specific route from PRD\/Stitch\/DESIGN_DOM\.\n\s+If the destination page doesn't exist yet, create a minimal placeholder page with the route\.\n\s+If a sidebar\/navbar has navigation items, EVERY item MUST have a working href\.\n\s+Before commit: grep -rn 'href="#"' src\/ — if ANY match found, you MUST fix them all\./g;

const STALE_DESIGN_DOM_NAV_RULE =
  /- Every in-scope nav link must route to the correct page\/modal/g;

const STALE_HIDE_UNWIRED_BUTTON_RULE =
  /- onClick=\{\(\) => \{\}\} is FORBIDDEN — if a button has no functionality, do not render it/g;

const STALE_DESIGN_FIRST_LINK_LINE =
  /- LINKS: every link must point to a real route\./g;

const STALE_DESIGN_CONTRACT_NAV_RULE =
  /1\. Every navigation link must route to (?:its|a real) page\.(?: If the Stitch design shows a\n\s+control whose target is not in the PRD, implement a project-specific behavior\n\s+first; if truly out of scope, make it visibly disabled\/hidden\.)?/g;

const STALE_GENERATED_SCREEN_FOCUSED_READ_RULE =
  /- Never read every src\/screens\/\*\.tsx file in one turn\. If exact detail is\n\s+still needed, inspect one relevant file with a focused line range\./g;

const STALE_SHARED_SCREEN_FULL_FILE_RULE =
  /- If a screen file is only in SHARED_FILES, do NOT cat\/read\/sed the full\n\s+file\. Use src\/screens\/SCREEN_INDEX\.json, src\/screens\/index\.ts,\n\s+COMPONENT REGISTRY, STORY_SCREENS, and UI BEHAVIOR CONTRACT for\n\s+component names, props, and action IDs\./g;

const STALE_IMPLEMENT_FULL_REFERENCE_READ_BLOCK =
  /## BEFORE Writing Any Code\n\nYou MUST read these reference files before starting implementation:\n1\. \*\*references\/design-standards\.md\*\* — Frontend design rules \(MANDATORY\)\n2\. \*\*references\/backend-standards\.md\*\* — Backend\/API\/DB rules \(MANDATORY\)\n3\. \*\*references\/web-guidelines\.md\*\* — Accessibility, forms, performance \(MANDATORY\)\n\nFollow ALL rules in these references\. Violations will cause your PR to be REJECTED\./g;

const STALE_CLAIM_JQ_RULE =
  /1\. Read the story description and acceptance criteria from the claim with jq\.\n\s+Do NOT cat the full claim JSON\. Do NOT paste large prompt\/context files into\n\s+the session\./g;

const STALE_FRAGMENT_CLAIM_JQ_RULE =
  /1\. Read the story task and acceptance criteria from the claim via jq only; do not\n\s+print the full claim JSON\./g;

const STALE_IMPLEMENT_RAW_STITCH_DOM_BLOCK =
  /DESIGN DOM:\n\s*Use stitch\/DESIGN_DOM\.json from WORKDIR when element-level detail is needed\.\n\s*Read only the screen ids listed in STORY_SCREENS\. Do NOT paste or process the\n\s*full project DOM in the session\./g;

const STALE_IMPLEMENT_STITCH_FILE_READ_BLOCK =
  /3\. If stitch\/ directory exists:\n\s+a\. Read stitch\/DESIGN_MANIFEST\.json only to identify\/count screens\n\s+b\. Read only the stitch\/\*\.html files for STORY_SCREENS \/ current scope, and\n\s+only when layout details are not already available from the injected\n\s+STORY_SCREENS\/UI contract\n\s+c\. Read stitch\/design-tokens\.css only enough to import it and confirm token names\n\s+d\. Implementation MUST match Stitch design \(layout, colors, fonts\)\n\s+e\. NEVER use fonts\/colors NOT in design-tokens\.css\n\s+f\. You MUST @import stitch\/design-tokens\.css from the main CSS entry — do NOT copy or recreate tokens\.\n\s+g\. stitch\/design-tokens\.css is the SINGLE SOURCE OF TRUTH for all design values\./g;

export function sanitizeAgentPromptContracts(input: string): string {
  let output = input;

  output = output.replace(
    MATERIAL_SYMBOLS_FONT_BLOCK,
    [
      "  - Do NOT add Material Symbols, Material Icons, icon-font links, or icon",
      "    ligature text. If Stitch contains those names, replace them in source UI",
      "    with inline SVG components or an already-installed SVG icon library.",
    ].join("\n"),
  );

  output = output.replace(
    DESIGN_FIRST_MATERIAL_SYMBOLS_BLOCK,
    [
      "- FONTS: copy ordinary Google text-font `<link>` tags from the Stitch HTML into",
      "  `index.html <head>` only when `index.html` is in SCOPE_FILES. Do not copy",
      "  Material Symbols, Material Icons, or any icon-font links.",
      "  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.",
      "- ICONS: if Stitch HTML/DESIGN_DOM contains Material Symbols, Material Icons,",
      "  icon-font classes, or ligature text, replace them in source UI with inline",
      "  SVG components or an already-installed SVG icon library.",
    ].join("\n"),
  );

  output = output
    .replace("- NEVER: emoji icons, purple gradients, transition:all", "- NEVER: emoji icons, icon fonts, Material Symbols, purple gradients, transition:all")
    .replace("- NEVER: emoji icons, purple gradients, transition: all, href=\"#\", empty", "- NEVER: emoji icons, icon fonts, Material Symbols, purple gradients,\n  transition: all, dead unhandled placeholder links, empty");

  output = output.replace(
    STALE_HREF_HASH_LINK_BLOCK,
    [
      "- LINKS: never leave a dead, unhandled `href=\"#\"` or `href=\"javascript:void(0)\"`.",
      "  Preserve generated Stitch `<a>` tags, className, nesting and layout.",
      "  Do NOT replace anchors with `<span>`, `<div>`, or text-only elements.",
      "  Prefer a real route when the route/page is in scope. If the target is out",
      "  of scope, keep the `<a>` and add an `onClick`/keyboard-safe behavior that",
      "  prevents default navigation and produces visible in-screen state, or mark",
      "  it explicitly disabled/hidden when the story says it is unavailable.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_DESIGN_DOM_NAV_RULE,
    [
      "- Every in-scope nav anchor must preserve the generated `<a>` tag,",
      "  className, nesting and layout. If the target route is real and in scope,",
      "  navigate there. If the target is a Stitch placeholder such as `#`, keep",
      "  the anchor and add visible in-screen behavior or an explicit disabled",
      "  state; do not replace it with `<span>`.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_HIDE_UNWIRED_BUTTON_RULE,
    [
      "- onClick={() => {}} is FORBIDDEN. Preserve generated control structure;",
      "  wire the control to visible behavior, or mark it explicitly disabled/hidden",
      "  only when the story says it is unavailable. Do not remove Stitch controls",
      "  just because behavior is not implemented yet.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_DESIGN_FIRST_LINK_LINE,
    [
      "- LINKS: every visible link must navigate, change visible state, or be",
      "  intentionally disabled. Preserve generated Stitch `<a>` tags, className,",
      "  nesting and layout; do not replace anchors with `<span>` just to remove",
      "  `href=\"#\"`.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_DESIGN_CONTRACT_NAV_RULE,
    [
      "1. Every navigation anchor must preserve the generated `<a>` tag, className,",
      "   nesting and layout. If the route is real and in scope, navigate there. If the",
      "   target is a Stitch placeholder or out of scope, keep the anchor and add",
      "   visible in-screen behavior or an explicit disabled state; do not replace it",
      "   with `<span>`.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_SHARED_SCREEN_FULL_FILE_RULE,
    [
      "- If a screen file is only in SHARED_FILES, do NOT use read, cat, sed,",
      "  head, tail, rg, grep, find, awk, node, or python on that src/screens/*.tsx file.",
      "  Use src/screens/SCREEN_INDEX.json, src/screens/index.ts, COMPONENT",
      "  REGISTRY, STORY_SCREENS, and UI BEHAVIOR CONTRACT for component names,",
      "  props, and action IDs.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_GENERATED_SCREEN_FOCUSED_READ_RULE,
    [
      "- Focused line-range inspection is allowed only for generated screen files",
      "  explicitly listed in SCOPE_FILES. Shared/read-only generated screens must",
      "  be consumed through SCREEN_INDEX/index.ts and injected contracts only.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_IMPLEMENT_FULL_REFERENCE_READ_BLOCK,
    [
      "## Reference Context Discipline",
      "",
      "Do NOT read full `references/*.md` files during implement. The platform",
      "injects mandatory, story-relevant rules into this claim as Design Rules,",
      "Stack Rules, UI Behavior Contract, Supervisor Memory, and retry feedback.",
      "",
      "Only inspect reference files when the current story owns that domain or a",
      "local command proves you need extra detail. Backend/API/DB standards apply",
      "only to backend/API/database story scope. For frontend/game stories, rely",
      "on injected Stitch excerpts, UI behavior contracts, design tokens, generated",
      "screen contracts, and the injected rules. If a reference is needed, read the",
      "smallest focused excerpt; do not load unrelated backend/security/SQL guidance",
      "into the session.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_CLAIM_JQ_RULE,
    [
      "1. Read the structured claim summary file first. Use its story, scopeFiles,",
      "   generatedScreenPolicy, supervisorMemory, previousFailure, command, and",
      "   output-path fields as the authoritative handoff.",
      "   Do NOT parse or dump claim.input with jq, sed, head, cat, node loops,",
      "   or python loops. The full claim JSON is an audit fallback only.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_FRAGMENT_CLAIM_JQ_RULE,
    [
      "1. Read the structured claim summary file first. Use its story, scopeFiles,",
      "   generatedScreenPolicy, supervisorMemory, previousFailure, command, and",
      "   output-path fields as the authoritative handoff.",
      "   Do NOT parse or dump claim.input with jq, sed, head, cat, node loops,",
      "   or python loops. The full claim JSON is an audit fallback only.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_IMPLEMENT_RAW_STITCH_DOM_BLOCK,
    [
      "DESIGN DOM:",
      "Use only the injected STORY_SCREENS, UI BEHAVIOR CONTRACT, DESIGN_MANIFEST,",
      "DESIGN_TOKENS, SCREEN_INDEX, and generated screen contracts in this claim.",
      "Do NOT read raw stitch/*.html, .stitch-screens*.json, or full",
      "stitch/DESIGN_DOM.json during implement; the gateway enforces this to",
      "prevent context overload and cross-story drift.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_IMPLEMENT_STITCH_FILE_READ_BLOCK,
    [
      "3. Do NOT read raw Stitch corpus files during implement:",
      "   - Do not read stitch/*.html, .stitch-screens*.json, or full stitch/DESIGN_DOM.json.",
      "   - Do not read stitch/design-tokens.css just to discover colors or fonts.",
      "   - Use injected STORY_SCREENS, DESIGN_MANIFEST, DESIGN_TOKENS, STITCH_HTML",
      "     excerpts, UI BEHAVIOR CONTRACT, SCREEN_INDEX/index.ts, and generated screen",
      "     contracts as the source of truth.",
      "   - Match Stitch layout, colors, fonts, labels, icons, and controls from those",
      "     injected contracts. If detail is missing, report STATUS: retry with the",
      "     exact missing contract instead of loading raw design files.",
    ].join("\n"),
  );

  output = output.replace(
    STALE_GENERIC_DESIGN_FIX,
    [
      "DÜZELT:",
      "• Fix only the exact UI_CONTRACT lines above.",
      "• For icon-font issues, use inline SVG components or an installed SVG icon library.",
      "• For transition-all issues, use scoped transition properties.",
      "• Do not add unrelated design-token/import work unless the error explicitly reports it.",
    ].join("\n"),
  );

  return output;
}
