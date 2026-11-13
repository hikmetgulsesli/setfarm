# Vitest Browser Storage Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Generated Vite/React tests use real jsdom Storage on supported Node versions.

**Architecture:** Add a feature-gated Node argument exclusively to Vitest forks in the existing scaffold template. Preserve all existing evidence and runtime guards.

**Tech Stack:** Existing shell scaffold, TypeScript and node:test/tsx. No dependency changes.

**Spec:** `docs/superpowers/specs/2026-11-13-vitest-browser-storage-compat-design.md`

## Global Constraints

- Change the owned setup-repo.sh Vitest template and focused scaffold regression tests only.
- No generated project edits, dependency changes, provider/SDK patches, new repair authority, test skips or guard bypasses.
- No historical run replay.
- Preserve all existing test inclusion, environment, one-worker, isolation and teardown settings.
- Preserve all new records and the blocked b8bb state; do not rescue its generated code.

## File Map

- Modify `scripts/setup-repo.sh`: Vitest config heredoc, supported flag detection and fork-only execArgv.
- Modify `tests/steps/04-setup-repo.test.ts`: actual extracted config and child-boundary regressions. A nearby focused test-support file is allowed if needed to keep extraction separate; no generic library or runtime orchestration changes.
- Root and worker private task records retain original captures and supplemental real Vitest/jsdom reproduction evidence. Production payload is not committed.

### Task 1: Fix generated browser-test storage ownership

**Interfaces:** Existing scaffold script arguments and output remain unchanged. Generated Vitest config remains default-exported defineConfig. Extra worker arguments are empty if the Node flag is unsupported.

- [ ] Extract the actual Vitest heredoc for the test, load it with an inert defineConfig boundary, and assert fork-only arguments when process.allowedNodeEnvironmentFlags supports the flag. Cover unsupported/absent capability and unchanged existing settings. Capture genuine RED before template edits; do not use a source substring test as sole regression.
- [ ] Use this minimal template shape, with names adapted for clarity:

```ts
const nodeRuntime = (globalThis as {
  process?: { allowedNodeEnvironmentFlags?: { has(flag: string): boolean } };
}).process;
const browserWorkerArgs = nodeRuntime?.allowedNodeEnvironmentFlags?.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage'] : [];
```

Add `poolOptions: { forks: { execArgv: browserWorkerArgs } }` within the existing test config. Do not change parent process flags or environment.

- [ ] Verify the real Node child sees the selected capability behavior and unsupported capability never forwards an unknown option. Do not mutate global process state to manufacture the test.
- [ ] Run the focused scaffold tests covering the change and server TypeScript no-emit if relevant to changed test types; record original outputs/PIDs/exits. Do not run full suites or dirty builds.
- [ ] Supplemental real integration: use Root's existing frozen diagnostic directory `E2/claim10-frozen-test-reproduction-v1` only to create a NEW extracted-config file and NEW probe test file/logs (no overwrites). Use the installed cloned Vitest/jsdom dependencies, no install/network/provider. Parent environment has no NODE_OPTIONS. Verify actual localStorage and sessionStorage set/get/remove behavior, and run the unchanged original App test under the generated config. Label supplemental reproduction distinctly; it is not original production evidence or a full application pass.
- [ ] Freeze exact source/test files and hashes, report the actual RED/GREEN and any remaining limits. Root alone stages/commits/delivers after task and whole-branch review.

## Delivery

- [ ] Root reviews, delivers scoped PR and builds clean merged source once. Preserve actual failures and reviews.
- [ ] Plan guarded normal transition separately using actual source/build identities and current operational evidence; no force or current-run repair.
- [ ] After the platform correction, use one clean official baseline run through the existing maintained starter, preserving the prior failure. Qualify only actual orchestrator-owned app/evidence results.
