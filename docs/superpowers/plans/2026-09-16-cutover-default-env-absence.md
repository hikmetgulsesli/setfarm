# Cutover Default Environment Absence Implementation Plan

> **Execution:** Primary owner inline TDD, parallel read-only review, one writing
> branch. Standing owner authorization applies to this causal scope refinement.

**Goal:** Observe physical absence of default env-file candidates without
claiming effective runtime equivalence or relaxing the existing launcher guard.

**Architecture:** Add one import-inert zero-input filesystem observer. Derive
selected checkout from the real CLI observer, current checkout from the module
location, and the home candidate from code-owned user identity. Hold physical
ancestors, bracket ENOENT-only absence and CLI identity, return frozen nonsecret
commitments. Expose an explicit authenticated diagnostic mode; no SQL or effects.

**Tech Stack:** TypeScript ESM, Node no-follow filesystem calls, current compiled
bootstrap loader and genuine physical fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Global Constraints and Scope

Old installation, eight archives, CLI and ports3080/3333/18789 stay unchanged.
No credentials read, old modules evaluated, environment mutation, arbitrary
caller paths, service action, database connection or ownership acquisition.
Keep `runtime-effective-environment-not-authenticated` and controller blockers.
Do not make SETFARM_ENV_DIR optional in the existing launcher observer. Current
host lacks it, but accepting that runtime mode requires a separately reviewed
retained startup-closure profile; this task proves only candidate-file absence.

Alternatives considered: restoring launchctl configuration changes preserved
state without proving prior intent; interpreting arbitrary env files requires
broader precedence and secret handling. The selected absence-only observation
is useful independently and refuses every present candidate, including symlinks.
It is not sufficient for transition admission.

## File Map

- Create `src/internal-production/baseline-deployment-cutover-env-absence-v1.ts`:
  zero-input `observeDeploymentCutoverDefaultEnvAbsenceV1()`; frozen schema,
  scope, selected/current checkout paths, CLI commitment, physical ancestors,
  candidate absence boundaries, observation hash and explicit remaining blockers.
- Create matching test under `tests/internal-production/`; existing cutover glob
  invokes it. Real filesystem/CLI observer; only user identity and fault boundaries
  substituted. Copy the subject module to its real fixture checkout location.
- Modify `scripts/deployment-cutover.mjs`: explicit `inspect-envfiles --json`,
  authenticate compiled observer bytes before execution; retain final source check.
- Modify `scripts/__tests__/deployment-cutover.test.js` and its bootstrap fixture
  for the genuine compiled new mode and remaining-blocker evidence.
- Update approved spec File Map and this plan with verification results.

## Task1: physical candidate observation

Interface has zero arguments. Candidate paths are .env/.env.local beneath each
of selected checkout, current checkout and owner-home/.openclaw/setfarm; dedupe
identical roots deterministically. Missing intermediate directories are allowed
only through a pinned nearest-existing ancestor and the exact first missing
component. All other lstat errors and all present candidate files refuse.

Initial behavior assertion (fixture returns actual child observation):

```typescript
assert.equal(result.observation.schema,
  "setfarm.internal-production-deployment-cutover-default-env-absence.v1");
assert.equal(result.observation.scope, "default-candidate-absence-only");
assert.equal(result.observation.candidates.length, 6);
assert.deepEqual(result.observation.blockers,
  ["runtime-effective-environment-not-authenticated", "controller-ownership-not-acquired"]);
```

Physical traversal rule used for each candidate:

```typescript
// Start at the root, retain each physical directory fd. Only ENOENT terminates
// traversal with an absence boundary; a present final candidate always refuses.
for (const component of candidateComponents) {
  recheckHeldAncestors();
  const stat = lstatOrExactENOENT(component);
  if (stat === null) { recordMissingBoundary(component); break; }
  requirePhysicalDirectoryOrRefuseFinalCandidate(component, stat);
  holdNoFollowDirectory(component, stat);
}
recheckAllBoundaries();
```

- [ ] Add a genuine six-absence fixture; missing export/file must fail first.
- [ ] Implement descriptor-held physical ancestors and ENOENT-only boundaries;
  compare path and fd identities, owner/mode/device, CLI before/after, then close
  each descriptor once. Uncertain close poisons fresh calls; fixed secret-free
  failure `DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID`.
- [ ] Test each candidate present, dangling symlink, missing home-parent, bad
  owner/mode, ancestor symlink/replacement, candidate appearance, CLI replacement,
  ambiguous error, and close-response-loss/reused descriptor. Preserve evidence.
- [ ] Assert stable frozen output/hash, no writes/network, no env mutation and
  explicit candidate-only scope/remaining blockers. No broad test-only exports.

## Task2: authenticated diagnostic composition

- [ ] Genuine bootstrap test first expects inspect-envfiles output and blockers;
  current argument validation must reject it RED before implementation.
- [ ] Add only the explicit mode, dynamically load the authenticated observer,
  include observation under envFiles, retain final source/output fencing.
- [ ] Present file, crossed CLI and tampered compiled observer refuse with no
  output/effects. Existing inspect/inspect-host/inspect-database behavior unchanged.
- [ ] Run cutover, script/genuine, noemit and manifest/contracts; independent
  review and reviewed PR. Normal build only on delivered independent clean main.

## Deferred Proofs, Not Implicitly Completed

Actual retained startup closure includes389 relative static modules and external
yaml/json5/zod before runtime config. Old compiled inline loader differs from
new source. Physical candidate absence is not proof that no earlier module can
change PG settings. Retained-generation compatibility, launcher default-profile
acceptance, full helper/phase ownership, already-absent-dashboard disposition,
controller/effect journal and ready handoff remain separate required steps.
