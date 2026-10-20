# Native SourceMap Authority Implementation Plan

> Execute task by task with subagent-driven-development and task-scoped reviews. Root alone owns all native/browser/DB/HTTP/build execution and Git delivery; workers author scoped Source/tests and inert checks only. Preserve SDD records.

**Goal:** Correct the two captured native setup-build SourceMap contradictions without weakening authority.
**Architecture:** Share full-payload assertion ordering, then admit exact generated sources at the real setup writer; packet remains authority.
**Tech stack:** Existing TypeScript ESM/Zod/node:test/tsx/native browser/isolated Postgres, no dependency or schema change.
**Spec:** `docs/superpowers/specs/2026-10-20-native-source-map-authority-design.md`.

## Global constraints

One sole SF writer on scoped PR branch; current live unchanged. Root-selected options and File Map in spec govern. No runtime/test/SourceMap guard weakening or arbitrary folder-granted generated role. Preserve original assertions, hashes, selectors, expected/operators, accepted-attempt/converter proof, topology role/owner. Native tests are never inert. Use the pinned Node22 toolchain for compiler/stock-build and non-P3 checks; use existing production Node26.4.0 (SHA256 `59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553`) for the unchanged guarded P3 wrapper and its native children. Root's first Node22 P3 original exited before test import because its maintained `NODE_OPTIONS=--test-isolation=none` is unsupported there; the compatibility capture proves Node26 accepts it. Preserve that UNKNOWN pretest result; do not alter the launcher, capability preload, option, guards or three-case selection. No whole npm test/test:scripts selecting protected PM. No source/credential/DB bypass, generated runtime edits, provider calls or new cleanup. Root stockbuild only genuine clean actualmain==origin/main after reviewed final necessary merges and before runtime qualification; intermediate4f74 rebuild is deliberately deferred, not qualified.

Detailed originally investigated witness recipes and risk inventory: `/Users/setrox/ai/setrox/logs/2026-10-20-reviewed-source-release-v1/i5-sixth-source-map-root-fix-plan-draft-v1.md` SHA256fcdfd4902c76498d83546291d6756791d77a270942cb73613700f1f1da26ba6c. It is historical advice, not additional edit/execute authority. Root current spec/sequence controls.

### Task 1: Assertion identity causal regression and smallest shared fix

Files: existing `tests/product-compiler/implementation-source-map-v1.test.ts`; then new `src/product-compiler/observable-assertion-identity-v2.ts`, new `tests/product-compiler/observable-assertion-identity-v2.test.ts`, existing `src/product-compiler/producers/design-graph-v2.ts` and `src/product-compiler/producers/implementation-source-map-v1.ts`.

- [x] First fresh test author modifies ONLY existing implementation-source-map test. Parameterize authentic fixture before compile/targets/browser/bindings/graph/story, use six raw before-then-after Start Game control assertions from draft, preserve old behavior/W1. Expected producer success must fail current exact OBSERVABLE_IDENTITY_MISMATCH. Never fabricate a postproduced graph positive or import nonexistent helper. Name `accepts genuine noncanonical observable assertion order without changing original authority`. Record complete original product/graph assertions and hashes/exact diagnostic reference. Retain new native roots/artifacts; no native/import/compiler execution by author. Report/freeze/diff, Root commits after readback.
- [x] Independent static review of test qualification; Root executes exact selected case under owned browser capture, observes real causal RED at intended gate, original process/cleanup/source provenance. Setup/stream failure remains UNKNOWN. Root may refine fixture only without guards.
- [x] Fresh production implementer adds spec pure shared helper; replace graph private function with identical comparator; SourceMap retains current conjuncts and adds full original productObservableHash plus exact canonical assertion payload/hash checks. Do not mutate ProductSpec/targets/raw lists or relax schema.
- [x] Add meaningful pure conservation/order coverage and schema-valid negative expected/phase/property/selector/evidence mutations that reach the exact gate (or explicitly report stronger earlier refusal). Tests assert full unchanged authority and deterministic repeat. Root executes actual browser producer GREEN with same intended test and baseline/W1 overlap; pure tests/import audit and production tsc proportional.
- [x] Independent task review spec+quality, preserve RED/GREEN before moving on.

### Task 2: Actual setup writer generated-source admission

Files: new `src/product-compiler/setup-generated-screen-admission-v2.ts`, new `tests/product-compiler/setup-generated-screen-admission-v2.test.ts`, existing `src/installer/setup-handoff.ts`, existing `tests/product-compiler/setup-build-packet-orchestrator-v2.test.ts`.

- [x] Static author extends real native packet fixture with actual-writer stock assertions and combined noncanonical case. Use unique run/screen/temp identities per case and real seeded stories/manifest. Configure unsuffixed db-pg explicitly to owned TestDatabase URL before any connection, assert both actual clients current_database equals fixture DB and close before fixture disposal. No live DB selection or fake pgQuery.
- [x] Use actual `materializeSetupBuildContracts(runId,repo,context,buildCommand)` and existing executed-converter attestation, accepted real attempt/converter capture. No crafted correct certificate for writer qualification. If safe attestation import or runner composition requires more source, report first; Root amends scope, never guard workaround.
- [x] Root proves independent actual-writer stock RED SOURCE_OWNERSHIP_MISMATCH before writer changes. It must not be earlier wrong-stack/source/schema/DB setup failure. Correct-assertion isolation is explicit. Combined case must reproduce original second condition appropriately after Task1.
- [x] Implement pure admission interface/strict schemas and bounded writer wrapper from spec. Native missing index preconversion adds nothing; once index exists incomplete/invalid mapping must fail bounded refusal. No directory scan grants membership. Preserve legacy/reference/no-design behavior. Writer reads normalized stable-contained UTF8 regular sources <=16MiB; exact source validator/root surface/target/response/story binding mandatory.
- [x] Root proves actualwriter→packet stock and noncanonical PASS, certificate exact indexed file membership/topology generated/present/exacthash/US001owner, second materialization preserves membership, no dependency install from empty requested_dependencies. No file artifact editing qualifies a fix.
- [x] Pure negative matrix strict extra/duplicate/missing/index/source/target/title/root/hash/manifest/owner and native stray handwritten source cannot authorize consumed screen; source/converter/ownership drift retained. Unused unrelated extra certificate declarations are not newly prohibited by this wave.
- [x] Task review spec+quality, focused current checks; original failed run unchanged.

### Task 3: Integration, review and delivery

- [x] Root reviews combined File Map, production tsc, relevant native/source/packet/setup overlap only, expands on causal evidence.
- [x] Fresh mostcapable whole-branch reviewer on exact deliveredbase→currenthead. One finalfixwave then scopedreview; rulings explicit and no silent guard waiver.
- [ ] Normal PR/check/comment review delivery; genuine clean final main stockbuild before live qualification. Keep SF/MCsource/build identities and currently unqualifiedfull8 explicit. Fresh maintained full8 only after all known platform roots delivered and qualified, not after this isolated wave alone.

Verified source phase: Task1 review C0 and native5/pure3/type PASS; Task2 independent spec/quality approved C0/I0/M1 (unchanged loader deprecation deferred), data43/type/native3 PASS at99cb99ff. Root retains both genuine RED originals and exact GREEN material/DB/logging/owner qualifications in this plan’s SDD workspace. Delivery, clean-main build, live qualification, negative PLAN/V3 consumer fixes and full8 GO remain separate pending outcomes.


### Task 3 final-fix wave: external PR301 P1

Whole-branch review of f844 is complete C0/I0/M1deferred; later GitHub review found a real P1 and integration remains held. Root's appended spec refinement controls this single final-fix wave.

- [x] Fresh scoped implementer prepares ONLY unchanged exported actual handoff wrapper with inert default-strict stage signature and the real stale-source → actual regeneration → strict writer/packet → readiness regression in the two refined File Map files. Preserve existing three tests byte-for-byte. No execution by author.
- [x] Root reads exact source/test diff, admits actual effects/closure, commits clean scoped test-seam preparation and runs maintained one-file guarded P3 Node26 with original capture. Require exact stale-admission blocker, real repaired converter/validator/packet success, final readiness RED; preserve all originals.
- [x] Same implementer adds only exact-code stage deferral and code-owned forthcoming converter caller selection after Root qualifies RED; adds scoped conservation/non-admission/strict negative controls. No broader failure clear or skip.
- [x] Root executes identical causal witness GREEN with complete capture, relevant type/overlap; independent scoped review against pre-fix f844 plus exact refinements. Record component-only/full-flow limits.
- [ ] Normal PR301 update, current checks and comment reconciliation, reviewed merge. No stockbuild until final necessary actual clean main after remaining negative PLAN/projection root fixes.

Verified P1 final-fix source88dcc70d: genuine guarded RED original59652, 4tests3PASS1FAIL solely stale baseline after actual repair; same causal code/fixture authority GREEN original94774 natural0/bothEOF/fulltrackedsourceunchanged/no faults,4/4PASS with7nested safety probes. Productiontsc original91369 natural0/empty streams/sourceunchanged. Root verified9wrapper logger restorations, exact SQL/source restoration, ownedclients closed/DBdisposed/preexistingtemplate preserved,256retained witnessfiles. Scoped finalfix review specPASS/staticqualityPASS C0/I0/M0, previous DEP0205M1 remainsdeferred; wholebranchreview earlierf844 unchanged. Component proof only, not whole nativeV3preClaim/autocomplete. PR301delivery pending; SF final actualcleanmainstockbuild deferred until subsequent negativePLAN/projection rootfix delivery, then qualified rollout/freshfull8.
