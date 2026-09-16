# Sampled launcher settlement implementation plan

Root sole source writer; independent agents review read-only. Standing owner
authorization applies to this causal refinement of the approved preserved cutover.

## Evidence and design

PR137 clean-main build passed. Actual host inspection78558 refused after57.12s
at qualify/sampled-identity, cleanupFailed:false. This stage covers several
operations; the actual failed operation remains unknown. Do not infer native
failure or directory drift from elapsed time.

Source inspection found a narrower independently reproducible lifecycle issue:
checkSampled accepts authenticated idle at its first snapshot but rejects the
same idle state immediately after successful matching native identity. Accept
that post-identity idle as settled, retaining all later no-restart and final
process-family/listener-zero checks. Native errors, identity mismatches, replaced
PIDs and configuration drift still refuse; never catch native failure as exit.

Alternatives: diagnostic-only preserves the known inconsistent idle transition;
catching generic native errors and accepting later idle can conceal mismatches
and is rejected. Choose explicit post-success idle settlement plus finite
substage attribution for snapshot, generation, native, binding and postcheck.
No raw error, PID, path, environment or credential data in diagnostic additions.
No service/link/archive/DB effects. No claim this fixes the exact host refusal
until a reviewed clean-main host inspection proves it.

## File map

- src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts:
  existing sampled monitor, explicit successful-identity idle transition only.
- scripts/deployment-cutover-default-context.mjs and deployment-cutover.mjs:
  closed allowlists for the additional finite launcher substage values.
- tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts:
  normal exit after identity, replacement/restart/native-failure refusals and
  exact diagnostic propagation without DB calls on failure.
- scripts/__tests__/deployment-cutover-default-context.test.js and
  deployment-cutover.test.js: accepted finite values and crossed-value refusals.
- scripts/integration/deployment-cutover-default-context-composed.test.mjs:
  composed successful identity-to-idle transition through authenticated graph.

## Execution and verification

- [x] RED: fixture sets idle synchronously after a monitor identity (only after
  both measurements); expect qualified samples and one private census call.
  Existing monitor rejects at its post-snapshot. Add native-error-to-idle,
  replacement PID and restarted settled generation refusal variants, no DB.
- [x] GREEN: set local fixed stages around each monitor operation; after a
  matching identity, if authenticated after.pid is undefined, mark settled and
  continue; otherwise require exact original PID. No native catch or retry.
- [x] Exercise every new finite diagnostic through owner and bootstrap.
- [x] Run focused launcher/owner/bootstrap, composed, broad cutover, serial
  genuine, manifest, noemit, English/path and diff checks. No full npm-test claim.
- [ ] Independent review, scoped PR/cloud review, SHA-bound merge.
- [ ] Normal separate clean-main build; one fresh sanitized host inspection.

The original approved specification remains
docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md.
All unrelated filesystem/helper/phase/controller/journal blockers remain.

## Verification evidence

RED launcher5 and owner/bootstrap10 reproduced finite stage and normal-idle
failures. Real composed monitor-idle also reproduced sampled-identity rejection
(17630). GREEN owner52, launcher83, bootstrap diagnostic17 and composed8 passed
(67689); additional same-PID settled restart regression passed in targeted6.
Final broad cutover328 passed (54584), including all84 launcher tests. Manifest18,
noemit, English1565/path892 passed (32219). Final standard serial genuine32/32
passed in56.6s (73426). Diff check clean. Independent read-only review found no
production blocker; its requested settled same-PID restart test was added.
