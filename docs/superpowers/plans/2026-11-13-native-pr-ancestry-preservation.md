# Native PR Ancestry Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve an accepted native candidate's commit identity through PR integration so existing QA repair can authenticate the integrated source.

**Architecture:** Select an explicit ancestry-preserving mode in the existing V3 verify caller. The merge helper uses one ordinary exact-head merge in that mode; existing downstream ancestry checks remain authoritative.

**Tech Stack:** TypeScript ESM, node:test, TypeScript source-data extraction and owned local Git fixtures.

**Spec:** `docs/superpowers/specs/2026-11-13-native-pr-ancestry-preservation-design.md`

## Global constraints

- Root is the sole production writer and delivery owner in the existing writer checkout.
- Preserve the original failed run, source commits, QA findings and native evidence.
- Native mode requires the authenticated tested head and permits one normal merge attempt.
- No native admin/squash/unchecked-head fallback; no ancestry-to-tree substitution.
- No generated-code edit, current-run repair, rearm, history rewrite, new role, migration, timeout, budget or provider change.
- Keep the finite source-data test file free of runtime, DB, selected-profile and child-process imports. Real Git belongs in its separate owned fixture file.

## Task 1: Preserve native merge ancestry

**Files:**
- Modify: `src/installer/pr-state.ts`, `tryAutoMergePR`.
- Modify: `src/installer/step-ops.ts`, the exact-tested-head call inside `handleVerifyEachCompletion`.
- Modify: `tests/execution-attempts/subscription-owned-stage-evidence-v1.test.ts`.
- Create: `tests/execution-attempts/native-pr-merge-ancestry.test.ts`.

**Interfaces:**
- Consumes the unchanged PR URL, story/run identity and authenticated tested SHA, plus the explicit optional merge mode.
- Produces the existing boolean result; false retains the existing pending-verification behavior.

- [x] **Step 1: Add the failing caller and local Git regressions.**

Extend the existing source-data verify fixture with the persisted protocol port. Require its actual merge clause to pass:

```typescript
const f = verify();
await f.route();
assert.deepEqual(f.mergeArguments, [["https://example.invalid/pr/1", "US-001", "run-verify",
  "1".repeat(40), "preserve-ancestry"]]);
```

In the separate test file, extract only the actual production `tryAutoMergePR` declaration using the same finite TypeScript-source approach. Create an owned temporary repository with base B and accepted candidate C. Its `gh` command port accepts only the fixture PR and exact expected head. For `--squash`, perform a real local squash merge and commit; for `--merge`, perform a real local no-fast-forward merge. Never execute GitHub, shell interpolation, network or global Git configuration. The fixture's `merge` is the extracted production function, `candidate` is C's actual `rev-parse HEAD`, and `repo` is the owned temporary directory. Assert:

```typescript
assert.equal(merge(url, "US-001", "run-git", candidate, "preserve-ancestry"), true);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", candidate, "HEAD"], {
  cwd: repo, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
}).status, 0);
```

The old helper ignores the new argument and creates a same-tree sibling, so this must fail on ancestry. Retain an explicit legacy squash control. The existing command fixture also verifies native protection failure returns false after one call, native missing tested SHA returns false with no calls, and native head mismatch has no fallback. Preserve existing legacy tests.

- [x] **Step 2: Commit the test-only candidate, then run qualified RED.**

```bash
node --import tsx scripts/run-execution-attempt-tests.ts tests/execution-attempts/subscription-owned-stage-evidence-v1.test.ts tests/execution-attempts/native-pr-merge-ancestry.test.ts
```

Commit and freeze the test-only candidate before execution; confirm both production files are byte-identical to F31. Retain the actual process, output and exit. Require the real Git ancestry assertion and caller/native refusal assertions to expose the missing behavior. A fixture/precondition error is not RED. Never repeat because a stream result is missing.

- [x] **Step 3: Implement the explicit merge mode.**

Add the optional literal union parameter from the spec. Before legacy head capture, refuse missing expected head in ancestry mode. Build the attempts with:

```typescript
const mergeArgs = ["pr", "merge", prUrl,
  mergeMode === "preserve-ancestry" ? "--merge" : "--squash",
  "--delete-branch", "--match-head-commit", head];
const attempts = mergeMode === "preserve-ancestry"
  ? [mergeArgs] : [mergeArgs, [...mergeArgs, "--admin"]];
```

Retain full-SHA validation and existing cache/log handling. In ancestry mode, return false on the first command error before the legacy admin-retry branch/log. Update the verify caller's final argument to:

```typescript
verifyRunProtocol?.protocol === "v3" ? "preserve-ancestry" : "legacy-squash"
```

Keep the existing configured checks, exact tested head and all source/ownership guards. Do not add a separate history-repair or alternate-source protocol.

- [ ] **Step 4: Verify GREEN and TypeScript.**

Run the exact same two-file maintained command once, then:

```bash
npx tsc --noEmit
```

Require the real native local merge to preserve C's ancestry, legacy behavior to remain covered and native refusal boundaries to hold. No unrelated suite or provider probe is required. Build only from clean main after ordinary reviewed merge, preserving the known main-only build guard.

- [ ] **Step 5: Independently review and deliver the bounded fix.**

Review task bounds and the whole diff. Root pushes the scoped branch, reads actual GitHub checks/reviews and performs a normal exact-head protected merge. Record actual clean-main build and guarded service transition receipts before live activation. Preserve the failed case; later validation uses a clean native run and its real QA/repair evidence.

## Verification checkpoint

The maintained two-file RED completed with 19 tests: 13 passed and six expected assertions failed. The actual production helper returned success after creating a real same-tree squash sibling; the accepted candidate was not an ancestor. The legacy real-Git control passed. The two-file implementation is in place; focused GREEN remains pending.
