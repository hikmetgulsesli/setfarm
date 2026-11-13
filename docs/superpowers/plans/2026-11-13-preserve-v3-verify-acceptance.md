# Preserve V3 Verification Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Preserve canonical V3 acceptance through ordinary story verification.

**Architecture:** Resolve protocol from the story's persisted run. V3 uses status-only update; non-V3 keeps the existing `verifiedStoryOutput` policy. Native authority readers remain unchanged.

**Tech Stack:** TypeScript ESM, node:test/tsx, existing isolated PostgreSQL fixture.

**Spec:** docs/superpowers/specs/2026-11-13-preserve-v3-verify-acceptance-design.md

## Global Constraints

Single existing writer; preserve all evidence; no live DB/service/generated-project writes; no reader weakening or protocol inference from output. Root alone stages/commits/pushes/merges. Preserve legacy/shadow behavior. No full suite, speculative fixes or new dependency installation.

### Task 1: Preserve acceptance in the actual verification writer

**Files:** Modify `scripts/run-isolated-postgres-tests.ts` only to admit the fixed exact accepted fallback selector; add parser acceptance/near-miss tests in `scripts/__tests__/isolated-postgres-command.test.js`. Root commits these harness changes before the real SQL test, leaving only allowlisted native test and writer dirty. Modify `src/installer/repo.ts`; test `tests/execution-attempts/native-implementation-join.integration.test.ts`. Existing legacy helper controls: `tests/steps/07-verify.test.ts`.

**Interfaces:** Existing `verifyStory(storyId: string, verificationOutput?: string): Promise<void>` signature unchanged; consumes actual persisted run.protocol. Produces verified status and unchanged V3 output, existing non-V3 replacement.

- [ ] Establish closed exact selector `--test-name-pattern=^native VERIFY preserves V3 story acceptance using persisted protocol$` on the existing native-implementation-join file, mirroring prior fixed selectors. Add only `src/installer/repo.ts` and `tests/execution-attempts/native-implementation-join.integration.test.ts` to `P3_TRACKED_SCOPE` so the actual edited bytes are pinned/projected; retain every existing scope/byte check. Root commits docs before invocation, so no doc allowlist additions are necessary. First test parser admission and rejection of near-miss/suffix/extra arguments; preserve all existing command grammar. This is necessary to execute the proportional regression, not a guard bypass.
- [ ] Add dedicated test `native VERIFY preserves V3 story acceptance using persisted protocol` under the maintained real configured Postgres before() fixture, using minimal persisted runs/stories and required genuine fixture release admission. No implementation claim or producer is necessary for this writer contract. Save canonical valid-shape fixture output, call actual `verifyStory(id, "STATUS: done")`, assert verified status and exact unchanged bytes. Include malformed/null/stale V3 preservation, legacy/shadow canonical-looking output replacement, stale cleanup and ordinary unchanged output controls. Restore the old full native fallback scenario exactly; its unrelated pre-writer claim failure is retained and deferred, not repaired or called RED.

```ts
const before = await database.sql`SELECT output FROM stories WHERE id=${value.input.storyDbId}`;
await verifyStory(value.input.storyDbId, "STATUS: done");
const after = await database.sql`SELECT status,output FROM stories WHERE id=${value.input.storyDbId}`;
assert.equal(after[0]?.status, "verified");
assert.equal(after[0]?.output, before[0]?.output);
// Existing strict native reader tests separately check canonical acceptance/output drift.
```

- [ ] Use a private copy of prior `E7/task-1-pg-capture.mjs`, rebound only to this evidence directory and exact selector/file, to create an owned local ephemeral PostgreSQL cluster, redact its fresh random password and close it normally. Run only the selected regression through the maintained isolated PostgreSQL runner, save exact command/result privately. Genuine RED must show output clobber, not fixture/setup failure. Inspect existing runner allowlist/selector before running; do not weaken guards or run the whole integration file.
- [ ] Minimal writer: query story joined to runs for persisted protocol, then bypass textual replacement for V3.

```ts
const replacementOutput = row?.protocol === "v3"
  ? null
  : verifiedStoryOutput(row?.output, verificationOutput);
```

- [ ] Re-run identical focused regression GREEN including persisted legacy controls; run existing pure legacy stale-output check, existing strict native reader canonical/output-drift tests, and no-emit typecheck. Self-review SQL/missing row behavior. Report exact commands, original RED/GREEN outputs and changed files to Root, no delivery actions.
- [ ] Root independent task review, then whole-branch review, conventional commit, clean `npm run build`, normal PR delivery. Record current run failed stages separately; no old-run repair.
