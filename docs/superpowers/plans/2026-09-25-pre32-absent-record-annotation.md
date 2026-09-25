# Pre-32 Absent Git-Record Annotation Implementation Plan

> **For agentic workers:** Root is the sole writer; independent agents are read-only reviewers. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach the existing direct-child absent-base witness to the exact V6 held physical/DB interval, preserving every blocker and diagnostic limitation.

**Architecture:** Add a small annotation observer that first obtains the existing V6 pair (through injectable test ports or the code-owned host observer), then applies the existing V3 witness to that pair's held V2 subpair. It reports witnessed and remaining blocker lists with source hashes; it never changes the source catalog or emits cutover authority.

**Tech Stack:** TypeScript ESM, Node test runner, canonical JSON hash, authenticated deployment-cutover bootstrap.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-absent-record-annotation-design.md`

## Global Constraints

- Preserve all historical/deployment worktrees, selected historical dist, CLI symlink and service ports.
- Preserve V1/V2/V3/V6 contracts and all original physical blockers. No migration, admission, writer, cleanup or live cutover effect.
- Diagnostic-only output; no zero-owner or ready label. A witnessed absent Git record is not an authenticated worktree receipt.
- Root alone edits, commits and delivers; reviewers are read-only.

---

### Task 1: Held V6 absent-record annotation

**Files:** Create `src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.ts` and `tests/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.test.ts`.

**Interfaces:** `observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(physical, database)` uses the same port signatures as `observePositiveWorktreePre32HostPairWithPortsV6`; `observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV1()` uses the existing code-owned V6 observer. Both return frozen `{schema,authority,sourcePair,witness,witnessedBlockers,remainingBlockers,annotationHash}`.

- [x] Write RED fixtures whose V6 physical callback brackets one DB callback. Assert direct-child prunable records appear only in `witnessedBlockers`, all other blockers remain in `remainingBlockers`, and the original catalog is unchanged.
- [x] Run `node --import tsx --test tests/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.test.ts`; confirm the missing module/export fails.
- [x] Implement the annotation using `observePositiveWorktreePre32HostPairWithPortsV6` and `projectPositiveWorktreePrunableAbsenceWitnessV3(sourcePair.heldPair)`. Check witness roots uniquely match source blockers, freeze output and hash the exact body; never publish an authority label beyond `diagnostic-only`.
- [x] Add refusal tests for malformed V6 database count/hash and physical/DB callback failure; prove non-direct children remain blockers and duplicate source records remain visible without multiplying unique witness roots. Run focused tests until green.

### Task 2: Authenticated host inspection

**Files:** Modify `scripts/deployment-cutover.mjs`, `scripts/__tests__/deployment-cutover.test.js`.

**Interfaces:** Add `inspect-pre32-absence-annotation-v1 --json` to the existing authenticated bootstrap allowlist and refusal-stage mapping; load only the code-owned annotation observer. Do not change old verbs.

- [x] Add RED bootstrap tests for exact verb admission, invalid arguments, and sanitized refusal. Run `node --test --test-name-pattern='pre32 annotation|V6 absent-record annotation' scripts/__tests__/deployment-cutover.test.js` and confirm missing verb behavior.
- [x] Add the minimal verb dispatch and sanitized refusal mapping; run focused script tests.
- [x] Run TypeScript, internal-production pure/cutover suites, authenticated bootstrap suite, English/path contracts and `git diff --check`.
- [ ] Obtain independent read-only review; fix findings, commit and deliver scoped PR. After exact-head review, merge through GitHub, synchronize a separate clean-main deployment clone, run normal build and authenticated no-write host inspection. Recheck selected historical dist hashes and CLI target; do not claim cutover readiness.
