# Fresh owner activation and runtime admission: Unit2b

Approved objective: a complete isolated fresh Setfarm and Mission Control installation; preserve legacy data for comparison. Same sole writer. No extra permission request for this in-scope implementation. Existing legacy Task6A/deployment and ordinary V3 product-release gates remain intact.

## Delivery and qualification order

Branch source tests cannot truthfully claim finalized clean-main activation. First deliver a reviewed headless implementation with entrypoints unwired and build guards closed. Prove strict data contracts, component protection/grants/CAS/rollback on owned real PostgreSQL fixtures, and real production API refusal of an unqualified branch before mutation. After reviewed merge, perform stock clean-main build and use the actual compiled dist API for one bounded owned fresh create/init/activate/verify and reservation/claim-readiness qualification. No fake build, legacy ready receipt, production test flag or Native experiment. Only then wire service/CLI/MC entrypoints and run the live workflow.

## Required behavior

1. Strict fresh source authority is a distinct schema in the owner-producer source authority union. It binds the validated installation origin to actual clean-main SHA/tree/finalized build hash, unchanged manifest A and owner registry/census hashes. Preserve exact authority pair/ref derivation; do not include invented legacy operation/PBA fields. Parsing is data validation only.
2. Both db-pg authority creation and resolution must branch. Fresh resolution checks actual selected/private or privately registered activation context, connected database identity/origin, canonical stored authority and actual current release; a new JSON discriminator alone grants nothing.
3. A headless activation controller owns its administrative connection, derives the new target from strict recorded identity, verifies loopback maintenance endpoint, committed schema, exact role OIDs and actual qualified release before effects. Register its exact owner transaction in a private WeakMap; expose no privileged handle. Reuse activation's existing immutable source/activation/head inserts, exact retry checks and null/current_revision0 to A CAS in a caller-owned transaction. Runtime may read activation tables, not publish them.
4. Install a source-owned fresh-only provenance trigger rejecting changes to head_payload.migrationApplication or migration_application_evidence_hash. Runtime head transitions may update only required transition columns; no head delete/truncate, evidence-hash update or broad provenance mutation. Legacy32 exact ACL/trigger metadata contract remains unchanged and fresh activated extensions have their own exact verification.
5. Grant the minimum business DML/sequence privileges used by actual runs, steps, stories, claim publication, runtime sessions, reservations/bindings/closures and admission authority inserts. Audit row-lock-only privileges separately; use nonlocking immutable activation reads where possible. Preserve existing immutable triggers and ordinary release admission. Published migration25 has unavoidable INVOKER `FOR KEY SHARE` reads of immutable preparation authority/claim rows; PostgreSQL requires some column UPDATE privilege for these locks ([SELECT documentation](https://www.postgresql.org/docs/17/sql-select.html)). Preserve its published functions, trigger mode and digests exactly. A narrowly reviewed fresh-only exception grants UPDATE(created_at) on v3_preparation_authorities_v2 and UPDATE(claimed_at) on v3_preparation_authority_claims_v2 only while the existing unconditional UPDATE rejection remains intact. Before granting, verify exact published ledger metadata/guards, owner separation, restricted roles and no session_replication_role SET privilege. Prove genuine trigger INSERT positives and filled-row no-op/changed UPDATE denial23514, DELETE/TRUNCATE/disable/function-replacement/replica denial42501 and unchanged rows. This is a causal compatibility fix for normal V3 claims; it grants no ability to mutate existing authority. Never replace the guard with SECURITY DEFINER or change a published migration.
6. Provision Mission Control's five tables, sequence, indexes and existing9 template seeds through one fixed source-owned contract before final activated catalog capture. No arbitrary provisioning callback. Grant only the actual MC business columns/sequence usage; no runtime DDL. MC source wiring follows separately and will verify rather than create/seed.
7. Persist/fsync immutable activation-prepared evidence before COMMIT, containing exact schema-stage pins, origin, qualified release, A source authority/activation/head and final catalog. Only actual complete-state reconciliation may publish a missing activated acknowledgment; missing preparation, partial grants/extensions or conflicting A state refuse without repair or another CAS. Publish a distinct immutable activated record bound to schema-stage record identities, origin, actual source/build, authority/A activation/head and final catalog. Preserve schema-prepared/schema-committed history. Make reopen/runtime verification explicitly stage-aware; do not compare an activated schema to the original schema-only hash. Handle acknowledgment loss by actual exact-stage reconciliation, never reinitialize/adopt unrelated state.
8. Start a separate selected runtime process after activation, with locator set before imports. Do not promote an already prepared schema-only client into activated authority. Fresh workflow readiness checks on the actual caller transaction must match selected activation evidence, exact A node/source and actual release/origin/catalog. Legacy readiness still resolves Task0. Keep this composed through reservation, single/loop claim publication and running-step reauthentication. Replace the duplicate running-step migration-application parser with the shared strict legacy-or-fresh parser and preserve its error boundary/ancestry checks.

## File map

- installation/fresh-installation-owner-source-v1.ts: actual finalized clean-main release/origin and connected33-row journal derivation/verification; no connection or mutation.
- internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts: explicitly narrow the existing legacy authority return after strict union parsing.
- internal-production/owner-admission-v1.ts: strict fresh authority type/parser branch; legacy body unchanged.
- installation/fresh-installation-activation-v1.ts: private controller/transaction registration, actual release derivation, owned activation and stage publication/reconciliation; no entrypoint invocation.
- installation/fresh-installation-activation-verifier-v1.ts: read-only actual transaction verification for normal runtime, owner precommit and acknowledgment reconciliation; only normal runtime may admit work.
- installation/fresh-installation-runtime-grants-v1.ts: fixed audited business column/sequence grants across the ordinary compiler/runtime path; preserve append-only ledgers, use nonlocking source reads and retain only the two explicitly reviewed published-trigger lock exceptions. Enter the existing migration import graph through its canonical module before the preparation verifier leaf; no published source changes.
- installation/fresh-installation-artifact-bootstrap-v1.ts and artifact-policy-v1.ts: actual private empty inventory/bootstrap with caller-owned savepoints and frozen standalone4MiB/512MiB/8GiB policy. Refuse adoption/repeat/runtime callers, retain host floor, initialize before grants/final catalog; authenticate actual ready capacity-row limits on activated reopen.
- runtime-config.ts: selected capacity/mode getters pin that policy and refuse locator/environment drift; ordinary generic defaults retain existing behavior.
- installation/fresh-installation-provenance-v1.ts: fixed source-owned trigger/narrow grant contract with exact read-only extension verifier.
- installation/fresh-installation-mission-control-schema-v1.ts: fixed MC schema/index/template/grant contract copied and checked against current canonical MC definitions; no arbitrary SQL callback.
- db-pg.ts: authority creation+resolution, extract caller-owned activation core, fresh transaction readiness and lock-policy branch. Selected schema preparation remains distinct from operational admission.
- execution/operational-outbox-repository.ts, operational-event-delivery-repository.ts and v3-story-claim-runtime-binding-v1.ts, plus installer/step-ops.ts: fresh selected readers omit immutable event/binding row locks while retaining all mutable claim/runtime/step/story/delivery locks, identity joins and CAS. This is causally required because PostgreSQL row locking would otherwise force inappropriate UPDATE privileges on immutable authority rows; legacy SQL stays unchanged. Qualify extracted actual SQL with real restricted-role PostgreSQL component tests, then actual compiled APIs.
- installer/step-ops.ts: shared strict migration application union/parser; unchanged ancestry transition formulas.
- installation/fresh-installation-records-v1.ts, runtime-v1.ts, selection-v1.ts: bounded immutable activated evidence, stage-aware actual connection verification and selected snapshot pins.
- Tests: pure fresh authority strictness/hash/origin/source/legacy compatibility; actual owned DB trigger/grant/CAS/rollback components; production unqualified-release refusal before effects; post-merge compiled actual activation/reservation/single+loop claim/running-step qualification script. Reuse behavior sequences from claim-runtime-publication/claim-step recovery and activation-controller tests without legacy fake readiness.
- product-compiler/artifact-index.ts, recovery/v3-downstream-evidence-publication.ts and evidence/accepted-candidate-repository.ts: nine additional fresh nonlocking immutable queries preserve all remaining24 mutable owner/capacity/claim locks, replay/hash joins and V3 gates; qualify actual SQL and unchanged mutable lock census.
- Preserve all published migration1-33 manifests/digests/checksums exactly0010a430; the actual full source/build capture binds new operative code. No digest whitelist or journal rewriting.

## Verification boundaries

All component fixtures are explicitly component evidence, not compiled activation. Real compiled activation cannot be skipped or counted as done because branch tests pass. After actual runtime reservation/claim tests, remaining work is MC/entrypoint process wiring, reviewed launcher transition, HTTP3080/3333/18789, exact selected spawner heartbeat and one bounded clean workflow through its real gates. The runtime must be mechanically unable to alter nested provenance or disable its protection. Keep8GiB floor; serialize heavy producers and only OID-checked cleanup of newly created test resources.

## Plan review

startup_helper_delivery_review approved the workable split with the above explicit precommit activation preparation and fresh post-activation process contracts. Implementation is in progress on the sole writer branch. Strict authority DATA, immutable staged records, unqualified-source refusal and shared running-step parser component tests have passed. Actual owned PostgreSQL provenance/MC rollback, narrow grants and mutation-denial component passed after correcting PostgreSQL aclexplode(NULL) handling. The expanded fixed business grant helper and14 immutable source-query corrections are implemented; actual PostgreSQL rollback/DML/denial and query components pass. Canonical-first migration import ordering fixed an observed leaf-first ESM initialization error without changing published code. Empty CAS bootstrap/outer rollback and selected8GiB policy behavior also pass. Current TypeScript and published migration/English/path checks pass. The populated V25 claim/attempt component passes after correcting its test attempt-ID literal. Current focused source/DATA/cache24, legacy16, selected-client10, immutable-query2, schema/grant1, CAS2 and V25binding1 cases have passed; CAS also passes with the final8GiB source policy. Independent whole code/preparation reviews are clear, with original component authorship disclosed. Reviewed delivery, genuine post-merge compiled activation/claims, process wiring and actual live workflow remain open. Future test commands use TSX_DISABLE_CACHE=1 (supported by the installed loader) to avoid regenerating stale source-copy cache; no test/runtime guard changes. These component results do not certify the whole project.


## PR288 review correction

Exact-head cloud review of fc82e40 found four real restricted-runtime gaps before delivery: setup-handoff updates stories.file_skeletons and implementation_contract; cleanup/retry updates steps.abandoned_count; expired downstream attempt adoption updates execution_attempts.generation, fence_token and lease_acquired_at under its existing generation/fence predicates; successful V3 terminalization reads immutable accepted_candidates with FOR SHARE. Add only these six business-column UPDATE privileges and the selected-fresh nonlocking immutable candidate read, preserving legacy SQL, fencing, all mutable locks and immutable DML denial. Adjacent read-only claim mapping found the same immutable-lock cause in five claim-runtime-publication reads (product_packets and four story-binding joins) and run-persistence release-admission verification. Include their selected-only nonlocking immutable branch while retaining mutable join locks and all release/preparation checks. These are necessary for the same working fresh-system objective; no migration, release guard or immutable UPDATE grant changes.

File-map refinement: execution/run-terminal-transition.ts, execution/claim-runtime-publication.ts and execution/run-persistence.ts join the immutable-query correction; fresh-installation-runtime-grants-v1.ts gets the exact six columns above. Extend actual restricted-role seeded-row update/denial and extracted-production-SQL tests, run RED before changes, then green and focused compatibility checks. Compiled activation/workflow qualification remains open until the corrected reviewed head is merged and actually built.


Correction evidence: four seeded restricted-role subtests first failed with real PostgreSQL42501 (7fbad2), then all four plus the enclosing rollback/protection component passed (b5a410). The expanded immutable-query component first detected the terminal candidate lock (c6d928), then both cases passed (665aa2):21 real SQL expressions,12 immutable mutation-denial table checks and77 other unconditional lock arguments. TypeScript noEmit passed8dca8b; semantic migrations, English/path and whitespace passedd87b15. Current focused total is60 unique cases (the prior schema component now includes four subtests); no skips or cancellation. Independent grant/fixture review C0/I0/M0 confirms exact six-column scope and stale-fence replay0. These grants are column privileges under the existing trusted runtime/source boundary; the fixed application SQL retains its row predicates, rather than claiming SQL privileges themselves enforce every row CAS. Query review and exact new-head cloud review are required before merge. Actual compiled activation and live installation remain unrun.


The next exact-head cloud review found an additional mutable cleanup observation grant gap. Existing recovery-source cleanup receipt upsert/finalization SQL updates only status, summary, detail, completed_at, updated_at and metadata. Add exactly those six run_observations UPDATE columns and a restricted-role component executing both exact source statements, including replay and crossed-run refusal. This fixes the same audited business grant contract; it does not enable or qualify any protected legacy bootstrap workflow, invoke repository erasure, or change its source/authority guards. The SQL fixture remains component-only data. File map adds no production file beyond the grant helper; source cleanup routines remain unchanged. Actual legacy/Native Task6A remains unqualified.

Cleanup-observation regression first failed with real42501 (4cabe0); all six schema/rollback/grant component cases then passed (37e7d8), including both exact cleanup statements, replay and crossed-run=0. TypeScript noEmit passedbd6f4e; English/whitespace passedd6c7ba. Independent narrow grant/test review C0/I0/M0. Current focused total61 unique cases; compiled/live qualification still open.


The third exact-head review identifies two additional fresh-runtime capabilities needed by the same complete-system objective. The genuine V3 release-admission repository must be able to create immutable canary/release-go rows, create canary slots and consume their run_id/consumed_at through its existing checks. Add only those INSERT/consumption columns and selected-only nonlocking admission reads, preserving mutable canary/run locks and actual suite/preflight/result/gate validation; no synthetic release-go or bypass. Separately, existing medic persistence needs medic_checks INSERT(id,checked_at,issues_found,actions_taken,summary,details) and DELETE for its unchanged latest500-row retention SQL. Both table DELETE privileges are explicitly enumerated (stories and medic_checks), not widened globally. The application SQL supplies retention bounds; the DB table privilege itself is not row-scoped. Add real restricted-role SQL/retention/denial regressions and independently review. Whole medic startup/remediation/private effects and genuine V3 workflow qualification remain separate Unit3/runtime gates. File map additionally includes execution/v3-release-admission-repository.ts and its actual SQL tests; no published migration changes.


Medic INSERT/retention regression first failed42501 (c7b261), then all seven schema/rollback/grant cases passed (9efb7d). Release component first failed genuine42501 on the canary slot lock and its new selected-join assertion failed as expected (b79050). After the three exact lifecycle grant rows and one immutable alias correction, the combined10-case real PostgreSQL components passed (1de18b):22 exact selected/legacy queries,78 remaining unconditional lock arguments,12 immutable-table denial checks, seven schema/rollback/grant cases including six source-SQL subtests, and actual canary API/replay/selector/slot-consumption/denial component. This grants no actual GO/preflight/workflow readiness. Focused total is63 unique cases. Independent medic review C0/I0/M0; independent release review is C0/I0/M0; new-head cloud review precedes merge. TypeScript noEmit passeda77f9e; semantic migration/English/path/whitespace checks passed58c67f. Known-table literal DML heuristic audit90f3d8 found only intentionally excluded embedded test INSERT(output) and owner-only capacity quota/max bootstrap; it is not an exhaustive SQL proof. All actual compiled/live gates remain open.


The fourth review identifies ordinary dashboard rules CRUD missing from the fixed fresh grant map. Add only the existing source SQL's eleven INSERT columns and eight UPDATE columns, plus rules in the fixed DELETE list. Preserve rule id/readonly/source ownership columns and DDL denial; execute both source INSERT forms, import/edit/toggle and id-scoped DELETE as an actual restricted-role component. This completes the same working MC/dashboard business contract, enables no shared scraping/deployment/process effect, and does not qualify HTTP routes or protected legacy operations. File map remains grant helper plus operational-schema test; dashboard source is unchanged. Selected interim HTTP effects remain closed until the relevant Unit3 composition is reviewed.

Rules component first failed genuine42501 (5c82a4), then all eight operational schema/rollback/grant cases passed (0050d0), including both source INSERT forms, import/edit/toggle/delete and id/readonly UPDATE plus TRUNCATE denial. Independent scoped rule grant/fixture review C0/I0/M0. TypeScript noEmit passede3f161; English/whitespace passed0a5765. Focused total64 unique cases; actual compiled activation/claims/live runtime still unrun.

## Compiled lifecycle correction: normal claim exclusion lock

PR288 was reviewed and merged as74c847ee; its stock clean-main build passed.
Actual compiled fresh initialization, owner COMMIT-response-loss recovery,
restricted activation verification, source/current authority, reservation,
run persistence, single and loop publication and exact replay executed. The
original120s aggregate child bound expired during the sequence; the diagnostic
successor measured forward progress and a600s aggregate QA bound exposed the
next genuine failure: PostgreSQL42501 on recovery_dispatch_deliveries while
withdrawing the normal loop claim. Both failed original captures are retained;
neither is a passing whole-lifecycle qualification.

The ordinary claim-mutation authority locks an existing active recovery delivery
before excluding a competing recovery owner, even when no delivery exists. The
schema-only runtime already has SELECT, but PostgreSQL FOR UPDATE additionally
requires some column UPDATE privilege. Preserve that mutable exclusion lock and
all original predicates. Add only UPDATE(updated_at) on this mutable table to
the fixed fresh grant contract, protected by a fresh-only owner-gated UPDATE
statement trigger. The timestamp supplies recovery event identity, causality
and transition CAS. A bare column grant would allow those inputs to change;
PR289 review identified that problem before merge. The trigger must reject
every actual runtime UPDATE, including empty/no-op updates, while SELECT FOR
UPDATE and source-owned owner updates remain possible. Verify its exact
zero-argument INVOKER body, owner, search_path, owner-only function ACL and
always-enabled statement trigger before accepting the lock privilege. Refuse
preexisting extension objects and install atomically before the column grant;
bind the extension in the final activated catalog. No recovery state, identity,
lease, INSERT, DELETE, TRUNCATE or recovery-dispatch feature is enabled.

File-map refinement is limited to fresh-installation-runtime-grants-v1.ts and
the operational-schema restricted-PG regression. Execute the exact ordinary
claim-mutation, withdrawal and completion exclusion SQL on empty and populated
component rows; prove contention still blocks and disallowed business/identity
mutations remain denied. Run RED first, apply the one-column fix, then focused
PG, TypeScript and published-migration checks plus independent review. Deliver
through a reviewed PR and stock clean-main build. A NEW source-pinned instance
must pass the complete actual compiled lifecycle before Unit3 source wiring.
Never repair grants or rewrite source pins in an earlier activated instance.

Correction evidence: exact empty-query regression first failed42501 (6019af),
then all9 schema/rollback/grant cases passed (1f88a5). The populated component
first exposed a test-only JSONB double-encoding error (feb8f5); passing its
unchanged object directly fixed the fixture without changing constraints.
All10 cases then passed (e28afe), including four exact populated source locks,
real second-connection55P03 contention and post-release success, timestamp
advance, protected42501 mutations, and the actual normal claim authority's
recovery-owner refusal with unchanged business snapshots. Independent narrow
grant and whole fixture review C0/I0/M0 includes that fixture correction.
TypeScript14a3d9, English93d745, semantic migrations400d54 and paths65fd24
passed. This remains component evidence; actual compiled lifecycle after the
new reviewed clean-main build and all Unit3/live outcomes remain open.

The earlier populated timestamp-advance positive is historical evidence for
the rejected bare-grant revision. PR289's exact3bef3912 cloud review correctly
found that updated_at is authoritative in v3-recovery-lifecycle-reconciler,
including event hashes, causal ordering and CAS. Independent review confirms
the correction. Extend the same file map with a fixed private guard inside
the business grant module, no generic verifier or published migration change.
Run RED on timestamp/no-op mutation rejection, then verify real row locks and
owner updates still succeed, runtime writes/DDL/replica mode remain denied,
and owned-fixture guard drift fails exact verification without repair.

Guard correction evidence: timestamp rejection first failed with a real
missing-rejection assertion (c4165d). The guarded revision passed all11
schema/rollback/grant cases (3f1e6f): empty and populated/no-op runtime UPDATE
rejection, real row-lock contention, owner timestamp update, actual normal
recovery-owner exclusion, rollback absence, denied DDL/replica mode and exact
verifier rejection of trigger/body/function-ACL drift followed by rollback.
Independent exact delta review C0/I0/M0 pins production aad95488 and tests
eb7fddc0 (6b2037/865914). TypeScriptb5d84d, English2d95b0 and semantic
migrationsc4a714 pass. Reviewed delivery, new clean-main build/instance and
actual complete compiled lifecycle remain required; Unit3 is still unwired.

## Unit3: activate the actual private service runtime

PR289 merged as2e573b54; the stock build e14432 passed. The NEW actual
compiled installation qualification v9 passed all1 case,290296ms, original
capture2ffb6f and receipt completed/cleanupCompleted true. It recovered one
real lost owner COMMIT response and used the actual compiled selected client,
reservation, run persistence, single/loop publication, exact replay, normal
withdrawal and real termination. This is API component evidence. claimStep,
running-step reauthentication, maintained V3 workflow and live services remain
unqualified; closed Native/PM scalar tests remain unrun.

Implement the already approved working fresh system on the existing sole writer.
Use tests first and the independently reviewed outside Unit3 candidates. Refine
the causal file map to: db-pg and fixed operational entry; CLI/dashboard entry;
private source-pinned assets and installer/provision/workspace/cron seams;
private service custody and same-backend notification listener; daemon,
daemonctl/spawnerctl and spawner composition; step-ops shared temporary-output
recovery exclusion; bundled Mission Control preimport/config/SQL/CLI/paths;
final actual workflow acceptance and private control classification. These
changes are required because the activated schema APIs alone cannot enter the
ordinary runtime without legacy Task6A/shared HOME effects. Keep all legacy
branches and actual claim/preflight/release/runtime guards intact. No invented
authority, receipt, positive fixture or guard environment override is allowed.

First run focused negative entry tests RED, implement entry and rerun GREEN,
including legacy dashboard readiness. Then repeat TDD for source/private assets,
owned controls/listener/controllers/spawner and step-output isolation. Compose
MC's actual restricted pool and source checks before imports/SQL. Final MC run
start must await the existing real workflow-run COMMIT and return its actual ID.
Use source-only component mocks solely for negative/owned DATA lifecycle tests.
Independent exact-source review and normal cloud PR review precede merge.
Only build on clean source without skip/dirty flags. A NEW installation from
that final reviewed main release must pass actual compiled prepare/drift/close,
same-backend notification and actual claimStep/running-step checks, then start
private services on3333/3080 with existing18789 and execute a genuine bounded
maintained workflow through actual gates. Preserve the previous data and
installations; no source-pin rewrite or live grant repair.

Unit3 source integration evidence: entry initially10 RED then25 selected/legacy
checks GREEN (ae698c); assets28 RED then28 GREEN (407635); controls/listener
and legacy daemon25 GREEN (898314); spawner/private output initially13 RED
then82 GREEN including prompt/terminal components (1c7024). Real selected-client
PostgreSQL regression passed10 (226955). TypeScript noEmit passed037f3e.
Failure retry cron needs an additional causal file-map entry, step-fail.ts:
actual fixed entry before DB and shared cron excluded before and after awaited
workflow lookup; original retry state and SQL remain. Seven tests passed after
the late-selection seventh test first failed (2cce10), independently reviewed.

The final CLI permits fixed reviewed private service/work actions, while exact
private status/stop executes before ordinary imports or live DB preparation.
The existing awaited workflow run returns bounded structured acceptance after
its real persistence, with all protocol/preflight/release checks retained.
File map also includes context-ops.ts and feature-dev workflow templates to pin
platform scripts from actual Source paths rather than the old shared alias.
The reserved scripts key is fixed in both selected and legacy modes; the
legacy caller cannot retarget the old literal prefix. The new same-run renderer
and private-entry tests first produced13 RED; two subsequent failures were a
fixed one-level test declaration locator, then the new legacy retarget test
failed before the final context correction. Actual21-case GREEN is required.

Adjacent source fixtures keep the actual legacy behavior tests. Four failures
in spawner-gateway-recovery were missing captured mode DATA and source-shape
assertions after the private split; minimal test-only correction passed109
( d4ac33 ), independently reviewed. Initial broader Task6A ordinary-refusal
regression passed40/51; the eleven remaining extracted startup/guard fixtures
are being reconciled with actual selected-versus-legacy wrappers. They are
failures, not passes, until the original behavioral refusal assertions execute
and pass again. No historical closed Native or PM scalar test is qualified.

Mission Control v6 preimport negatives passed10 after RED (91a234). Its owned
pool facade TypeScript errors were fixed with a phase union annotation and an
actual callable-target refusal, preserving CLOSED and all guards; noEmit passed
3ba9c1 with independent narrow review. Final accepted-run route/UI and actual
HTTP/compiled-runtime verification are still pending.

Final Unit3 Source evidence: CLI21 passed5a1178. All52 ordinary startup,
post-await refusal, shutdown retention, listener dispatch and deferred-import
regressions passed1c0185 after the test fixture was updated to use the actual
two-statement wrapper and its captured-absence assertion. The prior11 failures
and the intermediate stale fixture11 failures remain preserved as such.
Independent source/test closure is C0/I0/M0 for the final CLI, script context,
step-fail, controllers, spawner, source/private assets and legacy adaptations;
review credit excludes each reviewer's authored leaf and is cross-covered.
Final TypeScript33e5cd, version/migrationb606ce and English/path/12MC contracts
36c0fd passed. Unit3 has not been built or operationally qualified yet.
Deliver source through reviewed PR; the required next phase is a stock clean
main build and NEW actual installation, then actual compiled entry/listener,
claimStep and running-step reauthentication before maintained workflow/live
readiness. Never treat these source/DATA negatives as that positive proof.

## PR290 correction: private runs do not own shared gateway cron cleanup

The exact265d9a95 cloud review found a real P1 before merge/runtime: returning
false from gatewayAgentCronsEnabled enters syncActiveCrons' legacy disabled
branch, which deletes the same workflow's shared gateway crons. The same
lifecycle assumption also exists in ensure/repair/direct removal. Refine the
file map to agent-cron.ts plus the new private-agent-cron lifecycle regression.
Use a fixed captured-selection exclusion at all eight public shared lifecycle
seams, before parameters, SQL, gateway access, logging or catch scopes. Selected
count is zero. Keep the existing enabled predicate and every legacy function
body, including disabled legacy stale-cron cleanup, unchanged. This is an
in-goal root fix for the promised private runtime; no gateway framework, shared
cron migration, deletion, or changed legacy policy is authorized.

The actual old source-body regression first recorded10 failures, including
fake gateway deletion on selected sync (66d807). After the fixed eight fences,
all53 new/legacy cron plus source/private-asset cases passed (434f36), with
no real gateway or SQL effects in these DATA components. Runtime workflow
advance remains part of the later actual installation qualification.
