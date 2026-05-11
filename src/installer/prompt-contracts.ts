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
    .replace("- NEVER: emoji icons, purple gradients, transition: all, href=\"#\", empty", "- NEVER: emoji icons, icon fonts, Material Symbols, purple gradients,\n  transition: all, href=\"#\", empty");

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
