# Negative PLAN and Projection Authority Design

Status: Root-approved canonical A2/B2 design, placed after actual reviewed SourceMap PR301 merge `ef92b53fe4654e012308df13eace9ef269aa1951`. Independent v1 review I1 is closed by mandatory accepted V3 compatibility controls in reviewed v2. Implementation and all runtime qualification remain pending. The original static v1/v2 artifacts and reviews are retained privately; this canonical document governs the existing sole writer.

## Objective and current truth

Correct two causally established failures within the existing working-system objective: the V2 PLAN resolver rejects the advertised bare typed refusal because it reads only `parsed.prd`, and the convergence collector rejects canonical V3 operational snapshots because it parses only V2. A2 adds exact refusal-only raw transport at the existing V2 authority. B2 extracts existing projection calculation into a data-only seam, then adds full strict V3 dispatch alongside V2. They have independent causal RED/GREEN cycles.

Selection authority: `root-negative-plan-projection-design-selection-v1.json`, SHA256 `e1ff7edb3deaec08f2b268a17936b6a81c3749f8bc637571048358bdfd5b49d6`. Full investigated predecessor: `i5-negative-plan-and-projection-root-fix-plan-draft-v1.md`, SHA256 `e442e3e4c2e522c241630db1926b5d2f9e695cc4c08b0024a8bfc64d26b0dbfc`. Both are in the same evidence directory and were read in full with matching hashes.

The retained original full8 result is **all eight FAILED, 0/8 passed, fail/no_go**. Original claims 28/32 reached `V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:0`; claims 29/31 separately exited code zero without durable completion and became `infra_retry`/`AGENT_PROCESS_EXITED`; claims 30/33 produced compiler clarification. Each final negative has three PLAN claims and `retry_count = 1`. Correct final refusal semantics cannot satisfy one-claim/zero-retry provenance retroactively.

The investigation's current HTTP captures show complete, settled, matching V3 SF/MC pairs. Historical evaluator poll bodies were not retained. V2-only rejection of the captured V3 shape is established; the exclusive historical sentinel cause is unknown. Do not infer an outage or MC rendering defect. Why the two agents exited without completion, and whether that recurs, remain separate unknowns. No spawner fix follows from this design.

Historical v1 Root-supplied source checkpoint is sole writer `.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`, clean HEAD `f8444811b33d107b8097b8602a50e6272c4a431e`; branch/cleanliness are not independently Git-attested by this static author. At that historical checkpoint SourceMap PR301 was under external review: Task1 evidence already passed; Task2 C0/data43/type/native3 and later compatibility6 are reported by Root. No final SF stock-main build is established. MC845's main stock build is a separate PASS and does not qualify SF. Preserve SourceMap work and its evidence.

## A2: exact bare refusal at existing V2 authority

Actual interfaces are `resolveV3PlanOutputAuthorityV2`, `parseOutputKeyValues`, `completeStep`, and `completeV3PlanProductSpecRefusal`. There is no current `parseAgentOutput` API. Do not add one or replace the global parser.

Extend only the V2 resolver input:

```ts
resolveV3PlanOutputAuthorityV2(input: Readonly<{
  task: string;
  parsed: ParsedOutput;
  rawOutput?: string;
  requestedStackPackId?: string;
  allowSemanticOnlyCompatibility?: boolean;
}>): V3PlanOutputAuthorityV2
```

`rawOutput` is optional for existing direct callers. `completeStep` passes the exact unmodified `output` only to the V2 branch:

```ts
nativeV3PlanAuthority = semanticsV2
  ? resolveV3PlanOutputAuthorityV2({ ...planInput, rawOutput: output })
  : resolveV3PlanOutputAuthorityV1(planInput);
```

Preserve the actual compatibility condition: `plan_output_authority_version !== "product_build_v1"` enables semantic-only compatibility. Do not infer it from raw text, semantics version alone, or a refusal.

The sole new accepted raw form is the entire output:

````text
STATUS: done
```product-spec-rejection-v1
{"schema":"setfarm.product-spec-rejection.v1","sourceTaskHash":"<task ledger hash>","reasons":[{"code":"PRODUCT_SPEC_TASK_AMBIGUOUS","requirementRefs":["<ledger requirement id>"],"message":"<concrete reason>"}]}
```
````

Angle-bracket values illustrate the prompt contract; tests and runtime use exact ledger values. Permit surrounding whitespace, LF or CRLF line endings, and whitespace-only separation between the STATUS line and fence. STATUS spelling, value and fence language remain exact and case-sensitive. There is exactly one opening/closing fence and no text after closing except whitespace. No prose, extra KEY line, PRD sibling, second fence, compiler projection or positive artifact may be ignored.

Use a small private `readBarePlanRejectionV1` helper in the authority file; its name is proposed, not an existing API. Its result is either no bare candidate, exact rejection JSON text, or a thrown `V3PlanOutputV2RejectedError`. A raw candidate begins with the STATUS line immediately followed by the bare rejection fence after whitespace. A candidate with trailing material must fail before the PRD branch, including when generic parsing also finds PRD. An exact bare raw form with nonempty `parsed.prd` or other parsed sibling keys must fail. Existing empty/missing PRD semantics remain consistent with `prdText`; do not fabricate PRD. JSON-object encoding is not a new bare transport; existing JSON objects with PRD continue on the PRD path.

The current bounds are `PLAN_V2_PRD_MAX_BYTES = 4 * 1024 * 1024` and `PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES = 4 * 1024 * 1024`. Raw refusal body recognition must be byte-bounded before regex scanning/JSON parsing; reuse the 4 MiB value for the bare transport. Root/implementer must preserve ordinary PRD positive admission at the existing PRD bound: do not silently cap the entire successful PRD completion at 4 MiB including envelope overhead.

Compute raw UTF-8 byte length first. Select the leading bare envelope with a non-regex finite-state prefix recognizer: consume only surrounding leading whitespace, the exact STATUS line, whitespace-only separation and the exact rejection opening-fence line; stop at the opening fence or first incompatible character. Do not scan JSON or look for artifacts in arbitrary fields. Keep constant auxiliary state, avoid copying raw with `split`/`trim`/global matches, and do not truncate the prefix and then fall through to PRD. Arbitrarily long allowed leading whitespace makes this prefix work linear in prefix length, not constant-time; this is distinct from the body bound and is disclosed rather than hidden by a new global positive cap. If it selects bare, raw byte length over 4 MiB refuses before any body regex/JSON parse, regardless of parsed PRD. If PRD is absent, oversized raw refuses before full-body matching even when the prefix is malformed. A PRD completion with no leading bare candidate follows the unchanged PRD checks. Tests include valid existing PRD at its bound plus envelope overhead, overbound bare, overbound bare followed by valid PRD, and long-leading-whitespace mixed bare cases. No fixed prefix cutoff may turn an oversized mixed bare refusal into accepted PRD.

After exact transport matching, use the same `decode`, `boundedParsedSnapshot`, `ProductSpecRejectionV1Schema.parse`, and `canonicalizeProductSpecRejectionV1({ task, rejection })` path as legacy PRD rejection. Sharing the rejection decoder in this file is allowed. Its canonical work limits, exact task hash, known requirement references, reason enum/length/cardinality, strict schema and canonical ordering remain authoritative. Return `{ status: "rejection", rejection }` directly. Do not manufacture reasons, task hashes, requirements, a product, or proposal projection.

Existing PRD type/byte/cardinality checks, atomic build admission, forbidden legacy/split/compiler projections, semantic-only compatibility authorization and canonical projection remain unchanged. Bare build and bare semantic proposals remain invalid. Transport validation does not determine the semantic truth of a message.

`buildV3Prompt` renders complete templates for each supported authority: semantics V2 shows the bare refusal above and says it is the entire submission; semantics V1 shows `STATUS: done`, `PRD:`, then the rejection fence. Say “exactly one decision: proposal or typed rejection”; retain existing proposal fences and schema rules. Avoid contradictory unconditional “emit one proposal” instructions. V1 resolver behavior remains unchanged.

The existing refusal transaction is unchanged: exact claim closes completed, failed PLAN clarification record binds run/step/claim/hash, runtime completion owner/effect commits, one compiler termination is requested with model redispatch budget zero, then a notification wakes the owner. Invalid transport continues through existing `output_contract_invalid`/`failStep`; it is not transformed into a successful refusal. A valid refusal returns before product/context projection or downstream steps.

## B2: pure strict versioned pair evaluation

New module `src/evals/convergence-projection-v1.ts` has no HTTP, DB, filesystem, runtime-config, installation, runner or server producer imports. Its one public function is:

```ts
import type { z } from "zod";
import type { ConvergenceProjectionEvidenceV1Schema } from "./result-schema.js";

export type ConvergenceProjectionPairEvaluationV1 = Readonly<{
  projection: z.infer<typeof ConvergenceProjectionEvidenceV1Schema>;
  ordinaryPending: boolean;
}>;

export function evaluateConvergenceProjectionPairV1(input: Readonly<{
  runId: string;
  setfarm: unknown;
  missionControl: unknown;
}>): ConvergenceProjectionPairEvaluationV1;
```

That function/type are proposed. The existing `result-schema.ts` imports `suite-schema.ts`, which imports `node:fs/promises`; therefore its schema import must be **type-only** in the pure helper. Runtime result-schema `.parse` stays in the existing runner for every returned projection, including unavailable results. Do not use an `as any` cast to substitute for schema validation.

First mechanically extract current V2-only behavior, including the ten capability keys, unavailable sentinel and settlement calculations, without V3 support. Demonstrate V2 compatibility before adding the V3 failing assertion. Only then dispatch the input schema literal to full `RunOperationalSnapshotV2Schema.safeParse` or full `RunOperationalSnapshotV3Schema.safeParse`. Unknown versions and failed strict parsing return unavailable. Invalid V3 is never retried as V2; never strip V3 authority before accepting or hashing it.

For each parsed snapshot require exact `run.id`, correct full-body snapshot hash and `implementationSubmissionEvidence === true`. Preserve the V2 explicit hash check because V2 schema does not provide it. Locally reproduce the existing stable expression using pure `hashCanonicalJson`: remove `snapshotHash`, `generatedAt` and each invariant's `observedAt`, then hash the remaining complete body. V3 already validates `computeRunOperationalSnapshotHashV3`; using that pure schema export for explicit V3 checking is acceptable. Include version, operationalFailure, operator action permissions and every other authority field. Valid V2/V3 pairs must remain unequal; no version-erased hashing.

Full V3 schema enforces migration22/release-attested operationalFailure capability, inherited constraints, full hash and exact canonical termination/cause/requester/ref binding. Complete V3 cannot omit that capability. A completed accepted V3 snapshot with no canonical failure request must remain valid with `operationalFailure: null`. Its accepted candidate, evidence, deployment receipt and transfer acknowledgement retain every existing exact binding. Existing V2 remains supported for actual producer fallback. No schema, producer, endpoint, attestation or capability policy change is needed.

Preserve the exact existing unavailable result: both hashes are `hashCanonicalJson({ projection: "unavailable" })`, both projections unavailable, `exactHashMatch = false`, ten capability values false, settled/transfer false, both transfer hashes null, `ordinaryPending = false`. Equal sentinel hashes never imply a match.

The ten evidence capability keys remain attempts, claimBinding, runtimeOwnership, managerCompletion, effectLedger, findingRecovery, evidenceLedger, acceptedCandidate, deploymentReceipt and projectTransferAck. Each is the conjunction across both snapshots. Implementation submission stays the separate prerequisite. Do not add `operationalFailureAuthority` to the strict old result capability shape.

Transfer acknowledgement requires matching ackHash, projectRecordHash and sourceSnapshotHash; retain both projected transfer identities only on acknowledgement. Known terminal requires both terminal runs, terminal lifecycle, healthy state, zero invariant count/list, complete projection, only pending/leased/published outbox states and exact unpublished count. Pending owners are activeClaims + activeAttempts + activeRuntimes + openCompletions + mandatoryEffectsPending + unpublishedOutbox. Known terminal with any positive count is ordinaryPending; settled additionally requires all six zero and every outbox item published. Invalid schema/hash is never ordinaryPending. Keep mismatch and settlement independent exactly as today; the pass gate requires their conjunction.

`collectProjection` retains its two concurrent settled HTTP reads. Successful reads delegate both unknown bodies; a failed read delegates unavailable input without admitting one-sided evidence. The runner parses the returned evidence with existing `ConvergenceProjectionEvidenceV1Schema`. Polling remains initial observation plus at most 12 repeats, 250–5000 ms bounded sleeps, existing accepted-only synchronization and cancellation rules. Keep `CONTROL_SETTLEMENT_UNCERTAIN` for untrustworthy cancellation state. No new requests, query negotiation, retries or credentials.

There is no `canAct` property on these snapshots. The negative fixtures keep `summary.operatorActions.stop.allowed` and `.resume.allowed` false. Parsing V3 does not grant action permission. Release preflight remains exact release HEAD/cleanliness/migration attestation; the collector does not newly compare `verifiedReleaseSha` to an expected argument. No claim of continuous source re-attestation is made.

## File Map and ownership

Initial product/test map is exactly eight files:

| Path | Responsibility |
| --- | --- |
| `src/execution/v3-plan-output-authority-v2.ts` | A2 optional exact raw refusal path and shared strict rejection validation |
| `src/installer/step-ops.ts` | Pass exact `output` only to V2 resolver |
| `src/installer/steps/01-plan/module.ts` | V2 bare/V1 PRD complete refusal templates and one-decision wording |
| `tests/execution-attempts/v3-plan-output-authority-v2.test.ts` | A2 genuine old-resolver RED, adversarial/compatibility controls |
| `src/evals/convergence-projection-v1.ts` (new) | B2 V2 mechanical seam then strict V2/V3 pair evaluation |
| `src/evals/convergence-runner.ts` | Delegate collection calculation, retain effects and result validation |
| `tests/evals/convergence-projection-v1.test.ts` (new) | V2 compatibility, genuine refusal V3 RED/GREEN, strict matrix and successful accepted V3 control |
| `tests/evals/fixtures/convergence-operational-snapshot-v3.ts` (new) | Deterministic full-schema refusal and accepted fixtures, exact candidate/deployment/ack bindings and explicit hashes |

Necessary integration extensions are conditional, exact and separately recorded by Root **before editing**:

| Existing path | Trigger / narrowly allowed extension |
| --- | --- |
| `tests/execution-attempts/v3-plan-refusal.integration.test.ts` | Current case uses V1 and PRD. Add V2/product_build_v1 bare-output case through actual completion owner and `completeStep`; preserve V1 baseline; assert exact one claim/zero retry/one typed termination and atomic owner/effect state. |
| `tests/evals/convergence-eval.test.ts` | Needed to prove actual private collector wiring/poll policy, beyond pure helper. Feed both strict refusal and accepted V3 fixtures through existing `ports.http.operationalSnapshot`, prove accepted V3 transfer success before B2 delivery, retain accepted V2 controls and cancellation/drain cases; no export of private collector solely for testing. |
| `tests/steps/01-plan.test.ts` | Unselected after Root's Task3 inspection. Exact V1/V2 rendered-template assertions belong in the already isolated refusal integration after explicit singleton/DB selection; import and call the real PLAN module there. Its unrelated whole-file onComplete/logging paths need not be selected. This retains all prompt coverage and is not pure execution. |

These are test extensions only, not authority to broaden production File Map, create a new launcher, or edit runtime guards. Root must record why each selected extension is necessary. Spec/plan files themselves are documentation, separate from the eight initial product/test files. Any further source need returns to Root for causal File Map refinement before edits.

Root's post-Task2 composition decision selects exactly the first two existing test files. Preserve the V1/PRD baseline and add both V2 reason variants with exact maintained negative tasks/oracles. For real producer-to-collector coverage, retain all eight schema-valid suite cases, reorder only the selected negative first, recompute the suite hash, and cancel through existing control after its first collected result. The final partial suite must remain blocked/no_go. Explicit fixture adapters may return the already-created owned run; no CLI/provider start or full8 success is inferred. Use real SQL canonical collection and unmodified producer bodies. Guarded fixture preparation may use existing public current-head plan/verification and `applyContractSpineMigrationsIfNeeded` on an already-current owned clone, plus concrete owned artifact-inventory bootstrap under unchanged limits/mode. Assert no migration application/activation or authority-head change; fixture attestation is not actual-main/build attestation. Close completion/effects/termination/outbox and both derived delivery owners through existing APIs before asserting settlement. Root's pre-edit ruling and bounded effect audits remain required before execution.

## Validation and effect gates

1. A2 RED must invoke the existing exported resolver with an intermediate input variable carrying `rawOutput` and the actual parser-shaped `parsed: { status: "done\n" + fence }`. Old code ignores the extra property and throws **0:0** while the assertion requires canonical rejection. Use both `PRODUCT_SPEC_TASK_AMBIGUOUS` and `PRODUCT_SPEC_SEMANTIC_UNSUPPORTED`. Missing symbol/import/type/fixture failures are not causal RED.
2. A2 GREEN runs the identical witness after the narrow change, legacy PRD byte/hash equivalence, LF/CRLF/whitespace and no-mutation controls, plus every strict negative in the plan. Preserve atomic-positive and semantic compatibility tests.
3. B2 first extracts unchanged V2 logic and proves full V2 compatibility. A full schema-valid, independently hash-bound refusal V3 pair then must fail the intended settled/exact-match assertion on that V2-only helper. Only strict V3 dispatch turns that same witness GREEN. No missing-module RED. Before B2 GREEN/delivery, require a separately constructed, independently full-schema-valid accepted V3 pair: `operationalFailure: null`, migrations19+22, non-null release attestation, completed terminal run, exact candidate/deployment/ack evidence, complete/exact/settled, all ten evidence capabilities true, `ordinaryPending = false`, `transferAcknowledged = true` and returned ack/project-record hashes equal to the supplied acknowledgement. Preserve the accepted V2 successful control. A separately full-schema-valid accepted V3 pair with unequal transfer identities must yield false acknowledgement and null returned transfer hashes; malformed/impossible fixtures do not qualify this control.
4. Pure tests establish transport and projection data behavior only. They cannot prove claim counts, retries, transactions, dispatch effects or settled runtime ownership.
5. Root later uses the established guarded P3/isolated execution path to prove actual bare completion → real refusal transaction, one completed PLAN claim, retry_count zero, one bound typed terminalized termination, drained completion/effects/owners, no downstream dispatch, and actual collector's strict V3 settled result. Never run against live I5; preserve current admission/DB-selection/source-pin/cleanup guards and original captures. Fixture HTTP-port tests establish collector behavior, not real network or database history.
6. Exact diff/spec/quality review, proportional type checks and scoped overlaps precede delivery. SF stock build is deferred until **final necessary reviewed actual clean main after all known root-fix deliveries**, before SF rollout. No dirty-build flag, runtime bypass, protected PM suite, provider activity or premature full8.
7. Fresh negative qualification requires genuine one-claim/zero-retry provenance plus matching fully settled SF/MC V3 projections. Any new code-zero/no-completion attempt fails that provenance and requires its own evidence investigation. Fresh maintained full8 additionally requires all six positive cases under their unchanged gates.

Pure closure candidates are authority/strict schemas/canonical hashing and type-only result schema; re-audit actual imports before execution. The predecessor's static scans found authority closure 29 local files and V3 schema closure 19, with crypto/util-types/Zod only; those counts are historical static heuristics, not current execution certificates. Runner, context parser and prompt modules transitively load filesystem/runtime/DB/process-capable modules. Isolation cannot be inferred from mocked ports or a test name filter.

This design authorizes no SourceMap changes, provider/PM/live/migration/credential/deletion operation, broad parser/schema/capability redesign, extra retry, guard bypass, secret publication or generated-artifact repair. MC operational static design proceeds separately in the evidence directory. Root's v2 authoring update supplies source `43291050` and an in-progress P1 inert seam/test; these are not independently Git-attested here and do not change this author's static-only scope. Document preparation, source correctness, integration qualification, reviewed delivery, stock build, rollout and full8 GO are distinct completion claims.

