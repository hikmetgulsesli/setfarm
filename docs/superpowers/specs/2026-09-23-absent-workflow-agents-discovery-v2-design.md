# Absent workflow agents discovery V2

Status: diagnostic-only root fix for the approved positive physical-plus-PostgreSQL ownership cutover. The host catalog delivered in #147 fails closed before reporting present worktrees because `/Users/setrox/.openclaw/workspaces/workflows/developer/agents` is absent. The absence must remain a blocker, but it need not conceal independently observable paths.

## Decision

Keep the existing generic refusal, create an empty runtime directory, or record a physically held absence and continue discovery. Choose the third option. Creating a directory would mutate OpenClaw runtime state, and a generic refusal hides other physical evidence. A named unresolved blocker preserves the zero-owner gate while making the catalog useful for diagnosis.

## Contract

For each present workflow child, hold its directory before checking `agents`. If `agents` is absent, record that exact path as `absent-workflow-agents-discovery-parent`, do not enumerate any agents under it, and continue enumerating other workflow and managed bases. A present `agents` directory retains all existing no-follow and child-enumeration rules; symlinks, files, inaccessible paths, and unsafe metadata still refuse. Every absent parent must be rechecked after the awaited callback while its workflow directory remains held. Appearance, disappearance/reappearance, or parent metadata drift refuses the whole observation. A stable absence produces `status: "unresolved"`, never `complete` or a zero-owner assertion.

The blocker is part of the canonical catalog hash. `absentBases` remains reserved for optional managed worktree bases; an absent discovery parent is not reclassified as an optional base. This change does not alter V1, PostgreSQL, source/build provenance, cutover, services, CLI/dist, or the Stage-1 owner projection.

## Evidence and tests

Use real temporary directories. One absent workflow `agents` parent alongside a present managed worktree must return both the named blocker and the visible worktree. A callback that creates the missing directory must fail closed; a create/remove ABA must also refuse through held workflow metadata. Existing complete-path, missing mandatory-anchor, symlink/non-directory, pure-partition, and cutover tests must remain green. After reviewed PR delivery and independent clean-main build, run the read-only code-owned catalog on the host and report all visible blockers without treating `unresolved` as cutover authority. Never create, delete, or relabel a host worktree to make the catalog pass.

## File map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`: hold and bracket absent workflow `agents` parents; return a canonical blocker.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`: real-directory RED/GREEN and drift fixtures.
- `docs/superpowers/plans/2026-09-23-absent-workflow-agents-discovery-v2.md`: implementation and delivery gates.
