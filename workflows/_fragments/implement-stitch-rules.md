BEFORE writing code:
1. Read the structured claim summary first. Do not parse or dump raw claim JSON;
   the summary already contains task, scope, story screens, supervisor memory,
   previous failure, command, and output-path fields.
2. Do NOT read full references/*.md files during implement. The mandatory rules
   are already embedded in this prompt. If a local build/test failure proves a
   specific rule is needed, search the exact heading and read the smallest
   focused excerpt only.
3. Do NOT read raw Stitch corpus files during implement:
   - Do not read stitch/*.html, .stitch-screens*.json, or full stitch/DESIGN_DOM.json.
   - Do not read stitch/design-tokens.css just to discover colors or fonts.
   - Use injected STORY_SCREENS, DESIGN_MANIFEST, DESIGN_TOKENS, STITCH_HTML
     excerpts, UI BEHAVIOR CONTRACT, SCREEN_INDEX/index.ts, and generated screen
     contracts as the source of truth.
   - Match Stitch layout, colors, fonts, labels, icons, and controls from those
     injected contracts. If detail is missing, report STATUS: retry with the
     exact missing contract instead of loading raw design files.

SCREEN COVERAGE RULE (CRITICAL):
- Implement only current SCOPE_FILES. Do not create routes/pages/screens outside
  this story to satisfy global manifest coverage.
- For app-shell stories, use src/screens/SCREEN_INDEX.json and src/screens/index.ts
  to wire generated screens into reachable flow without reading any non-owned
  screen source file.
- The spawner machine-enforces this: reading generated src/screens/*.tsx files
  outside SCOPE_FILES kills and retries the story claim.
- For screen-owner stories, verify only the generated screen files in SCOPE_FILES.
- Global screen coverage is checked by verify/supervisor after stories are merged;
  do not solve it by editing out-of-scope files.
