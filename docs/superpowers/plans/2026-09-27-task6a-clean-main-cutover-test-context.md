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

Each test copies only `scripts/deployment-cutover.mjs` to a fresh disposable
noncanonical `scripts/` path and invokes that copy with the same sanitized
environment and verb. The script must refuse at `source-authentication`
before dependency or host loading, independent of the source checkout branch.
Use the real temporary-directory path so macOS `/var` to `/private/var`
presentation cannot turn the entrypoint check into an earlier `entry` refusal.
Keep stdout empty and the fixed two-line refusal. Close/delete only the
per-test temporary fixture; never prune existing worktrees or generations.

RED is the observed clean-main test failure (`dependencies` versus
`source-authentication`). Run the four focused tests, full pure/cutover and
manifest suites, TypeScript, independent read-only review, exact-head PR
review, then clean-main build and cutover tests. No live service, DB, role,
credential, selected CLI or production-source changes.
