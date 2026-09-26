# Runtime-start retry identity implementation

## Causal scope

Positive physical/DB receipt publication must occur in `markStarting`, after worktree and attempt bind and before child spawn. Exact idempotent retry is a prerequisite: otherwise a later producer could falsely accept a crossed caller worktree while returning the prior starting row. This PR only closes that seam and grants no new authority.

## Steps

1. [x] Audit normal/recovery worktree ordering, `markStarting` and the pre-spawn boundary; create a clean isolated branch at reviewed main `c73a8c63`.
2. [ ] Write RED real-PostgreSQL exact/crossed retry tests, including unchanged state/version on refusal.
3. [ ] Implement the smallest locked-row equality check for supplied identity fields.
4. [ ] Run focused and proportional broad checks, independent read-only review, reviewed PR delivery.
5. [ ] Clean-main guarded build and no-write host/service/artifact verification; preserve all historical worktrees and selected dist/link.

## File Map

See design. Authenticated physical receipt producer, no-replace journal, held physical identity, pre-spawn post-commit recheck and positive owner guard remain separate prerequisites.
