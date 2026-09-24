# Authenticated pre32 held-pair diagnostic entry

Status: bounded prerequisite of the approved positive physical-plus-PostgreSQL ownership design. The diagnostic does not perform cutover or certify an owner.

## Evidence and decision

PRs #154–#155 delivered a strict same-transaction pre32 census/active-row snapshot and a held physical/database diagnostic pair. A direct `node -e` host attempt immediately refused at launcher `transport`: the passive Python source import is data-only and can be resolved exclusively by the authenticated `scripts/deployment-cutover.mjs` loader. Loading it outside that bootstrap would bypass a safety boundary; the refusal is expected.

Add exactly one read-only bootstrap verb, `inspect-pre32-host-pair --json`, to the current source/build-authenticated entry. After the existing closure, build, dependency and controller-source checks, import the built `baseline-positive-worktree-host-pair-v2.js` from the authenticated output tree and call its zero-input V4 diagnostic once. Return it under a new `pre32HostPair` property only for this verb. Require its fixed schema, diagnostic authority, unverified physical identity label, frozen envelope, and canonical hash shape before output. Keep all existing verbs and their result shapes unchanged. On refusal, print no nested exception or credential; use finite bootstrap stage and `cleanupFailed:null` if nested cleanup cannot be certified. The nested observer owns its resource cleanup.

The bootstrap does not reinterpret physical blockers or grant database, controller, service, or journal authority. It neither starts/stops services nor changes the selected historical CLI, DB, filesystem, or guard. A real host sample may still refuse; that refusal is evidence, not a reason to relax checks.

## File map

- `scripts/deployment-cutover.mjs`: one fixed verb, authenticated module call, exact diagnostic output and finite refusal stage.
- `scripts/__tests__/deployment-cutover.test.js`: RED/GREEN authenticated fixture dispatch, no extra input, wrong shape, source/output tamper and non-secret refusal.
- `docs/superpowers/plans/2026-09-25-pre32-authenticated-bootstrap-diagnostic.md`: TDD, verification and delivery record.

No production source module, migration, selected dist, launcher or physical catalog changes are required.
