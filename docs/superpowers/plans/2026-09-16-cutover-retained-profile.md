# Retained Startup Profile Implementation Plan

> **Execution:** Primary-owner inline TDD, parallel read-only review. One writing
> branch. Standing owner scope refinement; no service, CLI, archive or DB effects.

**Goal:** Authenticate the exact reviewed ARM64 retained startup generation and
its installed dependency inventory without evaluating retained code.

**Architecture:** A code-owned finite profile binds the historical finalized
output tree plus ten exact package installations derived from lock-SRI-verified
cache archives. A builtins-only physical observer derives selected root from the
existing authenticated CLI/build observer, brackets physical reads and returns
hash-only profile evidence. Unknown bytes, metadata or resolution paths refuse.
This is a prerequisite for default-mode effective configuration; it does not
remove existing effective-env/database/phase/controller blockers on its own.

**Tech Stack:** Node builtin filesystem/crypto/zlib, existing selected-build
authenticator, immutable profile JSON, real package-cache qualification tests.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Scope and File Map

Preserve old generation eef9f6c4059daa487a5a367f8f1609b1d1e39142 and checkout
HEAD/localoriginmain1c7505476a6dbda8e45960aeb4a04a6a296573ae. No retained code or
native addon evaluation. Preserve existing two-package executable bootstrap
allowlist. Broader retained inventories grant read/identity evidence only.

- `scripts/deployment-cutover-retained-profile.mjs`: zero-input
  `observeDeploymentCutoverRetainedProfileV1()` physical observer,
  fixed reviewed profile and inventory hashing, bounded nofollow reads, immutable
  results, sticky consume-once cleanup and fixed sanitized refusal.
- `scripts/deployment-cutover-retained-profile.v1.json`: reviewed historical
  output identity and package inventory commitments, no secrets or machine paths.
- `scripts/__tests__/deployment-cutover-retained-profile.test.js`: real temporary
  physical trees and actual observer; genuine cache bytes used only in separate
  integration gate. No substituted acceptance results.
- Matching fixture helper: actual selected-build validators with Git-committed
  synthetic one/two-package profiles; this fixture does not claim to exercise
  all ten production installations. The separate genuine archive gate does.
- `package.json` genuine test command: invoke the new archive test in the standard
  suite; regression runs that command with a fresh test-runner environment.
- `scripts/integration/deployment-cutover-retained-profile-genuine.test.mjs`:
  authenticate ten fixed installations and compare committed inventory commitments;
  missing archives refuse, no download or code evaluation.
- `scripts/deployment-cutover.mjs` and existing bootstrap fixture/tests: explicit
  authenticated retained-profile diagnostic, preserve all other blockers.
- Spec and this plan: record finite semantic audit and remaining obligations.

## Task1: fixed inventory commitments

- [x] Verify lock-SRI archives for yaml2.9.0, json5 2.2.3, zod4.4.3,
  postgres3.4.8, parse5 8.0.1, entities8.0.0, playwright1.60.0,
  playwright-core1.60.0 and fsevents2.3.3, plus the existing nested
  playwright/node_modules/fsevents2.3.2. Compare installed trees without loading
  JS/native members. Missing/extra files or symlinked resolution cannot qualify.
- [x] Define canonical per-package inventory of sorted relative regular-file
  locators, byte lengths and SHA256; physical metadata is checked separately.
  Hash the inventory, not concatenated ambiguous strings.
- [x] RED missing profile; implement reviewed literal profile with source/output
  tree and ten installation commitments. Genuine archive test must reproduce each
  commitment, not derive expected values through the observer under test.

```javascript
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
assert.equal(profile.sourceSha, 'eef9f6c4059daa487a5a367f8f1609b1d1e39142');
for (const installation of profile.installations) {
  // Read fixed local cache bytes; verify declared SHA512 before decoding.
  // Independent archive enumeration produces sorted locator/length/SHA256 rows.
  assert.equal(archiveInventoryHash, installation.inventoryHash);
}
```

The nested fsevents installation is a separately authenticated dependency root,
not an unvalidated ignored subtree. Do not add it to the executable loader.

## Task2: held physical observation

- [x] Missing observer RED; physical cases cover unknown generation, modified
  dependency, local resolution override, wrong architecture, symlink/mode and
  close-response loss. Resource fanout, optional and empty-nested REDs corrected.
- [x] Derive selected checkout through existing finalized-build observation.
  Require reviewed generation/output tree. Authenticate owner/device/ancestors,
  actual package manifests and all regular files; bound paths/counts/bytes.
- [x] Cover inventoried nested node_modules and local optional/sibling candidates;
  refuse unknown branches inside those trees and local bufferutil/utf-8-validate.
  Complete ancestor/global Node resolution remains a separate blocker. No
  caller-supplied roots, manifests or acceptance booleans.
- [x] Bracket selected CLI/build and physical identities; failed cleanup poisons
  reuse and never recloses a consumed descriptor. Return only frozen profile/hash
  commitments and remaining environment/database/phase/controller blockers.

## Task3: authenticated integration and delivery

- [x] Genuine bootstrap RED before explicit mode; authenticate new script/profile
  against source Git bytes before import. Read-only dependencies do not become
  executable loader allowlist entries.
- [x] Positive reviewed fixture, crossed compiled/profile/dependency and optional
  resolution negatives; no sockets, child application execution or authority writes.
- [x] Focused tests24/24 including the standard genuine command; actual archive
  gate4/4; broad bootstrap/owner/dependency/integration124/124, then final retained
  bootstrap5/5 after nested fix. Cutover266/266, manifest18/18, noemit and contracts.
  Two independent reviews cleared corrected resource-budget and gate-wiring gaps.
- [ ] Cloud review, scoped PR, independent normal clean-main build and real
  read-only inspection. No service/link/archive effects in this slice.

## Remaining after profile authentication

Compose exact default launcher environment with held six-file absence and reviewed
runtime/PG/root semantics, including spawner repository override and notification
constructor. Qualify ancestor/global module resolution and new startup independently;
inventory runtime phase owners. Current output is byte-inventory evidence only.
Only then can controller-owned already-absent/no-signal entry and journaled
service/link transition proceed. No profile success alone authorizes effects.
