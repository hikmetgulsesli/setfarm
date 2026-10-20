# Spawner pending claim ownership plan

Goal: prevent orphan recovery from invalidating a still-owned compiler preClaim invocation without weakening real orphan recovery or downstream authority validation.
Spec: docs/superpowers/specs/2026-10-20-spawner-inflight-claim-ownership-design.md.
Execution: subagent-driven-development with fresh non-delivery builder, genuine RED/GREEN, independent task and whole-branch review. Root performs all Git delivery, stock clean build and any admitted runtime work.

## File Map

| File | Responsibility |
| --- | --- |
| src/spawner.ts | Exact private pending invocation ownership, lifetime cleanup, candidate durable runtime projection and exact skip before orphan mutation; carry original candidate claim identity through existing quiescence/retry-authority/release helpers so stale C1 cannot act on replacement C2 |
| tests/spawner-inflight-claim-ownership.test.ts (new) | Genuine production function AST extraction and inert deferred ownership/race regressions; no live module entry/DB/process/provider/native/browser |
| tests/installation/fresh-installation-spawner-retention.test.ts | Existing affected genuine source components; modify only if the new exact invocation resource needs an inert fixture port |
| tests/spawner-gateway-recovery.test.ts | Existing affected source/contract regression; no weakening assertions or native effects |
| docs/superpowers/specs/2026-10-20-readonly-observable-projection-design.md | Root accepted bounded causal Task2 design from actual third-case compiler failure |
| scripts/stitch-to-jsx.mjs | Preserve exact browser-authorized readonly observable-only native text displays through annotation, without synthetic actions/transports |
| src/product-compiler/stitch-screen-source-validator-v2.ts | Prove narrowly indexed literal readonly display semantics while retaining all strict source/interactive guards |
| src/product-compiler/schemas/stitch-screen-index-v2.ts | Optional exact readonlyDisplay metadata and disjoint unique-element raw-count accounting; preserve old artifacts and all other coverage guards |
| tests/product-compiler/readonly-observable-projection.test.ts (new) | Genuine complete converter functions with inert private projection fixtures and strict validator round trip; no browser/process/DB/provider |
| tests/product-compiler/stitch-screen-source-validator-v2.test.ts | Positive exact displays and spoofing/mutability/handler/spread/overlap negative regressions |
| tests/product-compiler/converter-projection.test.ts | Real native-v2 readonly input round trip; builder authors only, Root separately admits/executes native coverage |
| src/product-compiler/producers/implementation-source-map-v1.ts | Final W1: count distinct strict indexed readonly displays as aggregate accepted native inputs; keep source-map schema/raw equality unchanged |
| tests/product-compiler/implementation-source-map-v1.test.ts | Final W1: genuine producer/output-schema readonly and deduplication regression; existing fixture uses native capture, Root alone runs exact focused cases and retains new evidence |

## Constraints

- Sole writer .worktrees/setfarm-dashboard-cutover-controller-20261007-v1 branchfix/spawner-inflight-claim-ownership-20261020 based main5a9fbe74aea8d5a6390324a6918d0ae0d5618cf8. Root fetched only writer, not immutable live release.
- No other product files/schema/guards/credentials/runtime/test limits. Task2's separately accepted bounded design extends the File Map only as listed. No production code before meaningful RED. Keep pending invocation matching exact; no claimingSpawns role shortcut or ad-hoc identifier parsing.
- Inert tests may read bounded genuine Source and use actual function bodies/transpileModule with injected synthetic ports as existing retention harness. No actual spawner import/entry, live URLs, DB, process spawning/signals, providers, native/browser or blanket test/scripts. Root reviews exact focused commands before use if unsure.
- Preserve all original/new evidence and dirty files. No staging/commit/push/build/delivery by builder. Root stock build must run from a clean nonlive source context, never in immutable selected live release.

## Shared interfaces and consistency

| Boundary | Contract |
| --- | --- |
| Pending claim invocation -> runtime intent | Session ID, owner instance, full claim agent, runtime agent must identify the same invocation before durable publication |
| Maintenance SQL -> exact pending matcher | Join durable runtime by candidate claim/run/step and claim-agent identity; missing/mismatched runtime means no skip |
| Invocation -> active/draining/completion ownership | Keep record through postclaim publication or transfer; cleanup on every exit without deleting a later record |
| Tests -> real code | Run whole genuine maintenance and relevant spawning lifetime logic with inert ports; no duplicated reimplementation or regex-only proof |

### Task1: Exact pending claim ownership

1. Add meaningful deferred genuine-source regression(s) first. Run focused inert command and retain natural RED output before product edits.
2. Apply smallest spawner ownership/lifetime change. Preserve authority guard equality and original diagnostic behavior for true orphan recovery.
3. Run same focused command GREEN plus affected existing inert retention/source checks. Retain raw output, child exits, complete diff and Source pins. Do not sum nested TAP tests or claim live acceptance.
4. Freeze complete diff and report limitations for independent task review; follow scoped fix rounds if needed. Root whole-branch review and focused type compilation precede PR; the stock clean-main build follows actual reviewed merge and precedes all runtime qualification (actual build guard requires main and HEAD==origin/main).
5. After actual full8 settles and current owners/receipts/source guards are reconciled, Root separately admits reviewed rollout and new clean real evaluation. Existing failed cases remain failures.

Ruling: fix the false-orphan producer first. Generic retry diagnostic masking is separately recorded, not a reason to exempt compiler output, invent retry input or broaden this minimal fix. If a different causal defect appears, Root updates spec/FileMap before Source edits.

Ruling I1: independent review identified replacement-claim recovery as a real load-bearing gap in the same false-orphan objective. Refine mapped spawner helpers and new inert regression before delivery. Tests must hold stale C1, start exact pending C2 for the same run/step/claim-agent, then show no C2 drain/retry/release before first effect and across awaited boundaries. Scope remains the two product/test files; any additional production file requires a new causal FileMap ruling. Cost if wrong: withheld delivery/rework.
Ruling build sequence: scripts/write-build-info.mjs910–926 mechanically requires canonical origin, main branch and HEAD==origin/main. Premerge type compilation plus reviewed focused tests are valid source gates; the genuine stock build is postmerge/before rollout. No artificial refs, dirty/guard bypass or premerge stock-build PASS claim.


### Task 2: Preserve readonly observable-only text displays

**Spec:** docs/superpowers/specs/2026-10-20-readonly-observable-projection-design.md.
**Causal scope:** actual I5 run be58f47c-ef28-4340-882a-285f1f4fd9c4 failed before generated implementation because converter-owned neutralization destroyed accepted readonly textbox authority. This root fix is necessary for the same working-system/full8 objective. No project-specific allowlist or generated project edit.

**Files:** modify only scripts/stitch-to-jsx.mjs, src/product-compiler/stitch-screen-source-validator-v2.ts, tests/product-compiler/stitch-screen-source-validator-v2.test.ts, tests/product-compiler/converter-projection.test.ts; create tests/product-compiler/readonly-observable-projection.test.ts. Root already wrote the design/File Map. No edits to completed Task1 files. Root count-proof amendment also maps src/product-compiler/schemas/stitch-screen-index-v2.ts; all schema regressions stay in the two mapped inert test files.

**Interfaces:** converter loadNativeV2ProjectionContract already validates exact rendered element/receipt/hash authority and has the native element. Add private projection metadata for readonly input text/default observables only; consume it in the actual annotateInteractiveElements value-tag path after annotateObservableElements. Public screen observable gains only optional strict readonlyDisplay={kind:"input",inputType:"text",readOnly:true}; schema accounts distinct display elements exactly once and disjoint from controls/rejected, original raw counts unchanged. Restrict metadata to exact accessibility textbox observables with matching source locators and consistent metadata on shared elements. No textarea support: current native capture lacks its readonly state. Validator validateInteractiveCompletenessAndSpreads consumes existing screen.observables and parsed JsxElementRecord; existing exact observable validator remains unchanged. Use a dedicated narrow predicate, not a role/marker-wide exemption.

- [ ] Step 1: Read the spec and exact source investigation. Inspect the existing converter, source-validator and neighboring tests. Write genuine inert RED first in the new test. Use TypeScript AST extraction to execute whole production declarations and their genuine pure dependencies for annotateObservableElements -> annotateInteractiveElements -> htmlToJsx as needed. Supply only inert ports/literals for external filesystem/runtime dependencies; do not duplicate the matching or annotation behavior under test. The fixture's validated projection is synthetic unit input, explicitly not fresh browser evidence.

The expected assertion shape is:

```ts
assert.match(projected.html, /role="textbox"/);
assert.match(projected.html, /aria-label="Display state"/);
assert.doesNotMatch(displayTag, /data-setfarm-rejected-control|aria-hidden|disabled|data-action-id|data-control-id|onChange/);
assert.equal(projected.valueControls.length, 0);
assert.equal(projected.rejectedControls.some(c => c.sourceElementRef === displayElementRef), false);
assert.equal(validateStitchScreenSourceV2({ screen, sourceText }).status, "valid");
```

Use actual validator result signature from source if its discriminator differs; do not invent an interface. Include an adjacent undeclared input, which must remain neutralized and indexed as rejected. Add focused validator positives and all design negatives. Inert tests may read genuine bounded source and execute pure function bodies; they must not import spawner/CLI/browser capture modules or execute processes, sockets, HTTP, DB, provider, native browser, signals or cleanup of existing records.

- [ ] Step 2: Execute only these inert tests with physical Node22 and capture raw natural RED log/exit before production edits:

```sh
/opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test --test-concurrency=1 tests/product-compiler/readonly-observable-projection.test.ts tests/product-compiler/stitch-screen-source-validator-v2.test.ts
```

The meaningful RED must demonstrate actual converter neutralization and the subsequent validator's unindexed readonly-display refusal, not import/setup failure. Retain evidence under this plan's SDD workspace task-2-* files. If no safe inert extraction can exercise actual functions, stop before production and ask Root for the exact missing port decision; do not substitute static regex-only coverage.

- [ ] Step 3: Implement the minimal private converter proof and source-validator predicate from the spec. Conceptually:

```ts
const exactReadonlyDisplay = exactRequiredObservableElement
  && browserNativeReadonlyTextDisplay && literalSourceReadonlyTextDisplay
  && noActionOrInputOrEventSemantics;
if (exactReadonlyDisplay) return preservedObservableAttributes;
// Existing unknown-control neutralization remains the fallback.
```

This is a proof checklist, not copyable API: use existing exact-element data and attribute parser conventions. Reject ambiguous/dynamic/duplicate attributes. Do not strip handlers merely to qualify an otherwise undeclared control. No other schema extension, generic guard relaxation, retry/time-budget, role-label allowlist, state transport or action invention. Eligibility must be proven on original attributes before canonicalization as well as final source. Add schema causal RED before changing its production code; existing raw-count guard must not be bypassed or subtracted.

- [ ] Step 4: Run the same exact inert command GREEN and git diff --check. Retain raw logs/exit and exact test counts (nested not additive), source hashes and complete diff. Self-review every fallback and multi-observable/duplicate marker case. No build/typecompile/Git delivery by builder; Root owns those separately.

- [ ] Step 5: Author the real native-v2 regression in existing converter-projection.test.ts using actual capture and final validateStitchScreenSourceV2. Extend helper only as needed for a visible readonly text input with implicit textbox role, no input/action binding, literal value, and undeclared adjacent control. Preserve all existing tests. Do not execute this file or any browser command; explicitly label native round trip UNRUN pending Root admission. Do not delete fixture/cache artifacts outside current test-owned inert files.

- [ ] Step 6: Freeze source and write task-2-report.md plus task-2-freeze.json with all mapped file pins, exact commands/results, genuine RED cause, coverage limits, native UNRUN status, complete diff path and self-review. No subagents, stage/commit/push/PR/merge, build, live change, credentials, generated-project repair or signals. Return DONE or a precise context need to Root. Root performs independent task review, final whole-branch review, no-emit compilation and ordinary delivery; stock build only actual clean main after reviewed merge.

## Delivery correction — PR300 P1 literal readonly values

Before merging PR300, apply the binding spec's explicit literal value/defaultValue policy in exactly its four mapped converter/validator/inert-test files. Root accepted original finding4326984905 from actual GitHub observation; preserve closed Task1/W1 source and all guard/evidence records. Same implementation worker records genuine inert pre-fix RED then minimal source GREEN, no native/build/Git effects; Root owns actual native literal positive/typecheck, independent scoped P1 review and delivery. No native .value witness or stronger equality is invented. Current full8 oldsource remains separate and cannot qualify this correction.
