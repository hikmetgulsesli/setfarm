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
