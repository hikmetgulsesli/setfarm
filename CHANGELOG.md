# Changelog

This repository now keeps agent-facing operational notes in English only.

## 2.3.0 - 2026-05-16

- Added persistent supervisor run metadata, intervention reports, visual QA artifacts, and fixer plans under `.setfarm/supervisor/<runId>/`.
- Wired supervisor interventions into story-scoped manager checkpoints so retries carry explicit manager feedback instead of ad hoc project rules.
- Added Playwright-backed visual QA evidence for web verification, including route screenshots, console/network issues, layout overflow checks, and clicked-control checks.
- Kept supervisor artifacts out of product git history with automatic `.setfarm/` git excludes.

## 2.2.0 - 2026-05-16

- Added the supervisor-first execution architecture for persistent project oversight.
- Added an automated version contract so release surfaces must match package semver.
- Kept all repository instructions, fixtures, and agent-facing prompts in English.

## 2026-05-16

- Added the supervisor-first refactor design and implementation plan.
- Started replacing fatal project-specific guard behavior with persistent supervisor state, checklist scanning, and targeted intervention messages.
- Added supervisor modules for checklist construction, DOM implementation scanning, state persistence, intervention text, model policy, coordination, and fixer ownership.
- Converted prompt, workflow, test fixture, and documentation text to English so coding agents receive a single technical instruction language.

Older operational notes were archived before this cleanup. Use git history for pre-2026-05-16 details.
