# Pre32 Git-admin entry churn remains a physical blocker

Status: bounded systemic root fix for the approved positive physical-plus-PostgreSQL ownership diagnostic. No cutover authority is added.

## Evidence and decision

PR #156's authenticated host diagnostic refused inside the V4 held physical/database pair. The established authenticated default-context observer independently qualified both passive launchers and returned zero legacy owner counts with the three existing cutover blockers. A standalone read-only physical observer refused with a nested `directory-descriptor` drift on `setfarm/.git/worktrees/setfarm-internal-production-bootstrap`. That directory's mtime/ctime advanced at a 60-second cadence matching both old launcher retry logs; a read-only filesystem watcher observed two transient `index.lock` rename events at the retry second. The preserved selected CLI runs `git status --porcelain` before rejecting its stale historical build. It must not be patched, replaced, or bypassed.

The V2 physical catalog should distinguish a linked Git worktree's exact, marker-derived admin directory entry churn from lost directory identity. Keep held descriptor/path identity, type, mode, owner, birth time, all ordinary directory mutation guards, Git listing/topology checks, candidate dirty-state checks, PID checks, and second-pass agreement. Record observed mtime/ctime churn on that one verified admin directory as a named `git-admin-entry-churn` blocker rooted at the visible candidate worktree. The catalog and enclosing V4 pair remain diagnostic-only and unresolved. Never treat this blocker as an owner, absence, or permission for effects. Unknown or non-admin drift still refuses. A replaced admin directory still refuses. The change retains every worktree and the selected CLI/dist.

## File map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`: narrowly classify marker-derived linked Git-admin entry churn, preserve identity checks, publish explicit unresolved blocker.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`: RED/GREEN transient lock churn, admin replacement refusal, unchanged non-admin drift and topology tests.
- `docs/superpowers/plans/2026-09-25-pre32-git-admin-churn-blocker.md`: TDD, verification, review, PR and host evidence record.
