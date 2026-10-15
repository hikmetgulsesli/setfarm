# Ordinary migration 33 current-entry observers implementation plan

> **Root preparation checkpoint:** Tests and literal routing are now applied on e4c0acb2. Modeled selector RED and all14 new modeled controls are observed; the separate existing owner-inventory expectation was updated for the one new enrollment and passes. The original217-test modeled run remains216PASS1FAIL; its exact repaired callback then passes1, giving217 distinct composed controls. Both actual DB leaves remain UNRUN and db-pg.ts is unchanged. Root is the sole writer/producer; the original outside-preparation notes below are historical.

**Goal:** Prove and fix the two current-entry observers that reject a legitimate engine-adopted ordinary33 row, preserving guarded32 applied-only and every source/catalog/admission requirement.

**Architecture:** First deliver one literal fresh-cluster selector plus the two regression leaves in a reviewed clean preparation checkpoint. The maintained outer owner creates a fresh SCRAM PG17 cluster and supplies its generated admin input to the existing P3 wrapper. That wrapper creates the authenticated FD3/prepared-operation test realm. Only after the actual two-leaf DB RED does root change the two33 predicates, checkpoint clean, and run a second fresh same-mode GREEN. No borrowed server, generic command, URL, new inner grammar or migration-engine change.

**Tech Stack:** TypeScript ESM, Node test runner, existing private Postgres owner, authenticated P3 projection.

**Spec:** Task6A ordinary33 apply-or-exact-adopt contract in docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md:19,8218. Engine adoption at src/db/contract-spine-migrations.ts:17506,17655; offending current-entry checks at src/db-pg.ts:5877,5940.

## Final File Map: exactly six paths

1. Modify `scripts/run-private-postgres-tests.mjs`: add only literal mode `migration33-observers` to both closed enums (planner19 and main307); add one fixed test-argv branch using the existing receipt-mode inner-wrapper pattern. Creation, root/port/password/SCRAM/identity/8GiB/clean-source guards, redaction, journal, own-child custody, quiescence and cleanup code remain unchanged.
2. Modify `scripts/__tests__/private-postgres-test-cluster.test.js`: literal plan/refusal tests; teach the existing wrapperBoundaryFixture expected-argv table and its command-mode loop the new literal mode. Reuse its normal/nonzero/mirror/journal/close/retained-DB/cancellation/before-dispatch/attach/input-error controls. These are explicitly modeled ordinary boundary tests, not DB or32 evidence.
3. Create `tests/execution-attempts/migration33-current-entry-observers.test.ts`: the prepared exact2-leaf candidate (SHA9ce25bb675aa208d17ce3ad4c81646f8915298087fdd1b5f72bf3325b778fc69). It authenticates the existing P3 capability before DB acquisition, uses the existing zeroarg32 capability and actual engine adoption, then exercises each real observer independently.
4. Modify `scripts/run-execution-attempt-tests.ts`: add only `migration33-current-entry-observers.test.ts` to OWNER_BACKED_TESTS. The existing package `test:execution-attempts` already discovers all .test.ts files; this literal enrollment routes the new file through its existing authenticated wrapper in the regular matrix. No package.json/internal-production alias change.
5. Create this causal plan at `docs/superpowers/plans/2026-10-15-migration33-current-entry-observers-plan.md`.
6. Modify `src/db-pg.ts` ONLY AFTER actual DB RED: admit applied or adopted in the two ordinary33 predicates. Leave all32 checks, exact name/checksum/catalog/full verifiers, startup and default-deny entry guards unchanged. No implementation candidate is prepared before RED.

## Projection and ownership facts

- Initial inspected base was0ab1756ae8792d3f2afe5641cc98daf9c15d6c37. Main92d4ec330014373ec5e27b69d359163997502dce has the same applied-only33 guards.
- Outer preconditions at run-private-postgres-tests.mjs:212–214 require a completely clean worktree, including no untracked paths. A dirty added test or doc cannot reach PG creation; do not suppress that guard.
- P3_TRACKED_SCOPE at run-isolated-postgres-tests.ts:42 is a permitted dirty-tracked-byte exception set, NOT a projection membership list. projectCurrentBytesV1:308–338 reads every `git ls-files --stage -z` entry and copies all stable tracked members; non-exception members must match indexed blobs. assertSourceScopeV1:209–220 refuses every untracked path and dirty tracked paths outside that set.
- Therefore a new test committed clean is copied without P3_TRACKED_SCOPE enrollment. No edit to scripts/run-isolated-postgres-tests.ts is required or nominated. Neither new test/docs nor owner runner are permitted to remain dirty during the outer run.
- The six-cell inner grammar is unchanged. The new file must exist as a clean tracked member before the fresh cluster run. The two leaves explicitly authenticate the existing P3 test FD3; missing/forged/absent capability is a setup failure before DB acquisition, not intended RED.
- No closed11088/82075/other PostgreSQL root is selected, scanned for credentials or adopted. Live5432 is never an input. The root owner creates a NEW cluster for each RED/GREEN invocation below.

## Exact new fixed selector

The outer sole positional mode is literally `migration33-observers`. Its fixed `plan.test` is exactly these ten cells:

```json
[
  "--import",
  "tsx",
  "scripts/run-isolated-postgres-tests.ts",
  "--",
  "node",
  "--import",
  "tsx",
  "--test",
  "--test-concurrency=1",
  "tests/execution-attempts/migration33-current-entry-observers.test.ts"
]
```

No argv, filename, selector pattern, URL, root, command or SQL is supplied by the caller. The existing main creates `/tmp/setfarm-task6a-pg.<fresh>` with a newly generated credential; plan.initdb/server remain byte-identical to other modes; only main's internally constructed testEnv supplies SETFARM_TEST_PG_ADMIN_URL and the actual data directory.

The root-owned invocation from the exact clean checkpoint is:

```bash
/opt/homebrew/Cellar/node/26.4.0/bin/node scripts/run-private-postgres-tests.mjs migration33-observers
```

Run it through the existing original-PID/full-raw terminal capture with a fresh ordinary three-key PATH/LANG/LC_ALL environment. Do not supply ambient PG URL variables. This outer command, rather than an independently called inner wrapper, is the concrete owner of the fresh admin server.

## Sequence A: selector/preparation TDD and clean delivery

- [x] Reconfirm original63046 final FAILED1/strict-cleanup records and the separately completed owner-fixture1/manifest18 results; freshly verify clean e4c0acb2ff788f64edb18c9986d37484b1247456 and completed delivery readback. Root may then add the unchanged candidate2-leaf file, this plan and new modeled selector assertions only. Keep both the outer runner and db-pg.ts unchanged until their respective eligible modeled/actual RED checkpoints. These preparation tests and both DB leaves are still UNRUN.
- [x] Before modifying the outer selector, run only the new ordinary modeled pure-plan test against existing source: actual plan(migration33-observers) must refuse PRIVATE_TEST_CLUSTER_PLAN_INVALID. This is the selector's causal modeled RED, not DB regression RED. A syntax/import error is not accepted.
- [x] Add the literal outer enum entries and fixed argv branch. Update only wrapperBoundaryFixture's expected fixed argv and include the new literal in the existing modeled boundary mode table. Add malformed/extra caller input assertions that require refusal before any cluster effect.
- [x] Validate the modeled selector/boundary controls and unchanged existing modes, plus existing isolated-command parser regressions. Require fixed10-cell argv, unchanged initdb/server arrays, frozen results, ordinary test failures propagated, cancellation/uncertainty refused and no modeled native/DB effects. No PG producer yet.
- [ ] Add the one OWNER_BACKED_TESTS enrollment. Independently review the five-path preparation slice and preserve exact source/test/model pins. Root makes a normal clean checkpoint of these five paths on the sole branch; db-pg.ts remains byte-identical. This may contain the deliberately not-yet-run regression, so report it as test/selector preparation, not passing feature qualification. No generic success or clean-build bypass.

## Sequence B: actual original DB RED before production fix

- [ ] Read-only verify exact clean tracked checkpoint, mode/material/source pins, adequate disk and no previous owned producer. Call the one fixed outer command above through the owned recorder. It must create a fresh private cluster; root retains its original exit/close/EOF and strict journal.
- [ ] Both leaves must reach real source-known engine adoption33, fully verify it as current, assert applied32 and before/after journal identity, then reject at their respective existing observer with INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_33_INVALID. Require exactly2intended failures, not capability/marker/import/setup failures. No fake32 body or live database is used.
- [ ] Consume the same-original natural terminal: testCode1, complete journal/EOF/exit/close, two successful quiescence samples, adminEnded/serverClosedtrue. If cancellation or uncertain ownership occurs, preserve refusal; do not adopt that root or call it RED qualification.

## Sequence C: minimum fix and separate fresh GREEN

- [ ] Only after the actual DB RED, root changes the two ordinary33 predicates. Do not alter the engine or digest owners,32 applied-only guards, exact names/checksums/catalog checks, loader, P3 grammar or source guards.
- [ ] Independently review that two-line diff and run cheap applicable source checks. Root records a normal clean fix checkpoint before the next outer invocation; the outer clean-source guard cannot be bypassed to run a dirty fix. The2-leaf test stays byte-identical across RED/GREEN.
- [ ] Invoke the same literal outer mode again, creating a SECOND fresh owned cluster. Require exactly2PASS/0FAIL/SKIP/CANCEL/TODO, legitimate engine-adopted33 observations, unchanged32/33 journal identities and genuine full catalog verification. Require the natural original terminal and verified private cleanup.
- [ ] Run proportional adjacent existing checks for exact33 adoption, partial/malformed33 refusal, newer journal refusal and forged-adopted32 refusal; source/diff/contracts checks; record source/migration/digest bytes. Never count excluded cases as PASS.
- [ ] Review the complete six-path final pins and actual records before normal scoped delivery. No native/Root/runtime/live migration or whole-goal qualification follows from this ordinary isolated regression.

## Historical outside-preparation disposition

Outside-only preparation remains UNRUN. The existing2-leaf test is unchanged; this plan supersedes the earlier incomplete inner-wrapper-only recipe. No active-repo changes, selector implementation, production fix, database connection or producer was made by this reviewer. Source inspection supports the concrete next route but does not certify future RED/GREEN results.


## Historical v5 continuation checkpoint

V5 was prepared against4272a9850f7efa82821fbeab43e9d66910e78d6a when ten modes
existed. Its eleven-mode candidate and review remain immutable outside the repo.
At that checkpoint93607 and heldXS restoration were pending. Those historical
conditions do not describe the v6 preparation parent. The prior inventory
correction was a valid old rebase and is preserved as historical evidence.

## Current v7 parent and preserved preparation

The current clean delivered parent is e4c0acb2ff788f64edb18c9986d37484b1247456.
The owner-barrier fixture repair is the separate two-path commit; root recorded
push tool3ed0730. PR body readback was pending98515 at this file-only preparation,
so root must finish that readback before active migration33 application. This is
not evidence that migration33 tests ran or that the entire old campaign passed.

Original63046 ended naturally FAILED1:310tests/309PASS/1FAIL/0other, with
507 sealed journal frames and matching original exit/close, six EOF, two ordered
quiescence samples, privateDbQuiescent/adminEnded/serverClosedtrue. Its sole
observed error was the missing genuine guard in the copied owner fixture;
manifest was not reached in that original. The independent final audit retained
1136 evidence checks with zero inconsistencies, not a passing campaign verdict.
After the minimal fixture correction, the exact selected owner callback passed1
and the separately invoked pure manifest file passed18, both with natural tool0
and empty stderr. These separate occurrences do not relabel original63046 or
replay its healthy309 prefix.

The v6 originals, their a2039 preparation context and independent review remain
immutable historical evidence. V7 copies the reviewed unit63893B/SHA
6b02fad4b50a6ecced01c13217d3e611d08d538bb08a89d9b539c7d3f3cb53d2 and
the real two-leaf regression4599B/SHA
9ce25bb675aa208d17ce3ad4c81646f8915298087fdd1b5f72bf3325b778fc69 byteexact.
No new test body, query, observer, assertion, authentication or fixture callback
was changed. Current context remains unit61024B/SHA
18bab3ce392f9daadb4f78a4242cabe293c11af8b800c4941db3beca4dcd81c3,
runner1df1bd520e03f7b929244c476db713e1fe8d08dd060c6dbd5f11dbc6f6fe1526,
package0d51b1abda36c80a8998658a8d1090c2a0e3601a8b9f0edda91473398b0e89f8,
and db-pg970f607f369ae146638d240e34d7a1f6e4c8d66b4da92c889bb8705e22861f99.

All eleven current modes remain in exact order: findings, all,
readonly-verifiers, receipt, after-scripts, after-terminal, after-findings,
after-internal-pure, after-local-custody, after-cutover, after-receipt.
Migration33-observers is appended as mode12. The unit still has the same five
edit sites in four logical groups: one fixed10-cell expected-argv branch, one
mode-loop append, two complete-inventory updates retaining the ordered11-prefix,
and one appended two-contract block. Reversing those sites recovers every
current61024 unit byte. Twelve new modeled boundary cases plus two contracts
are fourteen UNRUN cases. Both actual DB leaves and their RED/GREEN are UNRUN.

The final File Map remains exactly six paths above. This outside preparation
contains only the three test/docs paths. No runner, owner-filename enrollment,
package, P3 wrapper or db-pg implementation is prepared or changed. Root first
captures eligible actual modeled RED, then writes only the literal mode and
owner filename, validates modeled GREEN, reviews and delivers a clean preparation
checkpoint. Only that clean checkpoint can run ONE fresh authenticated two-leaf
actual DB RED on unchanged db-pg. Only eligible adoption33 failures permit the
two ordinary33 predicate changes, followed by a clean fix checkpoint and a second
fresh same-mode GREEN. Guarded32 remains applied-only; no P3 dirty-scope exception,
arbitrary target, borrowed DB root or source guard bypass is introduced.

## Selected-build dependency correction

The clean selected-main fetch/fast-forward is completed useful work. Selected
stock build, retention prepare-discard/resume, archive disposition and promotion
are not independent prerequisites that may be retried now. The selected plan
`docs/superpowers/plans/2026-09-28-operator-archive-abandonment.md`, revised fence
order, explicitly prohibits selected `npm run build`, live `prepare-discard` and
`resume` before independently verified continuous OS/DB exclusion, fresh
zero-owner evidence and reviewed protected finalized promotion. Preserve the
actual eight-generation build refusal and ordinal6 archive identity mismatch;
no retry, deletion, sanitation, guard override or archive adoption is nominated.
My earlier independent-build recommendation was corrected in the retained
`independent-selected-build-order-correction-v1.json` addendum. That correction
supersedes any old ordering claim; this ordinary isolated migration33 preparation
does not require a selected stock-build retry.

No runtime/native/Root/initial-TCB/V2/startup or whole-goal qualification follows
from these unexecuted migration33 preparations or the separately completed
ordinary fixture and manifest results.


## Actual modeled preparation and enrollment contract

Root first applied only the three reviewed test/docs paths (fc35e7), while the
outer runner and db-pg.ts remained exact. Actual pure-plan selector RED07dfd5
exited1: one test,0PASS1FAIL0other, exactly PRIVATE_TEST_CLUSTER_PLAN_INVALID.
Stdout920B SHA256de9d5b1928c775857e4c56b5fb1d43ff8d17d7542dc835de7493b7bf9bcb4bf8,
empty stderr. This is the routing RED only, not the future real DB regression.

Root then changed only both closed mode inventories, one fixed10-cell argv
branch, and the one OWNER_BACKED_TESTS filename. Package.json and inner P3
grammar remained unchanged. Syntax475df8 and diff8135b2 passed before models.

Original modeled run726472/session82334 naturally endedaf408b exit1. Its
217 tests (cluster214 plus existing isolated-parser3) report216PASS1FAIL0other.
All14 new migration33 controls passed exactly once:12 unchanged modeled
boundary bodies plus the2 new contracts. The sole failed old contract assumed
the entire regular owner inventory still had38 members. Enrollment legitimately
makes39 and moves the sorted run-terminal marker from14 to15; the fixed old
post-terminal suffix remains the exact same23 files. This was a test expectation
coupled to the old whole-inventory count, not a runtime/DB failure.

The added sixth unit edit site changes only that existing contract's count39,
marker index15 and suffix start16, and explicitly requires the new filename
exactly once. It preserves POST_TERMINAL_OWNER_FILES and all fixed package
commands. Focused original2bfc82 exits0: exact1PASS0other, stdout234B SHA256
a4cb94fcd6ccde70bd5b50397b009f2e737dc3f6ccc33393cfd076fabf03c689, empty stderr.
The failed217 aggregate is retained unchanged;216 healthy controls are not
replayed. This yields217 distinct composed modeled/parser controls, not218.
The prior14 new controls still have only one successful occurrence each.

The prepared v6/v7 unit copies and their five-site inverse remain historical
byte-exact records. Current active unit additionally contains the disclosed
owner-count contract hunk. This is within the same six-path File Map and is
causally required by the single owner filename enrollment. No production
database observer predicate, migration body/digest,32 state check, package
alias, startup guard, current V2 controller or selected build was changed.

Next: independent current five-path review, ordinary clean preparation commit
and delivery, then ONE new private migration33-observers cluster for actual
two-leaf DB RED. Both actual leaves must reach genuine32 applied/engine33
adopted/fullverified premises and reject only at their intended observer. No
db-pg.ts edit is permitted before that actual eligible RED and cleanup.
