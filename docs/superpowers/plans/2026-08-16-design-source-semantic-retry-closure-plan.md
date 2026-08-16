# Design Source Semantic Retry Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Product Compiler v3 converge from exact design-source failure evidence while preserving strict semantic gates, exact two-attempt authority, raw selected HTML bytes, and dispatch-ambiguity quarantine.

**Architecture:** Project bounded semantic mismatches from the canonical candidate-selection failure into the existing parent failure artifact, compile only code-owned canonical correction records into attempt two, and keep `retry-delta.v1` as the parent/prompt-hash authority. Add a selected-HTML-only U+00A9 inspection exception and a strict child-process envelope that distinguishes an explicit pre-acceptance Stitch rejection from true ambiguity; both policies join the prompt-contract hash.

**Tech Stack:** TypeScript ESM, Node.js 26 test runner, Zod, canonical JSON/SHA-256 helpers, PostgreSQL isolated-test harness, code-owned Stitch `.mjs` adapter.

**Spec:** `docs/superpowers/specs/2026-08-16-design-source-semantic-retry-closure-design.md`

## Global Constraints

- Keep `setfarm.design-source-generation-retry-delta.v1` byte/schema compatible and keep `maximumAttempts: 2`.
- Never add a third semantic or provider dispatch attempt.
- Never rewrite selected HTML, infer product semantics, add a semantic overlay, or accept a candidate that fails current target/control/observable/source-safety checks.
- Literal U+00A9 is the only selected-HTML-specific non-ASCII exception; ProductSpec and every other English boundary remain unchanged.
- Preserve true dispatch ambiguity: timeout, signal, malformed output, ordinary process failure, partial accepted result, or any local screen artifact cannot use the typed rejection path.
- Semantic retry evidence accepts at most 200 stages, 100 targets per stage, 200 requirements per target, 8 observations per requirement, and 512 KiB canonical bytes.
- A corrected stage prompt accepts at most 400 canonical correction records and 64 KiB of appended correction text; overflow falls back to generic bounded guidance or no retry, never partial-detail authority.
- Prompt lines may include only code-owned directives and canonical JSON. Raw observed values, DOM text, element refs, provider prose, and generated project names are forbidden.
- Include semantic-retry, selected-HTML, and provider-rejection policy objects in the prompt-contract hash.
- No database migration is part of this slice.
- Do not use `SETFARM_ALLOW_DIRTY_BUILD=1`, `SETFARM_SKIP_RUNTIME_GUARD=1`, or any runtime/database/service mutation while the source diff is uncommitted.
- Agent implementers and reviewers do not stage, commit, push, merge, or open PRs. Each task ends with `git status --short`, `git diff --check`, and test evidence for the authorized Setfarm-owned handoff.

## Scoped owner delivery authorization

On 2026-08-16, the user explicitly authorized the primary Setfarm owner for this goal to stage only the approved File Map, commit and push `fix/design-semantic-retry-v2`, open and update its PR, address scoped CI or review findings, mark the PR ready, merge it after all required checks and actionable review threads are clear, and perform the code-owned clean-main rollout, canary, matrix, recovery, and Mission Control reconciliation in Task 8. This authorization overrides the implementation/reviewer handoff restriction only for that primary owner and this branch/PR/goal; implementation and review agents remain read-only delivery claimants.

The authorization does not waive branch protection, clean-worktree gates, tests, review requirements, zero-owner/restart authorities, secret rules, or evidence requirements. It does not authorize manual service starts, ad hoc database mutation, unrelated file delivery, force-push, direct commits to `main`, or external signed distribution. It expires when this internal-production goal is complete or when work would expand beyond the approved File Map and Task 8 scope.

`Standing Owner Authorization v1` now governs causally necessary root fixes discovered while this internal-production objective remains active. Such a fix no longer expires merely because its exact path was absent from the original File Map; the primary owner must first record the causal evidence, update the File Map and tests, and preserve every exclusion above. The user's explicit `resume`, `continue`, `fix all remaining problems`, or equivalent instruction renews execution under a fresh blocked-condition audit without granting external signed-distribution authority.

- Stop and classify rather than widening a gate if one post-fix systemic root repeats three times.
- External signed distribution remains explicitly deferred and outside this plan.

---

## File Map

- Create `src/product-compiler/design-source-semantic-retry-evidence-v1.ts`: strict capacities, policy, schemas, canonical selection-to-retry projection, hostile-input parser, and projection byte fence.
- Create `src/product-compiler/design-source-semantic-retry-corrections-v1.ts`: deterministic rejection-code/semantic-requirement-to-prompt compiler with canonical JSON and prompt capacity fences.
- Create `src/product-compiler/stitch-stage-provider-rejection-v1.ts`: strict provider-rejection policy/envelope, canonical serialization, redaction-safe validation, and exact process-envelope parser.
- Modify `src/product-compiler/design-source-runtime-v2.ts`: persist retry evidence, compile retry prompts, bind all three policies, and inspect U+00A9 without modifying selected bytes.
- Modify `scripts/stitch-api.mjs`: emit the typed envelope only for top-level MCP `isError:true`; keep parsed text errors generic.
- Modify `src/installer/steps/02-design/runtime-v2.ts`: parse exact child rejection, prove no local accepted artifacts, return typed infrastructure failure, and keep every other child failure ambiguous.
- Create `tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts`: schema, capacity, canonical projection, hostile input, raw-value exclusion, and prompt compiler tests.
- Create `tests/product-compiler/stitch-stage-provider-rejection-v1.test.ts`: envelope/policy/canonical parser and malformed/extra-output tests.
- Modify `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`: durable failure projection, targeted retry, U+00A9 byte/hash preservation, negative Unicode, provider retry, carry-forward, replay, and exhaustion.
- Modify `tests/execution-attempts/design-source-compilation-attempt-runner.test.ts`: retry-delta v1 compatibility, true ambiguity, ordinal-two exhaustion, and no duplicate attempt/dispatch tests.
- Modify `tests/steps/02-design-runtime-v2.test.ts`: code-owned child rejection mapping and local-artifact ambiguity tests.
- Modify `tests/stitch-api.test.ts`: exact script source/fixture tests for typed top-level `isError` and generic non-typed failures.

---

### Task 1: Strict semantic retry evidence projection

**Files:**
- Create: `src/product-compiler/design-source-semantic-retry-evidence-v1.ts`
- Create: `tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts`

**Interfaces:**
- Consumes: `StitchTargetCandidateSelectionV2`, `ProductCompilationAttemptArtifactRefV1`, `hashCanonicalJson(value)`, `canonicalJsonBytes(value)`, and the current semantic-check/rejection/failure-code schemas.
- Produces: `DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1`, `DesignSourceSemanticRetryEvidenceV1Schema`, `DesignSourceSemanticRetryEvidenceV1`, `parseDesignSourceSemanticRetryEvidenceV1(value)`, and `projectDesignSourceSemanticRetryEvidenceV1(input): DesignSourceSemanticRetryEvidenceV1 | null`.

- [x] **Step 1: Write the failing policy/schema tests**

  Add exact policy assertions before the module exists:

  ```typescript
  assert.deepEqual(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1, Object.freeze({
    schema: "setfarm.design-source-semantic-retry-evidence-policy.v1",
    maximumStages: 200,
    maximumTargetsPerStage: 100,
    maximumRequirementsPerTarget: 200,
    maximumObservationsPerRequirement: 8,
    maximumCanonicalBytes: 512 * 1024,
    maximumCorrectionRecordsPerStage: 400,
    maximumCorrectionBytesPerStage: 64 * 1024,
  }));
  ```

  Build one rejected selection from the existing contained-game ProductSpec and a candidate missing its declared control while adding an undeclared actionable element. Require a canonical projection with one stage/target, exact rejection codes, exact expected counts/values, and only an `observedValueHash`:

  ```typescript
  const projected = projectDesignSourceSemanticRetryEvidenceV1({
    candidateSelection: rejected.candidateSelection,
    candidateSelectionArtifact: selectionArtifactRef,
  });
  assert.ok(projected);
  assert.equal(projected.schema, "setfarm.design-source-semantic-retry-evidence.v1");
  assert.deepEqual(projected.stages.map((stage) => stage.stageId), ["DSGS_001"]);
  assert.equal(JSON.stringify(projected).includes("Settings"), false);
  assert.equal(projected.stages[0]!.targets[0]!.requirements[0]!.observations[0]!.observedValueHash?.length, 64);
  ```

- [x] **Step 2: Run the new test and verify RED**

  Run:

  ```bash
  node --import tsx --test tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts
  ```

  Expected: FAIL because `design-source-semantic-retry-evidence-v1.ts` does not exist.

- [x] **Step 3: Define strict schemas and canonical projection**

  Implement the public shape with no `z.unknown()` fields:

  ```typescript
  const RetryObservationV1Schema = z.object({
    disposition: z.enum(["missing", "duplicate", "unexpected", "mismatch"]),
    observedCount: z.number().int().nonnegative().max(10_000),
    observedValueHash: Sha256Schema.nullable(),
  }).strict();

  const RetryRequirementV1Schema = z.object({
    kind: StitchCandidateSemanticCheckV2Schema.shape.kind,
    semanticRef: z.string().min(1).max(1_000),
    expectedCount: z.number().int().nonnegative().max(10_000),
    expectedValue: z.string().max(2_000).nullable(),
    observations: z.array(RetryObservationV1Schema).min(1).max(8),
  }).strict();
  ```

  Group only non-exact checks by `(kind, semanticRef)`. Return `null` if two candidates disagree on `expectedCount` or `expectedValue`, any capacity is exceeded, canonical order is invalid, or the final canonical byte length exceeds `512 * 1024`. Hash observed values with a domain-separated payload:

  ```typescript
  const observedValueHash = check.observedValue === undefined
    ? null
    : hashCanonicalJson({
        schema: "setfarm.design-source-semantic-retry-observed-value.v1",
        value: check.observedValue,
      });
  ```

  Join rendered failure codes by candidate screen identity inside the projector, but do not publish screen IDs or element refs. Sort stages, targets, requirements, observations, and code arrays with the repository's UTF-16/canonical helpers.

- [x] **Step 4: Add hostile/capacity/canonical tests**

  Assert each of these returns `null` or strict parse failure without invoking proxy/accessor traps:

  - 201 stages;
  - 101 targets in one stage;
  - 201 requirements in one target;
  - 9 distinct observations for one requirement;
  - conflicting expected values for one `(kind, semanticRef)`;
  - proxy, accessor, cyclic, extra-field, reordered, or over-512-KiB input.

  Also project the same selection twice and require canonical byte/hash equality.

- [x] **Step 5: Run Task 1 GREEN and record handoff evidence**

  Run:

  ```bash
  node --import tsx --test tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts
  npx tsc -p tsconfig.json --noEmit
  git diff --check
  git status --short
  ```

  Expected: focused tests and TypeScript pass; only Task 1 files plus approved docs are dirty.

---

### Task 2: Deterministic correction compiler

**Files:**
- Create: `src/product-compiler/design-source-semantic-retry-corrections-v1.ts`
- Modify: `tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts`

**Interfaces:**
- Consumes: strict `DesignSourceSemanticRetryEvidenceV1` and `DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1` from Task 1.
- Produces: `compileDesignSourceSemanticRetryCorrectionsV1({evidence,stageId,reasonCodes}): readonly string[]` and `genericDesignSourceRetryCorrectionLinesV1(reasonCodes): readonly string[]`.

- [x] **Step 1: Write failing prompt-compiler tests**

  For one strict evidence fixture, require exact deterministic code-class lines and one-line canonical records:

  ```typescript
  const lines = compileDesignSourceSemanticRetryCorrectionsV1({
    evidence,
    stageId: "DSGS_001",
    reasonCodes: [
      "CANDIDATE_CONTROL_SLOT_SET_MISMATCH",
      "CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL",
    ],
  });
  assert.ok(lines.includes(
    "Render every and only declared physical control slot with exact data-action and data-control-slot on the same actionable element.",
  ));
  assert.match(lines.join("\n"), /^semantic_requirement: \{"expectedCount":/m);
  assert.doesNotMatch(lines.join("\n"), /Settings|E[0-9]{6}|observedValue/);
  assert.deepEqual(lines, compileDesignSourceSemanticRetryCorrectionsV1({
    evidence,
    stageId: "DSGS_001",
    reasonCodes: [...reasonCodes].reverse(),
  }));
  ```

  Cover surface, control, action-input, observable, target/title, all undeclared classes, and rendered-source failure codes.

- [x] **Step 2: Run the compiler test and verify RED**

  Run the Task 1 test file. Expected: FAIL because the correction module is missing.

- [x] **Step 3: Implement fixed code-class mapping and canonical records**

  Use a frozen complete mapping for every currently known candidate rejection class. Serialize each target and requirement record with `canonicalJsonStringify`:

  ```typescript
  lines.push(`semantic_requirement: ${canonicalJsonStringify({
    targetRef,
    kind: requirement.kind,
    semanticRef: requirement.semanticRef,
    expectedCount: requirement.expectedCount,
    ...(requirement.expectedValue === null ? {} : { expectedValue: requirement.expectedValue }),
  })}`);
  ```

  Never serialize observations. Unknown reason codes remain in failure evidence but add no invented line. Deduplicate and sort fixed directives by code, then append canonical records in stage/target/kind/ref order.

- [x] **Step 4: Enforce correction count/byte fences without truncation**

  Build the full candidate line set first. If it exceeds 400 records or 64 KiB, return only bounded generic code-class lines; if those exceed the byte cap, return `[]`. Add tests proving the result is either complete targeted evidence or generic, never the first N requirements.

- [x] **Step 5: Run Task 2 GREEN and record handoff evidence**

  Run the Task 1 test, TypeScript no-emit, diff check, and status. Expected: all pass.

---

### Task 3: Strict Stitch provider-rejection contract

**Files:**
- Create: `src/product-compiler/stitch-stage-provider-rejection-v1.ts`
- Create: `tests/product-compiler/stitch-stage-provider-rejection-v1.test.ts`
- Modify: `scripts/stitch-api.mjs`
- Modify: `tests/stitch-api.test.ts`

**Interfaces:**
- Produces: `STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1`, `StitchStageProviderRejectionV1Schema`, `StitchStageProviderRejectionV1`, `canonicalStitchStageProviderRejectionV1(value)`, and `parseStitchStageProviderRejectionProcessEnvelopeV1({stdout,stderr})`.
- Child wire schema: `setfarm.stitch-stage-provider-rejection.v1` with literal tool `generate_screen_from_text`, `isError:true`, `acceptedResult:false`, empty accepted screen/result arrays, bounded redacted diagnostic, and its domain-separated hash.

- [x] **Step 1: Write failing schema/parser tests**

  Require the exact policy and canonical envelope:

  ```typescript
  const envelope = StitchStageProviderRejectionV1Schema.parse({
    schema: "setfarm.stitch-stage-provider-rejection.v1",
    classification: "explicit_mcp_error_before_accepted_result",
    tool: "generate_screen_from_text",
    isError: true,
    acceptedResult: false,
    acceptedScreenIds: [],
    acceptedArtifactLocators: [],
    diagnosticCode: "STITCH_MCP_TOOL_ERROR",
    diagnostic: "Request contains an invalid argument",
    diagnosticHash: hashCanonicalJson({
      schema: "setfarm.stitch-stage-provider-rejection-diagnostic.v1",
      diagnostic: "Request contains an invalid argument",
    }),
  });
  assert.deepEqual(
    parseStitchStageProviderRejectionProcessEnvelopeV1({
      stdout: "",
      stderr: `${canonicalStitchStageProviderRejectionV1(envelope)}\n`,
    }),
    envelope,
  );
  ```

  Reject nonempty stdout, extra stderr text, false `isError`, any accepted ID/artifact, unknown fields, long/sensitive diagnostics, hash drift, and parsed-text-only `isError` lookalikes.

- [x] **Step 2: Run schema and script tests RED**

  Run:

  ```bash
  node --import tsx --test tests/product-compiler/stitch-stage-provider-rejection-v1.test.ts
  node --import tsx --test tests/stitch-api.test.ts
  ```

  Expected: FAIL because the contract and typed script output are absent.

- [x] **Step 3: Implement schema/policy/canonical parser**

  The parser accepts exactly empty stdout plus one canonical JSON envelope and one trailing newline. It must parse, reserialize, compare bytes, verify diagnostic hash, and reject everything else. Redaction continues to use the existing AQ/token patterns; policy includes maximum diagnostic 700 code units and maximum canonical envelope 4 KiB.

- [x] **Step 4: Emit the envelope only for top-level MCP `isError:true`**

  Add a private code-owned error class inside `scripts/stitch-api.mjs`. In `assertToolResultOk`, distinguish top-level `result?.isError === true` from generic parsed error payloads:

  ```javascript
  if (result?.isError === true) {
    throw new StitchExplicitProviderRejection(toolName, toolResultTextSample(result));
  }
  const error = toolResultError(result);
  if (error) throw new Error(`${toolName} failed: ${redactDiagnosticText(error).slice(0, 700)}`);
  ```

  The main catch emits only the strict envelope for that nominal class. Every other error keeps the existing generic `{error}` output and nonzero exit. Add source tests proving text-embedded `isError`, quota prose, timeout prose, and ordinary errors cannot emit the typed schema.

- [x] **Step 5: Run Task 3 GREEN and record handoff evidence**

  Run both focused tests, TypeScript no-emit, `git diff --check`, and status.

---

### Task 4: Selected-HTML admission and prompt policy authority

**Files:**
- Modify: `src/product-compiler/design-source-runtime-v2.ts`
- Modify: `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 semantic policy and Task 3 provider-rejection policy.
- Produces: prompt-contract authority that binds semantic retry, selected-HTML, and provider-rejection policy; selected HTML admits only U+00A9 without changing bytes.

- [x] **Step 1: Write the failing U+00A9 acceptance test**

  Extend the existing isolated-PostgreSQL runtime integration fixture with exact semantic HTML containing `Copyright © 2026`. Require accepted status and byte equality at download and final projection:

  ```typescript
  assert.equal(result.runner.status, "accepted", JSON.stringify(result.runner));
  assert.deepEqual(
    await readFile(path.join(attemptRoot, "download", "stages", "DSGS_001", "screens", `${screenKey}.html`)),
    copyrightHtmlBytes,
  );
  assert.deepEqual(
    await readFile(path.join(repo, "stitch", `${screenId}.html`)),
    copyrightHtmlBytes,
  );
  assert.equal(
    createHash("sha256").update(await readFile(path.join(repo, "stitch", `${screenId}.html`))).digest("hex"),
    createHash("sha256").update(copyrightHtmlBytes).digest("hex"),
  );
  ```

  Add separate literal U+00E9, Cyrillic, U+200B, invalid UTF-8, byte-limit, and code-unit-limit cases that remain rejected.

- [x] **Step 2: Run the focused integration test and verify RED**

  Run:

  ```bash
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/design-source-runtime-v2.integration.test.ts
  ```

  Expected: the U+00A9 case fails with `DESIGN_SOURCE_SELECTED_HTML_ENGLISH_REQUIRED`; existing negative cases pass.

- [x] **Step 3: Implement inspection-only neutral-symbol handling**

  Add `neutralCodePoints: ["U+00A9"]` to `DESIGN_SOURCE_SELECTED_HTML_ADMISSION_POLICY_V2`. After fatal UTF-8 decode, inspect only an ephemeral copy:

  ```typescript
  const inspectionText = decoded.replaceAll("\u00a9", " ");
  const violation = inspectEnglishTextV1(inspectionText);
  ```

  Do not assign the inspection copy to any artifact, renderer, selector, writer, or hash input.

- [x] **Step 4: Bind all three policies into prompt-contract authority**

  Extend only the canonical prompt-contract hash payload:

  ```typescript
  promptContractHash: hashCanonicalJson({
    schema: "setfarm.design-source-prompt-contract.v2",
    builder: "buildV3BatchStitchPromptV2",
    generationTargetsSchema: generationTargets.schema,
    projectId: input.projectId,
    semanticRetryPolicy: DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1,
    selectedHtmlAdmissionPolicy: DESIGN_SOURCE_SELECTED_HTML_ADMISSION_POLICY_V2,
    providerRejectionPolicy: STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1,
  }),
  ```

  Update the existing exact hash test and prove removing or changing any policy changes the authority hash.

- [x] **Step 5: Run Task 4 GREEN and record handoff evidence**

  Run the isolated integration test, pure policy tests, TypeScript no-emit, diff check, and status.

---

### Task 5: Persist semantic retry evidence and compile attempt-two prompts

**Files:**
- Modify: `src/product-compiler/design-source-runtime-v2.ts`
- Modify: `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`
- Modify: `tests/execution-attempts/design-source-compilation-attempt-runner.test.ts`

**Interfaces:**
- Consumes: Task 1 projector/schema and Task 2 correction compiler.
- Produces: failure artifacts with strict `retrySemanticEvidence`, deterministic targeted stage prompts, and unchanged `retry-delta.v1` persistence.

- [x] **Step 1: Write the failing durable-evidence/targeted-prompt test**

  In the existing rejected-candidate fixture, open attempt one's `raw/failure.json` and require a strict nested projection. Require attempt two's prompt to contain exact canonical requirements for the missing declared control and unexpected interactive element, but no screen ID, element ref, raw text, or provider diagnostic:

  ```typescript
  const failureArtifact = JSON.parse(await readFile(failurePath, "utf8"));
  const retryEvidence = DesignSourceSemanticRetryEvidenceV1Schema.parse(
    failureArtifact.evidence.retrySemanticEvidence,
  );
  assert.equal(retryEvidence.stages[0]!.stageId, "DSGS_001");
  assert.match(retryPrompts[1]!, /semantic_requirement: \{"expectedCount":1/);
  assert.doesNotMatch(retryPrompts[1]!, /screen-runtime-v2-rejected|E[0-9]{6}|Settings/);
  ```

  Assert `request/retry-delta.json` still parses as `setfarm.design-source-generation-retry-delta.v1`, points at the exact parent failure artifact hash, and contains only stage prompt hash transitions.

- [x] **Step 2: Run the isolated runtime/runner tests and verify RED**

  Expected: nested evidence and canonical requirement assertions fail under the current rejection-code-only projection.

- [x] **Step 3: Persist projection with candidate-selection failure**

  In `materializeAcceptedAuthority`, call the Task 1 projector after writing `candidate-selection.json`. Store:

  ```typescript
  evidence: {
    phase: "candidate_selection",
    candidateSelectionArtifact: selectionRef,
    failedStageIds,
    failedTargetRefs,
    unresolvedTargets,
    retrySemanticEvidence: projectedRetryEvidence,
  }
  ```

  Keep `unresolvedTargets` for historical/generic readers. The strict projection must be `null` rather than partial when unavailable.

- [x] **Step 4: Replace the one-code correction helper with the compiler**

  Keep the existing bounded `retryReasonCodes` fallback. Strict-parse `retrySemanticEvidence`, require its candidate-selection artifact ref equals the sibling failure evidence ref, and call Task 2 per failed stage. Append the compiler output after the existing code-owned retry header. If parsing/binding fails, append only generic code-class lines; do not fail an otherwise valid terminal parent artifact.

- [x] **Step 5: Test every mismatch class and carry-forward**

  Add table-driven pure/integration assertions for surface, control slot, action input, observable, target/title, undeclared action/control/input/surface/interactive, and rendered-source codes. Keep the existing two-stage fixture: stage one must be reused byte-for-byte while only failed stage two is regenerated.

- [x] **Step 6: Run Task 5 GREEN and record handoff evidence**

  Run the pure semantic tests plus both isolated execution-attempt tests, TypeScript no-emit, diff check, and status.

---

### Task 6: Map explicit provider rejection without weakening ambiguity

**Files:**
- Modify: `src/installer/steps/02-design/runtime-v2.ts`
- Modify: `tests/steps/02-design-runtime-v2.test.ts`
- Modify: `tests/execution-attempts/design-source-runtime-v2.integration.test.ts`
- Modify: `tests/execution-attempts/design-source-compilation-attempt-runner.test.ts`

**Interfaces:**
- Consumes: Task 3 canonical provider envelope/parser.
- Produces: code-owned child execution result that returns `DesignSourceGenerationDispatchResultV2` with `disposition:"infrastructure_failure"` only for the exact empty-local-output typed rejection.
- Internal test surface: `generateStitchStageOnceWithExecutorForInternalTestV2(input, executor)` delegates to the same private core as `generateStitchStageOnceV2(input)`; only `tests/steps/02-design-runtime-v2.test.ts` may import it. A source-boundary assertion rejects every non-test import and proves production calls the zero-override wrapper.

- [x] **Step 1: Write failing child-runtime mapping tests**

  Add the exact internal test executor described above. Its executor receives the existing `ExecOnceInput` and returns a rejected child observation with empty stdout, canonical envelope stderr, and nonzero exit. Simulate that result and verify:

  ```typescript
  assert.equal(result.disposition, "infrastructure_failure");
  if (result.disposition === "infrastructure_failure") {
    assert.deepEqual(result.failure.reasonCodes, ["DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE"]);
    assert.deepEqual(result.failure.evidence.failedStageIds, ["DSGS_001"]);
  }
  ```

  Then write `unexpected.html` into the generated output directory before returning the same envelope and require an ordinary thrown error, which the runner later classifies as `dispatch_ambiguous`.

  Read `src/installer/steps/02-design/runtime-v2.ts` plus all non-test TypeScript import declarations and assert the internal-test symbol has no production importer and `runDesignPreclaimV2` uses only `generateStitchStageOnceV2`.

- [x] **Step 2: Run step/runtime tests and verify RED**

  Run:

  ```bash
  node --import tsx --test tests/steps/02-design-runtime-v2.test.ts
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/design-source-runtime-v2.integration.test.ts tests/execution-attempts/design-source-compilation-attempt-runner.test.ts
  ```

  Expected: typed child failure is currently thrown and becomes ambiguous.

- [x] **Step 3: Parse exact child failure and prove local output absence**

  In the `execFile` error path, accept the Task 3 parser only when stdout is empty and stderr is one canonical envelope. In `generateStitchStageOnceV2`, inspect the temporary output root with bounded `readdir`/`lstat`: it must be absent or an empty owned directory. Symlink, special file, unknown entry, HTML, PNG, manifest, or transport bytes invalidate the typed path. Return raw evidence as the canonical envelope and a failure seed containing exact stage ID and policy hash.

- [x] **Step 4: Compile the provider retry into ordinal two**

  Add one fixed generic line for `DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE`: regenerate the unchanged typed stage because the previous call returned no accepted local result. The prompt still changes and therefore receives the existing retry delta. Do not add semantic requirements unless independently present in the strict failure artifact.

- [x] **Step 5: Prove success, exhaustion, ambiguity, and replay**

  Add four runner cases:

  1. typed provider rejection then accepted ordinal two -> accepted with exactly two dispatches;
  2. typed rejection twice -> terminal infrastructure failure, two dispatches, no third attempt;
  3. thrown timeout/generic error -> dispatch ambiguous after one dispatch;
  4. replay after terminal or accepted response loss -> same attempt/projection and no new dispatch.

  Require all final owner/attempt states terminal and no active lease remains in repository rows.

- [x] **Step 6: Run Task 6 GREEN and record handoff evidence**

  Run script, product-compiler, step, isolated runtime/runner tests, TypeScript no-emit, diff check, and status.

---

### Task 7: Source validation, security review, and Setfarm-owned PR handoff

**Files:**
- All files listed in the File Map; no generated project/runtime artifact may enter the diff.

**Interfaces:**
- Consumes: complete Tasks 1–6 diff and passing focused tests.
- Produces: review-ready source evidence, clean Setfarm-owned commit/branch, reviewed PR, and exact merged release SHA.

- [x] **Step 1: Run the complete focused source suite**

  ```bash
  node --import tsx --test \
    tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts \
    tests/product-compiler/stitch-stage-provider-rejection-v1.test.ts
  node --import tsx --test tests/stitch-api.test.ts
  node --import tsx --test tests/steps/02-design-runtime-v2.test.ts
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test \
    tests/execution-attempts/design-source-compilation-attempt-runner.test.ts \
    tests/execution-attempts/design-source-runtime-v2.integration.test.ts
  npx tsc -p tsconfig.json --noEmit
  npm run check:english
  npm run check:paths
  npm run check:migration-digests
  npm run check:mission-control-contracts
  git diff --check
  ```

- [x] **Step 2: Run full dirty-source-safe tests**

  Run `npm test` from the isolated worktree. Do not run the package build while dirty and do not use a dirty-build override. Record the terminal exit code and suite summaries.

- [x] **Step 3: Perform independent read-only review**

  Review exact current bytes for:

  - prompt injection/raw-value leakage;
  - capacity truncation disguised as complete evidence;
  - U+00A9 mutation or global English widening;
  - provider-envelope forgery or partial-result retry;
  - ambiguity/timeout weakening;
  - third-attempt or duplicate-dispatch paths;
  - replay, response-loss, carry-forward, and owner cleanup;
  - secret/path/generated-artifact leakage.

  Resolve every current Critical/High/Medium finding and rerun its focused regression plus Steps 1–2. The review must explicitly return CLEAR on the final bytes.

- [x] **Step 4: Record the Setfarm-owned handoff checkpoint**

  Run `git status --short --branch`, `git diff --stat`, and `git diff --check`. Verify the diff contains only the approved File Map plus this spec/plan. Do not stage, commit, push, or open the PR from an implementation/review agent.

  Source-verification record (2026-08-16): focused suite 60/60, design-source runtime integration 2/2, TypeScript `--noEmit`, English/path contracts, migration digests, Mission Control contract artifacts, and `git diff --check` passed. Full `npm test` exited 0 on the final bytes. Independent read-only review returned `CLEAR` with no actionable Critical/High/Medium finding. The working tree contains only the approved source/test files and this spec/plan; nothing was staged, committed, pushed, or deployed by the implementation/review agent.

- [ ] **Step 5: Authorized owner creates the clean PR delivery**

  The authorized Setfarm owner reopens all changed bytes, proves the focused/full evidence, stages only the approved paths, creates one conventional feature commit on `fix/design-semantic-retry-v2`, pushes, and opens a PR to `main`. GitHub checks and unresolved review threads must be read from current PR state; merge only after all required checks pass and every actionable thread is resolved.

- [ ] **Step 6: Verify the exact committed branch cleanly**

  In a fresh clean worktree at the PR head, run:

  ```bash
  npm ci
  npx tsc --noEmit
  npm test
  git status --short
  ```

  Expected: TypeScript and full tests pass and status is empty. `npm run build` is not a PR-branch check: the code-owned build authority must refuse every branch other than clean `main`, and `SETFARM_ALLOW_DIRTY_BUILD=1` remains forbidden. Record that refusal once without bypass, then run the real build only from the exact clean merged-main SHA in Task 8, where release metadata must identify that SHA.

---

### Task 8: Clean-main rollout, canary, matrix, and Mission Control reconciliation

**Files:**
- No source edits unless new authoritative evidence identifies a distinct systemic root; generated projects remain disposable evidence.

**Interfaces:**
- Consumes: merged reviewed PR, exact clean Setfarm main SHA, verified migration 30, zero active owners, healthy Setfarm/Mission Control services.
- Produces: clean canary, controlled 8-slot convergence artifact/gate, recovery/idempotency evidence, Mission Control DB/API/UI equality, controlled fleet closure, and final internal-production completion evidence.

- [ ] **Step 1: Establish clean canonical release truth**

  On the Mac mini canonical repositories:

  ```bash
  git -C /Users/setrox/ai/setrox/setfarm status --short --branch
  git -C /Users/setrox/ai/setrox/mission-control status --short --branch
  git -C /Users/setrox/ai/setrox/setfarm rev-parse HEAD
  git -C /Users/setrox/ai/setrox/setfarm rev-parse refs/remotes/origin/main
  git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD
  git -C /Users/setrox/ai/setrox/mission-control rev-parse refs/remotes/origin/main
  ```

  Require literal clean `main` and `HEAD === origin/main` in both repos. Preserve the separate docs planning worktree; do not use it as runtime source.

  Capture the already verified Setfarm SHA in a standalone fail-fast assignment:

  ```bash
  SETFARM_RELEASE_SHA="$(git -C /Users/setrox/ai/setrox/setfarm rev-parse HEAD)"
  SETFARM_REMOTE_SHA="$(git -C /Users/setrox/ai/setrox/setfarm rev-parse refs/remotes/origin/main)"
  readonly SETFARM_RELEASE_SHA
  readonly SETFARM_REMOTE_SHA
  test "$SETFARM_RELEASE_SHA" = "$SETFARM_REMOTE_SHA"
  ```

- [ ] **Step 2: Reverify platform and service prerequisites**

  From clean Setfarm main run:

  ```bash
  npm run --silent db:contract-spine:verify
  npm run --silent db:contract-spine:audit-current-authority-ledgers
  curl -fsS http://127.0.0.1:3333/ >/dev/null
  curl -fsS http://127.0.0.1:3080/api/projects >/dev/null
  ```

  Use the current code-owned zero-owner/restart authority before restarting any service. Never call `launchctl kickstart` or manually start Node outside that authority. Require the exact clean release after restart and zero open claim/attempt/runtime/recovery ownership before a run starts.

- [ ] **Step 3: Run one clean canary**

  Start the baseline utility task from the checked-in convergence suite through the clean compiled CLI:

  ```bash
  CANARY_TASK="$(jq -er '.cases[] | select(.caseId == "utility-status-baseline") | .task' evals/suites/product-convergence-v1.json)"
  readonly CANARY_TASK
  test -n "$CANARY_TASK"
  SETFARM_V3_ACTIVATION=enabled node dist/cli/cli.js workflow run feature-dev "$CANARY_TASK"
  ```

  Capture the returned run ID, poll only through the normal status/DB observation path, and retain its content-addressed attempt/failure/accepted artifacts. Require design-source evidence to show either direct exact acceptance or exactly one parent-bound retry; U+00A9 must preserve raw bytes/hash; no ambiguous dispatch may be relabeled. If the same systemic root appears three times across post-fix runs, stop and classify it before continuing.

- [ ] **Step 4: Run the controlled golden matrix at one exact release**

  First preflight, then execute with the same explicit SHA:

  ```bash
  SETFARM_V3_ACTIVATION=enabled npm run --silent eval:convergence -- \
    --suite evals/suites/product-convergence-v1.json \
    --release-sha "$SETFARM_RELEASE_SHA" \
    --json

  SETFARM_V3_ACTIVATION=enabled npm run --silent eval:convergence -- \
    --suite evals/suites/product-convergence-v1.json \
    --release-sha "$SETFARM_RELEASE_SHA" \
    --execute \
    --json
  ```

  `SETFARM_RELEASE_SHA` must be assigned from the already verified clean main SHA in a standalone assignment. Accept only the content-addressed result and release-gate artifacts emitted by the runner. Require every positive slot accepted, every typed-negative slot exact, no repeated systemic root, and zero final ownership.

- [ ] **Step 5: Exercise recovery/idempotency from authoritative artifacts**

  For the canary and matrix evidence, prove accepted replay causes zero redispatch, terminal provider rejection cannot create ordinal three, response loss adopts one exact attempt/projection, unchanged stages carry forward byte-for-byte, and all claim/attempt/runtime/recovery records settle. Use DB rows/events/artifacts and claim logs, not agent prose.

- [ ] **Step 6: Reconcile Mission Control DB/API/UI**

  For every controlled run, compare the canonical PostgreSQL operational snapshot hash with Setfarm dashboard and Mission Control API/UI projections. At minimum verify:

  ```bash
  curl -fsS http://127.0.0.1:3080/api/projects
  curl -fsS http://127.0.0.1:3333/
  ```

  Require run status, stack, story progress, failure owner/retryability, attempts, claims, accepted candidate, and terminal evidence to match the DB-derived model. A UI/API mismatch is a failure, not presentation-only success.

- [ ] **Step 7: Close the controlled fleet and audit the full goal**

  Retain only controlled clean-run evidence; do not repair polluted generated projects. Audit each original goal requirement against current release SHA, PR/check/review state, result/gate artifacts, DB rows, service HTTP state, recovery/idempotency evidence, and final ownership. Keep external signed distribution listed as blocked/deferred false authority. Mark the persistent goal complete only when every internal-production requirement has direct current evidence and no required work remains.
