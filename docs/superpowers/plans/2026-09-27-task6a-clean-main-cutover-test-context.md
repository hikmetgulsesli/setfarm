# Task6A clean-main cutover test context

Root is the only writer. PR #223 merged and its clean-main build, pure suite
and source manifest passed. The cutover suite exposed a pre-existing test
defect: four tests say they prove a feature-worktree bootstrap refusal but
invoke the script from whichever checkout runs the test. In a clean-main
checkout, source authentication correctly passes and the rejection advances
to `dependencies`; on a feature branch it refuses at `source-authentication`.
The resulting false failure blocks reliable clean-main validation of the same
Task6A delivery. Do not alter bootstrap production behavior or safety gates.

## File Map

- `tests/internal-production/baseline-deployment-cutover-pre32-physical-inventory-coverage-v1.test.ts`
- `tests/internal-production/baseline-deployment-cutover-task6a-private-catalog-bootstrap-v3.test.ts`
- `tests/internal-production/baseline-deployment-cutover-task6a-three-launcher-bootstrap-v2.test.ts`
- `tests/internal-production/baseline-deployment-cutover-task6a-writer-catalog-bootstrap-v2.test.ts`
- `tests/internal-production/cutover-feature-branch-bootstrap-fixture-v1.ts`

Each test uses one fresh disposable Git repository containing the exact
bootstrap closure, a matching `origin` and `origin/main`, and a clean commit.
The same verb must refuse the real non-main branch at
`source-authentication`, then advance to `source-build` when that same clean
repository is renamed to `main`. The latter is an intentional negative
control: the fixture has no finalized build and cannot enter host observation.
This proves the branch guard itself, independent of the source checkout branch.
Use the real temporary-directory path so macOS `/var` to `/private/var`
presentation cannot turn the entrypoint check into an earlier `entry` refusal.
Keep stdout empty and the fixed two-line refusal. Close/delete only the
per-test temporary fixture; never prune existing worktrees or generations.

RED is the observed clean-main test failure (`dependencies` versus
`source-authentication`). Codex review then found that a script-only copy
would pass without exercising the branch guard; a new branch identity
assertion was RED (Git status 128) before adding the real Git fixture. Run the
four focused tests, full pure/cutover and
manifest suites, TypeScript, independent read-only review, exact-head PR
review, then clean-main build and cutover tests. No live service, DB, role,
credential, selected CLI or production-source changes.
