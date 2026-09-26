# Runtime-start retry identity implementation

## Causal scope

Positive physical/DB receipt publication can use the `markStarting` transaction after worktree and attempt bind and before child spawn, but it is not by itself a pre-first-write fence: spawner claim-scope directory and wrapper writes currently precede it. Those writes require a separate earlier authorization or reordering before a positive owner can be counted. Exact idempotent retry is another prerequisite: otherwise a later producer could falsely accept a crossed caller worktree while returning the prior starting row. This PR only closes that retry seam and grants no new authority.

## Steps

1. [x] Audit normal/recovery worktree ordering, `markStarting` and the pre-spawn boundary; create a clean isolated branch at reviewed main `c73a8c63`.
2. [x] Write RED real-PostgreSQL exact/crossed retry tests, including unchanged state/version on refusal. The new test failed with `Missing expected rejection`; the remaining RED file was deliberately interrupted after that proof and is not reported as passing.
3. [x] Implement the smallest locked-row equality check for supplied identity fields. The complete isolated PostgreSQL file then passed 17/17 with exit 0, and the runner cleaned its template/clone databases.
4. [ ] Run focused and proportional broad checks, independent read-only review, reviewed PR delivery.
5. [ ] Clean-main guarded build and no-write host/service/artifact verification; preserve all historical worktrees and selected dist/link.

## File Map

See design. Authenticated physical receipt producer, no-replace journal, held physical identity, pre-spawn post-commit recheck and positive owner guard remain separate prerequisites.

Independent read-only review found no Important issue in this narrow patch and identified the earlier spawner worktree writes now recorded in the design. TypeScript no-emit, source manifest 18/18, version/English/path, migration digests, Mission Control contracts and diff check passed. The temporary PostgreSQL 17 server used only loopback port 55432, was stopped after testing, and its data directory was preserved.
