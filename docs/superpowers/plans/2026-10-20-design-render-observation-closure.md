# Design render observation closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the actual prefetch infrastructure cause, admit an exactly required browser-proven readonly text observable, and disclose existing full-source HTML admission requirements to generation without weakening admission.

**Architecture:** Three serialized Source tasks: narrowly translate a typed renderer failure through existing sealed materialization and preclaim cause custody; then extend owned native-input observation with strict, backward-compatible evidence and join only exact required readonly text observables into candidate admission. A final authority-bound prompt disclosure states the existing full-source policy. Rendering, semantic retry budgets, runtime ownership and downstream implementation evidence remain authoritative.

**Tech Stack:** Existing TypeScript/ESM, Zod, owned Playwright capture/replay, node:test and private isolated PostgreSQL test runner. No new dependency.

**Spec:** `docs/superpowers/specs/2026-06-03-universal-agent-inner-dev-loop-design.md`, evidence-authority and generic stack capability principles. The user's approved complete/fix/test objective and repository Standing Owner Authorization cover these causally necessary root fixes discovered by the actual unchanged full8 suite. This plan refines that scope; it does not authorize unrelated changes or effects.

## Global Constraints

- Root alone stages, commits, pushes and delivers; one Source implementation worker in the selected existing SF writer, branch `fix/design-render-observation-20261020`, base `83ccbbb819134408fed4f24849440b3a43c6654a`. Preserve prior branches, scratch, evidence and dirty files.
- Freeze live SF83/MCfa41/I4 and full8 job `1a2c2b5f-3c85-4d98-9968-9fafa8499e4e`; no service/build/runtime transition until its original owned closure. Source work and isolated tests only.
- Preserve the first and second failed full8 cases, all original artifacts and historical UNKNOWNs. Never repair/adopt generated evidence, pretend the suite passed, or substitute a model/tool failure for a failed test.
- No provider/real network calls, live DB selection, credentials/ACL effects, prompt edits outside the exact approved Task 3 disclosure, resource/TLS/allowlist changes, retry-budget changes, guard bypass, new dependencies or broad cleanup.
- Pure/compiler producer tests and production builds retain physical provisioned Node `/opt/homebrew/Cellar/node@22/22.23.1/bin/node` (v22.23.1). Maintained owner-backed P3 tests require pinned `/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/node/26.4.0/bin/node`, SHA256 `59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553`, because the unchanged runner sets --test-isolation=none. Prepend the nominated driver directory to command PATH; existing dependencies only. Test DBs only through maintained isolated owners; retain original exit/EOF/cleanup evidence. Stop new heavy work if observed disk falls below 8,589,934,592 bytes; do not weaken any existing resource guard.
- Keep English source/copy and existing schema/policy literals, phase/rejection codes, sealed request/artifact hashes, source/release binding and legacy conservative replay. Missing native-input evidence grants no readonly admission permission.
- Task 1 promises typed persisted/terminal cause, not a corrected legacy operational-model UI badge or original transport repair. Task 2 grants only a declared readonly display observable, not after/reload runtime correctness. Actual full8/GO remain unqualified.
- Focus tests on real observable behavior; no implementation-mirror tests or broad npm test/test:scripts wildcard that would invoke the retained protected PM diagnostic.

## Evidence and File Map

Architecture input: workspace `logs/2026-10-20-mc-only-rollout-v1/render-prefetch-classification-architecture-v1.md`, SHA256 `414f2f7c5f406e68051e21b7eaf469d8ea7ee4a09535938eb6e2dc6de90da8b6`. Root read the whole report and independently inspected the selector, renderer census/schema, replay comparison and authority hash consumers. Root's actual tool `f8003d` independently verified both original HTML/rendered DOM readonly attributes, element refs and generation/render/selection hashes.

First cause: `full8-claim-completion-readonly-v1.md`, SHA256 `1c64dc901399cb4bb7f3744935b44cccd93030f81397cf3fbc332b879c38493f`; second cause: `full8-second-semantic-rejection-causality-v1.md`, SHA256 `c2480a3779d4487292c53e8f630484ce25d23f57a6f3cac95e4fe78ed930ba33`. Names in these diagnostics are not permitted Source hardcodes. Each task below contains its production/test File Map; this plan is the only documentation deliverable.

### Task 1: Preserve typed prefetch infrastructure cause

**Consumes:** Existing capture error class/code/phase, `DesignSourceMaterializationFailureV2`, sealed runner failure and genuine PLAN-ledger preclaim fixture.

**Produces:** Exported immutable `DESIGN_SOURCE_RENDER_PREFETCH_OPERATIONAL_CAUSE_V1`; exact sealed infrastructure failure and recognized terminal cause. No new enum, diagnostic transport payload or retry authority.

#### Source chain and scope choice

- Producer `stitch-rendered-semantics-v2.ts:543–560` wraps native fetch exceptions into the typed code/phase. Prefetch occurs at 1414 before browser launch at 1420. `infrastructure()` at 161 retains only bounded error.message. The exported error class at 118 also includes INPUT_INVALID, ARTIFACT_INVALID, SIDECAR_INVALID and other codes: blanket conversion would broaden this task.
- Compiler runtime `design-source-runtime-v2.ts:459` awaits capture without a catch. Its existing helper at 272 always means semantic `rejected` / `contract_invalid`; do not reuse that helper unchanged for infrastructure.
- Runner `design-source-compilation-attempt-runner.ts:1314` already accepts `DesignSourceMaterializationFailureV2` (defined at 166). Untyped fallthrough invokes `ambiguousFailureSeed` at 890, producing `DESIGN_SOURCE_ACCEPTED_ARTIFACT_INVALID` / `contract_invalid`, while outer disposition is infrastructure_failure.
- `persistFailure` at 735 writes canonical `raw/failure.json`; the DB/result exposes only artifact hash, fingerprint, cause hash and reason codes. `readStoredFailureArtifact` at 763 validates canonical bytes and exact attempt/request/hash bindings. Preserve this custody path.
- Installer `steps/02-design/runtime-v2.ts:311–350` currently reconstructs only `DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1` by exact hash. Therefore a compiler-only fix would leave the terminal cause absent. `preclaim.ts:2276`, `:594` forwards an available cause; `step-fail.ts:787` supplies it to termination. No changes to those forwarding paths are needed.

Alternatives:

1. **Recommended: exact prefetch classification plus existing preclaim cause projection.** Two production files; deterministic code/phase preservation and no new taxonomy enum or persisted schema. Smallest end-to-end cause correction for the proven failure.
2. Compiler-only conversion: smaller, but leaves terminal operational cause incomplete; reject as incomplete for this objective.
3. Full renderer classifier/diagnostic framework: handles browser/schema/replay and transport detail together, but lacks current evidence for each mapping and expands scope. Defer.

#### File Map

| File | Planned action |
|---|---|
| `src/product-compiler/design-source-runtime-v2.ts` | Import existing renderer error class; export one frozen prefetch operational cause; narrowly catch capture and throw existing typed materialization failure. |
| `src/installer/steps/02-design/runtime-v2.ts` | Import that cause and add exact cause-hash recognition to private `runnerFailure`; keep semantic branch unchanged. |
| `tests/execution-attempts/design-source-runtime-v2.integration.test.ts` | Actual compiler path with offline allowed-resource fetch exception; inspect sealed DB/result and canonical failure artifact; preserve semantic/English/success controls. |
| `tests/execution-attempts/design-source-compilation-attempt-runner.test.ts` | Typed infrastructure sealing/replay and generic artifact/schema negative; retain max-attempt and claim fences. |
| `tests/execution-attempts/v3-plan-product-build-authority.integration.test.ts` | Use existing genuine PLAN-ledger preclaim fixture (445–525) to prove returned terminal cause, without exposing private mapper or forging ledger authority. |
| `tests/product-compiler/stitch-rendered-semantics-v2.test.ts` | Add native-fetch TypeError test beside existing HTTP500 infrastructure test at 461; verify exact producer code/phase, no transport calls. |

Read-only controls: operational cause schema, `tests/steps/02-design.test.ts:309` semantic-forwarding guard, `tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts` terminal cause forwarding. Task 1 has no schema, prompt, resource policy or Mission Control edits.

#### Concrete implementation

Use existing `OperationalFailureCauseV1`, `StitchRenderedSemanticsCaptureV2`, `DesignSourceMaterializationFailureV2`, `hashCanonicalJson` and real error fields. New exported constant (the only new public production symbol):

```ts
export const DESIGN_SOURCE_RENDER_PREFETCH_OPERATIONAL_CAUSE_V1 = Object.freeze({
  schema: "setfarm.operational-failure-cause.v1",
  workflowStepId: "design",
  boundary: "product_compiler.design_source.resource_prefetch",
  failureClass: "infrastructure_failure",
  failureCode: "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED",
} satisfies OperationalFailureCauseV1);
```

Replace only the existing capture assignment at 459 with the following, leaving arguments and all subsequent artifact writes untouched:

```ts
let renderedCapture: StitchRenderedSemanticsCaptureV2;
try {
  renderedCapture = await captureStitchRenderedSemanticsV2({
    generationTargets: input.contract.generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: input.deviceType,
  });
} catch (error) {
  if (!(error instanceof StitchRenderedSemanticsInfrastructureErrorV2)
    || error.code !== "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"
    || error.phase !== "resource_prefetch") throw error;
  const cause = DESIGN_SOURCE_RENDER_PREFETCH_OPERATIONAL_CAUSE_V1;
  throw new DesignSourceMaterializationFailureV2({
    disposition: "infrastructure_failure",
    failure: {
      failureFingerprint: hashCanonicalJson({
        schema: "setfarm.design-source-failure-fingerprint.v1",
        requestHash: input.attempt.requestHash,
        phase: error.phase,
        errorName: error.name,
        errorCode: error.code,
      }),
      operationalCauseHash: hashCanonicalJson(cause),
      reasonCodes: [error.code],
      evidence: {
        cause,
        phase: error.phase,
        error: { name: error.name, code: error.code, phase: error.phase },
      },
    },
  });
}
```

Persist code/phase, not arbitrary message/URL/nested cause/headers. Fingerprint includes requestHash; stable cause excludes occurrence detail. Omit `failedStageIds`: render infrastructure establishes no semantic regeneration delta.

At installer `runtime-v2.ts:344`, retain current semantic hash branch and append this mutually exclusive recognized-cause branch:

```ts
: result.status === "infrastructure_failure"
  && result.failure.reasonCodes.length === 1
  && result.failure.reasonCodes[0] === "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"
  && result.failure.operationalCauseHash === hashCanonicalJson(
    DESIGN_SOURCE_RENDER_PREFETCH_OPERATIONAL_CAUSE_V1,
  ) ? {
    operationalFailureCause: DESIGN_SOURCE_RENDER_PREFETCH_OPERATIONAL_CAUSE_V1,
  } : {}
```

This projects a known producer-owned value from its exact sealed hash; it does not parse arbitrary diagnostic text or trust unvalidated evidence. Existing semantic constant and every enum/literal remain unchanged. Unknown causes remain unrecognized.

#### Test-first execution steps for primary owner

- [ ] Reconcile current handoff and sole Source writer; verify isolated-test ownership/material preconditions before tests. Zero-live-owner/runtime transition gates govern later live effects, not isolated Source edits. Do not edit or rebuild the live immutable release. Update the actual task plan/File Map with this causal classification refinement.
- [ ] Compiler integration: fresh run/claim/repo and valid HTML/PNG plus regenerated `stitchDownloadReceipts`; HTML includes `<script src="https://cdn.tailwindcss.com"></script>`. Stub global fetch to throw `new TypeError("fetch failed", { cause: Object.assign(new Error("offline fixture"), { code: "ECONNRESET" }) })`, restore in finally. Assert one dispatch, `infrastructure_failure`, exact prefetch reason, ordinal-1 `no_retry`, null outputRefs, no projection/rendered-semantics, schema-valid cause/hash and raw failure artifact hash/code/phase. Baseline fails with `DESIGN_SOURCE_ACCEPTED_ARTIFACT_INVALID` / `contract_invalid`.
- [ ] Producer test beside HTTP500 test at 461: existing fixture with same scriptMarkup and offline fetch exception must throw actual class + exact code/phase (already passing baseline). Keep cancellation/redirect/capacity/source/browser/replay controls.
- [ ] Implement compiler constant/catch. Different exception prose must retain same cause hash and omit message/endpoints. Preserve successful replay, undeclared interactive control, forbidden inline script and English rejection outcomes.
- [ ] Runner test beside 777: throw typed infrastructure failure; assert exact canonical raw artifact, cause hash, zero projections and replay without redispatch. Ordinary `Error("invalid accepted artifact fixture")` materializer remains accepted-artifact-invalid/contract-invalid. Keep semantic rejection, bundle schema/ref/hash, max-attempt and claim-fence controls.
- [ ] Genuine PLAN-ledger preclaim integration at 445: existing ledgerAuthority/row.canonical_prd/real design claim and ensureProject stub; local valid stage/download receipts, offline fetch failure. Assert exact result and operationalFailureCause matching sealed artifact; replay same attempt without dispatch. Preserve ambiguous result without recognized cause, semantic forwarding and terminal forwarding tests.
- [ ] Implement the preclaim recognition branch. Run focused tests, review diff, and have only primary owner stage/commit under existing standing authority before clean build. Investigators do not commit or deliver. Do not run any guard override.

#### Exact verification commands (planned, not executed)

Run from sole writer after owner gates permit; retain original exits/captures. Use private isolated test DB, never live DB; do not print credentials.

```sh
# Pure producer/fake-runner, physical Node 22; no PG inputs.
node --import tsx --test --test-concurrency=1 tests/product-compiler/stitch-rendered-semantics-v2.test.ts
node --import tsx --test --test-concurrency=1 tests/execution-attempts/design-source-compilation-attempt-runner.test.ts
# Each following command requires a separate unchanged P3 invocation,
# pinned owner driver Node 26, clean Source and fresh privately owned PG input.
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/design-source-runtime-v2.integration.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/v3-plan-product-build-authority.integration.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/steps/02-design.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/steps/02-design-runtime-v2.test.ts
# Root alone: stock build on reviewed clean main == origin/main after merge; physical Node 22.
npm run build
```

Stock build requires reviewed merged clean main exactly equal to origin/main; a clean private-branch commit alone is insufficient. No `SETFARM_ALLOW_DIRTY_BUILD=1` or `SETFARM_SKIP_RUNTIME_GUARD=1`. Product suite entrypoint is `node --import tsx --test tests/product-compiler/*.test.ts`; execution entrypoint is `scripts/run-execution-attempt-tests.ts`, which clears live PG selection and isolates owner-backed tests. Build runs build-info/version/English/path/migration-digest/MC-contract prechecks, tsc, asset copy/version injection and finalization. No checks were executed here.

#### Operational outcome and limits

Failure cause class becomes exactly `infrastructure_failure`, with existing prefetch reason preserved through persisted attempt and terminal cause. Underlying problem owner is rendering/resource-fetch infrastructure; the repair here belongs to Setfarm's classifier. No evidence identifies a particular CDN, DNS, TLS, proxy or provider fault.

Runtime policy stays exact: no failedStageIds means existing planRetry (`design-source-runtime-v2.ts:959`) returns null, hence ordinal-1 `no_retry`; if prefetch fails in ordinal 2, runner 1451 keeps `maximum_attempts` or `repeated_failure` based on parent fingerprint. Preclaim terminalization stays `failureOwner: "platform_preclaim"`, `retryPolicy: "terminal"` (`step-fail.ts:789`), with no automatic retry or model regeneration. Infrastructure cause does not authorize retry-budget changes.

Do not equate that terminal evidence owner with the legacy server display enum `infra`. `src/server/run-operational-model.ts` currently derives display classification from text through stack modules and maps infra to `infra_retry`; it does not consume this cause directly. Thus this two-file fix alone cannot promise an `infra` UI card or corrected display retryability. A typed operational-model presentation improvement is separable and should not be smuggled into this patch or implemented by a new message regex.

Defer endpoint diagnostics: classification needs only the typed error. Later diagnostics may retain allowlisted transport codes/phase/resource hash with privacy/size tests, without URL queries/headers/secrets or fetch-policy change. Neither classification nor public probes prove original network repair or full8 success.


### Task 2: Required readonly text observable admission

**Consumes:** Existing strict rendered element/candidate evidence, browser census/replay, required observable selectors and exact receipt checks.

**Produces:** Optional strict `nativeInputState`, versioned readonly-observable policy capability, conservative replay shape handling, and narrow exact-required readonly admission.

Independent semantic fix; never classify this failure as infrastructure. Existing suite must close before runtime effects. Source tasks remain serialized in the sole writer.

**Evidence:** `full8-second-semantic-rejection-causality-v1.md`, SHA256 `c2480a3779d4487292c53e8f630484ce25d23f57a6f3cac95e4fe78ed930ba33`. Both exact required Preference value textboxes have passing role receipts, literal type=text/readonly, no action/input/slot attributes, and only the undeclared-interactive check fails. Target requires textbox after/reload value+visibility but action inputFields is empty. Census omits readOnly, preventing editable/display distinction.

**Source:** selector `producers/stitch-target-candidate-selection-v2.ts:384` treats every native input as interactive; `:599` admits only action-slot/input refs. Observable exact checks are computed afterward at 614–648. Renderer `producers/stitch-rendered-semantics-v2.ts:1007–1032` observes tag/role/native kind and operability but omits readOnly/type. Strict element schema is `schemas/stitch-rendered-semantics-v2.ts:42`; observation hash binds elements+roleReceipts at 232. Replay compares arrays/hash at renderer 1733–1746. Runtime authority hashes render/selection policy at `design-source-runtime-v2.ts:724–725` and also binds producerReleaseSha.

**Recommendation:** add optional, strictly typed native-input state to browser-owned census, then exempt only an exact required read-only text observable from the undeclared-interactive check. Keep isInteractive unchanged for action/input validation. Reject a broad all-observables whitelist, raw HTML-only inference, aria-readonly claims, disabled-as-readonly inference, and generic `input.readOnly` exemption (checkbox/range can expose readOnly while remaining mutable).

#### File Map and interfaces

1. `src/product-compiler/schemas/stitch-rendered-semantics-v2.ts`: add optional `nativeInputState` to `StitchRenderedElementV2Schema`:

```ts
nativeInputState: z.object({
  inputType: z.string().min(1).max(50),
  readOnly: z.boolean(),
  contentEditable: z.boolean(),
}).strict().optional(),
```

Add refinements: state is allowed only when tagName/nativeControlKind both input; reject unknown keys and partial state. At candidate level either every native input has state or none has it, preserving a clear legacy/new observation shape. Export new constant `STITCH_READONLY_TEXT_OBSERVABLE_POLICY_V1 = "native-text-readonly-exact-role-receipt.v1" as const`. Existing schema names, renderer/selection policy literals, phase enum and rejection codes remain intact; optionality is for historical evidence, not permission.

2. `src/product-compiler/producers/stitch-rendered-semantics-v2.ts`: in existing browser census emit state for every native input from DOM properties (`String(element.type)`, `element.readOnly === true`, `element.isContentEditable === true`); do not derive it from provider prose or aria-readonly. Existing canonical observationHash now covers state automatically. During replay only, if the recorded candidate is legacy (all input states absent), strip this one newly introduced property from fresh observation before existing exact comparison/hash computation. Keep all preexisting fields, role receipts, resource/DOM hashes and browser revision checks. Never mutate/rewrite stored artifact, rehash it, or return enriched legacy evidence to selector. New recorded candidates compare every state field exactly; changed readonly/type fails `STITCH_RENDERER_V2_REPLAY_MISMATCH`.

3. `src/product-compiler/producers/stitch-target-candidate-selection-v2.ts`: move undeclared-interactive loop after existing observable exact checks; their sorted final output is unchanged. New private helper interface:

```ts
function isReadOnlyTextObservableElement(
  element: StitchRenderedElementV2,
): boolean {
  return element.tagName === "input" && element.nativeControlKind === "input"
    && element.nativeInputState?.inputType === "text"
    && element.nativeInputState.readOnly === true
    && element.nativeInputState.contentEditable === false
    && (element.role === null || element.role === "textbox")
    && element.renderState === "rendered" && element.enabled
    && element.dataAction === null && element.dataActionInput === null
    && element.dataControlSlot === null;
}
```

Build `declaredReadOnlyObservableRefs` ONLY from target.requiredObservableSelectors with selector.kind accessibility and role textbox. Require the already computed observable check disposition exact (not just matching selector text), exactly one role receipt element, observed=visible=expected=1, receipt nearestSurfaceRefs and element nearestSurfaceRef equal selector.surfaceRef. Existing `expectedReceiptProjection`/`observedReceiptProjection` hash comparison binds observableRef/actionRef/selectorHash/query exact name+role/phases/visibility requirement. Require exactly one matching element in observableElements and helper above. Then the existing undeclared-interactive check skips only refs in this set. All original action/input/slot/surface/observable checks still run and reject conflicts. No static capture is claimed to prove after/reload runtime values; downstream implementation evidence remains required.

4. `src/product-compiler/design-source-runtime-v2.ts`: import capability constant and change only authority hash inputs:

```ts
renderPolicyHash: hashCanonicalJson({
  policy: STITCH_RENDERED_SEMANTICS_POLICY_V2,
  nativeInputObservation: STITCH_READONLY_TEXT_OBSERVABLE_POLICY_V1,
}),
selectionPolicyHash: hashCanonicalJson({
  policy: STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2,
  readOnlyObservableAdmission: STITCH_READONLY_TEXT_OBSERVABLE_POLICY_V1,
}),
```

No DB migration: hashes already use Sha256Schema. Existing literal schema/policy readers stay compatible, while attempt identity cannot silently reuse old-policy acceptance as current authority. Legacy artifacts parse/replay conservatively; missing nativeInputState never grants the exception. Current accepted-bundle/readProjectedDesignSourceAuthorityV2 hash chain and release pin remain intact. Do not retrofit old failed attempts or upgrade artifacts in place.

5. Tests: `tests/product-compiler/stitch-rendered-semantics-v2.test.ts`, `tests/product-compiler/stitch-target-candidate-selection-v2.test.ts`, `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`. Extend existing schema-bound fixture contracts with a required role=textbox display observable; use local HTML/PNG receipts, no actual project names or provider calls. No additional production dependency or public helper API.

#### Red/green and compatibility acceptance

- [ ] First reproduce old result from genuinely captured valid `<input type="text" readonly aria-label="Display value" value="ready">` on the required surface with exact role receipt and declared action button. Baseline must reject `CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL`; verify that exact observable check passes. Implement census/schema then selector refinement. Result must select/bind exact observable element, without requiring action inputFields for a display.
- [ ] Table negatives retain undeclared rejection: editable text; missing state; state readOnly=false; aria-readonly only; checkbox/radio/range with readOnly=true; non-input role textbox; contentEditable=true; missing/wrong/duplicate receipt; wrong target/surface/name/actionRef/phases; a required-before-visible hidden element (existing receipt rejection); undeclared readonly textbox; present data-action/data-action-input/data-control-slot; unrelated extra button; missing required action. Wrong/unknown schema values fail schema rather than becoming infrastructure exceptions invented by selector. Preserve existing `CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL`, unresolved selection and source failure codes.
- [ ] Renderer tests assert observed state against native DOM properties; all inputs carry it and non-inputs do not. New strict schema rejects partial/extra state fields and mixed legacy/new candidates. Recompute observationHash in deliberate pure-schema fixtures so tests fail on intended validation, not stale hashes.
- [ ] Real replay: new capture round-trips with exact state/hash. Changing readonly/type in sealed DOM (with controlled test sidecar hash setup) fails semantic replay equality; changing sidecar bytes without hash update still fails existing sidecar guard. Legacy fixture without state, original observationHash and genuine DOM replays through recorded-shape projection but remains unqualified for the readonly selection exception. No return-path enrichment or reclassification of historical artifacts.
- [ ] Runtime integration verifies new render/selection hashes differ from old string-only hashes, bind current capability, and changing either capability changes authority. Existing successful accepted replay remains accepted under same new authority. Old request identity is never reused for new semantics. Preserve task 1 infrastructure and all semantic/English/schema/ownership negatives.
- [ ] Run focused existing entrypoints below and Source-only noEmit checking after primary-owner scoped commit; final stock build runs only on reviewed merged clean main equal to origin/main. Tests may be completed independently of task 1, but changes to shared runtime/tests must be serialized. Review task 2 separately for false acceptance; no runtime cutover until original suite and owner gates close.

```sh
env -u SETFARM_PG_URL node --import tsx --test --test-concurrency=1 tests/product-compiler/stitch-rendered-semantics-v2.test.ts tests/product-compiler/stitch-target-candidate-selection-v2.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/design-source-runtime-v2.integration.test.ts
```

Expected owner/retry behavior: proven readonly display now qualifies; actual editable/unknown/undeclared controls remain contract rejection with existing bounded semantic retry. No new retry mechanism or budget, prompt tweak, resource-policy change, product repair, migrations or Mission Control effect. Two independent root fixes may share one reviewed Source wave, but neither proves original transport repair or full8 success.

## Primary-owner delivery

- [ ] Each task retains causal RED, exact GREEN commands, covering outputs and Source pins in its own SDD report; Root obtains independent task review before completing it.
- [ ] Root serializes commits and obtains the most capable independent whole-branch review after all three tasks. Covering tests and Source-only noEmit checks precede reviewed PR delivery. The unchanged stock build requires reviewed merged clean main exactly equal to origin/main and remains mandatory before rollout/source-product qualification; never edit or rebuild the live checkout.
- [ ] Preserve every original full8/UI failure. Guarded merged-main rollout and fresh actual workflow/UI qualification happen only after the active original full8 owner closes and all current gates hold.

## Rulings

Ruling: Include the typed prefetch cause and proven readonly observable false positive in the same bounded design-admission Source wave as separate reviewed tasks — both are demonstrated systemic defects in the actual approved full8 run, with distinct owners and no generated-project repair — if wrong, Source rework and a fresh qualification are required; no current failed result is promoted.

Ruling: Preserve historical replay by comparing only its recorded element shape, while never enriching legacy evidence for selection — optional schema evidence supports existing read/replay custody without inventing readonly proof — if wrong, legacy replay compatibility or a new negative test will fail and the change must be corrected before delivery.

## Guard-compliant private PG execution refinement

Root-read execution proposal: workspace `logs/2026-10-20-mc-only-rollout-v1/design-prefetch-private-pg-execution-proposal-v1.md`, SHA256 `5e4a23fa1534a6b620b455d8ecca128472045d4292d3b0756a259c8e93b34556`. Its fixed one-file grammar supersedes the earlier combined/raw execution recipe. No P3 runner/helper Source or scope changes are authorized.

Root first checkpoints the four frozen RED fixture files and this plan as an explicitly **UNQUALIFIED** private-branch commit. Guarded projection admits the exact clean indexed tree. Run original full compiler and genuine preclaim files through unchanged P3 on a fresh directly owned private PostgreSQL cluster, retain genuine regression assertions and complete original owner/EOF/SQL-prefix/cluster closure. A setup error is unqualified infrastructure evidence, never causal RED. Only then may Task 1 production edits begin. Root similarly checkpoints a minimal unqualified GREEN candidate to satisfy immutable Source custody before the same GREEN execution on a new private cluster. Independent review, successful covering tests, clean build and delivery remain mandatory; neither checkpoint is a passing or completion claim. No history rewrite or old cluster adoption.

Ruling: Use clean explicitly unqualified RED/GREEN checkpoints instead of broadening the P3 dirty-source scope — the maintained guard authenticates all indexed bytes and excludes this task's dirty Source; private commits preserve exact provenance while actual tests/review/build still gate delivery — if wrong, the unchanged projection refuses or tests remain unqualified; no guard may be bypassed.

Ruling: Use the existing pinned Node 26 driver only for maintained owner-backed P3 tests, retaining Node 22 production builds/runtime and pure producer checks — Root's actual Node22 probe exits9 on --test-isolation=none, which the maintained runner requires; earlier Node22-only plan wording was overbroad — if wrong, material/driver admission or original tests fail; do not change runner flags or runtime pins to force a pass.


## Actual main-only build sequencing correction

Task1 bounded five-file GREEN at `a2dcb123cfe081a4bb0937a1871698be2195b0bd` is independently qualified by `private-pg-green-actual-whole-phase-review-v1.md`, SHA256 `969759ea8cf090de0c42e9e7186cf4a446cc7bf7bc87b2b4f05fd7fdf25aa564`:38 passing leaves plus one parent, original PG/Node/SQL/stream custody closed. Separate Node22 pure files passed13 and24 tests. Source-only `tsc --noEmit -p tsconfig.json` exited0; it generates no build/release artifact.

The original stock `npm run build` exited1 at prebuild with `[write-build-info] HEAD does not equal origin/main`. Existing `derivePinnedInputSet` additionally requires branch main. The earlier assumption that a clean feature checkpoint permits stock build was wrong. Keep the exact guard, refs, scripts, topology and build authority unchanged; do not spoof origin/main, rename a feature branch to main, bypass prebuild or claim a successful build from noEmit/P3. Task-level implementation/test review may close the Source milestone; stock build/delivery/rollout remain separately open until the complete reviewed wave is merged and built on clean main. Current live services stay frozen.

### Task 3: Disclose exact selected HTML admission and bind its authority

**Consumes:** Actual case3 correct U+2022 rejection and evidenced generation/admission disclosure mismatch; proposal `logs/2026-10-20-mc-only-rollout-v1/selected-html-prompt-disclosure-task-proposal-v1.md`, SHA256 `de16827e73e991d70e705c4e958e4f4134ceda5ab3058e6c04ff1b80235b63c1`. Current selected-HTML predicate, decoder and immutable English/copyright policy remain authoritative.

**Produces:** One deeply immutable code-owned disclosure object emitted by the existing builder and hashed verbatim into prompt authority. No acceptance-policy, scalar allowlist, language-detector, transport, retry, generated-product or migration change.

The source builder currently asks for visible English only, while admission inspects the complete decoded source. Changing prompt text alone is insufficient: accepted attempt reuse is keyed by authority even for a different request. Bind the full exact disclosure object into promptContractHash so old accepted authority cannot satisfy new-disclosure generation. Existing release binding stays independent.

#### File Map

- `src/product-compiler/v3-design-contract-v2.ts`: export deeply frozen object below; emit one `## SELECTED_HTML_SOURCE_ADMISSION` section, `disclosure_schema:` marker and exact ordered rules immediately after the existing visible-English requirement. Keep builder signature and target/completeness checks.
- `src/product-compiler/design-source-runtime-v2.ts`: import the object beside builder; add `selectedHtmlPromptDisclosure: DESIGN_SOURCE_SELECTED_HTML_PROMPT_DISCLOSURE_V1` to existing `setfarm.design-source-prompt-contract.v2` hash payload. Preserve all existing inputs including Task2 capability and release binding.
- `tests/product-compiler/v3-design-contract-v2.test.ts`: independent literal content/order/single-section/schema/deep-freeze/deterministic request assertions and existing target controls.
- `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`: independent expected prompt hash; old/new/changed-rule authority+request distinction; exact new-authority replay; unchanged bullet rejection and copyright-byte preservation plus existing language/encoding/capacity negatives.
- `tests/execution-attempts/product-compilation-attempt-repository.test.ts`: use normal reserve/dispatch/seal to prove accepted old authority does not satisfy reserve under new authority; preserve same-authority accepted reuse.
- This Root plan only documentation deliverable. Read-only English policy/canonical-json/runner/schema/installer/provider wrapper stay unchanged.

```ts
export const DESIGN_SOURCE_SELECTED_HTML_PROMPT_DISCLOSURE_V1 = Object.freeze({
  schema: "setfarm.design-source-selected-html-prompt-disclosure.v1" as const,
  rules: Object.freeze([
    "- Return valid UTF-8 HTML of at most 800000 bytes and 200000 UTF-16 code units after decoding.",
    "- Setfarm checks the complete decoded HTML source, including markup, attributes, styles, comments and permitted data scripts, not only visible text.",
    "- Source characters may use printable ASCII U+0020-U+007E and structural whitespace TAB U+0009, LF U+000A and CR U+000D.",
    "- The only additional English typography is U+2013, U+2014, U+2018, U+2019, U+201C, U+201D and U+2026.",
    "- U+00A9 COPYRIGHT SIGN is the only extra neutral source character: Setfarm substitutes a space only for English inspection and retains the original HTML bytes.",
    "- Other non-ASCII source characters, including literal U+2022 BULLET, are rejected. Omit unsupported decorative glyphs; use ordinary supported punctuation where needed.",
    "- Other control characters, including DEL U+007F, are rejected. English admission also rejects known localized ASCII lexemes; ASCII spelling alone does not establish English.",
  ] as const),
});
```

#### Serialized TDD and review

- [ ] Fixture-only Task3 preparation may begin after Task2 production and its actual49-test producer GREEN are frozen, while Task2 private-PG qualification remains OPEN. No Task3 production edit or completion credit follows; Root must review fixtures and observe genuine causal RED before production. After Task2 Source milestone closes and Root reconciles current writer/pins, freeze new regression fixtures first. Builder RED must fail on the missing section; runtime RED must fail on missing exact authority disclosure, with all other inputs fixed. Setup/infrastructure failure is unqualified. No old-artifact rewrite or task-specific provider call.
- [ ] Old/new promptContractHash, full authorityHash and requestHash differ; changed rule changes enclosing hash. A stage-only prompt difference with unchanged authority is insufficient. Normal repository fixture must reserve a distinct attempt under new authority rather than already_accepted; same new authority replay remains identical without redispatch.
- [ ] Literal U+2022 still rejects at selected_html_english_admission with exact existing reason/diagnostic, no projection/bundle/no semantic retry. Copyright remains accepted with original bytes/hash. Preserve accented/Cyrillic/hidden-format/invalidUTF8/byte/code-unit/localized-ASCII/control negatives. These invariant tests are GREEN controls, not the task's missing-disclosure RED.
- [ ] Implement only the object/emission/authority input; focused builder/runtime/repository/English suites through current owned harness and independent review. No wildcard, bypass, dirty build, encoding workaround, broad policy refactor or new dependency.
- [ ] Root Source noEmit plus task review; final whole-branch review and guarded clean-main stock build before rollout. Provider adherence and actual fresh full8 remain separate live qualification, never guaranteed by disclosure.

Ruling: Add Task3 exact authority-bound disclosure as a causally necessary refinement of the unchanged full8 objective — case3's rejection was correct and the generator omitted its full-source requirements; preserve the policy and correct the producer instructions — if wrong, the provider may still violate the policy or authority tests may reject reuse, requiring Source rework/fresh qualification, never gate weakening.


## Task2 hidden-observable scope clarification

Existing selector semantics check undeclared interactivity only for `renderState === "rendered"`; exact observable receipts explicitly permit `traceable_hidden_allowed` when no before-visible assertion exists. Existing genuine browser tests preserve hidden after-only observables. Keep that behavior unchanged. The hidden negative above means a display explicitly required visible before, which existing role/visibility validation must reject. Characterize an after-only non-rendered display under existing policy without attributing its acceptance to the new readonly exception. A rendered control can receive the new exception only with exact required textbox receipt and observed=visible=expected1; invalid/hidden receipts grant no exception. Do not broaden the undeclared loop or claim static capture proves after/reload behavior.

Ruling: Preserve existing traceable-hidden after/reload semantics and constrain Task2 hidden negative to an explicitly before-visible requirement — the original plan's unconditional hidden-rejection wording conflicts with the current intentional policy, while the proven full8 false positive concerns visible read-only displays — if wrong, later runtime evidence may expose a separate hidden-state defect; no visibility/receipt condition of the new exception is relaxed and after/reload correctness remains unqualified.


### Task2 fixture review refinement

Independent fixture review v1 C0/I2/M0 found two test-only issues before actual RED. Preserve isInteractive unchanged: the non-input exclusion negative must use a native interactive readonly textarea with exact textbox receipt, not a div role=textbox that current census deliberately does not classify interactive. No broader classifier/policy change follows. Replay inputType mutation must preserve the existing textbox receipt (text→email with no datalist), and establish equivalence of old census/receipt fields so only the new inputType difference causes mismatch. Add a literal readonly email selector-boundary negative while preserving checkbox/radio/range and all other cases. Source/runtime guards and new exception's literal type=text restriction remain strict.


### Task3A bounded builder-only sequencing

Task2 private-PG milestone remains OPEN. Root separately nominated and ran only the5-case pure builder file with physical Node22,128MiB V8 heap and5sec test deadline: original08b24f naturaltestexit1,4controlsPASS/one missing-section assertion at117:12, no skip/cancel/todo, sourceunchanged, both Python pipeEOF/wait returned. ChildmaxRSS130498560B, elapsed0.346sec. This has no native/PG/8GiB admission credit; runtimepromptauthority RED remains unrun.

Permit Task3A only: implement the exact deeply frozen disclosure object and emission in src/product-compiler/v3-design-contract-v2.ts after this causal RED, preserving policies and allotherSource. Run same small builderfile GREEN and independentstaticreview. No runtime hash edit until its own actual PG RED and Task2 PG gate; do not deliver a partialprompt/authority change. Task3overall/build/live/full8 remain OPEN.


## Combined Task2 and Task3B runtime gate

Root reconciled the actual shared integration fixture after Task3A GREEN. Its new disclosure-hash assertion343 precedes the Task2 native-input authority/replay checks in the same successful-runtime leaf. Requiring Task2 whole-file GREEN before Task3B missing-hash RED/production is circular on these exact combined fixtures. Do not rewind Source, omit the new assertion, duplicate acceptance fixtures or claim Task2 complete frompartialobservations.

| Shared interface | Dependency found | Binding sequencing |
|---|---|---|
| Task2/Task3B runtime and integration fixture | Missing disclosure assertion blocks later Task2 replay on the same real attempt | After unchanged9GiB admission, run a fresh owned combined runtime RED on frozenTask2 production plus Task3 fixtures/Task3A builder. Only a genuine missing-disclosure hash assertion qualifies. Then permit only the planned Task3B runtime hash property; independent review and fresh combined GREEN must execute all Task2 capabilities/replay and Task3 authority/repository/English controls before either runtime milestone closes. |

This supersedes earlier Task3B text requiring Task2 PG milestone before Task3B production. Source edits stayserialized; no PG/Source milestone, build, delivery, rollout, provider/full8 success is waived. Currentcapacity remainsbelow8GiB, so no newPG/browser/heavy run. Task3A purebuilder actualGREEN2cddb4 passed5/5; Task2 producer49/49 at eccf4892 is retained, not a whole-current-branch claim.


## Task3B actual combined RED and bounded hash binding

The approved exact-three-old-copy cleanup recovered disk capacity without altering services/newrecords. FreshRoot nomination had18,908,426,240availablebytes; unchanged9GiB admission/8GiB floor passed. NewprivatePG root logs/dpg-003e2785-3c29-4095-8aad-7b4799b7ba6c, Rootdispatchd7e4f5/session39123/naturalcompletion2379c3exit0, phasef907f4a0047c7c067db232222ef56a1bccd1a14cdb2c9ff7126f6de46bc3d8ac. Independentactualwholephaseauditc10cbd046cfd9dd50631aa011cc44536b8cac01d0812c8913baf9e9123a0b189 C0/I0/M0 qualifiesgenuineRED+completeboundedoriginal/SQL/client/PGcohort/TCP62438closure; originalsqualificationfalse remainsimmutable.

Actual7files:50leafPASS/1expectedruntimeFAIL plus passingPLANparent (52reporternodes), no otherfailed/cancelled/skipped/todo. Acceptedruntimefails the exact prompt hash equality at currentline339 (historical343locator corrected): actual45b09c14... equals pre-disclosure payload, expected2769cfd8... equals fullseven-ruledisclosure payload. Everylaterassertioninthatsameleaf remainsUNRUN untilfreshGREEN, includingTask2capabilities/replay/Englishcases. PureEnglishfile stillusesnormalmaintainedP3setup and its exactprefixcleanup; zero-prefixabsence isnot setup proof.

OriginalTask3worker then changed onlyruntime import and selectedHtmlPromptDisclosure fullobjecthashproperty, SourceSHAbc610db6227738daa27913dd00b67b2f43239e9697487bd9b9de68074e654c26; all existinginputs/policies/capabilities/release/behavior/tests/builder preserved. Cheaptranspilezeroerrors/diffcheck0, no runtimeGREENcredit. FileMap unchanged(runtimeplusRootplan). Independentproductionreview, cleanunqualifiedcheckpoint, SourcefullnoEmit and freshcombined7fileGREEN remain required. BothTask2/Task3PGmilestones/build/delivery/live/full8/GO remainOPEN.
