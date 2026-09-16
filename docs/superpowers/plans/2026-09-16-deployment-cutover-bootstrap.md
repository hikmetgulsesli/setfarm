# Deployment Cutover Trusted Bootstrap Implementation Plan

> **Execution:** Serialized primary-owner TDD, parallel read-only review. Continue
> the approved design; existing isolated writing worktree only.

**Goal:** Authenticate the new clean-main source and finalized output before
loading the cutover owner/controller module, without touching retained archives.

**Architecture:** A builtins-only fresh fixed entry authenticates its plain-script
closure against canonical clean-main Git. A narrowly exported read-only wrapper
reuses the existing plain-JavaScript finalized-output verifier. Only then may the
bootstrap import compiled records/store and the owner module, with physical/source
brackets across imports. Initial command is diagnostic only; effect integration
remains a separate, required part of the approved transition.

**Tech Stack:** Node ESM, fixed Git commands, existing retention source/output
verification, physical temporary Git/build fixtures, strict JSON observations.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and causal scope

- Keep old deployment and eight archives unchanged; ports3080/3333/18789 unchanged.
- No source/tsx fallback, dirty-build override, ledger inspection that repairs
  state, maintenance acquisition, service operation or archive disposal.
- A compiled observer cannot bootstrap its own trust: running it in a fresh child
  before verifying output could execute unverified code. Verify plain-script
  bytes from Git and finalized output before any compiled import.
- The fresh builtins-only entry is the explicit trusted loading boundary, not an
  arbitrary long-lived cached owner import followed by hashing current disk.
- Freshness is established before Node starts: trusted executable and sanitized
  launch environment without preloads/custom loaders. Entry-time rejection of
  NODE_OPTIONS cannot undo earlier preload execution; do not claim otherwise.
- Native pre/post import checks alone cannot prevent swapped code from executing.
  The bootstrap must enforce the authenticated source bytes at load time, before
  evaluation, using a fixed allowlisted synchronous loader or immutable bytes.
  Unknown file dependencies fail closed; never silently trust an unlisted module.
  Use the synchronous Node `registerHooks` load contract: return an owned copy of
  the preauthenticated module bytes with exact format and shortCircuit, rather
  than letting native import reread a mutable pathname. Builtins are the only
  non-file exception; do not delegate unknown local/package modules. Feature-test
  hook availability and refuse unsupported runtimes. Reference:
  https://nodejs.org/api/module.html#synchronous-loadurl-context-nextload
- This closes the source-loading gap documented in owner-exclusion Task3. It is
  necessary for the same approved live transition, not an unrelated feature.
- Import-graph evidence: the receipt's pure source/build observer eagerly loads
  109 local modules and Zod through its surrounding module. Bootstrap and owner
  instead use the equivalent plain-JS current finalized observer. Do not broaden
  the loader allowlist to arbitrary node_modules. Existing receipt/cold/ready
  protocols remain unchanged and independently enforced later. Read-only review
  found no semantic gap in this bounded source/build prerequisite.

## File map

- Modify `scripts/build-generation-retention.mjs`: one zero-argument exported
  current finalized source/build observer; reuse private source pass,
  `inventoryBuildGenerationV1` and `observeActualSetfarmRuntimeSourceV1`.
- Modify `scripts/__tests__/build-generation-retention.test.js`: exercise the new
  read-only export with existing temporary Git/finalized-dist fixtures. Update
  the explicit exported-surface expectation; preserve all existing gates.
- Create `scripts/deployment-cutover.mjs`: fixed fresh diagnostic entry, script
  closure authentication, import bracketing and sanitized result/error output.
- Create `scripts/__tests__/deployment-cutover.test.js`: clean/dirty/source-drift,
  wrong-origin, missing/malformed output and import-boundary replacement tests.
- Modify `scripts/deployment-cutover-owner.mjs` and its tests: include the finalized
  bootstrap/verifier script closure in the immutable controller-source commitment.

## Task1: current finalized output read-only wrapper

**Interface:** `observeCurrentFinalizedSetfarmSourceBuildV1()` returns frozen
`{branch:'main',clean:true,sha,treeHash,buildHash,originMainSha}`. No inputs and no
retention-store dependency. The observed build must equal the current source;
the older-retained-build observer is intentionally not reused.

- [x] Add a real temporary Git fixture test and watch the missing export fail:

```js
const expectedBuildHash = writeFinalizedRuntimeDist(root);
const result = runModule(root, `import {observeCurrentFinalizedSetfarmSourceBuildV1 as observe} from './scripts/build-generation-retention.mjs'; process.stdout.write(JSON.stringify(observe()));`);
assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(result.stdout).buildHash, expectedBuildHash);
assert.equal(existsSync(join(root, '.setfarm')), false);
```

- [x] Implement fixed-root full-ancestor held guards, source pass, bounded terminal
  artifact reads and candidate build-hash derivation. The candidate is not trusted
  until `observeActualSetfarmRuntimeSourceV1` verifies exact output topology,
  content hashes, terminal metadata, Git-derived inputs and current source equality.
  Bracket with full dist inventory and another source pass; retain physical
  identities, validate owner/mode/device, consume each descriptor once and refuse
  uncertain cleanup. Never call prepare/resume or retained-current-build paths.
- [x] Test stale source/build, dirty branch, wrong origin, output tampering,
  terminal-byte drift, physical replacement, symlinks and descriptor response
  loss. Snapshot fixtures before/after to prove the observer performs no writes.
- [x] Run full retention script suite, noemit/contracts and independent review.
  Checkpoint only after every new and existing required assertion passes.

## Task2: fresh fixed bootstrap diagnostic

**Interface:** exact `node scripts/deployment-cutover.mjs inspect --json`; all
other modes refuse. Derive root only from `import.meta.url`. Return source/build
and source-closure commitments; never return secrets or acquire an owner.

- [x] Write command fixtures that demonstrate no module loading/effect occurs on
  dirty/wrong-origin/untracked/crossed script closure, then implement pre-import
  Git-byte authentication with held physical snapshots. Fixed closure includes
  bootstrap, retention verifier, owner, process observer and journal normalizer.
  All these scripts currently import builtins or fixed members of that closure.

```js
assert.notEqual(rejected.status, 0);
assert.equal(existsSync(join(root, 'module-loaded-marker')), false);
assert.deepEqual(runtimeNamesAfter, runtimeNamesBefore);
```

- [x] Import only the authenticated plain-JS verifier, run its current finalized
  output observation and recheck closure/ancestors. Use this same exact six-field
  source/build observer in the owner; no redundant receipt import is needed.
  Authenticate owner before import
  and compare its source commitment. Enforce authenticated script/output bytes
  in the load hook before evaluation, not only after native import. Test a swap
  between precheck and module read and require its execution marker to be absent.
  Cache original expectations, never rebaseline
  on drift; reject cached-before-auth or non-fresh unsupported entry invocation.
- [x] Test load-time script and compiled-record replacement, compiled-output drift,
  invalid CLI modes, unsupported existing-process import, secret-free errors and
  absent runtime writes. Companion wrapper/owner tests cover physical replacement,
  same-inode byte changes and permanent refusal after detected drift.
- [x] Update spec File Map and owner closure tests. Full targeted suites plus
  contracts/noemit and independent review precede checkpoint.

## Diagnostic qualification evidence

The wrapper started with five missing-export failures, then twelve focused tests
passed. Full retention script suite:206/206,zero failures/skips,628924.713166ms;
log `logs/2026-09-16-current-finalized-wrapper-retention.log` in the workspace.
Fresh bootstrap12 + owner20 + process-observer15:47/47,zero failures/skips,
15720.170125ms. Complete cutover TypeScript suite:181/181,zero failures/skips,
21512.481083ms. TypeScript noemit and English/path contracts passed. Independent
read-only review found no remaining material issue.

Two load-time replacement tests use execution markers. A private fixture mutation
that changed the hook from owned bytes to pathname rereading made both tests fail
because swapped code executed. The mutation was removed; both tests then passed.
The real current feature checkout correctly refuses diagnostic execution because
it is not delivered clean main. This refusal is not a successful normal build.
No owner acquisition, live authority publication, CLI/service change, archive
mutation or new deployment checkout occurred during these tests.

## Still required after diagnostic bootstrap

This observer does not authorize deployment. The controller still needs full
runtime/DB zero-owner preflight, immutable effect journal, exact launcher/process
operations, atomic CLI transition, new dashboard health/source authentication,
sealed cold recovery and actual Task6A-ready-bound completion. Deliver reviewed
PR and obtain a normal clean-main build before any live cutover execution.
