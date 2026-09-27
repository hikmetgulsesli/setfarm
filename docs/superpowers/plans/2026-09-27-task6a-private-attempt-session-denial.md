# Task6A private attempt/session denial extension

**Goal:** Extend the already-delivered private PostgreSQL 17 old-login rehearsal from `runs` and `claim_log` to the linked `execution_attempts` and `runtime_sessions` write path. Prove actual SQL inserts succeed before fixture-scoped revocation and fail with SQLSTATE `42501` after it, while no probe rows persist.

**Causal scope:** PR #211 proved only two direct write surfaces. The Task6A writer boundary also includes attempt and runtime-session writes; without their denial the old-login fence rehearsal is incomplete. This remains a fixture-only test, not a live writer cutover or a complete runtime grant matrix.

## Boundaries

- Reuse the exact private data-directory, nondefault-port, socket-directory and PostgreSQL 17 preflight. Never mutate live roles, credentials, ACLs, services, selected CLI, or preserved worktrees.
- Keep a generated `NOLOGIN` owner of only the four probed fixture tables, a distinct generated non-superuser old login, and existing no-membership/SET/ADMIN checks.
- The same old connection must exercise linked run → claim → attempt → runtime-session rows in a transaction intentionally rolled back, then independently attempt all four writes after revocation and receive `42501`. For attempt/session post-probes, create valid run/claim parents inside only the disposable fixture and remove them before asserting no rows remain; otherwise a still-authorized attempt fails at FK validation and weakens the denial signal.
- Do not infer full writer exclusion, intended successor runtime grants, Mission Control child-path denial, continuous DB/OS fencing, or cutover admission from this test.

## File map and verification

- `tests/execution-attempts/task6a-private-old-writer-denial.integration.test.ts`: add the two fixture-owned tables, pre-transition linked inserts, post-transition direct-denial assertions, and absence counts. Existing role cleanup remains mandatory.
- [x] RED: before extending `REVOKE`, the attempt insert reached the deliberate rollback marker instead of `42501`. Initial RED reached FK validation on the absent rolled-back claim (`23503`); the test was tightened with fixture-only valid parents to isolate authorization.
- [x] GREEN: revoke only the old login's fixture INSERT privilege on both new surfaces. The private dedicated test passed 3/3; adjacent opt-in verifier 2/2; TypeScript, source manifest 18/18, migration digest, and diff check passed. Independent read-only review found no Medium+ issue.
- [ ] Complete exact-head PR review, clean-main build, and private merged-main test before claiming delivery.
