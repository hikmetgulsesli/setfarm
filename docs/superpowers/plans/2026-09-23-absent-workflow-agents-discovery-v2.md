# Absent Workflow Agents Discovery V2 Implementation Plan

> **For agentic workers:** Root is the sole writer and delivery owner. Read-only agents may investigate or review; do not dispatch an implementation writer.

**Goal:** Preserve a missing workflow `agents` discovery parent as an explicit unresolved physical blocker while continuing to report other worktrees.

**Architecture:** Reuse the held workflow directory already acquired by `children()`. Record only stable `ENOENT` as a named blocker, recheck it after the awaited observation bracket, and let the existing blocker-derived status stay `unresolved`. All other unsafe states still refuse.

**Tech Stack:** TypeScript ESM, Node `fs`/`node:test`, existing held physical catalog.

**Spec:** `docs/superpowers/specs/2026-09-23-absent-workflow-agents-discovery-v2-design.md`

## Global Constraints

- Root alone writes. Preserve existing dirty files and every current worktree; never reset, revert, prune, delete, or create host runtime directories.
- Diagnostic-only V2. No V1, DB, source/build, controller, service, selected CLI/dist, or cutover-authority change.
- Missing `agents` is always `unresolved`, not an optional `absentBases` entry or zero-owner evidence.
- Keep no-follow held path checks, mutation checks, bounded discovery, and fail-closed close behavior.

---

### Task 1: Stable absence remains visible

**Files:**
- Modify: `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`
- Modify: `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`

**Interfaces:**
- Consumes: `observeHeldPositiveWorktreePhysicalCatalogV2(scope, betweenPasses?)`.
- Produces: existing catalog result with `{root: agentsPath, reason: "absent-workflow-agents-discovery-parent"}` in `blockers` and `status: "unresolved"`.

- [ ] Replace the existing `workflow without its agents discovery parent refuses` fixture with a fixture that also contains a real non-Git `.worktrees/data` child. Assert both the missing-parent blocker and visible child, `status: "unresolved"`, and no missing-parent path in `absentBases`. The key assertions are:
  ```ts
  assert.equal(result.status, "unresolved");
  assert.ok(result.entries.some((entry) => entry.root === unknown && entry.kind === "unresolved"));
  assert.ok(result.blockers.some((item) => item.root === agents
    && item.reason === "absent-workflow-agents-discovery-parent"));
  assert.equal(result.absentBases.includes(agents), false);
  ```
- [ ] Run `node --import tsx --test --test-name-pattern='workflow without its agents' tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`; verify RED because the current implementation throws before returning the catalog.
- [ ] In the workflow loop, accumulate missing `agents` roots only after the workflow directory is held. Seed `blockers` with `absent-workflow-agents-discovery-parent` for those roots; do not call `children()` on the absent path. Leave present-path handling unchanged. After `betweenPasses`, explicitly recheck the same roots beside `absentBases`:
  ```ts
  const absentAgentsParents: string[] = [];
  for (const workflow of children(held, workflowsRoot, incidentalFiles)) {
    addBase(path.join(workflow, "story-worktrees"), "runtime-zone");
    const agents = path.join(workflow, "agents");
    if (isMissing(agents)) { absentAgentsParents.push(agents); continue; }
    for (const agent of children(held, agents, incidentalFiles)) {
      addBase(path.join(agent, "story-worktrees"), "runtime-zone");
    }
  }
  const blockers = absentAgentsParents.map((root) => Object.freeze({
    root, reason: "absent-workflow-agents-discovery-parent",
  }));
  for (const root of absentAgentsParents) if (!isMissing(root)) fail();
  ```
- [ ] Run the focused test again and verify GREEN. Commit this behavior with a conventional message.

### Task 2: Bracketed absence cannot drift

**Files:**
- Modify: `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`
- Modify: `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`

**Interfaces:**
- Consumes: the Task 1 missing-parent roots and existing `betweenPasses` callback.
- Produces: whole-catalog refusal if any missing parent appears during the callback, including a create/remove ABA observed through held workflow metadata.

- [ ] Add a real-directory test whose callback creates the absent `agents` path, and one that creates then removes it. Both must reject with `INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID`:
  ```ts
  await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2(scope,
    async () => { mkdirSync(agents); }),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  ```
- [ ] Run the focused tests. The held workflow directory may already catch both changes by ctime/mtime; these tests are guard characterizations, not a second claimed RED cycle. Do not weaken the held check to manufacture a failure.
- [ ] Confirm every missing parent is rechecked after `betweenPasses`, alongside the existing `absentBases` recheck. Keep the held workflow directory alive until the catalog closes.
- [ ] Run focused tests, then `npm run test:internal-production:pure`, `npm run test:internal-production:cutover`, `npx tsc --noEmit`, and `git diff --check`. Commit only after verified output.

### Task 3: Independent review and host delivery

**Files:**
- Modify only the above files/spec/plan if review finds a concrete in-scope flaw.

**Interfaces:**
- Produces reviewed PR, clean-main build, and read-only host catalog evidence; never cutover authority.

- [ ] Have an independent read-only reviewer inspect the diff against the spec and the absent/appearance/ABA tests. Reproduce Important findings RED and fix GREEN.
- [ ] Push the scoped branch, open a PR, read GitGuardian and exact-head cloud comments, and resolve valid findings. Squash-merge only with a matching reviewed head SHA; retain all worktrees and branches unless separately authorized.
- [ ] Fast-forward the independent clean-main deployment clone and run its normal `npm run build`. Fast-forward only the selected source checkout; preserve selected dist bytes and CLI symlink identity.
- [ ] Run the compiled code-owned host catalog read-only. Record named blockers, unknown entries, and HTTP health. An `unresolved` result is not zero ownership, controller acquisition, or cutover completion.
