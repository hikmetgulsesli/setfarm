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
- Count one observing backend; clear activity snapshot before each population
  sample. Logical integrity/census remain the retained MVCC snapshot; recheck
  cannot detect later committed DML or a transient writer between samples.
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

Only fixed cold32+33/catalog/logical-owner/finding-inventory queries;
source31 journal identity is supplied by the complete held V31 audit, not this
standalone census primitive.
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

Own fresh single-backend/physical holders and reserve once; bracket every unsafe
AND tagged-template query, including control and cleanup routes. Before timeout/
lock/TEMP effects bind lifetime PID/backend-start/session-roleOID/name/database
OID/name/effective-role/Unix-client-address+port. Await/bracket a separate
pg_stat_clear_snapshot() before each conservative ALL-database-backend sample before/
after preflight/audit/census and at recheck. No raw SQL is yielded. State burns
before close/revoke and after failure; late awaits cannot yield eligibility.
Actively revoke at common monotonic invocation60s even if callback stays pending;
idle-in-transaction5s is additional, not a substitute. No deadline renewal.

Test files: tests/internal-production/task6a-held-pg31-diagnostic-v2.test.ts,
tests/execution-attempts/task6a-held-pg31-fixture-entry-v2.ts; extend existing
task6a-private-protected-cluster.integration.test.ts and package.json.
Test-only `tests/execution-attempts/task6a-held-pg31-base-ddl-v2.ts` parses
the actual db-pg AST in the trusted driving process; its adjacent test proves
the 52-statement topology and dynamic/missing-source refusal. The protected
runtime bundle receives those literal source statements as data, never imports
ambient db-pg and does not include the TypeScript parser in its runtime closure.

### Task 1: Source-owned held audit and connection-neutral census

- [x] Write behavioral SQL-boundary tests that fail while exports are missing.
  Independently derive ordering/literal output/expected backend/control effects.
  Controlled slow external boundary only; real composition and lifecycle execute.
  Mutation targets: premature commit/unlock, second reserve, skipped canonical
  preflight/full core, caller expected identity, swallowed cleanup failure.
- [x] Run RED: env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx
  --test tests/internal-production/task6a-held-pg31-diagnostic-v2.test.ts.
  Require assertions about missing behavior, not import/syntax errors.
- [x] Append minimal held composition using existing complete core/deadlines;
  extract cold-census body without weakening old adapter flags/callbacks.
  Preserve first error and every settlement failure; never release caller session.
- [x] Run GREEN, existing census/journal regressions and check:migration-digests.

### Task 2: Bounded one-backend private composition

- [x] Add RED cases: extra args/wrong namespace/peer/env, late unrelated backend
  hidden by a cached activity snapshot, session population crossed,
  physical/backend drift, concurrent close during each awaited phase, callback
  failure, expiry and ambiguous cleanup. No ambient DB socket can be opened.
- [x] Implement fixed private scope plus actual existing physical/single-backend
  primitives; retain session/transaction/lock through callback, permanent revoke
  around all awaits and before cleanup. Record control obligations before await;
  capture primary+TEMP-DROP+rollback/unlock errors without eligibility restoration.
  Allow bounded sequential recheck; reject concurrent/reuse-after-settlement.
- [x] Run GREEN + transport4/physical5/backend7 and baseline15; strict source TS.

### Task 3: Actual protected PG31 positive/revocation rehearsal

- [x] Add explicit held-PG31 opt-in requiring protected-PG AND native opt-ins;
  default mode creates no new fixture, connection, filesystem or root action.
- [x] Test-only entry extracts literal ordinary base DDL from actual db-pg AST;
  rejects missing/dynamic/wrong topology. Uses existing automatic source migration
  API and verifies guardedPending32/head31; no ambient harness/test32 evidence.
  Apply source automatic1–31 first on the empty DB, then every extracted base52
  statement unchanged, matching pgMigrate source order. Installing the ordinary
  claim indexes first is partial migration5; the first actual rehearsal proved
  this refusal. The setup-order regression must prevent that inversion.
- [x] The real second attempt is RED for frozen owner-only ACLs: extra SELECT
  grants cannot satisfy V27/V28/V29. Add an actual-setup-body boundary regression
  rejecting setup as task6a_owner or any table/function/column ACL grants.
  Keep disposable DB/original postgres probe owned by NOLOGIN task6a_owner;
  trusted admin temporarily grants public-schema CREATE/USAGE to task6a_runtime,
  SET ROLE task6a_runtime for unchanged automatic1–31 then base52, RESET ROLE,
  revoke schema CREATE. Verify journal/source ownership, runtime role flags,
  denied schema CREATE and absent owner/admin membership. No roles/HBA changes.
  Document that this is owner-class diagnostic authority outside READ ONLY,
  not least-privilege runtime, production origin or excluded-writer evidence.
- [x] Verify test honesty: callback assertions cannot satisfy outer rejection;
  capture refusal/restore outcomes and assert outside. Actual child probe catches
  only API rejection and propagates AssertionError trees rather than reporting
  test failure as refusal. Setup retains primary plus all distinct revoke/close
  failures and attempts both owned cleanup actions. Literal-probe restored-success
  and actual-setup-body cleanup failures must each observe RED then GREEN.
- [x] Prepare disposable setfarm DB via the trusted scoped setup actor.
  Observe same real backend and complete source31,
  cold-catalog/census, actual retained Node/backend native images. Add real
  denial/revocation probes and definite close/cleanup evidence.
- [x] Independent read-only source review clears exact changed privileged files.
- [x] Run actual third-opt-in command with all three=1,0 skips; record exact root/
  PIDs and all real outcomes including failures. Any uncertainty retains exact
  tree; never blindly rerun/clean. Independently verify exact safe terminal absence.

### Task 4: Scoped delivery and clean-main host proof

- [ ] Fresh-head cloud P2 on8320522 found the inner30s audit clock also checked
  callback settlement, incorrectly refusing legitimate30–60s retained evidence
  collection. First add real-composition/shared-clock regressions:35s and59999ms
  total invocation can settle;60000ms and audit31s must refuse. Observe RED for
  the positive cases. Remove only post-callback audit-deadline checking; retain
  30s setup/preflight/full31/admission and the existing active outer60s through
  all cleanup. No new deadline parameter, renewed clock or frozen helper edit.
  Verify pure/source contracts, independent exact-byte review, then rerun the
  actual protected fixture because privileged source bytes have changed.
- [x] Cloud P2 on562a276 found the lifecycle file was absent from the advertised
  npm-test chain. Add tests/evals/package-scripts.test.ts coverage that resolves
  reachable npm-run commands and then executes the selected real lifecycle leaf
  under a bounded no-ambient child; observe missing selection RED before wiring
  existing pure diagnostic script into test:internal-production. No privileged
  fixture command/flag becomes a default. Verify GREEN plus all diagnostic tests;
  no unrelated all-tests/PG effects are needed to establish this registration.
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
Baseline15PASS0fail/skip. Implementation now exists; diagnostic boundary tests
46PASS/0FAIL/0SKIP. The first actual attempt correctly rejected inverted migration5
setup; the second correctly rejected extra SELECT ACLs. Both stopped/removed only
their proven disposable roots. The third owner-class actual attempt ran3PASS/
0FAIL/0SKIP,116.3s: full31/cold-census held positive, different-role additional
backend, backend loss, physical restoration/no revival and corrupt constraint
refusal. It stopped/removed its exact root Y9A81c; old evidence stayed untouched.
That run preceded the independently found probe AssertionError-masking fix:
renewed exact-byte review and a fourth actual run then passed3/3,0skips,
115.940525s fixture, exact root d6ZPhB stopped/removed with live paths untouched.
The fourth run used reviewed integration fb546e8c67801eae9743aa6b7dafd9fb7d5534624ef1ea7aa1954d8ecbcf98e4
and entry9a42bf2b3f1eeee8ab82e75660b612c89149e4afd27b34944d23957bcf3edda2.
Setup cleanup-primary masking was also fixed with three RED/
GREEN cases. Five pure revival tests now assert outside callback; an in-memory
wrongly-successful recheck mutation makes all five fail (no source file edits).
Fresh expanded69tests passed with no failures/skips. Separate source and strict
all-five-touched-test-file TypeScript checks exited0. All version/English/path/
migration-digest/12MC contracts and diff checks passed before delivery.
Strict test TypeScript exposed a post-fourth-run narrowing error in the test-only
AST extractor: express its always-throwing refusal as `return refuse()`.
Independent review verified this single-line runtime-equivalent change and old
hash reversal. Actual run used old extractor cd54bb0e; final source is7bb66331.
In-memory old/new complete literal52 SQL bytes are identical, SHA256
2b9aca28a53a7f40dc97c4ed8c52a3a11f37ddf7592e6d8115a9bd16a5fb6729;
both still refuse dynamic/missing source. Fresh expanded69 and strict tests were
rerun after this compiler-only correction. No extra privileged rerun inferred.
Production authority, origin/genesis, live writer exclusion and32/33 are pending.

Cloud-review registration refinement: default-graph test observed missing
selection RED; pure-only default registration then eval+diagnostic48PASS and
expanded census/socket/physical/backend71PASS,0fail/skip. The bounded selected
lifecycle leaf actually passed once in a clean-env child; inherited
NODE_TEST_CONTEXT was removed rather than allowing a silent empty runner.
Strict eval TypeScript, English/path and diff checks passed. Independent
four-file incremental review cleared package/eval/spec/plan; no source, protected
fixture, entry or native bytes changed. Fresh-head cloud clearance is still
required; initial562a276 completion cannot clear the follow-up commit.
