# 01-plan - Plan Step Module

The first pipeline step. It converts the user task into a PRD and technical decisions.

## Input

- `task`: user-provided task text

## Parsed Output

- `STATUS: done`
- `REPO`: absolute path
- `BRANCH`: kebab-case branch slug
- `TECH_STACK`: `vite-react`, `nextjs`, `vanilla-ts`, `node-express`, or `react-native`
- `PRD`: complete product requirements document
- `PRD_SCREEN_COUNT`: integer, at least 3
- `DB_REQUIRED`: `none`, `postgres`, or `sqlite`

## Side Effects

On completion:

- writes the PRD to the `prds` table
- stores repo path and tech stack in run context

## Files

- `rules.md`: agent rules
- `prompt.md`: agent template
- `module.ts`: StepModule export
- `guards.ts`: validation and completion
- `context.ts`: context injection

## Prompt Budget

`maxPromptSize: 8192` bytes.
