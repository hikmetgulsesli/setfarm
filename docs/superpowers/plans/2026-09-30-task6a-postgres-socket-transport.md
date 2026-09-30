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

Create source `src/internal-production/task6a-postgres-socket-transport-v1.ts` and pure test `tests/internal-production/task6a-postgres-socket-transport-v1.test.ts`. Extend only the existing opt-in protected cluster test for actual peer child proof; keep root cleanup unchanged. Create this plan/spec.

## Task 1: Explicit transport and actual peer proof

**Interfaces:** `parseTask6aPostgresSocketTransportV1(value: unknown)` returns a frozen typed transport candidate. `buildTask6aPostgresSocketOptionsV1(value: unknown, profile: 'pool'|'listener', environment)` returns frozen explicit client options. `createTask6aPostgresSocketSqlV1(value: unknown, profile)` validates actual process UID/environment and resolved options before returning lazy SQL. None authenticate a descriptor or enable admission.

- [x] Inspect dependency transport code and existing runtime pool/LISTEN/MC defaults; identify the absent Unix path boundary. Baseline policy pure tests 2/2 passed, prior merged-main build `ed1fde26` is clean.
- [ ] Write pure tests with literal full socket filename, user/database/port and profiles; malformed directory/schema/PG/URL/password and wrong UID cases.
  Example: `assert.equal(sql.options.path, '/private/tmp/task6a-socket/.s.PGSQL.55437')`.
- [ ] Run intended RED against the empty guard/path implementation; confirm wrong path acceptance/refusal assertions fail, without any DB connection.
- [ ] Implement exact-key validator, canonical absolute directory validation and no-environment guard. Construct Postgres.js only after current UID agreement, then verify resolved path/user/db/port/password before any query.
- [ ] Run pure tests GREEN. In the private fixture run a scrubbed `_www` Node child importing the source factory: `SELECT current_user, inet_client_addr() IS NULL AS socket` and allowed INSERT/SELECT; admin role request must receive 28000 denial. Repeat pool/listener transport and negative probes after restart.
- [ ] Run privileged fixture 3/3 or expanded count, default skip/runner, focused pure suite, strict TS including test files, source contracts and diff check. Independently review; fix and rerun findings.
- [ ] Commit/push, exact-head GitHub review/security, reviewed PR merge without deleting preserved branches/worktrees.
- [ ] Fast-forward clean standby main, ordinary guarded build and final BUILD_INFO/HTTP proof. Continue protected descriptor and irreversible restricted pool/LISTEN wiring; never claim primitive success is live cutover.

## Evidence

Record exact RED/GREEN, private lifecycle, review/delivery and clean-main build here; do not infer full application-suite or host-exclusion proof.
