# Held Selected Build Implementation Plan

> **Execution:** Primary-owner inline TDD, read-only parallel review. One writer.

**Goal:** Preserve original selected CLI, source and finalized output physical
identities across qualification awaits, including the retained-profile consumer.

**Architecture:** Add zero-input held selected-build API; factor its existing
private finalized-build verifier into a held context. Keep source/output regular
files and parent directories open with original metadata, a 4096-descriptor
budget checked before open, and consume-once cleanup. Retain original inventory
and private source identity through rechecks; preserve public snapshot schemas.

**Tech Stack:** Existing builtin retention verifier and real temporary Git/build
fixtures. No new dependencies or old-code evaluation.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints / File Map

- `scripts/build-generation-retention.mjs`: held selected/finalized primitives;
  private source-pass collector retaining full stat metadata and source parents.
  Preserve existing physical-input hash format and all current source predicates.
- `scripts/__tests__/build-generation-retention.test.js`: real historical dist,
  newer clean checkout, CLI link and eight retained archives fixture.
- `scripts/deployment-cutover-retained-profile.mjs`: own one selected held context
  through inventory and rechecks; drain it even if another cleanup fails.
- Matching retained physical test and fixture: source/output drift after await
  refuses in the actual inventory consumer, not just the new leaf export.
- No launcher acceptance, Node resolution, environment, database, service/link or
  retention mutation. These remain independent obligations before admission.

## Task1: selected-build lifetime

New public interface: `holdSelectedSetfarmDeploymentBuildV1()` returns frozen
`{ observation, recheck(), close() }`. Existing `observeSelected...()` wraps it.
Private `holdFinalizedSetfarmSourceBuildAtRootV1(root, requireCurrent)` owns source
and output pins; existing current snapshot wraps and closes it.

- [ ] RED missing held export using selectedDeploymentFixture with unchanged
  historical/newer checkout expectations and eight preserved archives.

```js
const held = module.holdSelectedSetfarmDeploymentBuildV1();
await Promise.resolve();
held.recheck();
const observed = held.observation;
held.close(); held.close();
assert.throws(() => held.recheck());
```

- [ ] RED source/output same-byte replacement, same-inode modify/restore, source
  parent replacement and CLI-link replacement after acquire. Witness refusal at
  held.recheck, not a fresh wrapper or failed close.
- [ ] Keep original source-file stats via private source-pass collection without
  altering the existing physical-input-set hash contract. Pin parents and regular
  files, compare full dev/ino/uid/gid/mode/birthtime/nlink/size/mtime/ctime against
  descriptor and current path. Retain output inventory and file metadata likewise.
- [ ] Recheck original pins before and after unchanged source/Git predicates and
  output inventory validation. Preserve historical build versus checkout split.
- [ ] Enforce budget before opens; any cleanup failure poisons all dependent
  contexts and drains remaining handles. Closed handles reject recheck.
- [ ] Focused selected/current/source physical tests and close-response-loss/FD
  drain cases; unchanged snapshot hashes and zero runtime writes remain proven.

## Task2: actual retained consumer

- [ ] RED consumer source/output replacement after acquire despite unchanged
  public build hash. Use real selected fixture and canary modules never imported.
- [ ] Replace three independent selected snapshots with one held acquisition and
  its rechecks. Owned selected context closes in every profile failure/success
  cleanup; one failing cleanup cannot prevent other resources from draining.
- [ ] Run retained physical/genuine gate, retention focused gate, bootstrap
  touched modes, manifest, noemit, contracts and diff check; independent review.
- [ ] Scoped reviewed PR and normal independent clean-main build. Preserve old
  checkout HEAD/originmain, old output and all eight archives throughout.

## Explicit remaining obligations

This closes selected-file lifetime, not module resolution or implicit launch
environment. The owning default context still needs actual Node identity,
finite ESM/CJS resolution including global optional candidates, six env absences
and private strict DB target/census composition across the held lifetime.
