# Node Scaffold Materialization Authority Implementation Plan

Date: 2026-07-21

Status: F1, F2A, and the F2B2c publisher/durable-receipt/F2A join are complete
on the feature branch. The root-owned installer command state machine and real
production-root verification remain next; production NO-GO.

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

Status: F2A identity/consumer authority began in `e22f04be`, requires the
durable F2B2c provisioning join from `c090d816`, and now has the isolated
inspect/plan/apply/verify/rollback authority core through `dd2dc9de`.
Separately packaged root bootstrap/CLI, production installation, and a real
official-tree production transition remain blocking.

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
   entrypoint, package JSON and explicit builtin `npmrc` absence; hashing one
   launcher file is insufficient. The official archive's package-root `.npmrc`
   remains an ordinary hashed closure member, not builtin config authority.
   Symlink, hard link, special entry, writable file, owner split, case
   collision, concurrent directory drift and fixed bounds are typed refusals.
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

Status: F2B1 distribution verification, F2B2a archive inventory, F2B2b private
materialization, and the F2B2c root publisher/durable receipt/F2A join are
complete in shadow/test evidence. The pathless operational command schemas and
inspect/plan/apply/verify/rollback core are also complete against isolated
process-owned roots. A separately installed root bootstrap/CLI, real official
archive-to-production-root execution, and production-root receipt remain
required before F2 is complete.

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

F2B1/B2a/B2b/B2c evidence completed on 2026-07-22:

- commit `7809dd94` added a pathless authenticated distribution archive handle
  over the code-owned official URL, exact length and SHA-256. Candidate paths
  are non-authoritative; bytes are copied into a private `0600` file, fsynced,
  rehashed and exposed only as a defensive bounded byte copy;
- commit `54e4bdb4` added
  `setfarm.node-toolchain-archive-inventory-receipt.v2`. Exact root-owned
  `/usr/bin/bsdtar` runs through direct argv, deny-all environment, separate
  stdout/stderr limits and timeout. Every addressable member is checked for
  root containment, portable segments, duplicates and ASCII case collisions
  before selected-closure validation;
- the official archive contains three links outside the selected closure.
  Therefore the manifest now says
  `inventory_then_discard_without_extraction_v2`: unselected entries are never
  extracted, while every selected Node/npm member and ancestor must be a
  regular file or directory. The previous global link-rejection wording was
  false for the selected official source;
- the official npm tree has package-root `.npmrc` but no builtin `npmrc`.
  Inventory and F2A now bind that absence explicitly instead of inheriting the
  Homebrew-generated `npmrc` topology;
- commit `b596794e` added
  `setfarm.node-toolchain-private-tree-receipt.v2`. It extracts only the
  authenticated NUL-delimited selected-member list into process-private scratch,
  rejects any missing/extra/link/special member, and then writes a second tree
  with exclusive descriptors, normalized `0444/0555` modes, fsync and fresh-read
  content/topology verification. The authority remains a pathless WeakMap handle;
- a fresh official arm64 production smoke inventoried 5,866 members: 4,750
  files, 1,113 directories, three discarded symlinks, zero hard links and zero
  special entries. It selected 2,469 total members including 2,463 npm
  descendants, produced mode-aware inventory hash
  `256c518a5be70e09be1dc4f1c7183050f79ed3ccd0755b7bc5099468bad71441`,
  npm closure hash
  `7a00f1a8b956978df77a5405c36e65d2eadeae3666481d1b67c4950c04e429f3`
  and normalized tree hash
  `294b293fc2fe1e1aba2399b2478c38297cd5bfd953879add166c3e8df33ad7e6`;
- a fresh official x64 production smoke selected the same 2,469-member topology
  and produced the same npm closure/tree hash while binding its distinct Node
  bytes and whole-tree hash. Both receipts were pathless and left zero private
  stage residue;
- commit `c090d816` added the architecture-owned target registry and strict
  provisioning intent, claim, and receipt schemas. A root publisher acquires a
  real parent-scoped `/usr/bin/lockf` lease through an exact `/bin/cat` pipe,
  publishes a canonical no-replace claim before the root, hard-links every
  authenticated file from a deterministic private stage without replacement,
  fsyncs files/directories, removes stage aliases, seals every directory to
  `0555`, fresh-verifies the whole tree, and publishes the canonical `0444`
  receipt last;
- seven injected crash boundaries converge only under the exact prior claim.
  An unclaimed root, different ready source, foreign staging member, added final
  member, forged handle/schema, owner/mode/content drift, and test-to-production
  promotion all fail closed. Four concurrent identical publishers converge to
  one physical root/receipt without deleting foreign state;
- durable authority can be rehydrated from the receipt plus a fresh bounded
  every-and-only tree scan. Production host admission now opens that code-owned
  authority first and joins the exact root device/inode, Node content hash, and
  normalized npm tree/count/byte identity into `HostNodeToolchainReceiptV2`.
  A directory that merely exists or self-reports the right version cannot issue
  `production_host`;
- commits `569767df` and `3cc8bb99` added strict, pathless provisioner
  inspection/plan/operation artifacts plus fresh-precondition apply and verify.
  `target_absent`, `ready_verified`, and exact interrupted-claim states are
  derived from canonical filesystem evidence; a stale plan or substituted
  private-tree source is rejected before publication;
- commit `dd2dc9de` added generation-bound rollback claim and durable tombstone
  artifacts. Rollback owns one exact plan, provisioning receipt, physical root
  device/inode, normalized tree hash, and every claimed member. It publishes a
  no-replace claim, atomically quarantines only that root, removes only exact
  members, publishes the content-addressed tombstone, and removes the claim
  last. Ten destructive crash boundaries, concurrent rollback, old-plan versus
  later-generation, missing-member, foreign-quarantine, receipt-link recovery,
  and self-rehashed evidence cases fail closed or converge exactly;
- commit `354cdcec` added the pathless provisioner CLI protocol without
  attaching it to the ambient Setfarm process. Exact argv shapes expose only
  `inspect`, `plan apply`, `plan rollback`, `apply`, `verify`, and `rollback`;
  plan files are bounded canonical single-link regular files, stdout is one
  canonical artifact, and typed failure artifacts bind command, ordered cause,
  failure kind, exit code, and hash. The production operation adapter derives
  architecture from the executing runtime and still has no process entrypoint;
- commit `d609cad9` defined the separately packaged bootstrap manifest, fixed
  root layout, fail-closed root launcher, self-contained CJS entry bundle, and
  fresh every-only package verifier. Only the raw test-fixture compiler is
  exported; there is deliberately no caller-byte production compiler;
- commit `c77c93fd` added
  `setfarm.node-toolchain-provisioner-bundle-authority-receipt.v2` and the
  unforgeable `BuiltNodeToolchainProvisionerBundleV2` handle. Production bundle
  authority accepts only an authenticated official private-tree handle, then
  binds clean `main == origin/main`, exact `git archive HEAD`, the committed
  entrypoint/package/lock/builder sources, code-owned npm registry tarball and
  content-tree identities for esbuild 0.28.1, its Darwin platform package, and
  zod 4.4.3. It copies those inputs to a fresh private stage and requires two
  fresh process executions to emit byte-identical bundle and canonical
  metadata. Test adapters are permanently marked `test_fixture` and cannot be
  rehashed into production authority;
- commit `89fecb3e` joined the bundle and private-tree capabilities into the
  bootstrap manifest compiler. The production API accepts only
  `BuiltNodeToolchainProvisionerBundleV2` plus
  `MaterializedNodeToolchainPrivateTreeV2`; release branch/dirty/source refs,
  bundle bytes, runtime bytes, and both receipts must agree. Raw bytes remain a
  visibly dirty `test_fixture` path only. The root launcher renderer was split
  into a runtime-safe module so the packaged CJS contains neither Git/esbuild
  build authority nor the bootstrap compiler itself;
- commit `dae76fc3` made the authenticated compiler result an unforgeable,
  disposable `CompiledNodeToolchainProvisionerBootstrapV2` capability. Only the
  raw test-fixture compiler returns a caller-visible snapshot; production and
  authority-backed test compilation expose bytes only as defensive copies from
  a live WeakMap-backed handle;
- commit `5f579cd1` added
  `setfarm.node-toolchain-provisioner-bootstrap-prepared-package-receipt.v2`
  and the private prepared-package publisher. It creates a fresh process-owned
  mode-0700 stage, writes every member exclusively at storage modes 0400/0500,
  fsyncs files and directories, publishes the manifest last, then reopens and
  revalidates the every-only physical tree before issuing a disposable handle.
  The receipt explicitly says `not_installed_unprivileged_payload`, records no
  stage path, and records zero access to the future target root;
- live read-only inspection corrected a false macOS assumption: the
  `/Library/Application Support` ancestor is root-owned mode `0755` but group
  `admin` (`gid=80`).
  The system ancestor therefore requires root ownership plus exact non-writable
  mode, while Setfarm-created directories remain exact `root:wheel`;
- commit `9161f681` completed generation-bound bootstrap rollback. The strict
  plan/claim/tombstone schemas bind the installation receipt/claim/intent,
  prepared source, manifest, architecture, predecessor rollback-history fence,
  physical root device/inode/tree, exact eight-member removal set, all rollback
  locators, and the real lease tool evidence. The mutator publishes the claim
  before quarantine rename, removes only a fully recaptured every-only tree,
  publishes a content-addressed tombstone receipt-last, and removes the claim
  last. Eleven destructive crash boundaries converge; concurrent holders,
  missing members, foreign quarantine data, external hard-link aliases,
  missing lock, lost quarantine, stale plans, self-rehashed evidence, inode
  reuse simulation, reinstall generations, missing history, and transplanted
  tombstones fail closed or converge exactly. Canonical predecessor tombstones
  remain durable and are part of fresh read-only installation inspection, so an
  old target-absent plan cannot cross a later generation;
- final command/rollback/CLI-focused evidence is 23/23; the combined distribution,
  inventory, private-tree, host, provisioning, and command chain is 56/56.
  After authenticated compile, prepared publication, isolated bootstrap
  installation, rollback, and reinstall, the focused lifecycle file is 31/31
  and the complete Product Compiler suite exits 0. Scripts are 24/24, with
  TypeScript, English (1,072 files), path (600 files), and diff checks clean.
  No production toolchain root, live DB/PR/service, generated repository, or
  Setfarm run was mutated.

F2B dependency chain is:

1. **Complete:** `setfarm.node-toolchain-distribution-manifest.v2`, a code-owned architecture
   catalog binding exact URL, filename, byte length, SHA-256, expected Node/npm/
   ABI/N-API identities, selected archive roots and extraction policy;
2. **Complete:** `setfarm.node-toolchain-private-tree-receipt.v2`, binding the
   distribution receipt, safe every-member archive inventory, exact selected
   Node/npm closure, normalized modes and verified every-and-only private tree;
3. **Complete isolated authority and operational core:**
   `setfarm.node-toolchain-provisioning-receipt.v2`, real kernel serialization,
   claim-before-root, deterministic staged hard-link publication, receipt-last
   durability, bounded exact-claim recovery, owner/mode enforcement, durable
   rehydration, foreign-state refusal, pathless inspect/plan/apply/verify, and
   generation-bound rollback with a durable exact tombstone. The exact CLI
   invocation and canonical artifact/failure protocol is complete as a library;
4. **Complete:** the F2A join requires the exact provisioning receipt, physical
   final root, Node bytes, and normalized npm tree before `production_host`
   authority can be issued. Merely creating the fixed directory or making a
   binary self-report the expected version is invalid;
5. **Complete isolated installation and rollback authority, pending packaged-CLI
   rehearsal:** the separately packaged root launcher/manifest,
   installed-root verifier, authenticated reproducible bundle handle,
   handle-only compiler, and private prepared-package publisher now exist. The
   prepared publisher deliberately does not impersonate an installed package:
   its process-owned storage root cannot satisfy the manifest's future
   root:wheel locator/owner contract. A dedicated prepared-payload verifier
   therefore reopens exact storage bytes. Commits `15f4c797` and `b4bc3bd9`
   add canonical installation intent/claim/receipt, read-only
   inspect/plan decisions, a real inherited-descriptor `/usr/bin/lockf` lease,
   claim-before-root publication, prepared-handle-only defensive copy,
   same-filesystem hard-link no-replace files, manifest-last sealing, receipt-last
   durability, exact-claim recovery, and durable installed-handle rehydration.
   Eight injected installation-publication and eleven destructive rollback
   boundaries converge; foreign/unclaimed
   state, aliases, source drift, stale decision expansion, forged handles and
   test-to-production promotion fail closed. `9161f681` additionally retains
   canonical predecessor tombstones, fences stale install plans across
   generations, and provides exact rollback/rehydration/replay. All mutation
   evidence is still process-owned test-fixture storage. The next owner must
   execute the packaged CLI through the official runtime in a complete isolated
   install/open/inspect/apply/verify/rollback/cleanup rehearsal before any
   production root or OS-update transition. No installer action will run
   automatically from a Setfarm product attempt.

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

GO for F1 and the isolated F2B publisher/rehydration/host-join, authenticated
bootstrap compile, prepared-package authority, and isolated bootstrap installer.
NO-GO for production host execution, dependency installation, setup cutover,
PacketV4, live migration, deploy and new clean product runs until bootstrap
rollback plus official-runtime rehearsal, real-root verification, F3-F5, and
the later packet/evidence program are complete. The feature-branch `npm run
build` guard correctly refused `b4bc3bd9`; the resulting source-v26 versus
committed-dist-v25 mismatch also prevents `dist`-importing full step tests from
being release evidence on this branch. Only a clean merged-main build and full
test can close that release gate; it must not be bypassed.
