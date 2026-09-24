# Pre32 Git-admin churn blocker plan

> Root is the only writer and PR delivery owner. Other agents may investigate and review read-only.

**Goal:** Let the physical catalog report recurring selected Git-admin entry churn as an explicit unresolved blocker without mistaking it for an owner or weakening identity and topology checks.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-git-admin-churn-blocker.md`

## Constraints

- Keep the old selected worktree, CLI, and dist intact. Do not disable launchers, runtime guards, or any cutover gate.
- Only the marker-derived linked Git-admin directory may classify entry churn. All descriptor/path identity checks still refuse replacements.
- Existing non-admin drift and substantive Git topology/dirty-state drift remain refusals. No database, service, controller, or journal writes.

## TDD and delivery

- [x] RED: a transient `index.lock` create/remove in a linked admin directory across the held bracket returns one `git-admin-entry-churn` blocker, visible candidate, and unresolved status. It failed with `directory-descriptor` before the change.
- [x] RED: replacing that admin directory still refuses; ordinary held directory mutation and Git topology drift still refuse.
- [x] GREEN: record only exact marker-derived admin directory metadata churn while pinning descriptor/path identity and preserving all other checks. Bare-primary metadata stays strict.
- [x] Run focused physical (41/41), host-pair/pure (119/119), cutover (384/384), manifest (18/18), full scripts (779/779 plus genuine 43/43), TypeScript, English/path checks, `git diff --check`, independent read-only review (no critical/important findings). Clean-main build follows merge.
- [ ] Scoped commit/PR, exact-head checks, SHA-bound merge, clean-main build, selected source fast-forward with old dist/CLI proof, one sanitized authenticated V4 host observation.
