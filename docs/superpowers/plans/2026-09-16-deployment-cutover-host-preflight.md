# Deployment Cutover Host Preflight Implementation Plan

> **Execution:** Serialized primary-owner TDD with parallel read-only review in
> the existing isolated worktree. Continue the owner-approved design.

**Goal:** Join the existing CLI, launcher and global process diagnostics inside
the authenticated bootstrap, without publishing authority or operating services.

**Architecture:** Add exact `inspect-host --json` beside `inspect --json`. Import
the three compiled observers only after finalized-output authentication; use the
same immutable-byte loader. Compare complete observations across a forward/reverse
bracket. Report diagnostic blockers, never a zero-owner or ready capability.

**Tech Stack:** Node ESM, existing TypeScript observers, physical Git/build fixtures,
real plist conversion and test-private command responses for launchctl/ps/lsof.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints

- Old deployment and eight archives unchanged; ports3080/3333/18789 unchanged.
- No owner acquisition, maintenance/cutover publication, service operation or
  arbitrary input paths/PIDs. Existing source-only inspect behavior stays intact.
- Mixed roots and CLI starters remain visible; no process absence implies DB
  zero-owner. Old build authentication, DB preflight and ownership are still absent.
- This implements transition sequence step2's diagnostic composition, not its
  complete deployment authorization. No new effect journal before an actual effect.

## File map

- Modify `scripts/deployment-cutover.mjs`: authenticated host diagnostic composition.
- Modify `scripts/__tests__/deployment-cutover.test.js`: compile actual observers
  into the finalized fixture; provide owned CLI/plists and external-command data.
- Update spec File Map with the host diagnostic boundary.

## Task1: diagnostic host bracket

**Consumes:** `observeDeploymentCutoverCliLinkV1()`,
`observeDeploymentCutoverLauncherConfigurationV1()`,
`observeDeploymentCutoverProcessFamiliesV1()` from their matching compiled modules.

**Produces:** existing bootstrap result plus `host` containing `cli`, `launchers`,
`processes`, `newCheckoutPath`, `blockers` and `hostObservationHash`. Blockers always
include `old-build-not-authenticated`, `database-zero-owner-not-observed`, and
`controller-ownership-not-acquired`. Add `cli-already-selects-new-checkout` when
applicable, `non-dashboard-process-family` for any non-dashboard family, and
`dashboard-cli-root-disagreement` unless exactly one dashboard agrees with the
selected CLI and owns the sole3333 listener. These are diagnostics, not admission.

- [x] Write full fresh-bootstrap fixture. The missing mode must fail before code:

```js
const result = run(root, ['inspect-host', '--json']);
assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(result.stdout).host.cli.checkoutPath, oldCheckout);
assert.ok(JSON.parse(result.stdout).host.blockers.includes('database-zero-owner-not-observed'));
```

- [x] Load authenticated observers, read CLI/launchers/processes, then reobserve
  processes/launchers/CLI. Require canonical equality and final source/physical
  checks. Build a domain-separated hash over the diagnostic body; retain no lease.
- [x] Test CLI replacement, launcher state drift and family arrival between the
  two outer observations. Test mixed roots and short starters remain blockers.
  Actual observers parse fixture files/command responses; do not stub observer
  return values or use live host commands for fixture service state.
- [x] Verify no authority directories, unchanged link/plist bytes/inodes, sanitized
  errors, original inspect compatibility and unsupported mode rejection.
- [x] Run bootstrap/owner/process plus complete cutover suites; noemit/contracts,
  independent review, update evidence and scoped checkpoint.

Evidence: three positive fixture tests failed before the mode existed. Implemented
host composition then passed18/18 bootstrap tests. Review requested stronger
unchanged-link/plist evidence; the positive test now compares CLI target/bytes/inode
and both plist bytes/inodes. Final bootstrap18/owner20/process15 passed53/53,
zero failures/skips82252.745958ms; complete cutover181/181,zero skips27324.117667ms.
Noemit0, English1523/path870, diff check0. No material code finding from independent
review. No live host inspection or service/authority mutation was performed.

## Follow-on boundary

Next required work remains old build and shared runtime/DB zero-owner proof,
owner-fenced durable refusal, journaled exact launcher/link effects, new dashboard
authentication, existing cold handoff and actual ready-bound completion.
