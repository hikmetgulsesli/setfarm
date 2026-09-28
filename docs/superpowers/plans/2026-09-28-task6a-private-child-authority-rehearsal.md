# Task6A Private Child Authority Implementation Plan

> **For agentic workers:** Execute the steps in this plan in order. The root
> owner is the only writer; other agents may perform read-only review only.

**Goal:** Prove in one opt-in disposable child fixture that distinct macOS and
PostgreSQL identities jointly deny the old writer while preserving one
explicitly scoped successor read.

**Architecture:** A real child process runs under existing macOS UIDs with an
explicit empty ambient environment and an OS-restricted PG credential file.
The parent owns a dedicated PG17 fixture and verifies both pre-revocation
capability and post-revocation denial without touching live services.

**Tech Stack:** Node.js TypeScript ESM test runner, PostgreSQL 17 `psql`,
macOS `sudo -n`, disposable `/tmp` directory.

**Spec:** `docs/superpowers/specs/2026-09-28-task6a-private-child-authority-rehearsal-design.md`

## Global Constraints

- Root owner is the only writer; preserve all existing worktrees and dirty files.
- No live role, credential, LaunchAgent, selected CLI, generated project or
  historical worktree mutation.
- Do not print, commit or pass database passwords on argv; use protected files.
- A fixture-only proof is not production spawner integration or cutover authority.
- Never run Setfarm `npm test` without first pinning and verifying
  `SETFARM_TEST_PG_ADMIN_URL` to an explicitly identified private PG17 cluster:
  `tests/execution-attempts/test-database.ts` otherwise defaults to host
  PostgreSQL `localhost:5432`. Build on a clean worktree before the normal
  suite because some tests execute `dist/cli/cli.js`.

---

## Goal and causal relation

Combine the existing separate OS and PostgreSQL old-writer denials into one
real-child fixture. This tests a prerequisite of Task6A continuous writer
exclusion but does not itself fence the live spawner; that production seam,
positive physical/PG owner proof, zero-owner settlement and guarded 32/33
remain required.

## Task 1: Isolated fixture preflight and child contract

**Files:**
- Create: `tests/execution-attempts/task6a-private-child-authority.integration.test.ts`
- Create: `tests/execution-attempts/task6a-private-child-authority-child.mjs`

**Interfaces:** The test invokes the child through `sudo -n -u <uid>` with
only protected credential-file path, PG host/port/database/user and one exact
fixture path in its environment. The child emits a bounded JSON result with
UID, PG login and boolean read/write outcomes, never secret values.

- [ ] **Step 1:** Add a skipped-by-default test requiring
  `SETFARM_TASK6A_TEST_CHILD_AUTHORITY_FIXTURE=1`, exact private PG17 data
  directory, loopback non-5432 endpoint, no ambient `SETFARM_PG_URL`, and
  successful `sudo -n -u nobody/_www id -u` probes. Run focused test without
  opt-in; expected `SKIP`, no fixture writes.
- [ ] **Step 2:** Add child code that reads only the named protected PG pass
  file and invokes `/opt/homebrew/opt/postgresql@17/bin/psql` with bounded
  timeout. Its output is fixed booleans and UID/login, not SQL error prose.
  Test malformed/missing credential path as a fixed refusal.
- [ ] **Step 3:** Run focused tests; before any role transition, assert the
  old child can make one rollback-only SQL write and create one file in its
  own exact fixture root. This is the RED capability witness.

## Task 2: Transition and denial proof

**Files:**
- Modify: `tests/execution-attempts/task6a-private-child-authority.integration.test.ts`

**Interfaces:** Random roles and one isolated database are created only after
preflight. The old role loses writer privileges; the successor role receives
only SELECT on one exact benign table. The OS fixture root transitions from
old UID to successor UID with identity-checked `chown`.

- [ ] **Step 1:** Add test assertions for old-child successor credential-file
  read denial and old-owned file write after transition; run focused test and
  observe expected failure until transition setup is present.
- [ ] **Step 2:** Add exact scoped PostgreSQL GRANT/REVOKE and OS ownership
  transition in the disposable fixture. Assert old child DML denied, successor
  child SELECT succeeds, successor DML/DDL denied, and no marker row remains.
- [ ] **Step 3:** Add cleanup that revalidates exact temp root inode/path and
  owned database/role names before removal, stops only its private cluster if
  it created one, and preserves artifacts on uncertain identity. Re-run test.

## Task 3: Delivery and evidence

**Files:**
- Modify: this plan and the design only if review refines scope.
- Update: root `logs/2026-09-27-task6a-writer-boundary-matrix.md` after proof.

- [ ] **Step 1:** Run focused opted-in test against an exact isolated PG17
  cluster, recording before/after role/database and temp-root census without
  secrets. The retained cluster at `/tmp/setfarm-task6a-pg.zK3Q7K/data` is
  stopped and this shell has no admin URL; do not guess its credential. Create
  a new disposable SCRAM/loopback-only cluster if necessary. Verify the
  connected server's `data_directory`, port and socket directory before any
  database creation.
- [ ] **Step 2:** Commit reviewed source/test changes, run `npm run build`
  from the clean worktree, then run `npm test` with the private admin URL
  explicitly set. Verify outputs and no live marker/credential change.

### Observed baseline hazard, 2026-09-28

An early unpinned `npm test` run exited 1 because this new worktree had no
`dist/cli/cli.js`. Its helper also fell back to host PG17 `:5432`, where it
created and dropped disposable database
`setfarm_contract_spine_test_28096_f88ae72c005e`; a read-only follow-up
counted that exact name absent. Other pre-existing test databases were left
untouched. This run is not a passing baseline and does not certify that every
test in the partial suite was read-only. Do not repeat it; use the private PG
preflight above.
- [ ] **Step 3:** Obtain independent read-only exact-head review and GitHub
  review, address findings, merge a reviewed PR normally, fast-forward a clean
  main worktree, repeat tests/build and all three HTTP probes.

## File Map

- `tests/execution-attempts/task6a-private-child-authority.integration.test.ts`:
  actual old/successor child OS+PG fixture and cleanup.
- `tests/execution-attempts/task6a-private-child-authority-child.mjs`:
  harmless bounded child probe; no secret output.
- This design/plan and root Task6A evidence log: scope and proof limits.
