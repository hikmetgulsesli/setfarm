# Held identity drift diagnostic V1

Status: causal diagnostic refinement for the positive worktree host observation. PR #151 merged and its clean-main build passed, but live V3 probes failed closed inside the unchanged V2 physical catalog. Clean-main probes from outside candidate worktrees ended both at `HeldDirectories.assertStable()` during second-pass Git validation and at `referencePids()` when `lsof` returned status 1 with nonempty non-observer PID records. The generic inner errors hide the affected root. Without that path, the persistent host failure cannot be classified or safely corrected. No evidence supports relaxing identity or PID checks.

## Decision

Keep the exact fail-closed predicate and outer error message. When a held directory or incidental held file fails its existing descriptor/path identity comparison, add only a frozen structured cause `{ kind, root }` to the inner error. `kind` distinguishes `directory-descriptor`, `directory-path`, `file-descriptor`, and `file-path`. The outer physical-catalog error remains `INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID`, with the inner error as its cause. No success response field, schema, hash, owner predicate, observer command, filesystem write, or recovery action changes.

For the observed `lsof` status-1/nonempty-output mismatch, retain the same rejection and attach a frozen inner cause `{ kind: "lsof-status1-nonobserver-pids", root, observedPids }`. This records the already parsed PID list without accepting it. Other malformed `lsof` output and status errors continue to reject as before.

The root path is diagnostic local evidence, not a cutover decision. A mismatch still aborts immediately. A filesystem syscall error continues to propagate into the catalog's outer invalid error; this slice does not turn errors into absence. Existing held directory cleanup remains in `finally`.

## Verification

Add fixture tests that mutate a held directory and a held incidental file inside the existing two-pass callback and inject the observed status-1/multiple-PID `lsof` response, assert unchanged outer invalid error, and inspect the exact inner structured causes. Prove a stable fixture still returns the same catalog. Run focused/pure/cutover suites, TypeScript, contracts, independent read-only review, exact-head PR review, clean-main build, and one built host V3 probe from canonical workspace root. Keep all worktrees and historical selected dist/CLI visible and unchanged.

## File map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`: scoped diagnostic causes at the existing `assertStable` and `referencePids` refusal branches only.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`: RED/GREEN held directory/file and status-1 PID cause fixtures, plus stable success regression.
- `docs/superpowers/plans/2026-09-24-held-identity-drift-diagnostic-v1.md`: implementation, review, and delivery evidence.
