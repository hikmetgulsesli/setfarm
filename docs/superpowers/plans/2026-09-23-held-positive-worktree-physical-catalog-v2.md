# Held positive-worktree physical catalog V2 plan

> Root is sole writer; read-only agents may research/review. This is a diagnostic slice only.

**Goal:** Prove which managed host directories are present, physically stable, Git-authenticated, or unresolved without reinterpreting V1 or granting cutover authority.

**Architecture:** A fixed host-scope wrapper feeds a held descriptor catalog core. Two physical passes bracket a callback reserved for a later repeatable-read DB observer. Unknown entries are visible blockers, never dropped or relabeled as retained. `complete` means diagnostic coverage only; this slice yields no Stage-1 physical input because source/build and PostgreSQL provenance are not yet linked. The current host is expected to report actual unknowns.

**Spec:** `docs/superpowers/specs/2026-09-23-held-positive-worktree-physical-catalog-v2.md`

## File map and guardrails

- New `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts` and `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`.
- Update `package.json` to run the tests under `npm test`.
- No edits to historical V1, migrations, owner registry, CLI cutover commands, live runtime artifacts, services, selected dist or symlinks.
- Existing dirty files and all worktrees remain untouched; root alone writes.

## Task 1 — held candidate topology

1. RED: real temporary fixture with a primary Setfarm Git clone, linked retained worktree, deployment primary clone, generated project/runtime worktree, an absent optional base and a non-Git child. Assert every present child and absent base is visible; unknown blocks qualification. Assert exact `--show-toplevel` prevents parent-Git traversal.
2. GREEN: implement bounded source-scope enumeration; pin ancestor/base/child descriptors with no-follow; capture device/inode/birth/mode/UID/change metadata and release on all paths. Fixed host wrapper derives roots from code-owned workspace and account, not an environment override. Fixture-scope core is explicitly diagnostic.
3. Verify focused test and `npx tsc --noEmit`.

## Task 2 — Git and process authenticity, stable bracket

1. RED: add prunable/extra/forged Git listing, wrong origin, symlink, non-directory child, real positive process-reference capture/drift, inode/birth replacement during callback, failed close and post-close reuse cases. Test no silent skip of unknown entries or non-Git project parents. A deterministic rename-away/replace/restore inside an external command and Git-list swap remain follow-up fault-injection cases; held-path mutation metadata and two-pass comparisons are implemented but those exact interleavings are not proven by this slice.
2. GREEN: sealed Git/lsof commands with bounded output, explicit safe cwd, `core.fsmonitor=false`, held-path rechecks around every command, direct no-follow `.git` marker and common-dir authentication, exact top-level/primary/list checks and fail-closed process-reference parser; twice observe under held descriptors across awaited callback; poison acquisition after uncertain close. Do not write Git metadata or prune. Label all Git classifications topology-only with source/build provenance unverified.
3. Verify focused suite, `npm run test:internal-production:pure`, existing held phase tests, `git diff --check`, and no V1 diff.

## Task 3 — delivery and host evidence

1. Independent read-only review against spec, file map and test evidence; fix Important/Critical findings with RED/GREEN.
2. Conventional commits, scoped branch push, PR, exact-head GitGuardian/cloud review and inline findings, SHA-conditioned merge.
3. Fast-forward independent clean-main clone and run normal build. Run only the read-only host catalog; expect visible unresolved paths and no cutover authority. Preserve selected dist/CLI physical identity. Report remaining blockers honestly.
