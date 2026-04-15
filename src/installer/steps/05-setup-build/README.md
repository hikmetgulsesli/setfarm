# 05-setup-build — Setup Build Step Modülü

Setup-repo sonrası. npm install + build + compat check + stitch-to-jsx.

## Input (context)

- `repo`, `tech_stack` — plan'dan
- stitch/DESIGN_MANIFEST.json — design preClaim'den

## Side Effects (preClaim — heavy)

1. `npm install` (idempotent)
2. `npm run build` — baseline doğrulama (fail = step fail)
3. Compat engine (React 19 + testing-library 15 gibi peer mismatch'leri yakalar)
4. Tailwind kurulum (stitch HTML'lerinde Tailwind class'ı varsa)
5. `stitch-to-jsx.mjs` → `src/screens/*.tsx` auto-generate + commit
6. BUILD_CMD_HINT context'e yazılır

## Output (parsed)

- STATUS: done
- BUILD_CMD: agent'ın beyanı (`npm run build` default)

## Prompt Budget

`maxPromptSize: 6144`

## Files

README + rules + prompt + context + guards + preclaim + module
