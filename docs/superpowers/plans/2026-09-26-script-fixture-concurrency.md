# Serial Script Fixture Runner Plan

## Evidence and causal scope

The clean-main `npm test` reached `test:scripts` and failed the retained-build fixture with crossed Mission Control loaded/plist commitments. Independent read-only audit found that sibling test workers create temporary directories beneath the same Darwin ancestor whose `nlink` is part of separately sampled physical path-token commitments. The same suite passed 810/810 under Node's serial test-file runner. This is a test-runner concurrency issue, not evidence that the production retention guard should be relaxed. A reliable full-suite gate is necessary before the current cutover work can be delivered with credible verification.

## Decision

Pin only `test:scripts` to `--test-concurrency=1`, preserving every test and the subsequent serial genuine-integration command. Do not alter the retention observer, path-token check, runtime guard, or deployment behavior. This controls sibling test-file fixture churn; it does not claim immunity from unrelated ambient filesystem changes.

## File Map

- `package.json`: exact `test:scripts` runner option.
- `scripts/__tests__/test-scripts-runner-contract.test.js`: behavioral RED/GREEN runner probe using two real test files contending for an exclusive temporary lock.
- `docs/superpowers/plans/2026-09-26-script-fixture-concurrency.md`: evidence, scope and verification record.

## TDD and delivery

- [x] Add a real two-file test-runner probe; it failed with `EEXIST` on the parallel command and passed 1/1 after restoring the serial option. The genuine integration command remains in the package script.
- [ ] Complete the serial script suite with no concurrent temp-heavy test run.
- [ ] Verify TypeScript and contracts on the branch, then review. The normal build refuses a feature branch because `HEAD` must equal `origin/main`; do not bypass it. Run normal build and full `npm test` against the separate isolated PostgreSQL administrator on port 55432 after reviewed merge to clean main.
- [ ] Deliver a reviewed PR, clean-main build in the preserved deployment clone and a no-write host check. Preserve all historical worktrees, old selected dist and CLI link.

The first full-suite attempt in this new worktree was stopped at the initial CLI group because `dist/cli/cli.js` was not built. It is not counted as a suite result. A feature-worktree build then correctly refused because `HEAD` did not equal `origin/main`; no runtime or build guard was bypassed. The pre-merge script suite can run without that `dist`; full-suite evidence belongs to the reviewed clean-main build.
