# Task6A private child authority plan

## Goal and causal relation

Combine the existing separate OS and PostgreSQL old-writer denials into one
real-child fixture. This tests a prerequisite of Task6A continuous writer
exclusion but does not itself fence the live spawner; that production seam,
positive physical/PG owner proof, zero-owner settlement and guarded 32/33
remain required.

## Steps

1. Isolate a clean Setfarm branch/worktree from current `origin/main`; preserve
   all other worktrees. Record design, fixture preconditions and cleanup.
   The retained PG17 cluster at `/tmp/setfarm-task6a-pg.zK3Q7K/data` is stopped
   and this shell has no `SETFARM_TEST_PG_ADMIN_URL`; do not guess or disclose
   its old credential. Prefer a new exact disposable PG17 cluster with a
   generated secret kept only in fixture memory/protected files, SCRAM auth,
   loopback-only listener and a verified non-5432 port, or first recover the
   existing private capability through a non-secret approved mechanism.
2. Add an opt-in integration test, first showing the pre-revocation old child
   can reach its disposable writer and file (RED), then showing successor and
   old-child denials after the scoped transition (GREEN). Use actual `sudo`
   children, not only parent-side privilege queries.
3. Run focused test on the exact identified private PG17 cluster with
   before/after role/database and filesystem inventory. Run normal tests and
   clean-worktree build. Do not enable any live flag or grant.
4. Obtain independent read-only exact-head review and GitHub review; address
   findings, deliver PR normally, then verify clean-main tests/build and host
   HTTP without selecting that build for live Setfarm.

## File Map

- `tests/execution-attempts/task6a-private-child-authority.integration.test.ts`:
  actual old/successor child OS+PG fixture and cleanup.
- `tests/execution-attempts/task6a-private-child-authority-child.mjs`:
  harmless bounded child probe; no secret output.
- This design/plan and root Task6A evidence log: scope and proof limits.
