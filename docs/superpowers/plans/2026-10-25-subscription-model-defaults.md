# Subscription Model Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Prepare ordinary Setfarm model selection for MiniMax M3.1 Flash and
Kimi K3.1 Pro while preserving custom selections and selected runtime guards.

**Architecture:** A small pure installer policy owns known-preset migration and
fresh defaults. Existing consumers retain their boundaries; selected Codex
execution is unchanged. A distinct convergence suite names the new primary.

**Tech Stack:** TypeScript ESM, Node test runner, existing Zod/YAML dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-subscription-model-defaults-design.md`

## Global Constraints

- Use only the existing subscription accounts; no PAYG, credential rotation,
  purchase, topup or implicit paid fallback.
- This change is source preparation, not a live model activation.
- Preserve selected fresh-installation Codex identity, runtime guards, fallback
  refusal and exact argv. The live selected installation remains Codex until a
  separately verified private subscription runtime adapter and guarded transition.
- Do not change live configuration, catalogs, credentials, services or database.
- Do not change Kimi CLI or OpenCode defaults without adapter qualification;
  the direct provider trial did not qualify those worker routes.
- Preserve explicit YAML/environment overrides, unrelated settings, history and
  all technical tools. No blanket reinstall or generated artifact edits.
- Work only in the existing sole writer. Workers do not stage, commit, push,
  merge, deploy or spawn other workers. Root owns delivery.
- Build only on clean committed source; no dirty-build or runtime-guard bypass.

### Task 1: Model selection and compatible source defaults

**Files:** Create `src/installer/agent-model-policy.ts`; modify
`src/installer/install.ts`, `src/installer/constants.ts`,
`src/installer/agent-cron.ts`, `src/execution/operational-retry-directive.ts`,
`workflows/daily-standup/workflow.yml`, `workflows/ui-refactor/workflow.yml`;
create `evals/suites/product-convergence-minimax-m31-flash-v1.json`.
Test `tests/agent-model-defaults.test.ts`,
`tests/execution-attempts/operational-retry-directive.test.ts`,
`tests/execution-attempts/v3-implementation-handoff.test.ts`,
`tests/execution-attempts/v3-implementation-attempt.test.ts`,
`tests/installation/fresh-installation-v3-profile.test.ts` and a focused
suite compatibility test if existing coverage cannot hold it.

**Interfaces:**
- Consume existing `agent.model` and existing configuration `model` at upsert.
- Produce pure `resolveWorkflowAgentModel(explicitModel: string | undefined,
  existingModel: unknown): unknown` in the new module, and exported canonical
  refs `MINIMAX_SUBSCRIPTION_MODEL_REF`, `KIMI_CODING_MODEL_REF`.
- Preserve all selected profile interfaces and exact selected Codex refusal.

- [x] **Step 1: Write causal failing expectations before implementation.**
  Replace the first brittle model-default source-grep assertion with behavioral
  selection coverage. Preserve unrelated existing tool/skill assertions.
  Cover fresh default, no shared mutable fallback array, scalar and object old
  presets, either legacy Kimi provider alias, custom scalar/object/extra keys,
  explicit YAML precedence and unchanged existing main entry. Execute the actual
  upsert function in a bounded Source DATA harness if required to test wiring,
  providing inert tools/skills ports rather than importing installer side effects.
  Update actual retry expectations to the new exact identities first. Example:
  ```ts
  assert.deepEqual(resolveV3ExecutionProfile('primary'), {
    schema: 'setfarm.model-execution-profile.v1', providerId: 'minimax',
    modelId: 'minimax/MiniMax-M3.1-Flash', selection: 'primary',
  });
  assert.equal(resolveV3ExecutionProfile('fallback').modelId, 'kimi/k3.1-pro');
  ```
  Run the retry test before any production edit; record real nonzero exit with
  model mismatch, not an import or harness error, in the report.
- [x] **Step 2: Implement the smallest pure selection policy.**
  ```ts
  export const MINIMAX_SUBSCRIPTION_MODEL_REF = 'minimax/MiniMax-M3.1-Flash';
  export const KIMI_CODING_MODEL_REF = 'kimi/k3.1-pro';
  // explicitModel !== undefined wins; undefined existing or exact old platform
  // preset gets {primary: MINIMAX_SUBSCRIPTION_MODEL_REF,
  // fallbacks: [KIMI_CODING_MODEL_REF]}; every other existing value is preserved.
  ```
  Recognize old presets exactly as the spec lists. At installer upsert use
  `resolveWorkflowAgentModel(agent.model, existing?.model)` and keep the early
  `existing?.default === true` return. Do not change tools/security settings.
  Set story fallback to `kimi/k3.1-pro`; remove only the unused polling constant.
  Update ordinary retry profile literals together; retain local declarations if
  that avoids unnecessary selected DATA harness restructuring.
- [x] **Step 3: Migrate shipped inputs without rewriting history.**
  Replace only the four current bundled `minimax-openai/MiniMax-M3` defaults
  with `minimax/MiniMax-M3.1-Flash`. Clone the original convergence JSON into
  the new filename with `suiteId: product-convergence-minimax-m31-flash-v1`;
  change all eight execution profiles to the new primary, leaving every other
  field exactly equal. The original suite stays byte-identical. Add behavioral
  parsing assertions for actual story fallback, current YAML agent models and
  new-suite validity/profile identity; verify stripping suiteId and profile IDs
  yields deep equality to the original.
- [x] **Step 4: Run focused tests with no selected installation or live DB.**
  Use physical Node `/opt/homebrew/Cellar/node/26.4.0/bin/node`, an environment
  copy omitting `SETFARM_*` and `PG*` variables, and inherited non-secret tool
  paths. Audit test effects before running. Start with agent defaults and selected
  profile tests; run raw retry/handoff/attempt tests through
  `scripts/run-execution-attempt-tests.ts`. Include existing private cron DATA
  tests and YAML model preservation where affected. No provider calls or DB
  integration tests. Record full command, actual exit and pass counts in the
  report; store bounded stdout/stderr in this plan's workspace.
- [x] **Step 5: Self-review and hand back to Root.**
  Inspect the full diff, update plan checkboxes, write the report containing
  baseline/RED/GREEN evidence, effects and known limits. No staging, commit,
  build, delivery or live changes by the worker. Root performs task review,
  commit, no-emit TypeScript verification, whole-branch review and scoped PR delivery. Root validates
  source/build identity and reconciles the continuity checkpoint before yield.

## Delivery validation

Root confirms both task spec and quality verdicts, commits to the scoped branch,
runs `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` before merge,
and obtains a broad final review. GitHub review/checks precede normal merge.
The existing build guard also requires branch `main` and `HEAD == origin/main`;
full `npm run build` runs only in a freshly verified merged-main release clone
with exact current pins/material, never the live tree. Preserve that guard. This source deliverable alone never
qualifies the subscription adapter, live cutover, genuine PG test or full eight
provider-backed convergence cases.
