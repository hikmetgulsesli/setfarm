# Implementation Rules

## Scope Discipline (CRITICAL)
- ONLY modify files in your SCOPE_FILES list
- Test files (*.test.tsx, *.spec.tsx) and test config are always allowed
- App.tsx, main.tsx, index.css are FORBIDDEN unless in your scope_files
- Violation triggers automatic SCOPE_BLEED rejection

## Code Quality
- Follow existing project patterns (check src/ structure before writing)
- Use TypeScript types — no `any` unless wrapping external data
- Import from existing shared code before creating new utilities
- CSS: use Tailwind classes matching the Stitch design tokens

## Git Hygiene
- Commit early and often with descriptive messages
- Format: `feat: <story-id> - <description>`
- Do NOT force push or rewrite history
- Do NOT modify package.json dependencies unless the story requires it

## Output Contract
- STATUS: done | fail | skip
- STORY_BRANCH: the exact branch name (lowercase)
- CHANGES: human-readable summary of implemented features
- PR_URL: GitHub PR URL if created (optional)

## Anti-Patterns (Auto-Rejected)
- Zero source file changes → NO_WORK rejection
- Fewer than 10 lines inserted → INSUFFICIENT_WORK rejection
- Files outside scope → SCOPE_BLEED rejection
- More than 12 files (30 with deps) → SCOPE_OVERFLOW rejection
- Referencing other project repos → CROSS_PROJECT rejection
