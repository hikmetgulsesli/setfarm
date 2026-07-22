# Node Scaffold Materialization Authority Implementation Plan

Date: 2026-07-21

Status: F1, F2A, the F2B publisher/command/bootstrap lifecycle, F3 effective
npm authority, the complete F4 private scaffold/dependency materializer, and
the F5A-F5C compatibility experiments are complete on the feature branch. F5D
SemanticRealizationPlanV2 is the corrected target-architecture boundary, F5E
FileTreeManifestV3 projects its exact physical targets, and F5F
BuildTopologyV3 binds those targets to dependency, compilation, command, and
runtime authority. The V2
FileTree/BuildTopology/entrypoint-only transition must not be promoted.
Production-root activation remains NO-GO; the runtime and test generators are
next.

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
  -> SemanticSourceIntentSetV1 (obligations only)
  -> SemanticRealizationPlanV2
  -> FileTreeManifestV3
  -> BuildTopologyV3
  -> NodeProductRuntimeGeneratorV2 / NodeProductTestGeneratorV2
  -> runtime/test source receipts and evidence registry
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

Status: F2A identity/consumer authority began in `e22f04be`, joined the durable
F2B2c provisioner in `c090d816`, and now includes the complete isolated
inspect/plan/apply/verify/rollback plus packaged bootstrap lifecycle through
`e5f0b033` and `38cc9f36`. Only the controlled root-owned production transition
remains blocking for live activation; it is not a prerequisite for implementing
F3 in private authority fixtures.

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
materialization, F2B2c root publisher/durable receipt/F2A join, the pathless
operational command state machine, bootstrap install/rollback, and an actual
official-runtime packaged-CLI rehearsal are complete in isolated evidence.
Real archive-to-root:wheel activation and its production receipt remain a later
controlled migration gate.

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
- commits `e5f0b033` and `38cc9f36` completed the packaged bootstrap rehearsal
  boundary. The installed entrypoint now selects production only for the fixed
  root-owned manifest path; any other admitted package must be a schema-sealed
  `test_fixture` under the exact private `bootstrap/`, `toolchains/`, and
  `scratch/` sibling layout. Those directories are derived from the verified
  package root, never accepted from launcher argv or ambient environment. Test
  operations can issue only test-scoped plans/receipts, while their archive
  bytes must still equal the code-owned official Node artifact length and
  SHA-256. The entrypoint removes only Darwin's automatically injected
  `__CF_USER_TEXT_ENCODING` before enforcing the every-and-only launcher
  environment; every other ambient key remains a rejection;
- the real arm64 rehearsal downloaded the official 25,962,500-byte archive and
  reproduced SHA-256
  `fb526811860f81dcac7dd8b2b55eca4accfc5d61c3b7c2508f2639faee8a738d`.
  An authenticated bundle was compiled with that archive's actual Node
  `22.23.1` runtime, prepared, installed, and invoked only through its installed
  launcher. Eight canonical child-process outputs passed in order: initial
  inspect, apply plan, apply, verify, rollback plan, rollback, rollback replay,
  and final inspect. Provisioner and bootstrap rollback both completed, the
  final classification was `target_absent`, and the process-owned rehearsal
  root was removed exactly. Canonical rehearsal receipt hash:
  `d8006ce2bb809bad2138dcd18d279b8edf94f7374f700de275d85196af64ab95`;
- final command/rollback/CLI-focused evidence is 23/23; the combined distribution,
  inventory, private-tree, host, provisioning, and command chain is 56/56.
  After authenticated compile, prepared publication, isolated bootstrap
  installation, rollback, reinstall, and official-runtime rehearsal, the
  focused lifecycle file is 30/30 and the complete Product Compiler suite is
  987/987 across 121 suites. Scripts are 24/24, with TypeScript, English (1,075
  files), path (603 files), and diff checks clean.
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
5. **Complete isolated installation, rollback, and packaged-CLI rehearsal:** the
   separately packaged root launcher/manifest,
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
   generations, and provides exact rollback/rehydration/replay. `e5f0b033` then
   ran the packaged CLI through the official runtime in a complete isolated
   install/open/inspect/apply/verify/rollback/replay/cleanup rehearsal and issued
   one versioned receipt. All mutation evidence remains process-owned
   test-fixture storage. No installer action will run automatically from a
   Setfarm product attempt; root:wheel activation remains a separately reviewed
   migration operation.

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

**Status (2026-07-22): complete as isolated authority.** Commit `5f68fb61`
implements both receipts, one WeakMap-authenticated private environment handle,
fresh revalidation, authenticated owned-root destruction, and a narrow F2
execution boundary that can run only the code-owned effective-config probe.
Executable paths never enter a receipt or caller-selected argv. The environment
is built from an empty map with seventeen exact variables; mixed-case ambient npm
config, `NODE_OPTIONS`, proxy/CA and credentials have no inheritance path. User
and global npmrc files are distinct process-owned mode-0600 single-LF files,
while the probe cwd proves `.npmrc` absent. The execution-project `.npmrc`
claim deliberately remains `pending_file_tree_join`, so F3 cannot activate a
project by itself.

The first real npm probe exposed two previously unspecified side effects:
successful npm startup created `cache/_logs`, and Node created
`tmp/node-compile-cache`. The gate was not weakened. The code-owned environment
contract first advanced from 2.0.0 to 2.1.0 and fixed
`NPM_CONFIG_LOGS_MAX=0` plus `NODE_DISABLE_COMPILE_CACHE=1`; canonical command
receipts, rather than mutable filesystem diagnostics, remain the process-log
authority. A dirty Homebrew npm tree containing mutable generated Python cache
bytes was also correctly rejected by F2 before F3. The canonical official-byte
rehearsal therefore provisions the official distribution into a private test
root instead of treating Homebrew presence as authority.

F4B then made engine compatibility executable authority rather than a lockfile
claim. Catalog environment contract `2.2.0` and F3 receipt `2.1.0` add exact
`NPM_CONFIG_ENGINE_STRICT=true`; the effective npm probe requires
`engine-strict=true`, and every install runs with the same environment hash.

The official arm64 rehearsal reverified the 25,962,500-byte Node archive with
SHA-256
`fb526811860f81dcac7dd8b2b55eca4accfc5d61c3b7c2508f2639faee8a738d`,
provisioned it privately, admitted real Node `22.23.1` / npm `10.9.8`, ran and
replayed the exact config probe, authenticated-destroyed the environment, and
removed the complete rehearsal root. After the engine-strict contract
transition, the canonical rehearsal receipt is
`0cb113a566565a19e288bebdb6c2a61839d4f3ce816f1a8b4055394874e57da6`;
environment receipt is
`b9e51c2a00a23d8e90ecd1825d10d388c7d5b62fbbe6d9d6d26bb30661e0137c`;
effective-config receipt/hash are
`bd6b39e6f4d2238ffbaa5145c7ec1bcb8ea41ed44e8b7745f7f56300412cec48` /
`185e411e07f6dfeb696dd1d7a199f9fe4b6b09f15af9020aa4574f19e15b7534`.
Production toolchain root remained absent. The focused F3 suite is 9/9; full
Product Compiler is 996/996 across 122 suites; scripts are 24/24; TypeScript,
English (1,080 files), path (607 files), and diff checks pass.

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

**F4A status (2026-07-22): complete as an isolated scaffold-base authority.**
Commit `b036569b` adds all three versioned schema boundaries but exposes only
the scaffold-base producer. The code-owned materializer authority is explicitly
`scaffold_base_only_dependency_install_blocked`; no dependency receipt can yet
be produced. F1-authenticated package manifest, lock manifest and TypeScript
config handles are joined to the exact profile publication, copied through
exclusive descriptors, normalized to mode `0444`, fsynced and fresh-read into
one process-private root containing only `project/` and an empty
`dependency-capsule/`. Project `.npmrc`, `node_modules` and `src` are proven
absent before receipt issuance. Public receipts contain neither paths nor
bytes.

The base receipt deliberately separates `semanticInputHash` from physical
attempt identity. Separate clean F3 environments and concurrent F4 roots with
the same catalog, normalized effective npm config and authenticated assets
produce the same semantic input and base-state hashes, while their environment
receipt, inode-bound root identity and materialization receipt remain distinct.
This is the required basis for later unchanged-source retry suppression without
weakening physical freshness.

Focused F4A evidence is 9/9. It covers both Node product profiles,
cross-profile and receipt-shaped byte substitution, forged handles,
accessor/extra input, unsafe scratch parents, test-to-production promotion,
file/mode/topology/npmrc/hard-link drift, two concurrent independent attempts,
seven injected fsync crash boundaries, replacement during failure cleanup and
replacement before authenticated destruction. Full Product Compiler is
1005/1005 across 123 suites; scripts are 24/24; TypeScript, English (1,083
files), path (609 files), and diff checks pass. At the F4A commit boundary F4B
was still blocking; the following slice closes those missing authorities.

### F4B — Exact install, dependency census and immutable capsule

**Status (2026-07-22): complete as isolated authority in `5bf231b3`.** The
materializer authority advances from `2.0.0` to `2.1.0` and changes activation
from scaffold-base-only to
`dependency_materialization_verified_file_tree_blocked`. It still cannot claim
production readiness before F5 joins source, ownership and build topology.

The F2 boundary now admits only exact direct argv
`npm ci --include=dev --ignore-scripts --no-audit --no-fund`, direct Node plus
the private npm CLI, shell=false, a 120-second timeout, and independent 65,536
byte stdout/stderr bounds. It fresh-verifies the official host authority before
and after every process outcome, validates the private scaffold with
`O_NOFOLLOW` descriptors, and returns a pathless project-scope hash. F3 and F4
each synchronously preclaim a single-use lifecycle before the first await; one
physical process consumes both capabilities on success, nonzero, timeout,
output overflow, signal or spawn failure. An unchanged stage therefore cannot
run npm twice.

After exit zero, F4 captures a bounded every-and-only raw `node_modules` census.
It fresh-reads the root lock, npm hidden lock and every installed package
manifest; requires exact catalog graph membership and version/resolved/integrity
joins; validates every node_modules container and package root; rejects special
files and hard links; and requires every-and-only npm `.bin` link with its exact
relative target and executable target bytes. Lifecycle authority is the exact
`--ignore-scripts` argv barrier, engine authority is
`NPM_CONFIG_ENGINE_STRICT=true` plus exit zero, and integrity authority is the
pinned npm 10.9.8 lock enforcement. These claims are explicit; the receipt does
not invent an observed lifecycle process count.

The raw install remains disposable operational state. A separate capsule copies
only regular dependency directories/files, excludes the hidden lock and
generated `.bin` links, clears ACLs and all removable xattrs while writable,
then seals directories to `0555` and files to `0444/0555`, fsyncs recursively,
and captures `CanonicalRuntimeTreeV2(dependencies)`. Darwin on this development
host attaches non-removable `com.apple.provenance` to every newly created path:
both `xattr -cr` and `xattr -d` return success while it remains. The gate now
discloses exactly
`com.apple.provenance_only_not_in_canonical_tree_v2`; every other xattr and any
ACL still fail closed. This is a versioned host-metadata exclusion on Setfarm's
exclusive private copy, not a general metadata bypass.

The official arm64 rehearsal reverified the 25,962,500-byte archive, privately
provisioned Node `22.23.1` / npm `10.9.8`, ran real npm against both code-owned
profiles, fresh-replayed both receipts, authenticated-destroyed both stage and
environment roots, removed the rehearsal root and left the production root
untouched. Canonical rehearsal receipt:
`3bffc070c6da242a59a0ac95114243b3f8ce8978ac432bb4bca12d6cf5b12870`.

- CLI: graph 3 nodes/3 edges; raw 247 files, 29 directories, 2 links and
  26,131,278 bytes; capsule 246 files, 28 directories and 26,129,998 bytes;
  capsule tree
  `37c1fd0f7db7098b91c7147311bd7025899d4092f6ac8cad18d4ad379ab7266a`;
  dependency receipt
  `1be1228f863bf0057d330316b332161751ceff79285a3fad46f211f839cb8e3d`.
- Express API: graph 79 nodes/141 edges; raw 877 files, 168 directories, 2
  links and 28,429,632 bytes; capsule 876 files, 167 directories and
  28,394,927 bytes; capsule tree
  `3e93a750679ed14f23c308d2bb65df8ea340f8ad3ee93caa67eceef2b56cb402`;
  dependency receipt
  `3f97526faff3446a6fe329570237415e79dd9ca80f60c414ae638182ff35bb76`.

Focused host/F3/catalog/F4 verification is 51/51 across seven suites; the F4
materializer itself is 14/14 and the rehearsal receipt tamper suite adds one
more test. Full Product Compiler is 1011/1011 across 124 suites; scripts are
24/24; TypeScript, English (1,086 files), path (611 files), diff and residue
checks pass. No live DB, PR, service, generated repository, Setfarm run or real
`/Library/Application Support/Setfarm` tree was mutated.

## F5 — Join to FileTreeV2 and BuildTopologyV2

**Architecture correction (2026-07-22):** F5A-F5C remain useful, immutable
shadow evidence about the legacy V1 target model, private materialization and
stable logical identity. They are not the production topology. FileTreeV2
materialized V1's target decision before asking whether each semantic obligation
should be model-written, generated, platform-bound, or exempt. In particular,
it turned product-level aggregation of per-story `runtime_data_fixture` intents
into one setup-owned file with multiple model write grants even though the
upstream V1 rule still declared `exclusive_file`. Adding declarations after that
join would preserve the contradiction in a more elaborate artifact. F5D moves
the realization decision ahead of physical topology; FileTreeV3 must consume
that new authority and cannot reinterpret FileTreeV2 as native input.

F4's scaffold-base receipt becomes an input to FileTreeManifestV2; it is not a
substitute for that artifact. FileTreeV2 adds exact source/test/generated path
ownership and `.npmrc` absence. BuildTopologyV2 then binds build outputs and
the F4 dependency receipt. Only after these joins may the corresponding static
scaffold blockers be replaced by verified receipt refs.

### F5A — Stable scaffold-base FileTreeManifestV2

**Status (2026-07-22): complete as a shadow, production-forbidden authority.**
The implementation and adversarial proof are sealed by commit `79adc8e8`.
`setfarm.file-tree-manifest.v2` and its separately hashed code-owned contract
fresh-reproduce ProductSpecV2, delivery selection, Node layout/path tokens,
SemanticSourceIntentSetV1, SemanticSourcePathTokenSetV2 and scaffold resolution.
The compiler additionally requires one authentic F4 base-ready handle and
freshly revalidates the exact three-file private base before issuing a manifest.

The manifest materializes every-and-only current repository path authority:

- the three exact read-only scaffold config bytes;
- the forbidden project `.npmrc` absence;
- every unique semantic source path with exact intent, rule, subject, story,
  owner and access bindings;
- one generator-owned canonical entrypoint plan containing every external
  semantic requirement; and
- the profile's exact historical entrypoint rejection set.

Exclusive semantic paths have one story owner and no grant. The only shared
physical source class is a code-owned catalog aggregate: setup owns the file and
every contributing story receives one exact write grant. A two-story API case
proves sixteen semantic token intents become fifteen physical source paths,
with both story owners retained on the shared runtime-data aggregate.

FileTree is deliberately a logical artifact, not a private-attempt receipt.
It projects F4's stable `semanticInputHash` and `baseStateHash`, config content
hashes and path-specific absence hashes. Admission scope, environment receipt,
inode/file physical identity, random private-root identity and base receipt hash
are forbidden from manifest identity. Two independently materialized CLI bases
with distinct environment/base receipts therefore produce byte-identical
FileTree manifests. This prevents unchanged product/source authority from
appearing as a new retry delta merely because a fresh private attempt exists.

Build output, command execution, the dependency receipt, disposable raw
`node_modules` build input and read-only dependency runtime capsule are not
silently folded into FileTree. The contract delegates all five explicitly to
BuildTopologyV2. Raw `node_modules` will require fresh verification before and
after the private compiler command; the capsule excludes npm-generated `.bin`
links and is reserved for a later candidate/runtime bundle receipt.

The focused integration covers CLI, single-story API and two-story API;
schema-valid self-rehash, ownership forgery, cross-scope use, accessor input,
upstream rejection, base drift, recursive immutability and independent-attempt
identity stability. Golden manifest hashes are respectively
`687630f5caa489a64bd978891fe548e86ccc5e5e20a21cc912a3a1a9f5febbb2`,
`3a69a3859bc9c5108b37dc84906dbe35eba962c9e5151bf419b187d9d9a06a10`
and `79359b2225813271d06f3a8f34335ab37def435df793616fd73dba4acaa6b0dd`;
contract hash is
`c882764fc3790d7a7815c0ba802d0201d76e3ff874c878e0bf13f1b9d727756c`.
Full Product Compiler is 1012/1012 across 124 suites. Production use remains
forbidden by the exact six-code blocker set; no BuildTopologyV2, generated
entrypoint source receipt, semantic declarations, packet or release activation
is claimed by this slice.

The old setup installer, ambient worktree `npm install`, legacy Node entrypoint
rules and V1 BuildTopology remain compatibility observations. They are never
promoted into this authority chain.

### F5B — Dependency-ready BuildTopologyV2

**Status (2026-07-22): complete as a shadow, production-forbidden authority.**
Commit `8c520a2d` introduces `setfarm.build-topology.v2` version `2.0.0`
and a separately hashed code-owned contract. The contract hash is
`5ac524ec5f5c45ac3091c39c5fe959da3da970c15757196879031db55c30ef28`.

BuildTopology accepts no caller-authored path, command, runtime ABI or receipt
body. It fresh-verifies the complete FileTree at the dependency-ready F4 stage,
fresh-reproduces Node layout/path-token/scaffold authority, and revalidates the
authenticated dependency materialization receipt before producing an artifact.
It projects every-and-only FileTree path, then adds exactly four roles:

- disposable repository `node_modules` as compiler input, including verified
  npm-generated command links;
- the separate read-only dependency capsule as a future candidate-runtime copy
  source, explicitly excluding those generated links;
- the canonical build output, proven physically absent at this pre-build stage;
  and
- the candidate module path as a logical future materialization target, not a
  false filesystem-absence claim.

The topology binds the exact install/build/test direct argv, shared effective
environment, typed preconditions, non-zero-test rule, CLI module ABI or Express
named-handler ABI, source-to-output-to-candidate path chain and platform-owned
HTTP listener boundary. Build and test remain typed-blocked; this slice executes
neither command and does not invent a source, output or candidate byte hash.

Identity is deliberately split. `logicalBuildHash` binds stable product,
FileTree, content/toolchain/dependency, path, command and ABI authority used by
semantic comparison and retry dedupe. `manifestHash` additionally binds the
current authenticated F4 operational receipt, scope, stdout/stderr and private
project execution evidence. Random attempt identity, absolute paths and current
receipt hashes cannot perturb the logical identity. Two independent CLI F4
attempts therefore have different dependency receipt and topology manifest
hashes but the same logical build and logical dependency hashes.

The exact blocker set retains build execution, candidate materialization,
entrypoint source receipt, Node rule-to-generator transition, release
activation, semantic declarations and test-source authority. BuildTopology is
the pre-declaration planned-executable artifact; it does not claim declaration
refs. SemanticSourceDeclarationsV1 and the later ExecutableSourceContractV2 are
the downstream typed joins that discharge source completeness without mutating
or reinterpreting this artifact.

Focused coverage uses CLI, one-story API and two-story API fixtures. Their
stable logical build hashes are respectively
`3dbaab775f1d4f5b338923a9c032e536adf97dab974e94f5ab3fed52cc6d8a4b`,
`bbd4d9cafa4b3779196f7fa707c726c6494c39a01c8cd18de89ea5455b4755f6`
and `0f87d72f4e6541f13febf0d4eb3396705ec2cd8eede13dfb0329206523da7a4c`.
The test also rejects production/test scope confusion, schema-valid
self-rehashed logical and operational forgeries, and absolute/private-path
leakage. Materializer integration is 16/16; full Product Compiler is 1013/1013
across 124 suites; TypeScript, English (1,090 files), path contract (615 files)
and diff checks pass.

### F5C — Node V1 rule-to-generator transition

**Status (2026-07-22): complete as a shadow, production-forbidden authority.**
Commit `5c26ec59` adds
`setfarm.node-semantic-rule-generator-transition.v2` version `2.0.0` and the
separate `setfarm.node-entrypoint-generator-contract.v2`. Their code-owned
contract hashes are respectively
`6ea5bb30efdd5b98229bb0ca7e13bffbbc8601eadcd7a76b362cbd2d7bc0f10a`
and `52b95411113b302c8993e8d3debc712831955cb72a8b91a0226e40941a86933a`.

This slice does not relabel or activate V1. It fresh-reproduces the exact V1
rule set, semantic intent set and path-token set, fresh-verifies FileTree and
BuildTopology, and creates one transition for every and only FileTree
entrypoint requirement. Each transition retains the complete historical ABI:
rule-set/rule versions and hashes, intent/requirement/projection hashes,
subject/scope/story/owner, cardinality/domain, TypeScript parser contract,
structural slot, model-write policy and postcondition. Its target is one
code-owned deterministic whole-file generator with zero model write authority.

The generator contract binds two exact profiles. The CLI target is a Node ESM
process module with no named export and transport argv appended after the
module. The API target exports only `setfarmHttpHandlerV2`; server, listener and
socket remain platform-owned and candidate `listen()` is forbidden. Runtime
registration transitions to an ABI surface, not an invented CLI export.

Completeness is bounded by the inherited V1 catalog: exactly one entrypoint
registration, one to 500 route registrations and exactly one runtime
registration, for at most 502 transitions. The schema and producer enforce the
same bound. A transition's stable hash binds `logicalBuildHash`, while the
fresh verifier still checks the current operational BuildTopology. Private
root, dependency receipt, admission scope and operational manifest hash are
excluded from transition identity, so a new physical attempt cannot manufacture
a semantic delta.

The artifact remains `shadow_blocked` by five exact facts: generator
implementation, release manifest, rule activation, semantic declarations and
source receipt are all unverified. Declarations intentionally precede the real
generator: they must define exact versioned module/export ABI for the semantic
sources the generated entrypoint imports. The generator then emits deterministic
whole-file bytes plus `NodeEntrypointSourceReceiptV2`; it cannot infer imports
from filenames or prose.

This was the locally coherent F5C ordering before the whole intent inventory was
reclassified. F5D supersedes it: current Node behavior has no justified
model-owned handler/adapter/state module to declare or import. Do not implement
this paragraph as the target path.

Focused proof covers CLI, one-route API and two-route API. Their stable
transition hashes are
`dd9383168e399304d444e47d79363c47f710d9162a87caff034c1a75fbd8a5c1`,
`230bae76845629959fcebf10009d1c8bbb3361fe073d899c797ee87bca381a7c`
and `dbae4dd6890ee1ca3fadf060767e87c64875c539ee90ccc2762e984cabadbc85`.
Tests reject wrong scope, strict-input extras, schema-valid self-rehashed
logical authority and a schema-valid omitted route; an independent CLI attempt
keeps the same transition hash despite a different operational topology.
Materializer integration is 17/17; full Product Compiler is 1014/1014 across
124 suites; TypeScript, English (1,092 files), path contract (617 files), tracked
and untracked diff checks pass.

### F5D — SemanticRealizationPlanV2

**Status (2026-07-22): complete as a shadow, production-forbidden planning
authority.** Commits `a89bc494`, `1d514c3b`, and `8d53f53f` add
`setfarm.semantic-realization-plan.v2`, a code-owned Node realization policy and
the code-owned runtime/test generator contracts. Their final hashes are:

- realization-plan contract:
  `fcb011c9bcd79d4178415f0b7b419572d8a57eb38a94a8ece54d8a68f07d645e`;
- realization policy:
  `9dc1212f1c7fd1a6801dfbd9d3a2823b68292f76cdb9d8c7501fa8ac5beb120e`;
- runtime generator contract:
  `2f36ccaf6ccc5d88d89c770ea01daf139afc18b3736c4b282f9e01fea005b41f`;
- test generator contract:
  `478ecd63be81483a71d9becd769483e7c9b194c047223374eb35c0731e0c4f28`.

The compiler treats `SemanticSourceIntentSetV1` as an obligation inventory, not
an implementation decision. It fresh-reproduces that set and assigns every
intent exactly once to one of four target classes: a generated runtime member,
an exact platform contract binding, a typed exemption, or an evidence relation.
The historical V1 target is retained only as hashed compatibility evidence. No
current Node CLI/API semantic obligation receives a model write grant. Action
reducers, input/output codecs, route/runtime/entrypoint registration, state,
runtime data, observables and non-rendered surfaces are all members of one
code-owned whole-file generator. Opaque behavior is rejected unless a future
versioned ProductSpec behavior contract explicitly authorizes it.

The policy pins the exact delivery profile hash, stack-pack version/content hash
and V1 rule-set hash for both supported Node profiles. A same-ID upstream body
change therefore fails closed instead of silently inheriting policy. CLI keeps
its process-module ABI with no named export. API exposes exactly
`setfarmHttpHandlerV2`, forbids candidate `listen()`, and leaves server/listener/
socket ownership to the platform. The plan includes no normalized locator,
private root, mutable path, source byte, or operational-attempt identity. It
does pin the exact selected test-generator profile hash so a downstream V3
consumer resolves paths only from that code-owned contract.

The selected test profile owns one whole generated TypeScript test file and
forbids model writes, zero-test receipts, network access, ambient discovery,
clock and randomness. CLI binds `src/cli.setfarm.test.ts` to
`dist/cli.setfarm.test.js`, imports `./cli.js`, and may spawn only that exact
same-runtime CLI module. API binds `src/app.setfarm.test.ts` to
`dist/app.setfarm.test.js`, imports `./app.js`, and forbids subprocesses. Both
use the direct `node --test <compiled-file>` ABI; no npm/default test discovery
is authoritative.

Every-and-only coverage is exact for three independent shapes:

- CLI: 17 intents = 10 generator + 4 platform + 1 exemption + 2 evidence;
- one-route API: 19 = 11 + 5 + 1 + 2;
- two-route API: 32 = 20 + 6 + 2 + 4.

Their final plan hashes are respectively
`4bf2b8117db2b84cecefb8b50ed5230c31fdac0350f97277a51816b69d30a191`,
`a650d4b1923d098171181dd2de466df2cbce025782b556902cb5fc24e711a6c2`
and `7584d7e0c06858154ceaadba0707f0b01e0b56c320f362438f1ec8e9f0f6f16a`.
The two-route runtime-data obligations remain two separately traceable generator
members rather than two stories receiving permission to edit one aggregate
file. Memory persistence resolves explicitly to the generated state-runtime
member.

Schema-local hashes are not treated as authority. A test removes one evidence
relation, adjusts every count, recomputes membership and plan hashes, proves the
forgery is structurally schema-valid, and then proves the fresh verifier rejects
it. Changed policy members and a self-rehashed cross-profile test path are
rejected structurally. Strict extra fields, stale ProductSpec/selection
authority, proxies, accessors, cycles, sparse arrays and oversized inputs all
fail closed without executing caller traps. The final focused suite is 13/13;
TypeScript, English (1,095 files), path contract (619 files) and diff checks
pass. Full Product Compiler is 1027/1027 across 126
suites. No live run, DB, PR, service, generated repository or real Setfarm
application-support tree was mutated.

The artifact has eight exact blockers: realization-driven FileTreeV3,
BuildTopologyV3, runtime generator implementation, test generator
implementation, evidence-registry join, runtime source receipt, test source
receipt and release manifest. `SemanticSourceDeclarationsV1`
is no longer the next Node step: it assumed model-owned handler/adapter/state
modules and would reproduce the V1 ownership error. For current Node profiles,
the realization plan is the pre-source declaration and
`NodeProductRuntimeSourceReceiptV2` will provide post-generation every-member
source evidence. A future genuinely opaque/model-authored behavior may enter a
declaration path only through an explicit versioned ProductSpec behavior
contract; absence of that contract is rejection, not permission to improvise.

### F5E — FileTreeManifestV3

**Status (2026-07-22): complete as a shadow, production-forbidden physical
target authority.** Commit `e6bebd7c` adds
`setfarm.file-tree-manifest.v3` version `3.0.0`. Its code-owned contract hash is
`935102110da37a941d1859c6ff99ea05112894f872495b61ddc0673601b4704c`.

The manifest contains exactly six repository paths: three authenticated
readonly F4 config files, a forbidden `.npmrc` absence, one absent generated
runtime source target, and one absent generated test source target. Exactly
three owners exist: setup, the runtime generator, and the test generator.
Story owners, write grants and model writes are exactly zero. Runtime source
authority carries every generator-member realization. Test source authority
carries every action and every evidence-relation obligation.

V3 does not adapt FileTreeV2, SemanticSourcePathTokenSetV2 or story grants. It
fresh-reproduces ProductSpecV2, delivery selection, SemanticRealizationPlanV2,
NodeExecutionLayoutV2 and NodeExecutionPathTokenSetV2. The F4 catalog/base is
consumed only as authenticated scaffold-byte and absence evidence. Runtime/test
outputs, candidate module, commands and dependency capsule remain delegated to
BuildTopologyV3 rather than being invented at the base stage.

Logical identity excludes admission scope, private/physical identities and the
attempt-specific scaffold receipt hash. Two independent CLI private attempts
therefore have different receipts but byte-identical FileTreeV3 authority.
Both base-stage and dependency-stage verifiers reproduce fresh authority and
require canonical equality.

Stable manifest hashes for CLI, one-route API and two-route API are
`9f2355ab210b1d69d6ef4b523afcbdf065baf459e9d7fe61219409cb36399ae4`,
`5641aaa0e8906a447ad820db88b32c2308a8c2ffaecad3fc05e468f51ca62fb7`
and `4e3dfd610cf41f58037f9d2891f6caa0de4d7aa6e5ed16138e480f19b18eacd1`.
The three fixtures bind 10/11/20 runtime realizations, 1/1/2 actions and 2/2/4
evidence relations. Tests reject wrong scope, strict extras, accessors, hostile
proxies, cross-profile test substitution and a schema-valid self-rehashed
runtime-binding omission. The private materializer suite is 18/18; full Product
Compiler is 1028/1028 across 126 suites. TypeScript, English (1,097 files), path
contract (621 files), version, migration-digest, Mission Control contract and
diff checks pass. No live run, DB, PR, service, generated repository or real
Setfarm application-support tree was mutated.

At the FileTreeV3 boundary seven exact downstream facts were still absent; the
first was BuildTopologyV3. FileTreeV3 itself plans targets; it does not create
source bytes or claim executable success. F5F closes only that next planning
boundary.

### F5F — BuildTopologyV3

**Status (2026-07-21): complete as a shadow, production-forbidden executable
plan.** Commit `19ee7109` adds `setfarm.build-topology.v3` version `3.0.0`.
Its code-owned contract hash is
`85c5d6ab2546862383a3b1622a8f9360eed79af0bd5205e2cd1dea6bd911407f`.

The topology consumes FileTreeV3 only through its dependency-stage fresh
verifier and revalidates the authenticated dependency receipt. It has exactly
11 paths: all six FileTreeV3 projections, the disposable repository
`node_modules` compile input, a distinct readonly dependency capsule, runtime
and test build outputs, and the candidate module. Every write-grant tuple stays
empty. FileTreeV2, BuildTopologyV2, the entrypoint-only transition/receipt,
story grants, `npm run build`, and `npm test` are forbidden native authority.

Build is exact direct argv
`node node_modules/typescript/bin/tsc -p tsconfig.json`; the compiler target is
the authenticated `node_modules/typescript/bin/tsc` byte target from the
dependency receipt, not the generated npm link or PATH discovery. Tests are
exact direct argv `node --test dist/cli.setfarm.test.js` or
`node --test dist/app.setfarm.test.js`. The source-to-output-to-candidate graph
binds runtime realization and test coverage membership from FileTreeV3, while
both source receipts, the build receipt, test execution, candidate, evidence,
and release state remain explicitly absent or blocked.

Logical identity excludes attempt-specific dependency receipt, scope, project,
stdout/stderr, and host evidence hashes, while the operational manifest binds
all of them. Independent CLI private stages therefore produce different
dependency receipts and manifest hashes but the same logical dependency and
logical build hashes. Golden logical build hashes for CLI, one-route API, and
two-route API are respectively
`f97a1706091602ee52754ce984d8e8e02e7d1495c76bf46b6cce1f19b26cd8bc`,
`a37c780c70f51974503ff2d27cf52f02c76379fbc4a3405b46b81d19f1d3ed6d`,
and `7c94b8bda249c4138e0aa313ae4cd119dada708558809b38c59b67b6f4e1253b`.

Tests reject production/test authority promotion, strict extras, accessors,
hostile proxies, npm test discovery, a schema-valid self-rehashed logical
authority mutation, and a schema-valid self-rehashed operational mutation.
Fresh verification requires canonical equality to a newly reproduced artifact.
The private materializer suite is 19/19; full Product Compiler is 1029/1029
across 126 suites. TypeScript, English (1,099 files), path contract (623 files),
version, migration-digest, Mission Control contract, and diff checks pass. The
feature-branch build guard correctly refused the non-main branch and was not
bypassed. No live run, DB, PR, service, generated repository, or real Setfarm
application-support tree was mutated.

Seven explicit blockers now belong to the executable lifecycle rather than an
unspecified command: runtime and test source receipts, authenticated build
execution, candidate materialization, test execution, evidence-registry join,
and release manifest. BuildTopologyV3 plans and verifies these joins; it does
not execute a command or manufacture success evidence.

### F5G — NodeProductRuntimeGeneratorV2 and source receipt

**Status (2026-07-21): complete for the machine-executable ProductSpecV2
subset as a shadow, production-forbidden source authority.** Commit `f8281b98`
adds the code-owned whole-file generator and
`setfarm.node-product-runtime-source-receipt.v2`. The pinned runtime-program
contract hash is
`bc034f20c1c56ed094a2bebe6ea83cace9c861a299fbba0d44a7482803034bd5`.

The generator accepts no path, source fragment, model output, command, runtime
result, or release claim. It receives a private-stage capability separately
and bounded JSON containing ProductSpecV2, delivery selection,
SemanticRealizationPlanV2, FileTreeV3 and BuildTopologyV3. It freshly verifies
selection, realization and current operational topology, freshly compiles the
every-action InvocationInputTransportSetV2, and requires every product,
profile, path, realization-membership, compilation and logical-build join to
match before source bytes exist.

One canonical runtime program implements the exact supported semantics:
strict inverse transport decoding; transactional state snapshots; ProductSpec
preconditions; ordered set/merge/append/remove/clear/upsert deltas; canonical
JSON equality; input/literal invocation-output projection; declared success
and failure ABIs; CLI process output; and the platform-owned Express handler
export. The template has no clock, randomness, network, ambient environment,
filesystem discovery, candidate listener or semantic auxiliary file. Every
runtime realization has one content-derived `GENMEM_...` symbol and one exact
line/byte/hash marker span in the generated file.

The receipt separates three identities. Source content/program identity is
byte-stable. Logical receipt identity adds ProductSpec, transport, realization,
FileTree and `logicalBuildHash`. Full receipt identity additionally binds the
current operational BuildTopology manifest and admission scope. A sibling
private attempt therefore has different dependency/topology/full-receipt
identity but byte-identical source and logical receipt. A fresh verifier
regenerates both the complete source string and canonical receipt; local
self-rehash is not authority.

The behavior proof is not merely syntactic. Generated CLI and API source pass
strict TypeScript semantic checking in isolated projects. The CLI executes in
a real Node subprocess and returns its exact declared JSON result. The API
handler executes directly, returns the exact declared 201 result, and rejects
an extra request-body field through the declared typed 400 failure ABI. The
same generator covers CLI, one-route API and two-route API without a new
project-specific branch or guard. The private materializer suite is 20/20 and
full Product Compiler is 1030/1030 across 126 suites.

This slice also proves a new upstream blocker rather than hiding it. Current
`ProductSpecV2.states[].invariants` are prose strings, and `entity_field` deltas
carry no runtime entity-snapshot binding. The generator contract says opaque
behavior must be rejected, so non-empty prose invariants, unbound entity-field
sources, non-`stay` CLI/API navigation, overlapping output pointers and
before-phase invocation outputs receive typed pre-source rejection. The
positive runtime tests deliberately remove prose invariants; this is a test of
the executable subset, not a claim that current planner output is production
ready.

The next dependency-order slice is therefore not allowed to route this blocker
to review/retry or teach the generator invariant prose. Add the versioned,
machine-readable ProductRuntimeBehaviorContractV1 and its bounded evaluator.
Bind every current prose invariant to exactly one executable assertion set,
existing structured ProductSpec semantic coverage, or explicit non-runtime
constraint/non-goal plus required evidence disposition. Bind every
`entity_field` occurrence to an exact runtime snapshot and selection rule.
Version-forward realization, FileTree, BuildTopology and generator authority to
consume the behavior-contract hash. Only after that upstream behavior
contract is closed should NodeProductTestGeneratorV2 generate every action and
evidence-relation test from the same runtime program.

### F5H — ProductRuntimeBehaviorContractV1

**Status (2026-07-21): complete as an isolated shadow compiler, verifier,
evaluator and entity-snapshot resolver; production integration remains
forbidden.** Commit `26852450` adds
`setfarm.product-runtime-behavior-proposal.v1` and
`setfarm.product-runtime-behavior-contract.v1` version `1.0.0`. The pinned
code-owned evaluator contract hash is
`b067de2365e0ea413f632073c082a077c67de2e091fccddd7cb29e653eee990f`.

The compiler binds one exact ProductSpecV2 hash/source-task hash, one canonical
proposal hash and the evaluator hash. Every-and-only prose invariant occurrence
is identified from state ref, invariant ordinal and prose-text hash, then must
receive exactly one of three dispositions: bounded executable assertions;
exact existing action delta/precondition/observable/persistence-effect
coverage; or a non-runtime constraint/non-goal disposition with exact required
evidence. Each invariant retains its owning state's full traceability
requirement set. A functional requirement cannot be reclassified as
non-runtime, and prose is retained only through its hash rather than becoming
evaluator input.

The evaluator owns fixed `initial`, `after_action` and `after_rehydration`
checkpoints, RFC 6901 pointer semantics, canonical JSON equality, typed missing
values, vacuous every, exact truthiness/string-length/number/array behavior and
bounded collection/visit work. Results contain observation hashes rather than
raw state values. The compiler evaluates canonical initial state before issuing
a contract; the public evaluator fresh-verifies the candidate against both
ProductSpec and proposal before evaluating any snapshot.

Every `entity_field` delta occurrence now has exactly one derived occurrence
ref and snapshot binding. Selection is either one singleton object or one
canonical match from a state-before-action collection using a required typed
action input. Initial collections must be bounded, object-only, typed and
canonically unique. Runtime resolution requires every-and-only declared inputs
and states, enforces enum domains, rejects any malformed collection member, and
returns a typed missing/ambiguous/invalid action failure rather than guessing an
entity instance.

Fresh verification reproduces the full contract and compares canonical bytes.
A schema-valid self-rehash with a forged proposal hash is rejected. Strict
extras, stale ProductSpec hashes, proxies, accessors, cycles, sparse arrays and
oversized work fail closed. The focused suite is 12/12. Full Product Compiler
is 1042/1042 across 127 suites; TypeScript, English (1,104 files), path contract
(627 files), version, migration digests, eight Mission Control artifacts and
diff checks pass. The normal feature-branch `npm run build` guard refused
`arch/product-semantics-v2-authority` and was not bypassed. No live run, DB, PR,
service, generated repository or real Setfarm application-support tree was
mutated.

This slice does not prove that a model-authored structured assertion is the
correct semantic interpretation of arbitrary natural-language prose. More
importantly, current PLAN output accepts exactly one
`plan-semantic-proposal-v2`; it has no canonical producer for the behavior
proposal. Therefore caller-supplied test proposals are isolated proof, not a
production source of truth. The next dependency-order slice is one atomic
`PlanProductBuildProposalV1` envelope containing both primary semantic proposal
and local-key runtime behavior proposal. Setfarm must compile the semantic half
to ProductSpecV2, deterministically map local state/action/delta/observable/
entity keys into canonical refs, compile the behavior contract in the same
authority transaction, and reject partial or cross-proposal joins. Only then
may realization, FileTreeV3, BuildTopologyV3 and the runtime/test generators be
version-forwarded to consume the exact behavior-contract hash.

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

GO for F1-F4 and F5D-F5H as isolated shadow authorities. F5A-F5C are GO only as
compatibility evidence and are explicitly NO-GO as production topology. NO-GO
for production host execution, setup cutover, PacketV4, live migration, deploy
and new clean product runs until machine-readable runtime behavior, generated
test source/receipt, authenticated runtime-source materialization,
authenticated build/test/candidate evidence, evidence registry, release
manifest, SourceMap, and the later packet/eval program are complete. The next
dependency-order slice is the atomic PlanProductBuildProposalV1 producer and
PLAN authority integration, followed by downstream behavior-hash version
forwarding and NodeProductTestGeneratorV2. The feature-branch
`npm run build` guard was re-run after `19ee7109` and correctly refused branch
`arch/product-semantics-v2-authority`; it was not bypassed. Only a clean
merged-main build and full test can close that release gate.
