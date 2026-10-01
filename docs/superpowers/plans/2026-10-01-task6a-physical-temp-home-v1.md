# Task6A Physical Temporary Home Implementation Plan

> **For agentic workers:** Root executes inline, sole writer. Read-only agents
> independently audit cause and diff; no implementation or delivery delegation.

**Goal:** Restore portable positive pre-schema fixtures without weakening ancestry refusal.

**Architecture:** Canonicalize only newly created test homes. Preserve production
nofollow checks and verify explicit symlink-home refusal at both real consumers.

**Tech Stack:** Node26.4.0, TypeScript5.9.3, tsx4.22.4, node:test, Darwin.

**Spec:** docs/superpowers/specs/2026-10-01-task6a-physical-temp-home-v1-design.md

## Global Constraints

- Root only writer; preserve all existing worktrees, dirty changes and failed epochs.
- No production, package/dependency, guard, native, database or selector changes.
- Build only clean committed source; no dirty-build or runtime bypass.
- Positive fixtures use a physical owned home; injected symlink homes stay lexical.
- Focused GREEN is not ALL or protected/live cutover proof.

## File Map

- Modify tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts:
  two physical positive homes, two explicit symlink-home negative controls.
- Create matching spec and this plan with actual verification receipts.

### Task 1: Portable positive fixtures and intact negative contract

**Interfaces:** Existing preflightAtFakeHome(home) and observeAtFakeHome(home)
return actual spawnSync results from the real source consumers. No API changes.

- [x] Reproduce existing RED with TMPDIR and database URLs removed:
  node --import tsx --test tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts.
  Expect exactly ordinary-start refusal and ancestor-invalid failures.
- [x] Import realpathSync, readdirSync and lstatSync from node:fs. Change only
  positive constructors to realpathSync(mkdtempSync(path.join(tmpdir(), prefix))).
- [x] Before ordinary positive preflight, create linked-home -> . inside the
  owned physical home, call preflightAtFakeHome(linkedHome), assert status1,
  empty stdout, exact ordinary refusal, unchanged home entry names and symlink
  target/identity. Remove only that newly owned link, then continue positives.
- [x] With a valid operation present, create linked-home -> . in the same
  owned physical home; observeAtFakeHome(linkedHome) must return status1,
  empty stdout and exact ancestor error. Assert operation bytes and mtime
  unchanged and linked home stays a symlink. Remove only that newly owned link.
- [x] Run focused file under scrubbed TMPDIR/DB URLs and under inherited TMPDIR.
  Expect25PASS0FAIL/CANCEL/SKIP, including all original negatives.
- [x] Run npm run test:internal-production:pure with TMPDIR/DB URLs scrubbed.
  Expect372PASS0FAIL/CANCEL/SKIP; retain actual command/session/output evidence.
- [ ] Independent read-only diff review; verify only test/spec/plan changed.
- [x] Commit with scoped conventional message and run
  node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit on clean branch.
  Full build requires clean main equal origin/main and is deferred until delivery.
- [ ] Push branch, open PR, request available reviewers; inspect actual comments,
  threads and required checks. SHA-bound normal merge only after review/checks.
- [ ] Preserve writer, failed clean main and private roots. Synchronize a NEW
  clean-main checkout and build. Fresh independent pre-effect review before ALL.

## Receipts

- Sixth genuine ALL: pure370PASS2FAIL; independently closed FAILED. See external
  checkpoint for immutable journal/closure/health hashes; no stitched success.
- Focused RED: session62275 definitely CLOSED1, 25tests23PASS2FAIL,
  1135.858166ms; exact same two refusals, before test edits.
- Focused GREEN: scrubbed session55760 CLOSED0, 25PASS0FAIL/CANCEL/SKIP,
  7965.849083ms; inherited-TMPDIR session76504 CLOSED0, 25PASS,
  8076.733667ms. Both explicit linked-home controls refused without changes.
- Whole pure group: scrubbed session20582 CLOSED0, 372PASS0FAIL/CANCEL/SKIP,
  23993.750958ms. Production sources and all old assertions remain unchanged.
- Clean branch build attempt refused at provenance check: HEAD does not equal
  origin/main. No bypass or output-build claim. Clean noEmit session82690
  CLOSED0. Ordinary full build remains required on NEW delivered clean main.
