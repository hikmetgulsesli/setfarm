# Private Read-Only Login SCRAM v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Root uses inline execution with checkpoints: implementation delegation prohibited; executing-plans unavailable. Reviewers are read-only.

**Goal:** Correct the two genuine ALL restricted-login SCRAM fixture failures without changing live credentials or weakening authentication/verifiers.

**Architecture:** A single closed constructor-owned focused mode dispatches exactly two existing integration bodies. Those new ephemeral LOGIN roles and all reconnects use the private wrapper's already-redacted random password; existing privilege/fingerprint/refusal proofs remain.

**Tech Stack:** Node26.4.0, TypeScript ESM, node:test, postgres3.4.8, local private PostgreSQL17 with Unix/TCP SCRAM.

**Spec:** docs/superpowers/specs/2026-10-01-private-readonly-login-scram-v1-design.md

## Global Constraints

- Root sole source/Git/delivery writer; agents read-only, no effects or delegation.
- Exact6 File Map paths; no production verifier, test-database, journal or dependency change.
- No live5432 test fallback, retained-cluster adoption, password read/printing, arbitrary command API, trust/HBA change or privileged native effect.
- Keep findings/all exact graph unchanged and all lifecycle/journal/redaction/clean-source gates.
- Real private effects only after clean source commit and fresh exact per-invocation independent review/host preflight; freeze through definite closure.
- Preserve all old roots/worktrees/builds/archives/live deployment selection.
- Normal PR/SHA-bound merge/new clean-main guarded build; no dirty-build or runtime guard bypass, history rewrite, branch deletion or main commit.
- Standing bounded authorization selects inline execution/no repeat permission prompts.

## Task 1: Closed focused harness and secret-shape regression

**Files:** scripts/run-private-postgres-tests.mjs, scripts/__tests__/private-postgres-test-cluster.test.js, spec/plan.

**Interfaces:** planPrivatePostgresTestsV1({root,port,mode}) keeps findings/all; readonly-verifiers returns the exact immutable direct Node argv from the spec. CLI accepts exactly one known mode. Integration tests later expose no new API.

- [x] New isolated branch fix/private-readonly-login-scram-v1 at a5654e98;
  ignored shared node_modules unchanged/no install. Existing wrapper/journal
  baseline102PASS0FAIL0CANCELLED0SKIP3831.742833ms.
- [x] Self-review and commit spec/plan before implementation:f2a20c0d.
- [x] Add actual plan readonly-verifiers case, literal two-file serial argv and
  unchanged initdb/server/findings/all assertions. Add invalid near-mode and
  extra focused argument CLI checks with forbidden effect sentinels. Run RED:

```bash
env -u TMPDIR -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-concurrency=1 scripts/__tests__/private-postgres-test-cluster.test.js
```

- [x] Add actual integration-consumer malformed-password cases for each file:
  synthetic explicit private data path/admin URL, fixed invalid password markers,
  a child preload forbids the synthetic PostgreSQL target via numeric/object/path
  Socket.connect forms while preserving runtime IPC, actual node --import tsx --test.
  Require literal PRIVATE_READONLY_LOGIN_PASSWORD_INVALID, exit1, zero forbidden
  connection marker and no password marker in output. Observe RED before change;
  do not use real SQL/cluster/native effects or source-text matching.
- [x] Implement only fixed mode in both validation sites and plan test selection:

```javascript
test: Object.freeze(mode === 'readonly-verifiers' ? [
  '--import', 'tsx', '--test', '--test-concurrency=1',
  'tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',
  'tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts',
] : ['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
  ...(mode === 'findings' ? ['run', 'test:findings'] : ['test'])])
```

Keep credential-shape regressions RED until Task2; select focused mode tests for
GREEN. All prior102 wrapper/journal cases must remain green independently.
The malformed credential cases are deferred until after the clean harness-only
real RED, before authentication implementation. Fixed-mode planner RED:
7PASS1FAIL300.359958ms, PRIVATE_TEST_CLUSTER_PLAN_INVALID. Full pure harness/
journal GREEN:120PASS0FAIL0CANCELLED0SKIP6390.071917ms, including all12 lifecycle
fault modes for findings and readonly-verifiers and normal unchanged all dispatch.
- [x] Commit clean fixed harness/tests:820afbddd24e7dffff645389957114ff7f57fc0d;
  inspect actual source diff, obtain
  independent one-invocation review before real RED. Secret-shape cases can be
  added after the harness-only commit so real RED does not include them.
- [x] Fresh readonly-verifiers invocation after preflight:

```bash
/opt/homebrew/Cellar/node/26.4.0/bin/node scripts/run-private-postgres-tests.mjs readonly-verifiers
```

Expected two actual28P01 failures, NOT skips, launch/import errors or weakened
guard. Capture complete strict FD-pinned journal + owned children exit/close/
sixEOF/quiescence/admin/server/terminal + outer1 and postprimary. No next edit
before all effects close. Prior fifth ALL RED is corroboration, not this command.

## Task 2: Ephemeral login auth and unchanged verifier proof

**Files:** Both integration files, wrapper cluster regression tests, spec/plan.

**Interfaces:** Existing private admin URL decoded password in local variable;
all existing postgres clients keep identical host/port/database/user/max fields
and add password. No new utility or production API.

- [x] Complete malformed credential consumer RED from Task1, then add before
  admin client construction in both tests:

```typescript
let password: string;
try { password = decodeURIComponent(parsed.password); }
catch { throw new Error("PRIVATE_READONLY_LOGIN_PASSWORD_INVALID"); }
assert.ok(/^[a-f0-9]{64}$/.test(password), "PRIVATE_READONLY_LOGIN_PASSWORD_INVALID");
```

Never use assert.match(password), whose failure could print it. Extend observed
identity SQL with password_encryption and require scram-sha-256 before effects.
- [x] Append `PASSWORD '${password}'` to shape-validated existing random LOGIN
  DDL. Supply password to all4 restricted clients in each file, including missing
  target. Keep writerRole NOLOGIN, all flags/grants, fingerprint/drift/cleanup
  tests unchanged. No credential literals or new unregistered passwords.
- [x] Independently reviewed causal ownership refinement: base fixture cleanup
  currently drops a role even on CREATE collision. Test the complete actual
  integration callback with finite identity/database/CREATE-42710 boundaries,
  no real SQL; require primary duplicate error and zero foreign-role DROP.
  Observe RED, then set roleCreated only after successful CREATE acknowledgment
  and require it for cleanup. Keep current journal collision guard unchanged.
- [x] Run full pure wrapper/journal tests, noemit, version/English/path/migration/
  MC/diff checks; review exact6-path map and causal unchanged ALL/fail-closed
  invariants. Commit clean source before real GREEN.
- [x] New independent exact-head per-invocation review and immediate preflight;
  same focused mode, new owned private cluster. Freeze to full closure. Require
  both integration bodies PASS0SKIP with all negative catalog cases and actual
  two quiescence samples, admin end/server close/strict terminal/outer0/posthost.
- [x] Address only causal failures exposed by genuine evidence; refine map/tests
  and review first. Never weaken catalog or authentication proofs to get green.

## Task 3: Reviewed delivery and genuine ALL preparation

**Files:** Six mapped paths; append retained checkpoint logs outside source.

- [ ] Exact committed focused/pure verification and independent final read-only
  review; normal push/PR. Actual complete remote checks/reviews/comments/threads.
- [ ] Copilot/Gemini review-only request once; quota/silence not approval. No paid
  settings or access change. Normal SHA-bound merge without bypass/deletion.
- [ ] New clean-main clone/sync, ignored unchanged dependency link, guarded npm
  run build and matching source/compiled identities. Preserve old builds/selection.
- [ ] Prepare genuine unchanged ALL only with new per-invocation C0/I0/M0,
  source/build/dependency/primary/resource checks and full freeze/closure protocol.
  Focused2PASS is never ALL, native authority or live cutover proof.

## Self-review

Six-path design fixes one independent causal authentication root. A closed fixed
test mode is necessary to observe real RED/GREEN without rerunning an unrelated
hour-long ALL or weakening its graph. Existing random private password reuse
keeps redaction coverage; secret separation is explicitly not claimed. Privilege
and catalog invariants remain actual consumer assertions. No placeholders, live
credential changes, generated runtime edits or unrelated feature work included.

## Actual observed RED/GREEN checkpoint

- Exact820afbdd pure rerun26241 CLOSED0:120PASS0FAIL0CANCELLED0SKIP6416.207625ms.
  Both independent one-invocation read-only reviews C0/I0/M0. Immediate10:47:02UTC
  primary5432/setfarm claims0/unreleased0, ordinary UID/EUID501 GID/EGID20 Node26.4,
  ambient forbidden names empty, PG17.10, unchanged dependency digests, 14.6GB free.
- Genuine focused RED96971 definitely CLOSED1, constructor-owned NEW
  /tmp/setfarm-task6a-pg.vYFmIs, port52953; original root dev16777231ino206852394
  UID501GID0mode0700; journalino206852395mode0600nlink1. Two actual28P01 failures,
  no password assigned under unchanged localSCRAM,0PASS2FAIL0CANCELLED0SKIP
  10008.074417ms. No auth/cutover success is inferred.
- Whole held-FD reader:74records28586bytesSHA
  647b931f80abed1454ca599ddb9c42febb1852e8374e0b959a6559e207e4f5c2,
  stable identity/bytes, terminalObservedtrue/incompletefalse/reasonnull;
  observed testCode1/quiescent/adminEnded/serverClosedtrue. Owned initdb77194,
  test77213, server77205 each actualexit+close0/1/0signalsnull; all6EOF and two
  ordered quiescence samplesPASS. Outer1 separately observed. Post10:47:43UTC
  primaryschema31claims0/unreleased0/HTTP3080200. Cluster/root retained; no reuse.
- Initial malformed-test preload incorrectly denied runtime IPC and four child
  cases timed out. Object-only refinement then missed postgres numeric connect
  and observed ECONNREFUSED at synthetic127.0.0.1:55439, no SQL/live5432 effect.
  Neither attempt is accepted as the no-network regression RED. Corrected
  numeric/object/path boundary preserves IPC and prevents that PostgreSQL target.
- Genuine final seven-case RED75997 CLOSED1:0PASS7FAIL0CANCELLED0SKIP
  2798.170584ms. Four cases reach the forbidden-target sentinel; two malformed
  encoding cases escape as untyped URIError; base callback drops a foreign role
  after CREATE collision. No real SQL/native process beyond finite Node test child.
- After minimal fixes, pure wrapper/journal72138 CLOSED0:127PASS0FAIL0CANCELLED/
  SKIP9191.068666ms, followed by noemit/diff0. Real focused GREEN remains pending
  clean commit and a NEW per-invocation review/health check. No credential changed
  in the closed RED cluster, primary or any retained footprint.
- Auth source commit a89cd5406f7da936b7eb2c9577fe851bb43824f2 clean;
  fresh exact-head pure18661 CLOSED0:127PASS0FAIL0CANCELLED0SKIP9355.13725ms.
  Both separate one-GREEN-invocation reviewers C0/I0/M0. Fresh10:55:45UTC
  primary claims0/unreleased0, source/dependency/environment unchanged,
  ordinary Node26.4 UID/EUID501 GID/EGID20; disk14557528KiB available.
- Genuine same-command focused GREEN14966 definitely CLOSED0:2PASS0FAIL/
  CANCELLED/SKIP238255.382459ms. Full base catalog164695.775584ms and current
  journal72341.289125ms bodies, all existing negative rights/drift/fingerprint/
  missing-target checks unchanged. Expected missing-database FATAL logs are
  negative evidence, not ignored failures. No HBA or verifier relaxation.
- NEW /tmp/setfarm-task6a-pg.fS1yEu54201 originalrootdev16777231ino206856554
  UID501GID0mode0700; journalino206856555mode0600nlink1. Strict whole74records
  23256bytesSHA648d2a167bb10b1bad0c2e88c0fb110f1e742abd47fdf105f0da61f6937407c9,
  stable identity/bytes, terminalObservedtrue/incompletefalse/reasonnull,
  observed testCode0/quiescent/adminEnded/serverClosedtrue. Ownedinitdb78683/
  test78702/server78694 each actualexit+close0signalsnull, sixEOF and two ordered
  quiescence samplesPASS. Outer0 separately observed. Post11:00:53UTC primary
  real5432/setfarm/schema31claims0/unreleased0, HTTP3080200, available13957700KiB.
  Root retained with all old footprints; no production rollout or ALL success.
