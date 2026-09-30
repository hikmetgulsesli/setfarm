# Task6A source closure cleanup implementation plan

> **For agentic workers:** Root implements inline as explicitly required by the owner. Research/review agents are read-only; executing-plans is unavailable. Use TDD and verification-before-completion.

**Goal:** Exhaust owned source-closure releases and permanently refuse reuse after ambiguous cleanup.

**Architecture:** Existing private owners use one private attempt-all release helper and irreversible process latch; no authority or parser API changes. Deliver this independently from the preserved, unshipped protected startup worktree.

**Tech Stack:** Node >=22, TypeScript ESM, node:test, real filesystem FDs, TypeScript AST/VM test harness.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-source-closure-cleanup-design.md`

## Global constraints

- Root sole writer; old startup worktree paused, dirty files/branches preserved.
- No parser/Git/mode/UID/durability weakening, new capture/readiness or live mutation.
- Revoke before release, exhaust owners, never retry ambiguous OS close.
- Cleanup remains callable after process uncertainty; new acquisition is denied.
- Tests are resource protocol evidence, not source authenticity or startup proof.
- Reviewed PR only, no direct main commit, no build/runtime guard override.

## File Map

- Modify `src/internal-production/baseline-post-handoff-receipt-v1.ts`: release helper/latch; member/final rejection, parent, successor-chain, historical-inventory and receipt-directory owners; all raw-member callers and pre-schema endpoint owner implicated by PR247's cleanup P1.
- Create `tests/internal-production/task6a-source-closure-cleanup-v1.test.ts`: compile actual private bodies, real FDs, close fault, shared latch and preserved error causes.
- Modify `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`: only adapt one existing close instrumentation indentation marker; preserve assertions.
- Modify `package.json`: focused cleanup command and prepend it to existing internal-production chain only; no unshipped startup commands.
- Create this spec/plan: causal scope and evidence limits.

## Task 1: Exhaust cleanup and retain uncertainty

**Interfaces:** No new public exports. Private `attemptTask6aReceiptOwnedCleanupV1(releases: readonly (()=>void)[]):void`; private irreversible `task6aReceiptCleanupUncertainV1` boolean. Existing owners retain their public/internal return shapes.

- [x] Write and execute real-FD tests before fixes. Core symptom assertion:

```ts
assert.throws(() => held.close());
for (const fd of allocated) assert.throws(() => fs.fstatSync(fd), {code:"EBADF"});
assert.throws(() => held.assertStable());
assert.throws(() => held.close());
```

- [x] Observe intended RED9 for skipped releases/forgotten errors; fix attempt-all release. Then RED5 for reacquisition/parent retained refusal; fix latch. Independent review found lower acquisition gap, RED2 followed by fix preserving both causes. Additional shared-owner/await/error assertions added.
- [x] Reproduce complete test against untouched main in this isolated delivery worktree:21 tests,1 pass20 failures. Expected skipped real FDs, missing retained refusal/latch and lost acquisition causes; no setup/import failure.
- [x] Apply the exact bounded source fix and unchanged tests:21/21 pass, zero skips/failures. No initializer/db-pg/catalog changes copied.
- [x] Re-run actual-source/test strict TS, package command21/21, anchored10/10, pure372/372, source-chain1/1; zero skips/failures. English1865/path947/version2.3.79/migration digests/12MC/diff passed. No whole application-suite/build claim; branch builds require reviewed main and are not bypassed.

## Task 2: Reviewed delivery and clean-main verification

- [ ] Address PR247 cloud P1 at634b64d before merging: test every raw-member release group, retain aggregate causes, revoke publication slots before ambiguous close, track replacement/member ownership before fallible validation and reject stable raw observations after cleanup uncertainty. The same source-closure prerequisite causes this bounded refinement; no initializer or authority expansion.
- [x] Preserve cleanup causes through the five immediate original/status/raw/selected-pass borrower wrappers found by read-only review. Their first-error/suppression handling otherwise discards the newly retained evidence. Same source file/File Map and causal prerequisite; private awaited attempt-all helper, no authority change. Seven actual-body real-FD tests intended RED65/58pass7 after correcting two fixture fault-order setup failures. Both raw return callbacks now explicitly covered:66/66green, including distinct child failures and primary retention.
- [x] Frontier real-FD RED:22 tests,21 pass1 intended skipped-final-FD failure, then GREEN22. Additional raw-owner/stable RED12->GREEN34; publication/pre-schema transfer RED4->GREEN38; raw callbacks/construction and retained-cause tests brought GREEN56. Primary plus two distinct cleanup errors are retained. Latest57 tests executed against exact634b64d source entirely in memory:21pass36 intended failures, no worktree/source revert. Progress nested-owner validation-before-tracking gap independently RED58/57pass1, then move transfer before validation:58/58zero skips/failures. FD tracking is acquisition-generation-aware, not globally unique numeric FD assumptions.

- [x] Independently review exact six-file tree and test evidence, including shared latch/error assertions. No remaining blocker; lower untracked acquisition issue fixed before delivery. Scope is cleanup only, never positive source/startup.
- [x] Stage explicit six paths only; inspect staged diff and secret scan. Initial634b64d pushed as PR247; Gemini requested once, Copilot REST request refused422 (not collaborator). No payment/access configuration or false review claim.
- [ ] Verify final refinement gates and independent current-tree review; stage only the four refined paths, conventional additional commit/normal push, request new exact-head cloud review and reply to the real finding with evidence. No force-push or blind thread resolution.
- [x] Final refinement verification:66 cleanup/10 anchored/372 pure/1 source-chain, zero skips/failures; source and actual-test strictTS, English1865/path947/version2.3.79/digests/12MC/diff passed. Independent read-only final tree review clears direct owners, five immediate wrappers and both raw close paths. No remaining blocker in that scope; no whole-suite, positive source, startup or cutover claim.
- [ ] Verify exact-head cloud completion, security success and no unresolved review threads; merge with `gh pr merge --match-head-commit <verified-full-SHA> --merge`, never admin bypass or force push.
- [ ] Fetch/synchronize only the clean standby checkout and run ordinary `npm run build`; read full BUILDINFO/main/dirtyfalse. Preserve selected deployment/CLI and both development worktrees.
- [ ] Record exact commit/PR/build and host HTTP/PG evidence; resume authentic source closure work without interpreting this cleanup as positive startup or cutover.
