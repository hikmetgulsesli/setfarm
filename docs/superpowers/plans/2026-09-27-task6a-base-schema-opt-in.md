# Task6A opt-in read-only migration verification plan

**Goal:** Make an explicitly selected `pgMigrate({ baseSchemaMode: "verify" })` verify the already-migrated current-head journal and ordinary base catalog using a restricted PostgreSQL login, without opening a maintenance database or running base DDL. Keep the ordinary default unchanged.

**Why this is in scope:** The Task6A writer-fence rehearsal needs a startup path that cannot repair schema. PRs #206 and #207 already supplied separately tested read-only catalog and journal verifiers; the missing public orchestration is a prerequisite for the user-approved positive physical/PostgreSQL ownership cutover. The merged #209 findings fix is clean-main built and its coordinator passed 9/9 on the private cluster. A current host observation still fails closed at physical `candidate-lsof` ordinal 84; this plan does not reinterpret that as zero owners.

**Boundary:** No live role, credential, service, plist, selected CLI, schema, or worktree mutation. The two verifiers produce sequential read-only snapshots, not an atomic or continuous writer fence, full private-data migration parity, positive owner receipt, or cutover admission. The restricted login cannot certify duplicate open claims; the privileged pre-transition check remains separately required.

## File map

- `src/db-pg.ts`: add the explicit verify-only option, fixed refusal for incompatible/concurrent modes, a fail-closed verification-mode latch for automatic queries, target-only connection, sequential calls to the two existing verifiers, and readiness only after both pass. Leave default DDL and apply behavior unchanged.
- `tests/execution-attempts/base-schema-opt-in.integration.test.ts`: dedicated private-PG17 test using a distinct generated restricted login; prove no schema effect or missing-target creation, successful public verification and subsequent `pgQuery`, missing/drifted journal/base catalog refusal, missing target refusal, and concurrent-call refusal. The source-level branch review must separately confirm the target-only path does not call `ensureDatabaseExists`.
- `tests/execution-attempts/migrations.test.ts`: existing default/apply regression, left unchanged and rerun to prove no implicit runtime switch.
- `package.json`: register the dedicated test under a targeted isolated script; do not add it to an ambient-DB test path.
- `docs/superpowers/specs/2026-09-27-task6a-base-schema-readonly-verify-design.md`: align the existing design with delivered verifier leaves and explicitly state the restricted data-invariant boundary.

## Steps

- [x] Confirm RED at the public `pgMigrate` boundary: the second concurrent verify call silently succeeded under the old implementation while the first attempted the ordinary path.
- [x] Implement the smallest opt-in branch and verification-mode latch, with fixed errors and no default-mode regression. The private-cluster restricted-role test now passes the positive query, incompatible/concurrent refusals, base/journal drift refusals, failed-mode latch, and absent-target no-create assertion.
- [x] Run private-cluster positive/negative integration (2/2), focused default migration (1/1), base verifier (5/5), journal verifier (4/4), internal-production source manifest (18/18) and pure tests (337/337), TypeScript, migration digest, and whitespace checks. Independent read-only diff review found no remaining Medium+ issue after test-first fixes for unknown options and the initializer await race. The broad script suite remains a separate pre-delivery check.
- [ ] Commit, push one scoped branch, wait for exact-head GitGuardian and Codex review, fix actionable findings test-first, and SHA-condition merge.
- [ ] Fast-forward the preserved clean-main deployment clone, normal build, focused merged-main tests, and sanitized no-write host/HTTP checks. A host refusal remains a blocker, never a bypass reason.
