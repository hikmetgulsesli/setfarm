# Deployment Cutover Intent Implementation Plan

> **For agentic workers:** Serialized primary-owner implementation with parallel
> read-only review, as requested by the owner. Continue without another execution
> choice prompt. The executing-plans skill is unavailable; use inline checkpoints.

**Goal:** Define one immutable cutover intent binding both deployments and the
original launcher observations before any external cutover effect.

**Architecture:** Pure bounded codecs produce historical commitments only.
Physical observation, durable publication and startup refusal consume these
records in separately tested integration slices; parsing never grants authority.

**Tech Stack:** TypeScript ESM, Node crypto, node:test with tsx.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Global Constraints

- Preserve old deployment and all eight archives. No runtime mutation in this slice.
- Keep ports3080/3333/18789 unchanged; intent's dashboardPort must be3333.
- No arbitrary command, PID, environment, credential or bypass fields.
- Source/build identity and physical observations are commitments to resolve
  against live evidence later, never caller-supplied proof of current ownership.
- Existing retention, cold and rebind schemas remain unchanged.

## File Map

- Create `src/internal-production/baseline-deployment-cutover-records-v1.ts`:
  intent type, creation, canonical encoding and strict parsing.
- Create `tests/internal-production/baseline-deployment-cutover-records-v1.test.ts`:
  canonical roundtrip, structural contradiction, tamper and input ownership tests.

## Task 1: Strict immutable intent

Interfaces:

```ts
createDeploymentCutoverIntentV1(input: unknown): DeploymentCutoverIntentV1;
encodeDeploymentCutoverIntentV1(record: unknown): Buffer;
parseDeploymentCutoverIntentV1(bytes: Buffer): DeploymentCutoverIntentV1;
```

Input has exact fields `oldDeployment`, `newDeployment`,
`cliLinkObservationHash`, `spawnerLauncherConfigurationHash`,
`dashboardLauncherConfigurationHash`, `maintenanceIntentHash`, `dashboardPort`.
Each deployment has exact `checkoutPath`, `checkoutDirectoryIdentityHash`,
`sourceSha`, `sourceTreeHash`, `buildHash`. Git hashes are lowercase40/64hex;
observation/build hashes lowercase64hex. Paths are canonical absolute POSIX
non-root paths, max1024 bytes, safe ASCII segments; old/new paths must differ.

Record adds schema `setfarm.internal-production-deployment-cutover-intent.v1`,
purpose `preserved-deployment-cutover`, and `cutoverIntentRef/Hash`. Self hash is
SHA256 of sorted-key canonical body, no newline. Ref prefix is
`setfarm://internal-production/deployment-cutover-intent/sha256/`.
Wire encoding is canonical JSON plus one newline, max65536 bytes. Reject unknown
keys, accessors, symbols, non-enumerable fields, non-plain objects, duplicate JSON
keys and noncanonical bytes. Snapshot own data fields once before validation.

- [x] Write tests first:

```ts
const record = createDeploymentCutoverIntentV1(input);
const bytes = encodeDeploymentCutoverIntentV1(record);
assert.deepEqual(parseDeploymentCutoverIntentV1(bytes), record);
assert.equal(record.dashboardPort, 3333);
assert.throws(() => createDeploymentCutoverIntentV1({ ...input, dashboardPort: 3334 }));
assert.throws(() => createDeploymentCutoverIntentV1({ ...input, newDeployment: input.oldDeployment }));
```

- [x] Run `node --import tsx --test tests/internal-production/baseline-deployment-cutover-records-v1.test.ts`;
  observe missing implementation failure before code.
- [x] Implement data-descriptor snapshots, exact validators, canonical builder,
  frozen nested deployments, self-pair validation and bounded strict parser.
- [x] Add independent body mutations with recomputed hashes to prove structural
  validation, plus crossed refs, accessor refusal without execution, input mutation,
  whitespace/duplicate-key wire refusal, path traversal and oversize boundaries.
- [x] Run focused suite and no-emit TypeScript check; independent scoped review,
  fix material findings and checkpoint the tested slice on this PR branch.

Review caught caller-owned Buffer method dispatch and proxy reflection. Both
reproduced RED; parser now copies intrinsic bytes to owned memory, and validators
reject proxies before reflection. Eight record tests pass; independent re-review
clear. Combined record/physical-observer suite27/27, no-emit compiler exit0.

## Explicit remaining spec coverage

This plan implements record commitments only. It does not implement fixed-root
physical store observation/publication, pre-start refusal wiring, ready-bound
completion, ownership/death evidence, exact launcher/dashboard/link cutover,
clone/build/PR delivery, or crash/reboot/cold-handoff qualification. Each requires
a concrete implementation plan and tests before its first source edit. No live
controller is exposed until the full approved transition has passed qualification.
