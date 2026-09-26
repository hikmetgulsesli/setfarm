# Runtime guard read-only Git implementation plan

Root is the sole writer. Preserve old selected dist, CLI link, all retained
worktrees and both LaunchAgents. This scoped fix follows authenticated V3 host
evidence: recurring selected Git-admin churn is the remaining physical blocker,
and the old runtime guard's background `git status` is a plausible writer.
No source-only change is claimed to clear the current host blocker.

## File Map

- `src/cli/runtime-guard.ts`: pass `--no-optional-locks` before every Git
  read-only subcommand.
- `tests/runtime-guard-optional-locks.test.ts`: fake-Git process fixture
  asserts clean acceptance and dirty refusal with the flag.
- `docs/superpowers/specs/2026-09-26-runtime-guard-read-only-git-design.md`:
  safety contract and limits.

## Execution

1. Add focused fake-Git tests; observe RED with the current helper.
2. Change only the helper's Git invocation; rerun focused GREEN and related
   runtime/cutover tests. Verify TypeScript, source contracts and diff check.
3. Independent read-only diff review, then scoped commit, PR, exact-head
   GitHub review/checks, reviewed merge, clean-main build and no-write host
   verification. Do not rebuild or replace selected historical dist/link, stop
   services, clear the Git-admin blocker, or claim Task6A readiness.
