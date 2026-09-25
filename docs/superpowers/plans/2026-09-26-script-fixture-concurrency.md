# Serial Script Fixture Runner Plan

## Evidence and causal scope

The clean-main `npm test` reached `test:scripts` and failed the retained-build fixture with crossed Mission Control loaded/plist commitments. Independent read-only audit found that sibling test workers create temporary directories beneath the same Darwin ancestor whose `nlink` is part of separately sampled physical path-token commitments. The same suite passed 810/810 under Node's serial test-file runner. This is a test-runner concurrency issue, not evidence that the production retention guard should be relaxed. A reliable full-suite gate is necessary before the current cutover work can be delivered with credible verification.

## Decision

Pin only `test:scripts` to `--test-concurrency=1`, preserving every test and the subsequent serial genuine-integration command. Do not alter the retention observer, path-token check, runtime guard, or deployment behavior. This controls sibling test-file fixture churn; it does not claim immunity from unrelated ambient filesystem changes.

## File Map

- `package.json`: exact `test:scripts` runner option.
- `scripts/__tests__/test-scripts-runner-contract.test.js`: RED/GREEN package-script contract.
- `docs/superpowers/plans/2026-09-26-script-fixture-concurrency.md`: evidence, scope and verification record.

## TDD and delivery

- [x] Add a test that rejects the current parallel script-file runner and requires the serial option without dropping the genuine suite. RED failed on the old script string.
- [ ] Make the one-line package script change; focused test is GREEN 1/1. Build and complete serial script suite next.
- [ ] Run full `npm test` against a separate isolated PostgreSQL administrator on port 55432, with no concurrent temp-heavy test run; then normal clean-branch build and review.
- [ ] Deliver a reviewed PR, clean-main build in the preserved deployment clone and a no-write host check. Preserve all historical worktrees, old selected dist and CLI link.

The first full-suite attempt in this new worktree was stopped at the initial CLI group because `dist/cli/cli.js` was not built. It is not counted as a suite result; commit the scoped source first so the normal clean-worktree build guard can run, then retry.
