# Prunable Absence Witness V3 Implementation Plan

> Root is the sole writer and delivery owner. Research/review agents are read-only. Preserve every existing worktree, dirty file, selected CLI/dist, and live service.

**Goal:** Expose interval-bound physical absence for prunable records directly below V2 `absentBases`, without hiding any blocker or granting zero-owner/cutover authority.

**Architecture:** A pure projector validates and binds a full frozen V2 pair, maps direct-child prunable blockers to absent-base witnesses, and emits an independently hashed diagnostic sidecar. A zero-input wrapper uses only the existing code-owned V2 host observer. No new Git, filesystem, DB, runtime, or service write is introduced.

**Spec:** `docs/superpowers/specs/2026-09-24-prunable-absence-witness-v3-design.md`

## Task 1: RED fixtures and minimal projector

- [x] Add the focused test fixture with a complete hashed, frozen V2 catalog, DB snapshot, and pair. Assert direct-child witnesses, byte ordering, deduplication, preserved blocker/status/full pair, diagnostic labels, temporal scope, and canonical sidecar hash.
- [x] Run focused test and record RED from the missing module.
- [x] Implement the isolated pure projector and register it in `test:internal-production:pure`; run focused GREEN and TypeScript.

## Task 2: Refusal boundary and code-owned wrapper

- [x] Add RED tests for non-direct/prefix/path-alias/wrong-reason records, malformed or false V2 hashes/labels, mutation/accessor/proxy, duplicate/overflow inputs, and no cross-time claim. Verify 1,024 prunable records accepted and 1,025 refused.
- [x] Implement only required guards, frozen output, bounded scans, and a zero-input wrapper calling the existing V2 observer. Verify import inertness; no caller-provided scope or status override.
- [x] Run focused, pure, cutover, TypeScript, contracts, and `git diff --check`; request independent read-only review and fix Important/Critical findings via RED/GREEN.

## Task 3: Reviewed delivery and host evidence

- [ ] Conventional commit, push branch, open PR, inspect GitGuardian and exact-head cloud review, and SHA-bound merge only after checks and review pass. Do not delete worktrees.
- [ ] Fast-forward independent clean-main deployment clone and run normal build. Fast-forward selected source checkout while preserving historical dist/CLI identity. Run one read-only V3 host observation. Report its status, counts, hashes, temporal limit, remaining blockers, and HTTP health without claiming cutover.
