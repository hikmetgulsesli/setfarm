# Task6A Single Socket Backend Lifecycle Implementation Plan

> **For agentic workers:** Root implements inline with TDD and verification-before-completion; agents investigate/review read-only, no delivery. Explicit root-only authorization overrides implementation delegation; executing-plans unavailable.

**Goal:** Prevent hidden or replacement backend creation before protected runtime wiring.

**Architecture:** Import-inert single-attempt Unix socket factory with synchronous revocation and fixed persistent one-backend options. Actual reserved LISTEN/notification and connection-loss proof in the existing private peer fixture.

**Tech Stack:** Node >=22, TypeScript ESM, macOS, Postgres.js3.4.8, PostgreSQL17, node:test, existing esbuild.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-socket-backend-lifecycle-design.md`

## Global Constraints

- Root sole writer, one PR branch; preserve all worktrees/branches/changes.
- No live namespace, DB/schema, account, service, selector, archive or dependency mutation.
- Exact explicit Unix transport; one native socket attempt, no hidden replacement backend.
- Synchronous revoke/destroy before async close; retain effect uncertainty.
- Transport/lifecycle data is not descriptor/grant/readiness/owner/admission authority.
- Existing private fixture root lifecycle/cleanup remain unchanged; no root Node.

## File Map

Create `src/internal-production/task6a-single-backend-socket-client-v1.ts`,
`tests/internal-production/task6a-single-backend-socket-client-v1.test.ts`,
and `tests/execution-attempts/task6a-protected-cluster-client-entry.ts`
(test-only exports of unchanged source factories). Extend only client proof and
esbuild entry in `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts`;
no root fixture lifecycle/policy changes. Register focused normal discovery in
`package.json`. Create this plan/spec; causal scope is the captured-SQL/reconnect
gap found while reviewing the next protected initializer.

## Task 1: Single-attempt primitive and real peer lifecycle

**Interface:** `createTask6aSingleBackendSocketClientV1(transport: unknown,
onNotification?: (channel: string, payload: string) => void)` returns frozen
`{sql, revoke():void, close():Promise<void>, observe():Readonly<{nativeSocketCreations:number,revoked:boolean}>}`.

- [x] Write lazy options and preconnect-revoke/hidden-listen/wrong UID/environment
  tests. Example: `assert.equal(client.sql.options.max, 1)` and after revoke
  `await assert.rejects(captured.unsafe('SELECT 1'))`, `nativeSocketCreations===0`.
- [x] Watch intended failures against missing single-backend guards/options;
  do not connect to an ambient DB. Implement the internal one-attempt factory,
  native socket lifecycle, notification gate and frozen resolved options.
- [x] Run focused GREEN, strict TS source/actual tests. Add unchanged-source
  fixture entry and scoped real backend proof; obtain read-only review before
  privileged fixture execution.
- [x] Private child reserves the actual backend, checks exact role/session/db/
  null address and PID, executes `LISTEN task6a_single_backend_fixture`, sends
  pg_notify on that same reserved SQL and rechecks identical PID. Close then
  captured SQL denies; no driver listen() invocation for the successful path.
- [x] In another scoped client, terminate only its own backend with pending
  queued fixture writes. All promises settle rejected, native creation stays1,
  state revoked, and admin SELECT proves no forbidden note rows. Repeat before
  and after the exact private cluster restart; existing root cleanup unchanged.
- [ ] Run actual private fixture, default/focused tests, descriptor5/default
  skip, transport4, existing pure372, strict TS/contracts/diff. Independent
  exact-head review and cloud/security/no-open-thread gates precede SHA-bound
  merge. Preserve all branches; normal clean standby main build follows.

## Evidence

PR244 exact reviewed225ca45 merged mainf149f136; ordinary clean standby build
exit0, BUILD_INFO fullf149/main/dirtyfalse. Selected deployment untouched.
- Intended RED4 failures: max50 instead of1, revoke remained false, hidden LISTEN
  reached the private nonexistent socket (ENOENT instead of guard refusal),
  invalid callback accepted. No ambient DB connection. GREEN4/4, zero skips.
- Source strict TS passed; actual tests/helper/fixture strict TS passed after
  using Reflect.get for the driver runtime field absent from declarations.
  Default combined discovery6pass/1explicit private skip before two extra tests.
- Pre-execution review found permanent native error revocation and accidental
  async callback returns missing. Intended new RED4pass/2fail (unhandled native
  error, non-revoked async callback/unhandled rejection); permanent error hook,
  allocation refusal and strict sync callback/drained return corrected both.
  GREEN6/6. Independent reviewer cleared unchanged-root private fixture.
- First actual peer run failed its loss timeout (2policy pass/1private fail).
  Gate refused replacement native sockets but driver queue never fully settled.
  Exact UX8GhG fixture/postmaster69832 still stopped/removed and independently
  absent. This is meaningful backend lifecycle RED, not a missing-module failure.
  Revoke now fences/destroys synchronously THEN retains one end(timeout0) promise
  to drain pending driver work; no increased timeout or guard bypass.
- Actual GREEN3/3, zero skips/failures, exit0 (4.610s), exact private
  `/private/tmp/setfarm-task6a-protected-pg.3ecvfx`, postmasters70311/70493 stopped,
  exact tree removed, independently absent. Same reserved PID/peer role/session/
  DB/null address covered LISTEN/notify; self-backend loss rejected all four
  queued effects, native creation stayed1, old handles denied and parent actual
  SQL note count stayed0, repeated after restart. No live path/role/schema effect.
- Final pure6/6, existing descriptor5+explicit private skip and transport4/4;
  existing internal-production pure372/372 zero skips/failures, exit0 (23.987s).
  Source/actualtests strict TS, English1858/path946/version2.3.79/digests/12MC
  artifacts and diff checks passed. Independent final staged review no blockers.
  No full application-suite or live cutover claim. Exact-head PR/cloud/security
  and ordinary clean-main standby build remain delivery gates.
