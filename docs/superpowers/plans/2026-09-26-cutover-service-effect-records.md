# Preserved Cutover Service-Effect Records Implementation Plan

> **For agentic workers:** Root is the sole writer. Execute inline with TDD; read-only agents may independently review. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Define strict append-only historical record bytes for the two fixed pre-link LaunchAgent bootout effects, with unsettled history fail-closed.

**Architecture:** Keep a pure, import-inert codec separate from owner claims and OS adapters. Intent and completion self-hashes bind ordinal/action/predecessor and observation hashes; a bounded parser recognizes only empty, one/two pending, one-complete, or two-complete records, and grants no physical authority.

**Tech Stack:** TypeScript ESM, canonical JSON SHA-256, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-cutover-service-effect-records-design.md`

## Global Constraints

- No live service, process, link, worktree, migration or database effect.
- No self-hashed record or caller-fed observation may become cutover authority.
- Preserve the selected old dist, CLI symlink, current ports, historical worktrees and V1 guards.

---

### Task 1: Exact pure intent/completion codec

**Files:** Create `src/internal-production/baseline-deployment-cutover-service-effect-records-v1.ts`; test `tests/internal-production/baseline-deployment-cutover-service-effect-records-v1.test.ts`.

**Interfaces:** Export `createDeploymentCutoverServiceEffectIntentV1`, `createDeploymentCutoverServiceEffectCompletionV1`, `encodeDeploymentCutoverServiceEffectIntentV1`, `encodeDeploymentCutoverServiceEffectCompletionV1`, and `parseDeploymentCutoverServiceEffectHistoryV1`.

- [x] Write independent canonical/hash first-intent and completion fixtures; RED failed for missing production module.
- [x] Implement exact finite schemas, fixed ordinal/action mapping, canonical bounded bytes, copied/frozen values and stable hashes.
- [x] Add crossed intent/completion/owner/cutover/predecessor, malformed wire and hostile proxies/accessors; verify fail-closed checks.

### Task 2: History and non-authority boundary

**Files:** The same source/test files.

**Interfaces:** History result carries only `historicalState: "empty" | "unsettled" | "recorded-prefix" | "recorded-complete"`, never service or cutover authority.

- [x] Test intent without completion, second intent before first completion, duplicate, reversed order, unknown third action, and valid two-effect order.
- [x] Implement bounded exact history parsing and frozen output; focused 5/5 and TypeScript pass.
- [x] Pure 151/151, cutover 398/398, source manifest 18/18, genuine serial integration 43/43, TypeScript and English/path/migration/contract checks passed; independent read-only diff review found no Critical/Important issue.

### Task 3: Reviewed delivery

**Files:** Update this plan and `/Users/setrox/ai/setrox/logs/2026-09-25-cutover-status.md` with exact results.

- [ ] Commit conventionally, push the scoped branch, request exact-head PR checks/reviews, audit findings, and merge only by verified SHA.
- [ ] Fast-forward a clean independent deployment `main` clone and run a normal guarded build without deleting retained generations.
- [ ] Take a safe read-only host health check; do not invoke service effects or infer ownership from these pure records.
