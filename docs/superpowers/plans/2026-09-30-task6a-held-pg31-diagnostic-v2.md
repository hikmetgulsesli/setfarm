# Retained private PostgreSQL31 diagnostic Implementation Plan

> **For agentic workers:** Root executes inline, sole writer/delivery owner.
> Read-only investigation and independent review are the only delegated roles.
> Use test-driven-development and verification-before-completion task by task;
> owner decision delegation replaces execution/approval menus, not evidence gates.

**Goal:** Verify complete actual private PG31 integrity and cold logical census
with one explicitly counted backend retained through a bounded continuation.

**Architecture:** Append a held composition outside frozen migration regions,
reuse the unchanged complete V31 core and source-owned temporary preflight, and
extract the existing cold census into a connection-neutral primitive. A private
socket adapter owns one reserved backend and permanent close/loss revocation;
the protected opt-in fixture proves actual execution, not production authority.

**Tech Stack:** TypeScript ESM, Node22/macOS arm64, postgres3.4.8, PostgreSQL17.10,
existing Mach-O protected private payload, system-only root setup/inspection.

**Spec:** docs/superpowers/specs/2026-09-30-task6a-held-pg31-diagnostic-v2-design.md

## Global Constraints

- Preserve all old worktrees/branches/archives, failed fixture evidence and
  frozen19 startup changes; no reset/stash/revert/history rewrite/main commit.
- No production descriptor override, account/service/selector/livePG change,
  source/genesis/migration/admission capability, fakeV1 record or migration34.
- Preserve every frozen semantic migration region and checksum exactly.
- Preflight TEMP DDL/DML is explicit; later audit is retained READ ONLY.
- Count one observing backend; activity/census remain sampled/transaction-scoped,
  not continuous arbitrary-writer exclusion. No same-role-only session census.
- Root alone writes; exact privileged source independently reviewed before effects.
- No dirty build, ambient all-tests/livePG fallback, guard bypass or secret output.

## Interfaces and File Map

Append to src/db/contract-spine-migrations.ts outside all semantic regions:

```ts
export async function withHeldContractSpineV31DiagnosticV2<T>(
  session: postgres.ReservedSql,
  operation: (audit: CurrentContractSpineAuthorityLedgersAuditV2) => Promise<T>,
): Promise<T>;
```

Caller owns the fresh reserved backend and its physical/lifecycle checks. The
function never reserve/releases/reconnects. It performs fixed bounded session
setup, lock, exact-head preflight, unchanged temporary constraint/behavior
verification and canonical identity, then read-only BEGIN/full exact core.
The callback runs before transaction settlement/unlock. On callback/error paths
ROLLBACK then exact unlock/reset must be verified, with aggregate cleanup errors.
Output remains the existing literal productionAuthority:false integrity DTO.

Extract within src/internal-production/baseline-legacy-database-census-v1.ts:

```ts
export async function observeHeldColdPre32LegacyDatabaseCensusV2(
  connection: import('postgres').Sql,
): Promise<LegacyDatabaseCensusV1>;
```

Only fixed source31/cold32+33/catalog/logical-owner/finding-inventory queries;
no begin/reserve/end/URL. Existing URL adapter still wraps unchanged old modes,
flags, locks, exact-journal option and callback semantics around shared body.

New src/internal-production/task6a-held-pg31-diagnostic-v2.ts:

```ts
export async function withTask6aPrivateHeldPg31DiagnosticV2<T>(
  transport: unknown, serverUid: number, runtimeGid: number,
  operation: (held: Readonly<{
    observe(): Readonly<{
      schema: 'setfarm.task6a-held-pg31-diagnostic.v2';
      authority: 'diagnostic-only'; productionAuthority: false;
      backendPid: number; observingBackendCount: 1;
    }>;
    recheck(): Promise<void>;
    revoke(): void;
  }>) => Promise<T>,
): Promise<T>;
```

Own fresh single-backend/physical holders and reserve once; bracket every query,
check exact PID/role/database/local-socket/all-client-backend population before/
after preflight/audit/census and at recheck. No raw SQL is yielded. State burns
before close/revoke and after failure; late awaits cannot yield eligibility.
Bound whole invocation60s and server idle-in-transaction5s, not infinite lease.

Test files: tests/internal-production/task6a-held-pg31-diagnostic-v2.test.ts,
tests/execution-attempts/task6a-held-pg31-fixture-entry-v2.ts; extend existing
task6a-private-protected-cluster.integration.test.ts and package.json.

### Task 1: Source-owned held audit and connection-neutral census

- [ ] Write behavioral SQL-boundary tests that fail while exports are missing.
  Independently derive ordering/literal output/expected backend/control effects.
  Controlled slow external boundary only; real composition and lifecycle execute.
  Mutation targets: premature commit/unlock, second reserve, skipped canonical
  preflight/full core, caller expected identity, swallowed cleanup failure.
- [ ] Run RED: env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx
  --test tests/internal-production/task6a-held-pg31-diagnostic-v2.test.ts.
  Require assertions about missing behavior, not import/syntax errors.
- [ ] Append minimal held composition using existing complete core/deadlines;
  extract cold-census body without weakening old adapter flags/callbacks.
  Preserve first error and every settlement failure; never release caller session.
- [ ] Run GREEN, existing census/journal regressions and check:migration-digests.

### Task 2: Bounded one-backend private composition

- [ ] Add RED cases: extra args/wrong namespace/peer/env, session population crossed,
  physical/backend drift, concurrent close during each awaited phase, callback
  failure, expiry and ambiguous cleanup. No ambient DB socket can be opened.
- [ ] Implement fixed private scope plus actual existing physical/single-backend
  primitives; retain session/transaction/lock through callback, permanent revoke
  around all awaits and before cleanup. Reject repeat/concurrent recheck.
- [ ] Run GREEN + transport4/physical5/backend7 and baseline15; strict source TS.

### Task 3: Actual protected PG31 positive/revocation rehearsal

- [ ] Add explicit held-PG31 opt-in requiring protected-PG AND native opt-ins;
  default mode creates no new fixture, connection, filesystem or root action.
- [ ] Test-only entry extracts literal ordinary base DDL from actual db-pg AST;
  rejects missing/dynamic/wrong topology. Uses existing automatic source migration
  API and verifies guardedPending32/head31; no ambient harness/test32 evidence.
- [ ] Prepare disposable setfarm DB and restricted observation grants via the
  trusted scoped setup actor. Observe same real backend and complete source31,
  cold-catalog/census, actual retained Node/backend native images. Add real
  denial/revocation probes and definite close/cleanup evidence.
- [ ] Independent read-only source review clears exact changed privileged files.
- [ ] Run actual third-opt-in command with all three=1,0 skips; record exact root/
  PIDs and all real outcomes including failures. Any uncertainty retains exact
  tree; never blindly rerun/clean. Independently verify exact safe terminal absence.

### Task 4: Scoped delivery and clean-main host proof

- [ ] Focused pure/census/socket regressions, source TS, English/path/version/
  migration-digest/12MC contracts, diff check, final independent complete diff review.
- [ ] Record causality, RED/GREEN, actual private outcome and explicit diagnostic
  limits. Normal scoped commit/push/PR; ask available cloud reviewers once/head.
- [ ] Exact-head complete cloud/security/full inline/review/thread audit; fix real
  findings with TDD. Normal SHA-bound merge; preserve branch/worktree.
- [ ] Fast-forward independent standby-v2 cleanmain; ordinary build, actual compiled
  source/build observer and hostHTTP/PGREADONLY evidence. Keep standby unselected.
- [ ] Continue authentic protected controller origin/held genesis as a separate
  designed gate; no private diagnostic substitutes for live32/33/admission.

## Evidence

New isolated worktree base e15a11fc, fresh npmci--ignore-scripts16packages0vuln.
Baseline15PASS0fail/skip. Prior native3PASS is PR249 evidence only, not evidence
for the new held-PG31 code. Implementation and new privileged execution pending.
