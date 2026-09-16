# Held Default Qualification Implementation Plan

> **Execution:** Primary-owner inline TDD with parallel read-only review; one
> writing branch. Standing owner authorization covers this causal prerequisite.

**Goal:** Keep retained package and default env absence evidence physically valid
through later asynchronous qualification without changing launcher acceptance.

**Architecture:** Factor the existing observers into held, zero-input contexts.
Existing snapshot APIs acquire/recheck/close those contexts synchronously. A
context exposes frozen evidence, recheck and consume-once close, not descriptors,
paths selected by callers, credentials, or a claimed authority bit. Closed or
uncertain contexts refuse reuse. This is a supporting task within the approved
transition, not a new user-facing diagnostic or a relaxation of its blockers.

**Tech Stack:** Existing Node builtins, TypeScript observers and physical fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and File Map

- Preserve sourceeef9f6c4059daa487a5a367f8f1609b1d1e39142 and old checkout refs.
- No old JS/native evaluation, environment/credential writes, service operations,
  link changes, controller acquisition or new standalone successful diagnostic.
- `scripts/deployment-cutover-retained-profile.mjs`: add held inventory context;
  preserve snapshot result and all current blockers.
- `scripts/__tests__/fixtures/deployment-cutover-retained-profile.mjs`: allow a
  test-owned program to use the real held export while keeping genuine source,
  filesystem validators and socket refusal.
- `scripts/__tests__/deployment-cutover-retained-profile.test.js`: real pending
  async-boundary rechecks, file/ancestor drift, closed context and close-loss.
- `src/internal-production/baseline-deployment-cutover-env-absence-v1.ts` and
  matching test: held six-candidate absence with unchanged snapshot API.
- No launcher acceptance change in this supporting task. Later owning composition
  must acquire selected-build/CLI, resolution, inventory, absence and private
  launcher contexts, cross-bind them, await DB, reverse recheck, close, then return.

## Task1: retain package inventory pins across a caller's await

Interface: `holdDeploymentCutoverRetainedProfileV1()` returns frozen
`{ observation, recheck(), close() }`. `recheck` checks all held physical file and
tree identities, absence boundaries and selected CLI/build binding. It rejects
after close. Failure poisons the context; cleanup consumes each descriptor once.
Existing `observeDeploymentCutoverRetainedProfileV1()` retains zero-argument guard.

- [x] Extend fixture to accept test-owned held exercise text, keeping default
  snapshot path unchanged. Expected observation remains independently literal.
- [x] RED actual export absent; after acquisition await a promise, then recheck,
  close twice, verify observation and assert recheck-after-close refuses.

```js
const held = module.holdDeploymentCutoverRetainedProfileV1();
await Promise.resolve();
held.recheck();
held.close();
held.close();
assert.throws(() => held.recheck());
```

- [x] RED physical same-byte replacement after acquire refuses on recheck; direct
  optional-package appearance and tree membership ABA refuse independently.
- [x] Factor existing read/hold/check code without altering inventory rules.
  Return only after successful initial check; snapshot closes in finally.
- [x] Verify old physical cases plus new lifecycle cases. Inject close-response
  loss only at actual descriptor boundary, ensure reused descriptor survives.

## Task2: retain default env absence pins

Interface: `holdDeploymentCutoverDefaultEnvAbsenceV1()` returns frozen
`{ observation, recheck(), close() }`; same lifecycle semantics, no input roots.
Recheck includes CLI observation equality and absence parent mtime/ctime.

- [x] RED held export absent, test real temporary candidate trees.
- [x] RED create/remove candidate across await refuses even if now absent;
  replace held ancestor and change CLI target independently refuse.
- [x] Factor current absence observer; preserve its snapshot schema/hash/blockers.
- [x] Run the complete env-absence test file and retained profile file, noemit,
  source contracts, bootstrap closure and exact manifest tests.

## Task3: delivery qualification

- [x] Independent read-only review of resource lifetimes and unchanged authority.
- [x] Source tests must prove acquired descriptors are closed on failure, no
  double-close under response loss, no valid recheck after close/uncertainty.
- [ ] Scoped commit and reviewed PR; normal independent clean-main build after
  merge. Do not fetch the old shared repo or call feature-build override flags.

## Subsequent owning composition (not proven by these APIs)

Verification: profile30/30, env25/25, complete cutover272/272, bootstrap55/55
plus final retained/env bootstrap10/10, exact manifest18/18, noemit and source
contracts. Two read-only reviews cleared production changes; corrected one test
masking gap by witnessing held recheck refusal separately from fresh observation.
Actual descriptor-drain and held close-response-loss tests passed. No live effects.

The fixed resolution table must cover actual ESM/CJS exports, nearer shadows,
package-scope manifests, optional root/global candidates and actual launcher Node
identity. Hold selected finalized output/source metadata, not just snapshot hash.
Only the composition can privately qualify default launcher environment and DB
target across all retained lifetimes. Existing strict launcher API stays strict.
Filesystem phase/zero-owner, controller exclusion and journaled effects remain.
