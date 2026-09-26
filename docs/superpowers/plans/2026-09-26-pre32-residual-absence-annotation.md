# Pre-32 Residual Absence Annotation Implementation Plan

> **For agentic workers:** Execute the steps in order; root is the only writer. Review agents are read-only.

**Goal:** Expose bounded V7 non-Git-marker and missing-parent facts while retaining every original blocker and granting no cutover authority.

**Architecture:** Compose the existing V2 exact-journal observer and partition only its `remainingBlockers`. The V2 held physical producer remains the source of the two-pass absence checks. No database, runtime, migration, or service write is added.

**Tech Stack:** TypeScript ESM, Node test runner, canonical JSON hashing.

**Spec:** `docs/superpowers/specs/2026-09-26-pre32-residual-absence-annotation-design.md`

## Global Constraints

- Preserve existing dirty and historical worktrees; no reset, revert, removal, prune, or live claim.
- Preserve V1/V2/V7 bytes and A–E manifests, guarded migrations 32/33, selected dist/link, and runtime guards.
- New result is diagnostic-only, unverified, two-pass bounded, and never a zero-owner lease.

## File Map

- Create `src/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.ts` for the strict partition.
- Create `tests/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.test.ts` for real V2 composition through controlled physical/database callbacks.
- Modify `package.json` only to include that file in the pure suite.

### Task 1: RED behavior and strict partition

- [ ] Add a V7 fixture with one absent-base prunable blocker, four `non-git-child` entries with null Git identity/dirty and zero PIDs, one exact absent workflow `agents` parent, and one Git-admin churn blocker. Assert V3 retains the V2 source by identity, partitions five bounded and one residual blocker in original order, hashes exact body, and exposes no owner/ready field.
- [ ] Run `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.test.ts`; expect RED because the new observer module is absent.
- [ ] Implement `observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(physical,database)` by calling V2 and one private projector; add `observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3()` with zero input and the V2 host observer. Refuse wrong source authority/journal/hash and any partition cardinality or identity discrepancy.
- [ ] Re-run the focused test and require exit 0.

### Task 2: Negative evidence and suite integration

- [ ] Add failing tests: non-Git entry with PID remains residual; missing/mismatched/duplicate non-Git entry refuses; malformed or duplicate absent-parent path refuses; forged source hash, physical drift, and database callback failure do not produce V3; exact original blocker count remains unchanged.
- [ ] Run the focused file and observe expected RED failures for the unimplemented checks.
- [ ] Make only the required validation changes, then re-run focused GREEN.
- [ ] Add the new file to `test:internal-production:pure` and run that suite, `npm run test:internal-production:cutover`, source manifest tests, TypeScript no-emit, source contracts, and `git diff --check`.

### Task 3: Independent review and delivery

- [ ] Ask a read-only reviewer to compare the diff to the spec, including forged/crossed root cases. Resolve Important findings with RED/GREEN tests.
- [ ] Stage scoped files, conventional-commit, push, open PR against `main`, inspect exact-head reviews and checks, then use reviewed squash merge if branch protection permits.
- [ ] Fast-forward only the preserved clean deployment clone and selected historical source after verifying their status; build the separate clean-main deployment clone normally and verify its BUILD_INFO SHA/cleanliness.
- [ ] Run the existing authenticated no-write V2 host check from the clean build and record its exact output. V3 has no host bootstrap verb in this slice, so do not claim V3 host attestation or cutover readiness.
