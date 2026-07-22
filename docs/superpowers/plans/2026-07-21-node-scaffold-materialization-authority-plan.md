# Node Scaffold Materialization Authority Implementation Plan

Date: 2026-07-21

Status: F1 and F2A complete on the feature branch; F2B provisioning authority
is next; production NO-GO.

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

Status: F2A identity/consumer authority complete in `e22f04be`
(`feat(toolchain): verify host Node authority`); F2B supply-chain provisioning
and production installation remain blocking.

New versioned schemas:

- `setfarm.host-node-toolchain-receipt.v2`;
- `setfarm.host-node-executable-identity.v2`;
- `setfarm.host-npm-package-closure.v2`.

Planned modules:

- `src/product-compiler/schemas/host-node-toolchain-receipt-v2.ts`;
- `src/product-compiler/host-node-toolchain-authority-v2.ts`;
- focused tests under `tests/product-compiler/`.

F2A implemented producer and verifier invariants:

1. Resolve Node and npm only inside a bounded admitted host-toolchain factory;
   never accept caller paths or ambient `which` output as authority. Production
   has exactly one architecture-specific Setfarm root under
   `/Library/Application Support/Setfarm/toolchains`; Homebrew is not a fallback.
2. Open exact executable/package files without following symlink or hard-link
   substitution and bind device/inode/mode/uid/size plus content identities in
   private state.
3. Execute exact bounded probes through direct argv with deny-all then exact
   environment construction. Require Node `>=22.13.0 <23` and npm exactly
   `10.9.8`.
4. Bind npm as an every-and-only package closure, including its exact CLI
   entrypoint, package JSON and builtin npmrc authority; hashing one launcher
   file is insufficient. Symlink, hard link, special entry, writable file,
   owner split, case collision, concurrent directory drift and fixed bounds are
   typed refusals.
5. Record the ordered command PATH projection as logical executable refs and
   receipt hashes. Portable DTOs contain no absolute path.
6. Revalidate the held private identities immediately before every later spawn;
   host drift invalidates the handle rather than becoming retry prose. Only a
   `production_host` handle may cross the production pre-spawn gate; test
   fixtures are permanently separated.
7. Resolve the complete Darwin non-system Mach-O loader graph recursively. Bind
   every exact library file while trusting `/usr/lib` and `/System/Library` only
   under the exact macOS build identity.
8. Execute Node directly and execute npm as `exact-node exact-npm-cli --version`;
   the npm `#!/usr/bin/env node` launcher never re-enters ambient PATH.

F2A evidence:

- focused authority suite: 12/12, including real Node 22 process probes, a real
  recursive Mach-O closure, real timeout/output/signal enforcement, all
  version/pairing/package mutation classes, hostile ambient environment,
  forged/self-rehashed DTOs and production/test scope separation;
- full Product Compiler: 935/935, exit zero;
- TypeScript, English (1036 files), path (568 files), and diff checks: clean;
- production read-only smoke: typed
  `HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE`, because the dedicated
  root-owned Setfarm toolchain does not yet exist. This is the expected NO-GO,
  not a fallback trigger.

Host census also proved why the dedicated root is required. Ambient PATH points
to Node `26.4.0` and npm `11.17.0`. Homebrew's alternate Node 22 pair reports
Node `22.23.1` and npm `10.9.8`, but the Node executable is a small launcher with
a recursive non-system Homebrew dylib graph. Its shared npm tree additionally
contains 18 writable Python bytecode files created after installation. Deleting
those files would be a local cleanup, not an authority fix: the same runtime UID
can mutate the tree again.

### F2B — Code-owned distribution and root-owned provisioning receipt

Status: next implementation slice; required before F2 is complete.

The selected source is the official Node `22.23.1` Darwin distribution, not the
mutable Homebrew tree. Primary distribution evidence on 2026-07-21 established:

- Darwin arm64 `.tar.xz`: 25,962,500 bytes, SHA-256
  `fb526811860f81dcac7dd8b2b55eca4accfc5d61c3b7c2508f2639faee8a738d`;
- Darwin x64 `.tar.xz`: 27,528,028 bytes, SHA-256
  `efeec6641a2f15f5396d27cd0b32f5062d6689d1e9e5d89607d0b29bda890233`;
- the arm64 archive's Node probe is `22.23.1`, modules ABI `127`, N-API `10`;
  bundled npm is already exactly `10.9.8`;
- the official arm64 Node executable links only exact-build system frameworks
  and libraries, so its non-system dynamic closure is empty;
- bundled npm contains no symlink. Archive extraction under the current umask
  produced `0600/0700`, proving the installer must normalize modes rather than
  treating extraction mode as authority.

F2B will add:

1. `setfarm.node-toolchain-distribution-manifest.v2`, a code-owned architecture
   catalog binding exact URL, filename, byte length, SHA-256, expected Node/npm/
   ABI/N-API identities, selected archive roots and extraction policy;
2. `setfarm.node-toolchain-provisioning-receipt.v2`, binding distribution
   manifest, downloaded archive bytes, safe every-member archive inventory,
   selected Node/npm closure, normalized modes, fsync/no-replace publication,
   root owner/group and final directory identity;
3. a root-owned separately installed provisioning command. It stages outside
   the final root, rejects traversal/symlink/hard-link/special/case-collision
   entries, copies only exact selected closure, normalizes files to `0444/0555`
   and directories to `0555`, verifies again, then publishes with no replace;
4. an F2A join requiring the exact provisioning receipt and final tree identity
   before `production_host` authority can be issued. Merely creating the fixed
   directory or making a binary self-report the expected version is invalid;
5. idempotent inspect/plan/apply/verify/rollback operations. No installer action
   will run automatically from a Setfarm product attempt.

F2 completion does not authorize `npm ci`; it only creates the exact toolchain
precondition consumed by F3/F4. F2A alone is deliberately insufficient.

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
