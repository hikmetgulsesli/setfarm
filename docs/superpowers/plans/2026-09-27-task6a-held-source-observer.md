# Task6A held source observation

Root is the only writer. PR #220 proved the diagnostic DB adapter's exact SQL
and SELECT-only role on private PG17. The physical catalog's one-use runtime
capability still does not produce the source observation required by the
diagnostic receipt protocol. Add that observation inside the existing held
physical interval, without granting owner or publication authority.

## File Map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`:
  extend only the runtime-zone linked-Git one-use held callback with a scoped
  source observer. It runs fixed `/usr/bin/git` commands under the existing
  sealed environment and held descriptor/Git rechecks, validates the repository
  object-id width and exact commit/tree output, and rereads the commit to reject
  HEAD drift. Resolve the tree from the captured commit, not from a second
  HEAD lookup, so a temporary A→B→A ref change cannot cross the pair. Late,
  repeated, retained, missing, or changed
  physical/Git state continues to refuse. This observes the committed base,
  not uncommitted worktree contents or a verified build.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`:
  start RED with a real linked runtime Git fixture. Prove the exact frozen
  source tuple, dirty worktree still reports only committed-base identity,
  source callback cannot be used after the hold, and HEAD/Git-admin churn
  refuses instead of producing a trustworthy source observation. Inject a
  crossed tree lookup to reproduce the A/B pair bug RED before the pinned
  commit-tree resolution turns it GREEN.

Keep the catalog and receipt candidate diagnostic-only. No DB writes,
credentials, owner admission, live service change or cutover gate change.
Run focused tests, TypeScript, pure suite, source manifest/digests, independent
read-only review, exact-head PR review, SHA-bound delivery and clean-main build.
