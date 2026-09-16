# Deployment Cutover Observer Implementation Plan

> **For agentic workers:** Inline primary-owner implementation with independent
> read-only review; reuse existing isolated worktree and approved execution choice.

**Goal:** Observe absence or a complete cutover intent from its fixed workspace
root without changing any file, service, admission state or process.

**Architecture:** Reuse fixed workspace path resolution and the pure intent codec. Pin
descendant directories with descriptors; authenticate a bounded regular intent
file against descriptor/path identity. Missing descendants require a second
absence check under stable parents. Present partial state always refuses.

**Tech Stack:** TypeScript ESM, synchronous bounded Node filesystem calls, tsx tests.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and file map

- Create `src/internal-production/baseline-deployment-cutover-v1.ts` exporting
  `observeDeploymentCutoverIntentV1(): {state:'absent'} | {state:'open',intent}`.
- Create `tests/internal-production/baseline-deployment-cutover-observer-v1.test.ts`.
- Static imports only: filesystem/path, workspace path resolver, pure intent codec.
- Fixed root `data/internal-production-baseline/deployment-cutover-v1`, single
  committed `intent.json`; no caller-selected path or runtime environment override.
- Existing data/baseline parents must be current-UID directories without group/
  world write; cutover root must be0700. Every ancestor remains pinned and stable.
- Intent must be current-UID,0600, regular, single-link, same device as root, at
  most65536 bytes. No-follow/nonblocking open prevents symlink/FIFO traversal.
- Empty root, staging-only, extra members, malformed intent and ambiguous reads
  refuse. This slice accepts no completion schema, grants no startup permission
  from an open record and is not yet wired into spawner.
- Close each acquired descriptor once; preserve primary plus cleanup errors.
  Any uncertain close poisons subsequent observations in that process.

## Task: fixed-root physical observation

- [x] Add tests using private temporary home/workspace and a distinct child.
  Replace only OS home observation before importing the module; keep real fs.

```ts
assert.deepEqual(observeInChild(emptyWorkspace), { state: 'absent' });
assert.equal(observeInChild(workspaceWithIntent).state, 'open');
assert.equal(observeInChild(workspaceWithEmptyCutoverRoot).error,
  'DEPLOYMENT_CUTOVER_OBSERVATION_INVALID');
```

- [x] Run RED before implementing. Add malformed/extra/staging-only, root/file
  symlink, mode, hardlink, oversized and changed-ancestor cases; assert no cleanup.
- [x] Implement owned workspace ancestor pins → descendant pins → bracketed absence or exact
  directory inventory → bounded held-file read → parse → path/fd/parent/inventory
  revalidation → consume-once close. Return only after clean descriptor closure.
- [x] Add isolated child fault tests replacing an inode after read and throwing
  after descriptor close. Verify refusal, preservation and subsequent poisoned
  observation; no production-specific test hooks.
- [x] Run intent/observer tests and no-emit compiler; independent scoped review,
  fix material findings and checkpoint before startup integration.

Review refinement: existing workspace-anchor failed acquisition retries a close
that may already have consumed its descriptor. Reproduced three close attempts
instead of one with an acquisition/consumed-close fault. The new observer owns
its complete workspace-to-file descriptor stack rather than using that cleanup
helper. It preserves primary and close errors and poisons future observations.
The shared legacy helper is unchanged; no claim that all its callers are fixed.
It remains on the cold/startup/retirement/receipt path; a shared consume-once
cleanup correction and its existing regression updates are required before live
qualification, not optional cleanup. Track that root fix as a separate bounded
implementation slice so this observer does not silently inherit unsafe cleanup.

Verification:19 physical cases plus8 codec cases pass, zero failures/skips;
combined4242.884583ms, exit0. Independent reviewer reran27/27. No-emit compiler
exit0; English1493, paths861 and diff checks pass. No runtime wiring or live use.

## Remaining approved transition

Publisher, completion authority, spawner refusal wiring and the live cutover
controller remain separate work. No safe live switch can be inferred from this
read-only observer. All crash/reboot/cold-handoff qualification still applies.
