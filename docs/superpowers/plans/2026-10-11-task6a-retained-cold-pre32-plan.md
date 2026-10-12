# Retained cold-pre32 implementation plan

> Agentic workers: use root-only manual execution for this tightly coupled change
> and independent read-only task/whole-diff reviews. Standing single-writer rules
> override implementer delegation; no faster model or workspace cleanup.

**Goal:** Refuse phase drift on the same held pre-cutover backend.
**Architecture:** Shared exact absence body plus retained lazy canonical31 owner;
same genuine reservation/read-only transaction; original rollback/close custody.
**Tech Stack:** TypeScript5.9.3, postgres3.4.8, real private PostgreSQL17.
**Spec:** `../specs/2026-10-11-task6a-retained-cold-pre32-design.md`.

## Global constraints

Execution ordering: queued while root delivers the independent native-close and
revoked-holder lifetime corrections on a separate main-based branch. The
aggregate branch is preserved; neither that source integration nor its standby
build proves this cold-phase task or permits live cutover. Resume this task after
the single-writer handoff, retaining all original custody and review gates.

Root sole writer. Preserve worktrees/protected pair/live ports3080/3333/18789.
Disk floor8GiB. No account/security/grant changes to live host. No31/33 identity
copy, frozen migration-region change, caller-supplied authority, runtime bypass,
timer-induced custody release or stock-build claim from noEmit.

## Task1: One independently reviewed cold-phase composition

### Prerequisite: finite bootstrap source-closure integration

The genuine merged fixture run on 2026-10-12 failed 7/218 cases. Four census
fixtures rejected two real script inputs in the compiler metafile; three healthy
host cases refused the launcher's static adapter import. This root correction is
causally necessary to qualify the aggregate before cold-phase implementation;
it is not a new rollout permission or cold-phase RED result.

File Map: `scripts/deployment-cutover.mjs` adds only the existing adapter to its
Git-authenticated executable closure; `scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs`
copies that same script and recognizes exactly adapter plus retention in census
metadata, keeping them outside TS-to-dist transformation. New
`scripts/__tests__/deployment-cutover-bootstrap-inputs.test.js` and existing
`scripts/__tests__/deployment-cutover.test.js` cover unchanged
bytes, missing/tampered/foreign adapter edges and actual cross-observer fault
reach. The paired spec and external ledger retain capture identities and limits.
Shared adjacent File Map: `tests/internal-production/cutover-feature-branch-bootstrap-fixture-v1.ts`
adds only the same adapter and existing process-event `.mjs`/`.py` to copying,
without changing the source-build companion's expected stage. Four existing
bootstrap consumer tests are verified; no package command change (ordinary
test:scripts glob already covers the new JS test).

- [x] Witness strengthened cross-observer behavioral RED against the unchanged
  authenticated closure; an earlier loader refusal is not fault-arm evidence.
  Natural child56570 code1/null,3 intended-reach assertion failures, raw4745B
  SHA78536c04134dda43b5678505810042b5126060c852ff339cd849aba8f647fc3e;
  root and independent terminal custody audits passed (not test qualification).
- [x] Correct finite source/copy membership without a wildcard resolver allow.
  Focused original58638 code0/null,37/37 pass. Shared-helper original64357
  code1/null,4 wrong-stage assertion failures (source-authentication versus
  source-build), raw6126B SHAa2c2fc1c9774cfeda2fa250960c29d372c17ed4508f44e20efb0642ad95fd762.
  This separate behavioral RED precedes the exact three-member copy fix.
- [x] Verify intended host/census healthy companions, negative source guards,
  permissions and process-event DATA controls; then actual-source strict noEmit.
  Full original65433 code0/null,252/252 pass,0skip/cancel/todo; original21292
  code0/null,actual TypeScript5.9.3 roots852/files1202/diagnostics0/noEmit.
  Root and independent4380 current source/tool/copy pin audits match; exact
  membership2188 and sole dependency binding match. Receipt4569332B
  SHA325d2fc212d105d2b44b88842c6eae9a2dc044d201a1f4400359294f7204093d;
  minimum sampled free10867150848B. This is not stock build or native cold proof.
- [x] Two independent read-only exact-diff reviews before aggregate merge commit.
  FULL19-path binary diff585b71f6ae42013658811986080515fd7079a07db0a3a16f9523479e9ac734c6,
  C0/I0/M0 from both reviewers. This additive terminal record changes only the
  plan after captured source-custody release; no retroactive pin qualification.

Files and interfaces are exactly the spec File Map. Existing
`verifyHeldPre32ContractSpineJournalIdentityV1(query)` remains unchanged, where
`query(statement:string,parameters:readonly number[]):Promise<readonly unknown[]>`.

- [ ] Add failing modeled composition/import lifetime controls and real producer
  guard tests; new cold producer must reject nonzero/extra/missing/duplicate rows.
  Example: `await assert.rejects(cold(port([{laterJournalCount:'1',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}])))`.
- [ ] Run focused RED using actual Node and read-only dependency resolver. Missing
  cold/journal calls must fail behavior assertions, not accidentally pass setup.
- [ ] Extract existing tagged absence SQL unchanged into new inert leaf, using
  `transaction.unsafe<Array<Record<string,unknown>>>(literalSql)`. Delegate the
  old census helper; update copied-source tests to bind the real leaf and route
  its unsafe query through their explicitly modeled query boundary.
- [ ] Add retained lazy canonical verification after existing owner check:
  `held.recheck(); const loading=import('../db/contract-spine-migrations.js'); originals.push(loading); const owner=await loading; held.recheck(); await owner.verifyHeldPre32ContractSpineJournalIdentityV1(async (sql,parameters)=>await transaction.unsafe(sql,[...parameters])); await requireColdPre32CatalogAbsenceInTransactionV1(transaction);`.
  Keep original import occupied until settlement, even on reporting/refusal.
- [ ] Verify focused GREEN, pending import/reentry/refusal and ordinary census
  lock/call-order regressions. Prove emitted canonical initialization is lazy and
  newly reachable side effects are only the reviewed canonical owner graph.
- [ ] Extend actual private fixture with checksum32/33/catalog phase controls;
  require intended actual journal/cold rows and healthy companions before/after
  restart. Exact owned admin restore must not run on uncertain child completion.
- [ ] Capture final exact source/native/strict/adjacent evidence,8GiB reserve,
  original natural close; run version/English/path/migration/MC contracts.
- [ ] Two independent read-only final reviews; fix findings and reverify bytes.
- [ ] Root conventional commit/push to existing PR280, evidence checkpoint; keep
  draft until full integration/release gates, and continue remaining safe work.

Self-review: one coherent task shares the bracket/leaf/native interfaces; source31
and cold32/33 absence are complementary, not competing head expectations. No
positive controller, full application grant matrix, genesis or rollout is invented.
