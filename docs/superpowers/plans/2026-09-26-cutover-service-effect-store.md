# Preserved Cutover Service-Effect Store Implementation Plan

> **For agentic workers:** Root is the sole writer. Use TDD inline; read-only agents may independently audit. No live service or filesystem effect outside temporary test fixtures.

**Goal:** Persist the two fixed historical bootout record pairs immutably, without granting dispatch or cutover authority.

**Architecture:** Add a dedicated pinned baseline root and exact four-file grammar over the merged pure codec. Observe with no creation. Publish one exact committed record through exclusive stage, fsync, no-replace hardlink, and post-publication physical recheck. Refuse partial/unknown state and stale expected observation hashes.

**Tech Stack:** TypeScript ESM, Node fs synchronous descriptor APIs, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-cutover-service-effect-store-design.md`

## Constraints

- Preserve all live launchers, CLI symlink, old dist, retained worktrees and builds, database rows and migration state.
- Store observations and publications are history-only. No current owner lease, process/service exclusion, effect completion authority or cutover gate.
- No temporary-stage cleanup or replacement, even on failure. Uncertain close/fsync permanently fails closed for the process.

### Task 1: RED/GREEN fixed-root observation

- [x] RED failed for missing module; absent store observes without creation and a fixed prefix reconstructs pure history.
- [x] Implement pinned ancestry/root, bounded exact inventory and physical metadata checks.
- [x] Tamper tests cover unknown name, root/parent symlink or mode, foreign link, crossed alias, malformed bytes, missing predecessor and competing first intents.

### Task 2: RED/GREEN durable publication

- [x] First intent/completion then second intent/completion publish in order; exact bytes, mode, inodes and history state checked without a live effect.
- [x] Enforce expected full observation hash, fixed ordinal/predecessor and immutable conflicting replay rejection.
- [x] Inject short write, file/root/parent fsync, hardlink response and close loss; preserve partial evidence and refuse uncertain same-process retries. Real competing processes were tested; at most one wins, or both refuse with visible unsettled stages.

### Task 3: Review and delivery

- [x] Focused 23/23, TypeScript, cutover 421/421, pure 151/151, source manifest 18/18 and source contract checks passed.
- [ ] Rerun genuine serial integration alone before merge. Its concurrent attempt failed two resolution tests while the clean-main full suite occupied the host; do not weaken its guard.
- [x] Independent read-only diff review found no Critical/Important issue; same-UID path-swap limitation is explicitly documented.
- [ ] Commit scoped branch, reviewed PR, clean-main fast-forward/build, selected old-dist preservation and no-write host check; update cutover ledger.
