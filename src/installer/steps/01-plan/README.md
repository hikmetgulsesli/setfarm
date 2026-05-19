# 01-plan - Plan Step Module

The first pipeline step. It converts the user task into a portable Product
Contract. PLAN defines product behavior and platform intent; runtime identity,
repository paths, Git branches, and deployment names are resolved later by MC.

## Input

- `task`: user-provided task text

## Parsed Output

- `STATUS: done`
- `PROJECT_NAME`: user-provided or inferred product name
- `PROJECT_SLUG`: stable kebab-case slug derived from `PROJECT_NAME`
- `PLATFORM`: `web`, `mobile`, `desktop`, `api`, `cli`, or `game`
- `TECH_STACK`: `vite-react`, `nextjs`, `vanilla-ts`, `node-express`, or `react-native`
- `DB_REQUIRED`: `none`, `postgres`, or `sqlite`
- `DESIGN_REQUIRED`: `true` for UI-bound products, `false` for API/CLI
- `UI_LANGUAGE`: product UI language
- `PRD`: Product Contract with Context, Data/State, Behavioral Actions,
  Product Surfaces, Platform Contract, Testability, and Out Of Scope sections

PLAN must not emit `REPO`, `BRANCH`, `GITHUB_REPO`, `RUN_SLUG`,
`APP_TITLE`, `PACKAGE_NAME`, hardcoded paths, `PRD_SCREEN_COUNT`, or a
physical screen list.

## Side Effects

On completion:

- writes the PRD to the `prds` table
- resolves runtime identity through MC
- stores project identity, stack, platform, DB/design decisions, and PRD in run context

## Files

- `rules.md`: agent rules
- `prompt.md`: agent template
- `module.ts`: StepModule export
- `guards.ts`: validation and completion
- `context.ts`: context injection

## Prompt Budget

`maxPromptSize: 8192` bytes.
