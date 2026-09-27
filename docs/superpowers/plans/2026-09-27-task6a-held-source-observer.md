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
  physical/Git state continues to refuse. Codex review found that a same-tree
  linked branch update through the primary repo was still invisible to the
  prior catalog comparison. Preserve each Git-listed HEAD OID in the held
  listing and compare it in both the callback recheck and catalog second pass.
  Independent rereview then found an A→B→A window around both source reads;
  require their matching SHA to equal the first held HEAD OID as well. A second
  Codex review found ref churn between all HEAD samples: under Git's `files`
  ref backend, hold the exact linked HEAD, ordinary shared branch ref and
  reflogs (including packed/absent path ancestry) through the catalog close.
  Reject non-`refs/heads/*` symbolic HEAD namespaces here because Git may
  store those refs under the linked worktree instead of the common directory.
  Reject multi-hop symbolic HEAD chains because holding only one terminal
  shared ref would leave an intermediate mutable link unheld.
  This observes the committed base,
  not uncommitted worktree contents or a verified build.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`:
  start RED with a real linked runtime Git fixture. Prove the exact frozen
  source tuple, dirty worktree still reports only committed-base identity,
  source callback cannot be used after the hold, and HEAD/Git-admin churn
  refuses instead of producing a trustworthy source observation. Inject a
  crossed tree lookup to reproduce the A/B pair bug RED before the pinned
  commit-tree resolution turns it GREEN. Reproduce a same-tree linked HEAD
  update after the source SHA read RED, then require held and second-pass
  rejection GREEN. Reproduce a source-read-only A→B→A ref window RED and bind
  to the first held HEAD identity GREEN. Reproduce ref churn entirely during
  the pinned tree command RED, then require held ref/reflog mutation refusal
  GREEN. Cover a packed nested branch, a worktree-private symbolic ref, and
  a multi-hop symbolic HEAD (the latter two fail closed).

Keep the catalog and receipt candidate diagnostic-only. No DB writes,
credentials, owner admission, live service change or cutover gate change.
Run focused tests, TypeScript, pure suite, source manifest/digests, independent
read-only review, exact-head PR review, SHA-bound delivery and clean-main build.
