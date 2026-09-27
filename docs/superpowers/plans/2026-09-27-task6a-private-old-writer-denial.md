# Task6A private old-writer SQL denial rehearsal

**Goal:** On an authenticated private PostgreSQL 17 cluster, prove that a distinct old-login role can insert into `runs` and `claim_log` before a fixture-scoped privilege transition and is denied by actual SQL after it. Preserve live roles, credentials, services, selected CLI, and all worktrees.

**Why now:** PR #210 delivered opt-in read-only verification. The current host still reports `diagnostic-only` and unverified physical provenance; sampled zero activity does not establish a continuous DB/OS writer fence. A private, narrow old-login denial probe is the smallest next measurable prerequisite for the approved Task6A transition plan.

## Boundaries

- Only a verified, non-default-port private cluster and a generated fixture database may receive role/owner/ACL changes. The test must authenticate data directory, TCP port, and socket directory before creation.
- Use random in-memory credentials; never publish URL/password, role secrets, or raw database errors in task output. Keep the admin connection separate from the old login.
- The fixture's non-login owner owns only the two probed tables in this slice. The test is not a complete privilege inventory, runtime grant package, Mission Control/OS identity fence, old-session drain, guarded 32/33 proof, or cutover admission.
- Pre-transition writes occur inside an intentionally rolled-back transaction. Post-transition denials must be real `42501` SQL errors, not just `has_table_privilege` results. No live Setfarm database changes.

## File map and steps

- `tests/execution-attempts/task6a-private-old-writer-denial.integration.test.ts`: strict private-cluster preflight, isolated DB/roles, pre/post direct SQL probes, fixed cleanup.
- `package.json`: explicit `test:task6a-old-writer-denial:isolated` gate; do not add to ambient-DB tests.
- [x] RED: the pre-fence old login inserted both rows inside a rolled-back transaction; without revocation, the expected post-fence denial failed with the rollback marker instead of `42501`.
- [x] GREEN: fixture-scoped revocation produces `42501` for both direct inserts through the already-open old-login connection and leaves the rolled-back fixture rows absent. The role check proves distinct session/effective identity, non-login owner, no superuser/bypass/create capabilities, and no member/SET/direct ADMIN relation to the owner. Independent review found and prompted fixed-error wrapping of password-bearing CREATE ROLE and cleanup-intent flags before each CREATE.
- [ ] Verify dedicated test, TypeScript, source manifest/digest, independent read-only review, PR and exact-head checks, then guarded clean-main build and private merged-main test.
