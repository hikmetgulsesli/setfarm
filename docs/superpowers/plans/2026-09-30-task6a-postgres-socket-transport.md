# Task6A PostgreSQL Socket Transport Implementation Plan

> **For agentic workers:** Root executes inline with TDD and verification-before-completion. Agents perform read-only investigation/review, never implementation or delivery. The executing-plans skill is unavailable; explicit root-only owner instructions override implementation delegation.

**Goal:** Prove correct no-fallback Postgres.js Unix transport before protected runtime wiring.

**Architecture:** Import-inert typed candidate validator and lazy factory, explicit full socket path and fixed pool/listener profiles. Actual peer fixture consumes this source factory under its scoped OS UID.

**Tech Stack:** Node >=22, TypeScript ESM, PostgreSQL 17, Postgres.js 3.4.8, node:test.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-postgres-socket-transport-design.md`

## Global Constraints

- No new dependencies. Root sole writer. No live endpoint/schema/service/archive/selector or host account/group mutation.
- Import inert; explicit-path only, exact schema keys, no PG/URL/password/custom socket input, no TCP fallback.
- Transport data never grants physical/role/owner/admission authority.
- Protected descriptor, restricted pool/LISTEN integration, MC and agent UID/broker isolation remain separate gates. Old observations/defaults unchanged.

## File Map

Create source `src/internal-production/task6a-postgres-socket-transport-v1.ts` and pure test `tests/internal-production/task6a-postgres-socket-transport-v1.test.ts`. Extend only the existing opt-in protected cluster test for actual peer child proof; keep root cleanup unchanged. Modify `package.json` to register the new focused test in the normal internal-production chain (that suite is explicitly listed, not glob-discovered). Create this plan/spec. This causal scope refinement prevents the new primitive from losing its default regression gate.

## Task 1: Explicit transport and actual peer proof

**Interfaces:** `parseTask6aPostgresSocketTransportV1(value: unknown)` returns a frozen typed transport candidate. `buildTask6aPostgresSocketOptionsV1(value: unknown, profile: 'pool'|'listener', environment)` returns frozen explicit client options. `createTask6aPostgresSocketSqlV1(value: unknown, profile)` validates actual process UID/environment and resolved options before returning lazy SQL. None authenticate a descriptor or enable admission.

- [x] Inspect dependency transport code and existing runtime pool/LISTEN/MC defaults; identify the absent Unix path boundary. Baseline policy pure tests 2/2 passed, prior merged-main build `ed1fde26` is clean.
- [x] Write pure tests with literal full socket filename, user/database/port and profiles; malformed directory/schema/PG/URL/password and wrong UID cases.
  Example: `assert.equal(sql.options.path, '/private/tmp/task6a-socket/.s.PGSQL.55437')`.
- [x] Run intended RED against the empty guard/path implementation; confirm wrong path acceptance/refusal assertions fail, without any DB connection.
- [x] Implement exact-key validator, canonical absolute directory validation and no-environment guard. Construct Postgres.js only after current UID agreement, then verify resolved path/user/db/port/password before any query.
- [x] Run pure tests GREEN. In the private fixture run a scrubbed `_www` Node child importing the actual source-factory bundle: `SELECT current_user, inet_client_addr() IS NULL AS socket` and allowed INSERT/SELECT; admin role request must receive 28000 denial. Repeat pool/listener transport and negative probes after restart, plus genuine LISTEN/NOTIFY, missing socket ENOENT and actual environment refusal.
- [x] Run privileged fixture 3/3 or expanded count, default skip/runner, focused pure suite, strict TS including test files, source contracts and diff check. Independently review; fix and rerun findings.
- [ ] Commit/push, exact-head GitHub review/security, reviewed PR merge without deleting preserved branches/worktrees.
- [ ] Fast-forward clean standby main, ordinary guarded build and final BUILD_INFO/HTTP proof. Continue protected descriptor and irreversible restricted pool/LISTEN wiring; never claim primitive success is live cutover.

## Evidence

Record exact RED/GREEN, private lifecycle, review/delivery and clean-main build here; do not infer full application-suite or host-exclusion proof.

- Intended initial RED: four failures (empty full socket path, missing validation,
  missing environment and UID refusal). GREEN 4/4 against the implementation,
  without database queries. Additional inherited PGPASSWORD RED: one of four
  failed with Missing expected exception, then bounded prototype check GREEN4/4.
- First actual connector attempt failed because `_www` cannot traverse the
  user's protected Home/worktree. It was a fixture-loading failure, not transport
  RED; postmaster and exact root were still stopped/removed. No repo permission
  change. Existing esbuild compiles the actual source/dependency unchanged into
  a root-owned 0444 temporary fixture module; Node executes only as `_www`, never
  root. This fixture bundle is not a production deployment/build handoff.
- Final expanded private run: 3/3 pass, zero skips, exit0 (4.570s), root
  `/private/tmp/setfarm-task6a-protected-pg.CsKHQK`, verified postmasters48619 and
  48793. Actual peer socket roles/null client address, pool/listener SELECT/INSERT,
  LISTEN/NOTIFY roundtrip, actual PGPASSWORD refusal, admin 28000 and missing
  Unix socket ENOENT passed before and after restart. Exact processes stopped
  and temporary tree removed; independently confirmed absent.
- Default test discovery: 6 pass, one explicit privileged skip; no effects.
  Strict TS including actual test/helper files, English1847/path943, version,
  migration digests,12MC artifacts and diff checks passed. Independent final
  delta review found no remaining primitive-only blocker; whole app-suite,
  protected descriptor/runtime wiring and live exclusion are not claimed.
- The complete existing internal-production pure suite also passed 372/372,
  zero skips/failures, exit0 (26.488s). Source strict TS no-emit passed after the
  final delta. Reviewed changes remain primitive-only, with no existing runtime
  pool/default modification. A normal clean-source build is the delivery gate.
- Owner delivery audit found explicit internal-production discovery did not
  automatically include the new pure test. Register the focused transport
  command and chain it into normal internal-production verification before
  delivery; no dependency or runtime gate changes. Reverify the exact new head.
- Review's shell-environment caveat is resolved in the positive lazy-client
  test: save/unset/restore PG/URL values inside that test process only. Explicit
  negative guard cases and real private child environment poisoning remain
  unchanged; no source guard is relaxed. Verify clean and poisoned shell runs.
