# Preserve V3 Verification Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Preserve canonical V3 acceptance through ordinary story verification.

**Architecture:** Resolve protocol from the story's persisted run. V3 uses status-only update; non-V3 keeps the existing `verifiedStoryOutput` policy. Native authority readers remain unchanged.

**Tech Stack:** TypeScript ESM, node:test/tsx, existing isolated PostgreSQL fixture.

**Spec:** docs/superpowers/specs/2026-11-13-preserve-v3-verify-acceptance-design.md

## Global Constraints

Single existing writer; preserve all evidence; no live DB/service/generated-project writes; no reader weakening or protocol inference from output. Root alone stages/commits/pushes/merges. Preserve legacy/shadow behavior. No full suite, speculative fixes or new dependency installation.

### Task 1: Preserve acceptance in the actual verification writer

**Files:** Modify `scripts/run-isolated-postgres-tests.ts` only to admit the fixed exact accepted fallback selector; add parser acceptance/near-miss tests in maintained seam. Modify `src/installer/repo.ts`; test `tests/execution-attempts/native-implementation-join.integration.test.ts`. Existing legacy helper controls: `tests/steps/07-verify.test.ts`.

**Interfaces:** Existing `verifyStory(storyId: string, verificationOutput?: string): Promise<void>` signature unchanged; consumes actual persisted run.protocol. Produces verified status and unchanged V3 output, existing non-V3 replacement.

- [ ] Establish closed exact selector `--test-name-pattern=^native Task11 accepted operational fallback remains the model source owner after cleanup$` on the existing native-implementation-join file, mirroring prior fixed selectors. Add only `src/installer/repo.ts` and `tests/execution-attempts/native-implementation-join.integration.test.ts` to `P3_TRACKED_SCOPE` so the actual edited bytes are pinned/projected; retain every existing scope/byte check. Root commits docs before invocation, so no doc allowlist additions are necessary. First test parser admission and rejection of near-miss/suffix/extra arguments; preserve all existing command grammar. This is necessary to execute the proportional regression, not a guard bypass.
- [ ] Extend the maintained real native fallback scenario after genuine completion and worktree retirement. Save canonical output, call actual `verifyStory(id, "STATUS: done")`, assert status verified and exact original output, then reload actual native context/authority. Add a selected variant or extend existing case without duplicating full fixture. Add real non-V3 controls for verifier replacement/stale cleanup and V3 malformed output preservation/rejection where the existing seam permits.

```ts
const before = await database.sql`SELECT output FROM stories WHERE id=${value.input.storyDbId}`;
await verifyStory(value.input.storyDbId, "STATUS: done");
const after = await database.sql`SELECT status,output FROM stories WHERE id=${value.input.storyDbId}`;
assert.equal(after[0]?.status, "verified");
assert.equal(after[0]?.output, before[0]?.output);
assert.deepEqual(await loadV3ImplementationAttemptContext(acceptedLocator), acceptedContext);
```

- [ ] Run only the selected regression through the maintained isolated PostgreSQL runner, save exact command/result privately. Genuine RED must show output clobber, not fixture/setup failure. Inspect existing runner allowlist/selector before running; do not weaken guards or run the whole integration file.
- [ ] Minimal writer: query story joined to runs for persisted protocol, then bypass textual replacement for V3.

```ts
const replacementOutput = row?.protocol === "v3"
  ? null
  : verifiedStoryOutput(row?.output, verificationOutput);
```

- [ ] Re-run identical focused regression GREEN and legacy controls; run no-emit typecheck. Self-review SQL/missing row behavior. Report exact commands, original RED/GREEN outputs and changed files to Root, no delivery actions.
- [ ] Root independent task review, then whole-branch review, conventional commit, clean `npm run build`, normal PR delivery. Record current run failed stages separately; no old-run repair.
