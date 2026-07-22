# Candidate Runtime Bundle Authority V2 Design

Date: 2026-07-21
Status: Approved for isolated shadow implementation
Scope: One-shot production dependency materialization and pathless candidate runtime authority

## Context

The content-first candidate chain now ends at a real private build authority:

```text
ImplementationClosureV2
  -> VerifiedCandidateSourceAuthorityV1
  -> CandidateBuildReceiptV2
  -> CandidateBuildAuthorityV2
```

`CandidateBuildAuthorityV2` proves the exact source, BuildTopology V3.2
operation, host/compiler/environment authority, successful bounded process and
the every-and-only `dist` output. It deliberately does not make mutable
worktree `node_modules`, a preview process or a caller-selected entrypoint
runnable.

The existing `CandidateRuntimeBundleV2` is a schema-only candidate. It has no
issuer, private root, process owner, single-use lifecycle or fresh verifier.
Three parts of that wire are also structurally wrong:

1. both the application tree and dependency tree use
   `CandidateCanonicalRuntimeTreeArtifactRefV2Schema`, whose producer is
   `candidate-build-authority-v2`; the runtime dependency tree does not exist
   during build and cannot truthfully have that producer;
2. `CandidateNpmMaterializationReceiptV2` records a plausible npm identity and
   exit code but does not join the authenticated host receipt, isolated
   execution environment, exact project scope, direct argv or bounded process
   evidence;
3. `CandidateLaunchTargetV2` still requires `SourceRevisionV1`, even though the
   current private generated source is content-addressed and owns no Git commit
   or tree.

These are authority-graph defects, not validation omissions. Accepting a
self-rehashed DTO or adding guards around the old fields would permit a caller
to assign build authorship to dependency bytes, invent process evidence and
fabricate Git-shaped source identity.

## Decision

Introduce one product-complete runtime bundle authority after the build and
before Registry/launch:

```text
CandidateBuildAuthorityV2                         # authentic, fresh verified
  + exact source package.json/package-lock.json
  + code-owned production npm recipe
  + authenticated host Node/npm and environment
    -> one-shot private candidate-bundle root
    -> CandidateProductionPackageResolutionGraphV2
    -> dependencies CanonicalRuntimeTreeV2
    -> CandidateNpmMaterializationReceiptV2
    -> CandidateRuntimeBundleV2
    -> CandidateRuntimeBundleAuthorityV2          # branded, pathless
```

The serialized bundle is evidence. Only the authentic WeakMap-backed handle is
operational authority. Parsing or self-rehashing the bundle never creates a
handle.

This slice corrects `CandidateLaunchTargetV2` to bind the content-first source
authority. It does **not** issue a launch target. Launch issuance requires the
later verified PlatformRelease/RegistryV2 authority because launcher module,
ABI and stack-pack bytes must be observed rather than claimed.

Production activation remains forbidden.

## Superseding Runtime Bundle Wire

There are no durable or live `CandidateRuntimeBundleV2` artifacts. The
schema-only wire is replaced before activation instead of maintaining a dual
parser. Its schema name remains `setfarm.candidate-runtime-bundle.v2`; its
component version and literal contract hash advance.

The bundle receipt binds:

- one code-owned `CandidateRuntimeBundleProducerV2`;
- PacketV4, BuildTopology V3.2, ImplementationClosureV2,
  CandidateSourceReceiptV1 and CandidateBuildReceiptV2 identities;
- the exact application tree artifact previously published by the build
  authority;
- a separately produced production dependency tree artifact;
- a separately produced production package-resolution graph artifact;
- the exact bundled `package.json` content identity;
- authenticated npm process/environment evidence;
- the every-and-only root closure;
- `verified_private_shadow`, `productionUse:"forbidden"` and literal blocker
  codes for RegistryV2, EvidencePlanV2, launch authority and atomic activation.

The producer is:

```ts
{
  pass: "candidate-runtime-bundle-authority-v2";
  codeSha: GitCodeSha;
  toolVersions: {
    candidateRuntimeBundle: "2.1.0";
    candidateBuild: "2.1.0";
    candidateSource: "1.0.0";
    canonicalRuntimeTree: "2.0.0";
    productionPackageResolutionGraph: "2.0.0";
  };
}
```

The application tree keeps its build-owned artifact reference. The dependency
tree uses a new runtime-bundle-owned artifact reference. The two schemas are
intentionally distinct even though both envelopes carry
`CanonicalRuntimeTreeV2` payloads. Producer identity is part of provenance and
cannot be selected by a caller.

The production graph is a complete bounded artifact, not an unattached hash.
Its graph payload uses `ProductionPackageResolutionGraphV2`; its artifact ref
binds the runtime producer, envelope hash and byte length. The npm receipt and
bundle both join the exact graph hash/ref and exact dependency tree.

## Production Dependency Selection

The code-owned Node scaffold lock graph is the only lock authority for the
current profiles. The runtime graph is derived mechanically from its lockfile
V3 package map and code-owned graph:

- root edges of kind `dependencies` seed production reachability;
- only dependency edges reachable from those roots are included;
- a node marked `dev:true` cannot occur in the production closure;
- every included locator must exist exactly once in the root and hidden npm
  lock projections;
- every package name/version/resolved/integrity and package manifest identity
  must reproduce;
- every declared dependency edge must resolve to another included canonical
  locator;
- installed package roots must equal the graph every-and-only;
- package count and dependency-edge count are bounded by the existing
  ExternalRuntimeResolutionV2 limits.

For the CLI profile the valid production closure is empty. This is a real
zero-package graph, not an absent check. For the Express API profile it includes
Express and every-and-only reachable production transitive package.

The production graph artifact records, for each package, its canonical
locator, name/version, exact lock entry hash, package.json hash, package subtree
hash and dependency locators. It therefore supports later attribution of a
runtime byte to a specific resolved package without reparsing prose.

## Exact npm Operation

The only admitted operation is code-owned:

```text
authenticated npm 10.9.8
  ci --omit=dev --ignore-scripts --no-audit --no-fund
```

The host authority resolves npm through its authenticated Node/npm closure. It
does not use a shell, caller PATH, ambient environment, caller cwd, caller argv
or a preview/start script. Stdin is closed. Timeout and stdout/stderr bounds are
literal contract fields. Nonzero exit, signal, timeout, spawn failure or output
overflow is a typed runtime-bundle rejection and consumes the attempt.

The process runs in the fresh bundle root while `package-lock.json` is present.
The root initially contains only authenticated copies of:

- `application/`, copied from the verified build output;
- `package.json`, copied from the verified candidate source;
- `package-lock.json`, copied from the verified candidate source for install.

After successful capture, `package-lock.json` is removed from the final runtime
root. Its bytes remain bound by CandidateSourceReceiptV1, the npm receipt and
the production graph. A changed package manifest or lockfile across the process
fence rejects the attempt.

The npm receipt includes:

- exact recipe and contract hashes;
- source lockfile and package-manifest identities before and after execution;
- host toolchain receipt, Node identity, npm closure/version;
- execution-environment receipt/effective-config/environment hashes;
- project-scope and direct-argv hashes;
- typed successful process outcome with bounded stdout/stderr identities;
- production graph identity and artifact reference;
- dependency-tree binding and artifact reference;
- lifecycle scripts forbidden and exit code zero.

## Private Root and Filesystem Closure

The runtime materializer owns a new attempt-scoped process-owned private root;
it never symlinks a worktree or reuses the scaffold project as the final bundle.
The logical final root is exactly:

```text
candidate-bundle/                 0555
  application/                    0555
  node_modules/                   0555
  package.json                    0444
```

No fourth root entry is accepted. Regular files are normalized to `0444`;
directories are normalized to `0555`; executable bits, symlinks, hard links,
special files, extended mutable metadata and owner changes are rejected or
normalized only under the existing code-owned Darwin metadata policy.

`application` is captured with the `dist` CanonicalRuntimeTreeV2 profile and
must reproduce the build output tree byte-for-byte. `node_modules` is captured
with the `dependencies` profile and must reproduce the production graph.
`package.json` is fenced before/after, content hashed and bounded. The
materializer fsyncs files and directories before sealing.

The private state stores absolute paths, held physical fingerprints and the
metadata probe. The public bundle, receipt and authority handle expose only
logical locators and hashes.

## Ownership and One-Shot Lifecycle

`CandidateBuildAuthorityV2` owns a mutable internal runtime-bundle lease:

```text
runtime_bundle_ready
  -> runtime_bundle_claimed
  -> runtime_bundle_consumed
```

Claim is atomic before any asynchronous work. Concurrent or repeated claims
return `CANDIDATE_RUNTIME_BUNDLE_V2_ALREADY_CONSUMED`; they are not new product
failures and must never replenish retry budget.

The stage and its authenticated execution environment gain one post-build
runtime-install transition:

```text
build_ready/build_consumed
  -> runtime_installing
  -> runtime_install_consumed
```

This transition only delegates the exact production npm process. It does not
expose the host toolchain or private environment paths. The runtime materializer
owns the bundle root; CandidateBuild continues to own the source/build stage.

On any failure, the issuer removes the bundle root and destroys the source
stage plus execution environment. On success, the branded runtime authority
owns all roots needed for fresh verification and later launch-target issuance.
A later explicit authority disposal operation will remove them after evidence
or activation consumes the bundle.

## Issuer and Fresh Verifier

The public issuers are:

```ts
materializeCandidateRuntimeBundleV2({
  buildAuthority,
  expectedBuildReceiptHash,
  artifactAuthority,
})

materializeCandidateRuntimeBundleV2ForTest(...)
```

Inputs are exact non-proxied data records containing authentic handles. The
production issuer requires production scope and a hybrid indexed publisher;
the test issuer cannot consume production authority.

Issuance performs, in order:

1. authenticate and single-use claim CandidateBuildAuthorityV2;
2. fresh-verify build source, output and CAS/index replay;
3. acquire the stage-owned post-build runtime scope;
4. create the fresh private bundle root;
5. copy and fence build output, package manifest and lockfile;
6. execute the exact production npm operation;
7. derive and validate the every-and-only production graph;
8. normalize, seal and capture dependency/application trees and root;
9. reproduce all build/source/process/environment joins;
10. publish dependency tree and production graph in one indexed CAS batch;
11. issue the receipt and opaque authority.

Fresh verification accepts only the authentic handle and expected bundle hash.
It repeats:

- CandidateBuild authority verification;
- source package/lock and build output checks;
- exact bundle-root enumeration and physical identity checks;
- application/dependency CanonicalRuntimeTree reproduction;
- production graph reproduction from current sealed bytes and bound lock;
- npm/process/environment receipt joins;
- exact indexed CAS batch replay.

Deleting a CAS blob while leaving a completed DB reservation, changing any
mode/owner/link/member, adding a root entry or mutating a source/build byte must
make fresh verification fail with a typed authority error.

## CandidateLaunchTargetV2 Correction

The schema-only launch target replaces:

```ts
sourceRevision: SourceRevisionV1
```

with an exact content-first binding:

```ts
sourceAuthority: {
  schema: "setfarm.candidate-runtime-source-binding.v2";
  candidateSourceEnvelopeHash: Sha256;
  candidateSourceReceiptHash: Sha256;
  semanticRevisionHash: Sha256;
}
```

The binding must equal the runtime bundle and embedded build receipt. Historical
Git-backed execution-attempt V1 rows keep `SourceRevisionV1`; they are not
reinterpreted. No Git placeholder or adapter is accepted.

Launch target parsing remains non-authoritative. The later issuer must consume
an authentic runtime bundle plus a fresh verified PlatformRelease/RegistryV2
handle and derive launcher, stack-pack, module/export, argv and transport bytes
itself.

## Failure Taxonomy

Runtime bundle failures are typed by ownership:

- input/brand/scope/expected-hash rejection;
- build/source authority drift;
- already-consumed lifecycle;
- private-root/materialization rejection;
- npm operation spawn/timeout/output/signal/nonzero rejection;
- lock/production-graph rejection;
- application/dependency/root closure rejection;
- indexed publication/replay rejection;
- cleanup failure.

Only a proven source/build delta or a new infrastructure state permits a new
attempt. Same build authority replay is terminally consumed. Supervisor may
classify and own bounded cleanup/retry routing later; it cannot reanimate the
capability or edit the receipt.

## Module Boundaries

Dependency-order implementation is:

1. this design;
2. superseding `candidate-runtime-bundle-v2.ts` wire and launch-source binding;
3. reusable production graph derivation/capture module extracted from the
   private scaffold materializer without weakening its current dev graph;
4. exact host production npm runner and process evidence;
5. execution-environment and private-stage post-build one-shot bridge;
6. private runtime root materializer, normalization and revalidation;
7. `candidate-runtime-bundle-v2.ts` issuer, branded handle, CAS publication and
   fresh verifier;
8. CLI/API integration, concurrency, tamper and CAS/DB split-brain tests;
9. full Product Compiler/execution/type/contract checks;
10. RegistryV2 and verified release adapter before launch issuance.

No Mission Control code changes in this slice. Mission Control receives the
canonical operational model only after activation/evidence state exists.

## Compatibility and Rollback

- Historical `SourceRevisionV1` execution attempts remain V1-only.
- Existing schema-only runtime/launch fixtures have no durable/live authority
  and receive no compatibility parser.
- CandidateBuildReceiptV2 remains unchanged; it only gains a private internal
  one-shot consumer bridge.
- Rollback reverts this isolated shadow slice. It does not convert content-first
  source identities into Git identities or reinterpret dependency artifacts as
  build artifacts.
- No live DB migration, service restart, run start or production activation is
  part of this slice.

## Test Matrix

Pure schema tests pin contract/producer/config/recipe hashes; exact artifact
producers; process/environment joins; empty and non-empty production graphs;
strict parsing; bounded work; hostile accessors/proxies/cycles; and source-
binding launch correction.

Host runner tests cover exact argv/cwd/env/stdin/shell/output bounds and typed
spawn, timeout, output-limit, signal and nonzero outcomes with host before/after
fences.

Materializer tests cover CLI zero-package and API transitive production trees;
dev omission; root every-and-only membership; application equality; package and
lock fencing; symlink/hardlink/mode/owner/special-file/metadata attacks; crash
cleanup; and single-use concurrency.

Authority integration tests cover authentic/forged/proxied handles, scope
separation, build revalidation, exact CAS batch replay, missing/corrupt CAS with
completed DB state and post-issuance physical tamper.

End-to-end shadow integration repeats the existing CLI, one-story API,
prerequisite API and entity-field API fixtures. Equivalent private attempts
must converge on semantic source, application tree, production graph and
dependency tree identities while retaining distinct operational receipt hashes.

## Cutover Decision

CandidateRuntimeBundleV2 design and isolated shadow implementation are **GO**.
CandidateLaunchTarget issuance, runtime launch, RegistryV2 activation,
EvidencePlanV2 execution, Mission Control completion and clean-run success are
**NO-GO** until verified platform-release bytes, atomic artifact activation,
typed delta retry, bounded supervisor ownership and three-class convergence
evals close.
