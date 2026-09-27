# Task6A private create-only worktree fixture

## Causal relation and boundary

PR #226 supplies only a private durable pending reservation. A physical owner
still cannot be born safely through `createStoryWorktree`: it prunes Git
metadata, stashes the primary checkout, may reset/clean/remove an existing
root or branch, and can prepare assets with further writes. The ordinary,
V3 recovery and completion-recovery callers all use that helper.

This slice proves a separate create-only physical operation in a disposable
test repository. It is import-inert and has no spawner call, registered
migration, live filesystem scope, producer-authenticated reservation lookup,
continuous DB/OS writer fence, owner promotion, or admission authority.

## Contract

- Accept only a direct, real, fixture-shaped repository under the system temp
  directory, an already-present real sibling target parent, an exact absent
  target, a correlation-only reservation hash, and full source SHA/tree IDs.
- Before writing, prove the source commit and its tree in that repository,
  primary Git directory identity, exact one-file fixture tree, absent private
  attributes, target-parent identity, target absence and no existing target
  registration. Run Git with inherited Git configuration removed and hooks,
  fsmonitor and global attributes disabled. No directory creation or cleanup
  occurs in the helper before the one Git add.
- Perform only `git worktree add --detach <exact-root> <full-SHA>`. Never
  fetch, prune, stash, reset, clean, remove, reuse, switch branches, prepare
  assets or fall back to another root/commit.
- Recheck exact target, detached HEAD/tree, primary Git identity, clean status
  including ignored/untracked artifacts, exact two-entry physical root and
  worktree registration. Failure preserves partial physical and Git
  metadata for census rather than automatically removing it. Success returns
  only a diagnostic observation, not an owner or release capability.
- Test a successful pinned creation, occupied directory/file/symlink, parent
  alias, wrong source/tree, stale target registration, dirty primary repo
  preservation, disabled hook/attribute rejection, and post-add fault refusal
  without cleanup.

## File Map

- `src/internal-production/baseline-positive-worktree-create-only-fixture-v1.ts`:
  fixture-scoped import-inert create-only operation.
- `tests/internal-production/baseline-positive-worktree-create-only-fixture-v1.test.ts`:
  disposable Git adversarial RED/GREEN cases.
- `docs/superpowers/plans/2026-09-27-task6a-private-create-only-worktree-fixture.md`:
  scope and evidence.

## Delivery gates

Run focused tests, TypeScript, pure/cutover/manifest and digests; use exact-head
independent read-only and GitHub review. Build only after PR merge on clean
main. Fast-forward preserved deployment checkout without deleting retained
worktrees. The fixture alone does not permit live Task6A admission or cutover.
