# Prepare dependencies for native evidence refresh

## Problem and bounded objective

The real Kimi run `3ad3d125-3f1f-4060-b728-b50d58e754c1` built and tested source `e393d61f21f84c34a57522eeb03ff5ec23590d1e` successfully in implementation attempt 16. Its native evidence refresh, attempt 17, restored the identical tracked source but failed both commands with exit 127: `tsc` and `vitest` were unavailable. Six runtime observations then lacked a running application. The coordinator classified this environmental command failure as product failure and dispatched source repair.

This is a causally necessary Setfarm root fix for the existing objective of producing and checking software. The generated application's separate state-bridge ABI mismatch remains product evidence; this change does not repair that application.

## Design

After `ensureNativeEvidenceOnlyWorktree` authenticates and restores the native candidate and the runtime records its custody, call the existing `prepareNativeImplementationDependencies(custody.repo, custody.worktree)` for `fresh_execution` only. Its existing private-copy, owner, inode, recipe, ignored-control-path and capacity rules apply. Existing reservation, source capture and running-publication guards subsequently revalidate the lease and exact tracked source before evidence commands.

Reuse this helper in `v3-evidence-only-runtime.ts`. Importing it into the repository authority module would close an existing static import cycle through worktree operations and database/completion modules. Coordinator replay must retain its current behavior.

This approach restores the same execution assets used by normal native implementation. Reclassifying every exit 127 cannot establish the underlying cause; a new package installer would duplicate existing behavior. Neither is part of this change.

## File map

- `src/recovery/v3-evidence-only-runtime.ts`: prepare authenticated private dependency assets before fresh native refresh execution.
- `tests/execution-attempts/native-implementation-join.integration.test.ts`: extend the real existing control refresh scenario with an ignored fixture-owned build tool, observe its private availability before real evidence commands, and retain all existing source, lease, branch and cleanup assertions.
- `tests/execution-attempts/helpers/native-implementation-join-fixture.ts`: canonicalize the owned temporary root with `realpath`; actual preexisting fixture cases were refused by the correct directory-alias guard on macOS.
- This specification and the matching implementation plan record the root cause and finite verification scope.

## Acceptance and limits

The original 25-test RED completed naturally with 13 passes and 12 failures. The new control failed exactly with `missing` versus `native dependency available`. Separate preexisting fixture failures included `NATIVE_IMPLEMENTATION_ASSETS_REFUSED:directory alias` and mismatched worktree paths; their original details remain retained. Normalize the temporary fixture root rather than accepting aliases in production.

The control scenario must genuinely fail on the old production code because its restored worktree lacks the ignored executable. With the fix, that exact candidate must execute the privately copied tool, complete real native evidence, and preserve its source revision, retained branch and normal owned cleanup.

Run this focused scenario, existing relevant dependency-copy checks, TypeScript checking and one clean committed build. Obtain task and whole-change review before normal PR delivery. No broad test campaign is required absent a new failure.

No source patch to the generated project, classifier change, new recovery authority, budget extension, credential change, npm installation, shared dependency symlink, runtime guard bypass, or historical-run replay is included. A live rollout requires the existing guarded service transition and current owner closure evidence; this source change alone does not qualify the game or complete the overall project.

## Evidence

Private actual captures and independent source reviews are under `.superpowers/sdd/2026-11-13-kimi-primary-clean-case/`, including `current3ad3d125-refresh17-readonly-rca-v1.md` and `current3ad3d125-refresh17-classification-source-rca-v1.md`. They are retained locally and are not committed.
