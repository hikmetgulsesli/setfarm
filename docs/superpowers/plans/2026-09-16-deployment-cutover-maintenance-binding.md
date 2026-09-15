# Deployment Cutover Maintenance Binding Implementation Plan

> **Execution:** Approved inline sole-writer implementation with independent
> read-only review; executing-plans is unavailable, so use serialized TDD.

**Goal:** Bind the cutover plan to truthful cutover-specific controller history
without reinterpreting archive-disposal authority or creating a hash cycle.

**Architecture:** Extend the existing pure cutover records module with a separate
maintenance-intent grammar committing the controller source hash and a domain-
separated plan hash. The plan projection contains old/new deployments, CLI and
launcher commitments and port3333, but excludes maintenance and self pairs.
The final cutover intent commits the maintenance hash. A pure relation validator
checks both directions and the expected controller commitment; it grants no live
ownership or permission and performs no IO.

**Tech Stack:** TypeScript ESM, strict canonical records, Node unit tests.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and causal relation

The old maintenance grammar requires candidateCompletionHash and describes
archive retention. No archive candidate exists in this preserved route. Reusing
that record or inventing a candidate would be false authority. In this protocol,
maintenanceIntentHash resolves only the new cutover-specific maintenance schema.
Neither an opaque hash nor a valid relation authenticates current process/lease,
source/build, launcher, service, zero-owner or Task6A readiness observations.
No schema migration, service change, old journal mutation or archive deletion.

## File map and interfaces

- Modify `src/internal-production/baseline-deployment-cutover-records-v1.ts`:
  reuse private strict shape/hash/build parsing for the same cutover record family.
  Add `DeploymentCutoverMaintenanceIntentV1`,
  `createDeploymentCutoverMaintenanceIntentV1(input: unknown)`,
  `encodeDeploymentCutoverMaintenanceIntentV1(input: unknown): Buffer`,
  `parseDeploymentCutoverMaintenanceIntentV1(bytes: Buffer)`, and
  `assertDeploymentCutoverMaintenanceRelationV1(input: unknown): void`.
- Create `tests/internal-production/baseline-deployment-cutover-maintenance-v1.test.ts`:
  independent canonical wire oracle, full field-crossing matrix and hostile input.
- Clarify this truthful relation in the approved spec file map; no live transition
  sequence change. Existing cutover intent wire encoding remains unchanged.

## Task: historical binding

- [x] Write a failing independently signed wire and relation test. Maintenance
  constructor input has exactly `{controllerSourceHash, plan}`. Plan has exactly
  oldDeployment/newDeployment/cliLinkObservationHash/spawnerLauncherConfigurationHash/
  dashboardLauncherConfigurationHash/dashboardPort. Record body has schema,
  purpose, controllerSourceHash and cutoverPlanHash, plus maintenance self pair.

```ts
const maintenance = createDeploymentCutoverMaintenanceIntentV1({controllerSourceHash, plan});
const cutover = createDeploymentCutoverIntentV1({...plan, maintenanceIntentHash: maintenance.maintenanceIntentHash});
assert.doesNotThrow(() => assertDeploymentCutoverMaintenanceRelationV1({cutover, maintenance, controllerSourceHash}));
assert.deepEqual(encodeDeploymentCutoverMaintenanceIntentV1(maintenance), independentlySignedBytes);
```

- [x] Run new tests RED before implementation; implement pure strict grammar.
  Domain strings: `setfarm.internal-production-deployment-cutover-plan.v1` and
  `setfarm.internal-production-deployment-cutover-maintenance-intent.v1`;
  purpose `preserved-deployment-cutover`; pair prefix
  `setfarm://internal-production/deployment-cutover-maintenance-intent/sha256/`.
- [x] Reject crossed plan fields, controller hash, maintenance hash and self pair;
  reject archive schema, extras, accessors, proxies, noncanonical/oversized bytes
  and mutated Buffer methods. Use native-owned wire copying as existing codec.
  Verify original input mutation cannot change frozen output or wire.
- [x] Run all cutover tests and noemit/contracts, get independent review and
  checkpoint only the reviewed relation. Do not enable live publisher invocation.

## Self-review boundary

No ownership takeover is implemented. Fixed-root controller-history storage,
fresh observed owner/exclusion, service operations, partial recovery and ready-
bound completion still need their own physical integration before live cutover.
This plan does not certify the broader goal or replace any existing cold gate.

## Checkpoint evidence

Five new tests failed RED for absent functions, then the combined maintenance and
existing intent codecs passed13/13. Complete cutover plus DB-boundary regression
run passed76/76, zero skips,12285.561417ms. English1503/paths862 and diff checks
passed; noemit exit0. Independent review found no must-fix; expected controller hash remains
historical input requiring physical authentication in the future controller.
