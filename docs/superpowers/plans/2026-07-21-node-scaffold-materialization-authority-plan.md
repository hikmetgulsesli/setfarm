# Node Scaffold Materialization Authority Implementation Plan

Date: 2026-07-21

Status: F1 complete on the feature branch; F2 in progress; production NO-GO.

## Goal

Replace ambient setup commands and mutable worktree inference with one bounded
authority chain:

```text
code-owned scaffold catalog
  -> DB-first ByteBundle publication
  -> deep CAS/index verified byte handles
  -> exact host Node/npm admission
  -> isolated effective npm configuration
  -> private no-replace scaffold stage
  -> exact dependency-tree receipt
  -> FileTreeManifestV2 / BuildTopologyV2
```

No stage may infer success from command prose, PATH lookup alone, a caller-
selected hash, a mutable absolute path, or a self-rehashed receipt. No blocker
is removed until its exact producer, schema, consumer and verifier exist.

## Fixed boundaries

- Do not start a Setfarm run during this plan.
- Do not mutate live artifact DB, PR state or generated projects.
- Do not reuse candidate/platform npm receipts at the scaffold dependency root;
  their logical roots and consumers differ.
- Do not put absolute host/stage paths or mutable bytes into a Product Build
  Packet.
- Do not execute shell command strings. Every invocation is exact direct argv.
- Do not activate the current Node scaffold catalog while any listed blocker
  remains.
- Keep host descriptors, stage paths and byte buffers behind authenticated
  process-local handles.

## F1 — Deep scaffold ByteBundle authority

Status: complete in `43af7921` (`feat(artifacts): verify scaffold byte bundles`).

Files:

- `src/product-compiler/schemas/deep-byte-bundle-verification-receipt-v2.ts`
- `src/product-compiler/deep-byte-bundle-verifier-v2.ts`
- `src/product-compiler/node-scaffold-toolchain-catalog-v2.ts`
- `tests/product-compiler/deep-byte-bundle-verifier-v2.test.ts`
- `tests/product-compiler/artifact-store-factory-census.test.ts`

Implemented invariants:

1. Fresh code authority produces exactly two profile-scoped publication
   batches, each containing three chunk-before-root file closures. The existing
   nine-occurrence batch bound is preserved.
2. An authenticated CAS authority privately constructs its own purpose-reader
   hybrid store and PostgreSQL artifact index.
3. Root and all declared chunks are exact-read before closure classification;
   all corresponding DB identities are then every-and-only checked.
4. Registered ByteBundle closure and final raw SHA-256/length reassembly both
   pass before a handle exists.
5. The canonical receipt is pathless and byte-free. Only a WeakMap-authenticated
   handle can return a defensive byte copy.
6. Fresh profile+role selection rejects cross-profile substitution. A
   filesystem-complete but unindexed closure and a self-rehashed receipt are
   non-authoritative.

Evidence:

- focused authority suite: 8/8;
- full Product Compiler: 923/923 across 114 suites;
- TypeScript, English (1032 files), path (566 files), and diff checks: clean.

Remaining F1 compatibility fact: the catalog intentionally still reports its
original shadow blocker set. F1 supplies a consumer authority; it does not
rewrite the static catalog into an active receipt claim.

## F2 — Exact host Node/npm toolchain admission

Status: next implementation slice.

New versioned schemas:

- `setfarm.host-node-toolchain-receipt.v2`;
- `setfarm.host-node-executable-identity.v2`;
- `setfarm.host-npm-package-closure.v2`.

Planned modules:

- `src/product-compiler/schemas/host-node-toolchain-receipt-v2.ts`;
- `src/product-compiler/host-node-toolchain-authority-v2.ts`;
- focused tests under `tests/product-compiler/`.

Producer and verifier requirements:

1. Resolve Node and npm only inside a bounded admitted host-toolchain factory;
   never accept caller paths or ambient `which` output as authority.
2. Open exact executable/package files without following symlink or hard-link
   substitution and bind device/inode/mode/uid/size plus content identities in
   private state.
3. Execute exact bounded probes through direct argv with deny-all then exact
   environment construction. Require Node `>=22.13.0 <23` and npm exactly
   `10.9.8`.
4. Bind npm as a package closure, including its exact CLI entrypoint and builtin
   npmrc authority; hashing one launcher file is insufficient.
5. Record the ordered command PATH projection as logical executable refs and
   receipt hashes. Portable DTOs contain no absolute path.
6. Revalidate the held private identities immediately before every later spawn;
   host drift invalidates the handle rather than becoming retry prose.

Tests first:

- wrong Node/npm version, path order and executable pairing;
- symlink, hard link, file replacement, mode/owner drift and PATH race;
- npm launcher with a substituted package closure;
- probe timeout, signal, nonzero exit, oversized stdout/stderr and malformed
  version output;
- ambient `NODE_OPTIONS`, `npm_config_*`, proxy/CA and credential variables;
- self-rehashed DTO and caller-supplied absolute path;
- immutable private handle and defensive receipt copies.

F2 completion does not authorize `npm ci`; it only creates the exact toolchain
precondition consumed by F3/F4.

## F3 — Effective npm configuration and execution environment

New versioned schemas:

- `setfarm.effective-npm-config-receipt.v2`;
- `setfarm.node-scaffold-execution-environment-receipt.v2`.

Implementation requirements:

1. Construct the environment from deny-all, then the catalog's exact fixed and
   attempt-scoped bindings.
2. Strip every case-insensitive `npm_config_*` ambient key before adding exact
   values.
3. Materialize distinct private blank-LF user/global npmrc files; require
   project `.npmrc` absence from the later base FileTree authority.
4. Probe effective npm configuration with the F2 npm handle. Prove registry,
   builtin config, proxy/CA absence, lifecycle policy and cache/home/temp roots.
5. Bind one environment hash shared by install, build and test recipes.
6. Keep secrets absent unless a later explicit secret authority is introduced.

Tests cover mixed-case environment injection, config precedence, user/global
path aliasing, builtin npmrc drift, project `.npmrc`, proxy/CA inheritance,
attempt-root reuse, and probe/source mutation.

## F4 — Private staged scaffold and dependency materialization

New versioned schemas:

- `setfarm.private-staged-materializer-authority.v2`;
- `setfarm.scaffold-base-materialization-receipt.v2`;
- `setfarm.build-dependency-materialization-receipt.v2`.

Implementation requirements:

1. Create a fresh mode-0700 attempt-private root with no replace/adoption path.
2. Materialize only F1-authenticated scaffold handles at their exact catalog
   locators. Reject symlink, hard-link, special file, pre-existing path,
   case-fold collision, metadata and root identity drift.
3. Write through exclusive descriptors, sync every file and directory, then
   fresh-read every exact file before issuing the base receipt.
4. Create private home/cache/temp and distinct npmrc roots from F3. These are
   operational paths and never portable packet fields.
5. Invoke exactly
   `npm ci --include=dev --ignore-scripts --no-audit --no-fund` through the F2
   handle and F3 environment; no shell, fallback install or ambient cwd.
6. Capture `node_modules` with the existing strict
   `CanonicalRuntimeTreeV2(dependencies)` primitive, then reproduce the
   every-and-only lock graph, package count, executable bins, lifecycle-script
   barrier and transitive engine compatibility.
7. Bind start/end scaffold identities, lock bundle receipt, host toolchain,
   environment, direct argv, exit status and dependency tree into one receipt.
8. On failure, destroy only the owned private attempt. Never edit a generated
   repository or turn partial output into a retry baseline.

Concurrency/crash tests cover two materializers for one logical request,
crashes after each fsync/rename boundary, source mutation during install,
dependency output mutation, stage replacement, process timeout and cleanup of
only authenticated owned roots.

## F5 — Join to FileTreeV2 and BuildTopologyV2

F4's scaffold-base receipt becomes an input to FileTreeManifestV2; it is not a
substitute for that artifact. FileTreeV2 adds exact source/test/generated path
ownership and `.npmrc` absence. BuildTopologyV2 then binds build outputs and
the F4 dependency receipt. Only after these joins may the corresponding static
scaffold blockers be replaced by verified receipt refs.

The old setup installer, ambient worktree `npm install`, legacy Node entrypoint
rules and V1 BuildTopology remain compatibility observations. They are never
promoted into this authority chain.

## Verification and release gate

Every slice requires:

```bash
npx tsc -p tsconfig.json --noEmit
npm run test:product-compiler
npm run check:english
npm run check:paths
git diff --check
```

F2-F4 additionally require focused real-filesystem, process, PostgreSQL and
concurrency tests. A clean merged-`main` `npm run build` and full `npm test`
remain release evidence; the feature-branch build guard is never bypassed.

GO for F1 shadow authority. NO-GO for host execution, dependency installation,
setup cutover, PacketV4, live migration, deploy and new clean product runs until
F2-F5 and the later packet/evidence program are complete.
