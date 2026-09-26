# Runtime guard Git checks without optional index writes

The selected historical CLI is still built from an older source and retries
through two 60-second LaunchAgents. Its runtime guard runs `git status
--porcelain` before rejecting stale dist. On the current host, the selected
worktree's linked Git-admin directory changes at roughly that cadence and is
the one residual V3 physical blocker. This is a strong causal hypothesis, not
PID-attributed proof. The old selected dist and CLI symlink must remain intact.

Git documents that `status` normally refreshes and writes the index, and
recommends `git --no-optional-locks status` for background callers. Make the
current source runtime guard use that global Git option for each of its
read-only branch, HEAD and status queries. Do not skip status or loosen branch,
cleanliness or BUILD_INFO checks. A fake-Git regression test must require the
option on every invocation, prove the clean result still succeeds, and prove a
dirty status is still rejected even when ambient `GIT_OPTIONAL_LOCKS=1`.

This prevents the newly built CLI's guard from itself creating optional index
locks. It cannot cure the preserved old selected dist's retry churn before a
separately reviewed, owner-held deployment switch. It grants no physical
nonowner, continuous exclusion, Task6A or cutover authority.

## File Map

- `src/cli/runtime-guard.ts`: add Git's per-invocation no-optional-locks flag.
- `tests/runtime-guard-optional-locks.test.ts`: RED/GREEN fake-Git clean/dirty
  guard behavior and exact invocation contract.
- `docs/superpowers/plans/2026-09-26-runtime-guard-read-only-git.md`:
  execution, verification and nonauthority boundary.
