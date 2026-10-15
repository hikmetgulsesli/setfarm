# Restore the receipt test fixture's genuine cold-census composition

Historical preparation status (superseded by the current application checkpoint below): UNRUN. Base `4272a9850f7efa82821fbeab43e9d66910e78d6a`. Original93607 remains active with its source frozen. Do not apply this candidate or run anything while that owner remains active. The actual exception cause is not yet observed in the retained bounded prefix, so this is a source-proven fixture mismatch to compare with the eventual final reporter, not a synthetic RED or a final root-cause claim.

## Causal evidence and scope

The original93607 bounded first92-frame snapshot reports18/18PASS and12/12PASS for the first two isolated files, then failures in two receipt callbacks: `cold recovery joins real prepare to sealed direct rebind without relaunching on replay` at16507 and `cold recovery compiled controller completes the real cold observation without publishing` at16601. Their local child stderr is supplied to assertion objects, but the source creates no separate child intent/result receipt; no exception is yet printed in that prefix. Owner subsequently reported five further failing callbacks at18347,18379,18403,18429,18455; that later progress is owner-reported here and is not credited as an independently decoded final result. All five call `createLegacyDatabaseCensusFixture`.

Static source establishes two narrow fixture gaps:

1. `createLegacyDatabaseCensusFixture` copies the genuine `baseline-legacy-database-census-v1.ts` into a fresh private ordinary test tree. That source now has an unconditional runtime import of `./task6a-cold-pre32-catalog-readonly-v1.js`. Neither this creator nor `ensureBaselinePostHandoffImportSupportV1` supplies it. Existing type-only imports do not require new runtime copies. The finding-publication validator already resolves to the maintained real source tree by absolute file URL; its original dependency closure stays intact.
2. `legacyDatabaseCensusSqlTransportFixtureV1` only models tagged calls plus `begin`/`end`. The maintained genuine cold producer calls `transaction.unsafe` once, with its fixed SQL string and no parameters. Its SQL selects aggregate string counts for the later journal, relations, functions, types and triggers. The old third-tagged-call cold branch therefore models the obsolete transport. The genuine guard's strict row/value checks must remain intact.

The public receipt-private zero-input wrapper remains correct: it passes its own fixed environment database URL and the boolean cold flag into the maintained census function. No production zero-input contract or guard needs changing.

## File Map — two test/docs paths only

- `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`: only the shared test transport and the missing copied genuine dependency. Every existing test callback body and assertion remains byte-identical outside those two helper regions.
- `docs/superpowers/plans/2026-10-15-receipt-cold-census-fixture-plan.md`: this causal relation, original evidence and qualification limits.

No `src` file, SQL producer, guarded refusal, controller, package alias, private runner, service, role, migration journal, source authority or runtime admission change. No broad fixture redesign or new producer interface.

## Exact candidate

Copy the maintained genuine `task6a-cold-pre32-catalog-readonly-v1.ts` into the same fixture-relative location. Preserve its complete code and its dependency imports. Its only additional source import is type-only, so there is no runtime recursion to invent.

The existing shared SQL transport reads the maintained cold producer as source data and requires exactly one fixed unsafe SQL literal. Its modeled `unsafe(...args)` checks construction, active read-only transaction, no prior close, cold mode, exactly two preceding timeout calls, exactly one argument and exact full statement equality. It then preserves all existing catalog-token checks and returns the unchanged modeled raw five-field count rows (`laterJournalCount`, `relationCount`, `functionCount`, `typeCount`, `triggerCount`) to the genuine guard. There is no precomputed allow boolean, stubbed guard, reordered aggregate, fake native result, swallowed refusal or permissive path.

Existing counter sequence remains: timeout1, lock-timeout2; cold unsafe query3; ordinary aggregate4 and finding reads5–7. The non-cold sequence remains aggregate3 and finding reads4–6. Existing end/connection construction/notice suppression/query-budget assertions stay unchanged. Existing malformed/empty/nonzero catalog-row tests continue exercising the genuine guard before the ordinary aggregate.

Reference compatibility was read, not executed: `task6a-cold-pre32-catalog-readonly-v1.test.ts:11–22` requires one unsafe query with undefined parameters and the same five string-count fields. `findings/repository.test.ts:213–218` similarly keeps the genuine leaf and models its unsafe row port. These helpers supply aggregate catalog rows, not separate regclass/proc/trigger tuples; this candidate deliberately preserves the actual ABI rather than claiming native SQL execution.

## Both callback groups

`finalizedColdRecoveryControllerFixtureV1` already follows static relative import/export edges recursively and compiles the actual source closure. It therefore already includes the genuine catalog producer. It injects this same `legacyDatabaseCensusSqlTransportFixtureV1` into the compiled census source. Correcting the shared transport covers that code path without a second SQL double or guard modification. The five legacy-census callbacks additionally need the explicit missing file copy because their tree is assembled non-recursively.

This relationship is statically demonstrated. Attribution to original93607's actual failures remains conditional until the original reporter's final exception messages agree; a different exception must be investigated as a separate cause, without relabeling it or applying this candidate on assumption.

## Verification and sequencing

1. Preserve the active source freeze until original93607 naturally terminates and its exact strict terminal/raw/outer result is paired. Audit actual unique callback failures and their detailed exceptions. A model/stream failure is not a test failure.
2. Only if the original errors match the missing dependency and/or missing unsafe seam, root records that genuine RED and applies this two-path test/docs candidate after terminal. If they do not match, keep this candidate UNRUN and narrow the actual cause first. Do not synthesize a missing-export RED or dispatch another case just to manufacture evidence.
3. Root selects the exact seven existing ordinary source-fixture callbacks for focused GREEN using the maintained Node test-name filter, with DB URL inputs absent. The primary owner must confirm the ordinary loader/setup reaches the requested callbacks and the completed reporter reports all seven selected names. No arbitrary wrapper grammar or old private PG root is needed or allowed for these source-fixture tests. Capture actual child/result/raw evidence; a loader/setup failure is not intended coverage.
4. Independently review the helper-only delta, genuine unchanged guard and all seven callback outcomes; cheap proportional syntax/diff checks remain required. If a new positive path exposes another genuine dependency contract, refine this causal File Map before further implementation. No test or compiler has been run by this preparation.
5. A later complete receipt file/remaining-owner qualification must use a fresh maintained owner and a reviewed clean source checkpoint. Original93607's failed receipt aggregate is never relabeled PASS by focused GREEN, and later unrun files/manifest remain pending until actually observed. This candidate adds no new alias or continuation selector.

## Limits

This is test-fixture composition and modeled SQL transport repair only. Actual test file IO, TypeScript transpilation and generated ordinary child execution in future GREEN do not establish native PostgreSQL behavior, migration32 authorization, real owner/fence genesis, a dependency/material freeze, Root/TCB/loaded-image/runtime admission, PM2 qualification, family closure or whole-project completion. No source/SQL guard is bypassed or made permissive. Original terminal/cleanup and later coverage must be audited independently.

## Checklist

- [x] Shared fixture/dependency/query contracts inspected read-only.
- [x] Outside-only minimal test helper delta and causal plan prepared.
- [ ] Same-original93607 final exceptions and terminal audited against the hypothesis.
- [ ] Root applies only after active campaign terminal and matching genuine RED.
- [ ] Exact seven existing callbacks complete focused GREEN with retained originals.
- [ ] Independent helper/source/evidence review and clean scoped delivery.
- [ ] Remaining complete source/alias coverage independently qualified.


## Exact direct selectors and no-P3 setup proof (preparation refinement)

Read-only source/AST validation: `focused-selection-static-validation-v2.json`, SHA256`bc5605e4f06607b5b5b244c3248be5e46af5f7334a89cb25f6dcefe63bc027c5`,23 successful static assertions/0 failures. No target module was imported or evaluated and no test/producer was dispatched. The historical v1 audit omitted literal string `.repeat` from its constant-data allowlist; it is preserved separately, with no source/test mutation or execution used to correct that audit.

The receipt test file imports only the normal Node modules, esbuild and the pure maintained owner-admission core. Its postgres import is type-only. There are no before/beforeAll/after hooks. The complete module-level call inventory is path construction, import.meta.resolve, literal array/string data construction, Object.freeze/fromEntries and it/describe registration. The only P3 authentication is inside the private optional loader at17679; its call sites at19430,42738 and42747 are all in separately excluded callbacks. These selected callbacks neither call that loader nor request a genuine PG connection. Both source fake-SQL compositions substitute their own fixed transport and sentinel URL; the compiled fixture's HTTP/service transport is explicit modeled data.

The selected callbacks are ordinary source-fixture tests, not pure computation. They create private files/Git repositories, run their reviewed build-info fixture producer/transpilation and child Node programs; the joined cold test can create and terminate its own fixture spawner/helper under the existing identity checks. This preparation does not execute or adopt any of those processes and gives no live-service or PG authority.

Seven affected existing callbacks, exact direct command after original terminal + matching exceptions + applied reviewed fix:

```sh
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test --test-concurrency=1 '--test-name-pattern=^(?:OA17 zero-input current Setfarm source/build observation )?(?:cold recovery joins real prepare to sealed direct rebind without relaunching on replay|cold recovery compiled controller completes the real cold observation without publishing|cold legacy census authenticates pre-32 absence before the ordinary read-only aggregate|cold legacy census preserves aggregate refusal through connection cleanup|cold legacy census refuses every later catalog owner before reading the ordinary aggregate|P4 legacy census rejects a nonzero open claim instead of synthesizing zero|P4 legacy database census rejects every live predicate and malformed aggregate)$' tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
```

The optional literal suite prefix permits the exact known immediate/full Node test-name spellings; it does not introduce a generic selector. Static matching against all925 expanded receipt registrations selects exactly those seven, with no extras. Actual future reporter names/counts still must confirm reachability and status. Nonselected exclusions are not PASS. No new inner-runner grammar or private PG server/root is required.

Proportional shared-helper verification should select13 existing callbacks, consisting of the eight compiled-fixture users plus all five legacy-census fixture users. This covers every caller of both edited helper regions without replaying all925 receipt registrations. The six additional compiled-fixture users are:

- `cold recovery compiled fixture authenticates its retained source and rejects output drift` (parent helper call line16320).
- `old exact-poison preparation refuses absent spawner at the unchanged four-service census` (parent helper call line16419).
- `cold recovery compiled V31 verifier authenticates raw catalog rows and refuses constraint or seal drift` (parent helper call line16625).
- `cold recovery compiled PBA transport returns strict current source evidence` (parent helper call line16650).
- `cold recovery compiled controller pins its real launch inputs before any child exists` (parent helper call line16666).
- `cold recovery compiled children refuse unauthenticated inherited roles before startup` (parent helper call line16687).

Exact direct13-callback command, under the same prerequisites:

```sh
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test --test-concurrency=1 '--test-name-pattern=^(?:OA17 zero-input current Setfarm source/build observation )?(?:cold recovery compiled fixture authenticates its retained source and rejects output drift|old exact-poison preparation refuses absent spawner at the unchanged four-service census|cold recovery joins real prepare to sealed direct rebind without relaunching on replay|cold recovery compiled controller completes the real cold observation without publishing|cold recovery compiled V31 verifier authenticates raw catalog rows and refuses constraint or seal drift|cold recovery compiled PBA transport returns strict current source evidence|cold recovery compiled controller pins its real launch inputs before any child exists|cold recovery compiled children refuse unauthenticated inherited roles before startup|cold legacy census authenticates pre-32 absence before the ordinary read-only aggregate|cold legacy census preserves aggregate refusal through connection cleanup|cold legacy census refuses every later catalog owner before reading the ordinary aggregate|P4 legacy census rejects a nonzero open claim instead of synthesizing zero|P4 legacy database census rejects every live predicate and malformed aggregate)$' tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
```

The direct parent commands explicitly unset both database URL variables. Run from the canonical reviewed checkout with ordinary maintained tsx loading and no inherited private preload. They are future primary-owner recipes, not actions taken by this preparation. No stale private root, live5432 connection, P3 capability adoption, source-clean bypass, production/SQL-guard change or global qualification follows from the static route proof. Full original93607 and any later remainder still need their own actual results.

## Current application checkpoint — 2026-10-15

Original93607 naturally ended:973 actual tests,966PASS,7FAIL,0 cancelled/skipped/todo. Receipt reporter943=936PASS7FAIL includes925 source callbacks and18 separately accounted nested tests. Actual outer1d4ee2 exit1 matches the strict1059-frame terminal, six EOFs, own init/test/server0/1/0, two positive quiescence samples and admin/server closure. Independent final audit3214checks/0findings SHA256c68c6497804bf27bbf3125b9006dcb735fdf87e4c0fbc79986eade0d1e594cd4 confirms evidence consistency. This original remains FAILED7, with the six later files UNRUN.

Five final exceptions directly show the missing genuine catalog module. The first two directly show WRONG_DATABASE_QUERY_COUNT in the fixture end method. The missing unsafe call beneath that cleanup error is SOURCE INFERENCE: the genuine cold path calls transaction.unsafe after two timeout tags; the old fixture lacks it, and its finally/end accepts3/4/7 calls, masking an earlier failure at2. No direct unsafe TypeError is claimed. The observed counter mismatch and exact source path justify the shared transport repair; focused GREEN must still verify the hypothesis.

After clean reviewed XS5 deliverya6fdee873184167ddbed38841b31bc65ad50772b, receipt source remains4043517B/e22d2a81. Root applies exact reviewed helper-only candidate4044472B/b6c25c62 and this reconciled plan. Production source, SQL guards, registration and callback assertions remain unchanged.

Run ONE proportional13-case selection from focused-selection-static-validation-v2.json SHA256bc5605e4f06607b5b5b244c3248be5e46af5f7334a89cb25f6dcefe63bc027c5, unsetting both PG URL variables. All7 failures plus6 additional helper users are selected. No separate seven-case replay or full healthy receipt replay is needed. Focused results and final current review remain pending at this checkpoint. Nonselected callbacks receive no fresh credit. PM2 remains owner-closed UNRUN and is never selected.


## Actual focused result

ONE original64675 naturally completed with actual tool1e3426 exit0:13tests,13PASS,0fail/cancelled/skipped/todo,1suite,306688.261958ms. Each exact nominated title appears once; stderr is empty. All7 failed original titles now pass among these13 helper users. Raw stdout3600B SHA256986da317c3226460a003ea1b9727e08aa3289ef06845e2fc4fd9cc023a341cf8 is retained with actual-green-receipt-v1.json SHA2569e2fa99dc712fbc591ccc694c27492bb7c7e3a05894a42447361ad7e043c3a80. No separate7-case or943-case replay.

Original93607 remains973=966PASS7FAIL; later six files remain UNRUN. The healthy original13 verifies the helper repair without directly reconstructing an unretained unsafe TypeError. Final current two-path review and scoped normal delivery remain the next checkpoint. No actual PG, native/Root/TCB or liveSetfarm qualification is inferred.
