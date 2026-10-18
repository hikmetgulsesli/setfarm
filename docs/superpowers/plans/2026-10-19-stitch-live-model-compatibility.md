# Stitch Live Model Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Root owns all git/delivery; workers edit/test/report without staging, committing, pushing, deploying or dispatching agents.

**Goal:** Remove retired production Stitch generation defaults while preserving exact authority and transport identity.

**Architecture:** Replace the obsolete code-owned defaults before authority hashing. Exercise real request construction with an offline external transport double; leave rejection and ownership contracts intact.

**Tech Stack:** TypeScript ESM, Node.js node:test, existing Stitch MCP adapter and compilation authority.

**Spec:** `docs/superpowers/specs/2026-10-19-stitch-live-model-compatibility-design.md`

## Global Constraints

- Sole Setfarm writer: existing linked worktree on `fix/stitch-live-model-defaults-20261019`.
- Default model: `GEMINI_3_8_FLASH`; explicit supported override fixture: `GEMINI_3_5_FLASH_LITE`.
- Model is resolved before authority hashing and identical bytes reach the provider.
- No silent remapping, automatic fallback, hidden retry, credential rotation in attempt-owned generation, schema/migration/ACL change or historical artifact rewrite.
- Offline tests only; no live provider, service, production DB or credential effects by workers.
- Root alone stages/commits/pushes/delivers. Never bypass dirty-build or runtime guards.

### Task 1: Correct the production model defaults with boundary regressions

**Files:**
- Modify: `src/installer/steps/02-design/runtime-v2.ts` (executeDesignPreclaimV2 authority and generateStage model).
- Modify: `scripts/stitch-api.mjs` (four generate command defaults and usage text).
- Modify: `src/installer/steps/02-design/preclaim.ts` (two explicit generation caller defaults).
- Modify: `src/installer/step-ops.ts` (explicit generated-screen caller default).
- Test: `tests/stitch-api.test.ts`.
- Test: `tests/steps/02-design-runtime-v2.test.ts` (or the existing closest actual preclaim integration fixture if necessary; report exact file and rationale).

**Interfaces:**
- Consumes: existing `runStitchCli(argv)` and `executeDesignPreclaimV2(input, dependencies)` contracts without changing their public meanings.
- Produces: omitted-model calls seal and dispatch the supported default; explicit-model calls preserve the supplied value; typed failure/no-replay behavior remains intact.

- [ ] Step 1: Read the spec, relevant existing tests and the production request path. Name the actual wrong request each new test will catch. Record initial base SHA and a baseline focused run. Do not import or call any real provider.
- [ ] Step 2: Add offline behavioral regressions before production edits. Use a literal enum fixture independently derived from the retained live schema. Run actual command handlers through fake fetch/controlled external execution, accepting requests only when their modelId belongs to the live enum. For each of the four generation command defaults, collect the actual tools/call arguments and assert successful command outcome plus `modelId === "GEMINI_3_8_FLASH"`. Hand-checked fixture expectations:

```ts
const supported = new Set(["MODEL_ID_UNSPECIFIED", "GEMINI_3_8_FLASH", "GEMINI_3_5_FLASH_LITE"]);
// The fake external boundary rejects an actual obsolete request, rather than
// replacing the function whose request construction is under test.
assert.equal(exitCode, 0);
assert.equal(actualGenerationArguments.modelId, "GEMINI_3_8_FLASH");
assert.equal(actualGenerationArguments.deviceType, "DESKTOP");
```

Also test explicit `GEMINI_3_5_FLASH_LITE` unchanged; rejected/ambiguous exact-attempt generation has one generation and no hidden replay. Use complete existing accepted screen/artifact fixtures; no fake accepted authority or public gate bypass. At the preclaim boundary observe both generated authority artifact and dispatched stage; assert the same hand-derived model for default and override. Reuse existing genuine/bounded fixtures, not a source-text equality test or a new test-only production export.
- [ ] Step 3: Run `node --import tsx --test tests/stitch-api.test.ts tests/steps/02-design-runtime-v2.test.ts` using the physical Node26 toolchain from the writer. Preserve full RED output outside tracked source. Required RED is an obsolete outgoing model/authority mismatch, not a harness/import error. If real PG fixture is necessary, Root supplies isolated owned harness; do not fall back to live DB or fake admission.
- [ ] Step 4: Replace exactly the current production retired defaults/pins with `GEMINI_3_8_FLASH`, including usage strings. The actual authority-bound resolver remains:

```ts
const model = input.model ?? "GEMINI_3_8_FLASH";
```

Keep that same `model` in both authority input and generateStage. CLI omitted parameter defaults use the same literal. Do not rewrite explicit supplied arguments, negative fixtures or existing records.
- [ ] Step 5: Run the focused regressions and adjacent existing rejection/ambiguity/parser tests once. Preserve GREEN command/output, counts, no skips/cancellations and actual files. Review the diff for production retired pins and accidental credential/output changes. Report DONE or exact concerns; never claim build/full8 from a test run.
- [ ] Step 6: Root verifies original logs, stages scoped source/tests/docs, commits the branch, produces a review package and obtains independent spec-and-quality review. Fix covering regressions on findings. After review Root runs clean build/contracts, PR/cloud review, normal integration and later real unchanged full8 qualification.
