# Task6A three-launcher held host V2 plan

## Objective

Bind the two idle Setfarm launchers, the running Mission Control launcher, the frozen V7 physical/database pair, and the V2 writer database sample in one fail-closed, source-authenticated diagnostic. This is causally required by the Task6A cutover evidence chain; it grants no writer admission or physical ownership.

## File Map and test order

1. `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`: RED tests for a private V2 snapshot method on the default holder: qualified idle before/after, exact URL handoff, sticky failure, no public URL. Then implement only that method in `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`.
2. `tests/internal-production/baseline-task6a-three-launcher-host-v2.test.ts`: RED pure injected-port tests for exactly-once awaited physical callback, sequential DB samples, role/hash agreement, refusal and cleanup. Then implement `src/internal-production/baseline-task6a-three-launcher-host-v2.ts`, reusing frozen V7 pair and both existing holders.
3. `tests/internal-production/deployment-cutover-bootstrap.test.ts` or matching script tests: RED for the new strict `inspect-task6a-three-launcher-host-v2 --json` branch. Then add the branch in `scripts/deployment-cutover.mjs`; enroll the pure test in `package.json`.
4. Run focused tests, pure suite, cutover suite, migration/manifest/anchored checks, TypeScript, build, and source contracts. Request independent read-only review; fix findings and rerun.
5. Commit/push scoped branch, deliver reviewed PR, fast-forward preserved clean-main deployment worktree, build there, then run the authenticated no-write host diagnostic and compare source/build evidence. Preserve every existing worktree, service, selected CLI and live DB role.

## Safety acceptance

- Both held launchers close on success/failure; an uncertain close refuses.
- V2 writer sample runs through qualified Setfarm `idle()` checks before and after, with Mission Control exact-URL/recheck bracketing.
- V7 database and V2 writer samples are sequential inside the awaited physical between-passes interval; no atomicity or continuous exclusion is claimed.
- Output is canonical-hashed, diagnostic-only, not-granted, unverified; no raw URL, token, or guessed controller role.
- The new bootstrap verb authenticates clean-main source and build and rejects malformed public shapes and hashes; old verbs remain unchanged.
