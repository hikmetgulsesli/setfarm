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

- Modify `src/internal-production/baseline-post-handoff-receipt-v1.ts`: release helper/latch; member/final rejection, parent, successor-chain, historical-inventory and receipt-directory owners.
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

- [x] Independently review exact six-file tree and test evidence, including shared latch/error assertions. No remaining blocker; lower untracked acquisition issue fixed before delivery. Scope is cleanup only, never positive source/startup.
- [ ] Stage explicit six paths only; inspect staged diff and secret scan. Conventional commit and push scoped branch, create PR against main; request available Copilot/Gemini once without paid activation.
- [ ] Verify exact-head cloud completion, security success and no unresolved review threads; merge with `gh pr merge --match-head-commit <verified-full-SHA> --merge`, never admin bypass or force push.
- [ ] Fetch/synchronize only the clean standby checkout and run ordinary `npm run build`; read full BUILDINFO/main/dirtyfalse. Preserve selected deployment/CLI and both development worktrees.
- [ ] Record exact commit/PR/build and host HTTP/PG evidence; resume authentic source closure work without interpreting this cleanup as positive startup or cutover.
