# Platform Release Build, Publication, and Verifier Plan

Date: 2026-07-26
Status: approved architecture implementation plan; all slices remain
shadow-blocked until clean-main activation

## Purpose

The V2 release schemas, exact source admission, authenticated build-toolchain
capsule, deterministic `BUILD_PLATFORM_RELEASE_V2` command, stable manifest,
separate occurrence attestation, and terminal manifest writer exist. They do
not yet form a production release pipeline.

The missing producer is the source-owned parent materializer that:

1. accepts only authentic source and build-toolchain capabilities;
2. invokes the deterministic command twice through the authenticated host Node
   runtime in two independent empty output stages;
3. materializes and verifies exact production dependencies in both outputs;
4. derives external/runtime/environment/catalog authority from observed bytes;
5. proves both complete output closures equal;
6. creates the manifest plus occurrence attestation and passes both to the
   terminal writer.

Fixture construction cannot substitute for this producer. A fresh verifier
must not promote a fixture-composed completed-stage handle.

## Decision

Implement one linear authority chain:

```text
AdmittedPlatformReleaseSourceStageV2
  + PlatformReleaseBuildToolchainCapsuleV2
  + PlatformReleaseHostNodeToolchainAuthorityV2
  -> PlatformReleaseCompiledOutputPairV2
  -> PlatformReleaseDependencyMaterializedPairV2
  -> CompletedPlatformReleaseStageCandidateV2
  -> PreparedPlatformReleaseV2
  -> VerifiedPlatformReleaseV2
  -> EvidenceAdapterRegistryV2
```

Each arrow is an operational capability transition backed by module-private
state. No public function accepts a caller path, command, environment, package
selection, receipt, manifest field, catalog entry, release hash, or producer
claim when the preceding capability can derive it.

The source context owns one monotonic lifecycle:

```text
source_admitted
  -> toolchain_materializing
  -> toolchain_materialized
  -> double_build_running
  -> double_build_complete
  -> dependency_materializing
  -> release_completed
  -> disposed
```

Failure is terminal for that physical context. A failed or interrupted stage is
disposed and never reset for a second logical attempt. A new attempt starts
from a new exact source admission.

## B5A — Authenticated Platform Build Process ABI

Add a code-owned host operation:

```ts
executeHostNodeToolchainPlatformReleaseBuildV2(
  host: HostNodeToolchainAuthorityV2,
  input: {
    sourceRoot: string;
    outputRoot: string;
    buildToolchainRoot: string;
    buildToolchainHash: string;
    sourceSha: string;
    sourceDateEpoch: string;
    commandModuleHash: string;
  },
): Promise<HostNodeToolchainPlatformReleaseBuildEvidenceV2>;
```

This is an internal physical operation, not release authority. It:

- authenticates one `source` + `node_modules` private sibling context;
- authenticates one distinct, initially empty mode-`0700` output root;
- reads the exact `scripts/build-platform-release-v2.mjs` source file and
  requires `commandModuleHash`;
- constructs the fixed direct argv and six-variable environment itself;
- uses the host authority's exact Node executable, never ambient
  `process.execPath`, `PATH`, a shell, or caller environment;
- bounds stdout/stderr and timeout;
- revalidates the host, private build-context root topology, exact command
  module, and output-root identity after execution;
- returns bounded process evidence and the exact stdout bytes, with no
  filesystem locator in its public evidence projection.

The platform wrapper binds that occurrence to the profile-independent platform
host receipt. CLI/API scaffold profile identity must not enter this evidence.
This low-level path operation deliberately does not issue source or toolchain
content authority. Portable Node path APIs cannot close a hostile same-UID
swap-and-restore attack. The B5B source owner must therefore keep both roots
private, freshly revalidate the authentic source and toolchain handles before
and after each call, and join every command-result tree/count/compiler field to
those pinned receipts before it may issue any compiled-output handle.

## B5B — Source-Owned Double Build

Add opaque `PlatformReleaseCompiledOutputPairV2`. Its private state retains:

- the authentic source and toolchain handles;
- two independent anchored output roots;
- exact source/toolchain receipts;
- command module identity;
- two parsed `PlatformReleaseBuildCommandResultV2` values;
- two host process evidence values.

The source owner allocates both roots. The caller provides only the source and
toolchain handles. Before and after each build it freshly revalidates both
capabilities. It requires:

- both outputs were empty and physically distinct from source, toolchain, and
  each other;
- both command results exactly project the admitted source/tree/counts, Git
  epoch/SHA, compiler, and toolchain tree;
- both command results are canonical-byte equal;
- the two pre-dependency `payload/dist` trees and package files are freshly
  equal;
- neither output yet contains `node_modules` or a manifest.

Inspection returns only hashes/counts and lifecycle state. Test-only root access
uses a callback bracketed by fresh revalidation; production has no path getter.

## B5C — Production Dependency Pair

Add a distinct authenticated host npm operation with fixed argv:

```text
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
```

It runs in a separate private install project containing exact admitted
`package.json`, `package-lock.json`, and `tsconfig.json`. It cannot run inside
either output root. The materializer independently:

- validates the lock root, every-and-only installed production package root,
  package manifests, required/optional platform edges, and lock-declared bin
  surface;
- removes only the verified generated hidden lock and `.bin` surface;
- normalizes and seals the dependency tree;
- derives every package subtree hash and the exact
  `ProductionPackageResolutionGraphV2`;
- atomically adopts one verified read-only tree into each output's
  `payload/node_modules`;
- creates a complete `NpmMaterializationReceiptV2` for each occurrence;
- re-captures full `dist` and `node_modules` trees in both outputs and requires
  equal deterministic bindings.

Attempt-specific npm process scope belongs to the build attestation/private
verification state, not the stable manifest. The stable output closure contains
the exact materialization receipt identity currently defined by V2. If this
receipt later gains occurrence fields, those fields must move to a separate
occurrence receipt before release identity can advance.

## B5D — Complete Release Composition

Only the dependency-materialized pair may derive:

- `PlatformRuntimePayloadV2`;
- exact external runtime resolution;
- evidence environment capsule;
- launcher/runner/definition/codec/receipt catalogs;
- two complete `PlatformReleaseBuildReceiptV2` values;
- stable `PlatformReleaseManifestV2`;
- exact `PlatformReleaseBuildAttestationV2`.

The production composer must reproduce code-owned catalogs from zero-input
definitions and observed module bytes. It cannot accept any of these artifacts
from a caller.

The terminal writer must eventually accept this authentic composer handle, not
public manifest/attestation JSON. The current JSON input remains candidate-only
until that transition lands. The fixture path remains test-only.

## B5E — Immutable Content Store and Prepared Brand

The release content store is separate from semantic artifact CAS. It owns:

```text
<releaseStore>/
  .staging/
  .locks/
  releases/<manifestPayloadHash>/
  attestations/<attestationHash>.json
```

The store authority is created only by the independently installed bootstrap.
Tests use a separate test constructor and temporary root. Publication:

1. preflights canonical manifest and attestation envelopes independently;
2. acquires exact content and attestation leases;
3. atomically renames the completed content root to
   `releases/<manifestPayloadHash>`;
4. adopts an existing identical content winner only after a full fresh
   filesystem reproduction;
5. appends the attestation as a separate no-replace canonical item;
6. issues `PreparedPlatformReleaseV2` only after both identities are durable.

No attestation occurrence bytes are written beneath the stable release root.
Conflicting bytes at either identity are corruption, never overwrite targets.

## B6 — Fresh Verifier

The fresh verifier accepts only an authentic prepared handle plus an
independently installed verifier capability. It does not trust the builder's
in-memory captures.

It independently:

- enumerates exact release layout and reads bounded canonical manifest bytes;
- parses manifest and exact attestation bytes from their separate stores;
- replays the candidate-envelope joins;
- re-captures complete dist/dependency trees and exact package/converter/module
  bytes;
- reproduces all code-owned catalogs and module exports;
- re-observes host-owned bootstrap, metadata tools, Node/npm, executable,
  browser, and OS identities under the pinned host verifier;
- reruns the code-owned network negative probe;
- binds every fresh occurrence receipt outside the stable manifest;
- issues an opaque `VerifiedPlatformReleaseV2` only after pre/post root and
  store fences remain unchanged.

The verified handle inspection contains hashes and states only. Private state
retains anchored roots, manifest, attestation, fresh tree captures, host
authority, and network receipt.

## B7 — Registry V2

`compileEvidenceAdapterRegistryV2` accepts only
`VerifiedPlatformReleaseV2`. It derives producer, release, catalog, adapter,
runner, executable, profile, transport, and support fields from private verified
state. Public input contains none of them.

Registry verification recompiles from the verified brand and compares canonical
bytes. Registry V1 remains historical read-only. No V1 fallback or dual active
registry is permitted.

## Implementation Commits

1. `feat(release): execute authenticated builds`
   - host build ABI and wrapper;
   - direct argv/environment/process evidence tests.
2. `feat(release): own double build outputs`
   - source lifecycle and opaque compiled-pair handle;
   - concurrency, failure cleanup, drift, and equality tests.
3. `feat(release): materialize production closure`
   - production npm host ABI;
   - lock/package/bin verification and double dependency trees.
4. `feat(release): compose authentic release`
   - observed runtime/external/environment/catalog builder;
   - authentic terminal-writer input.
5. `feat(release): publish immutable content`
   - release-store leases, rename/adoption, separate attestation CAS, prepared
     brand.
6. `feat(release): verify fresh release authority`
   - independently installed verifier capability, full recapture, verified
     brand.
7. `feat(evidence): derive registry v2`
   - verified-release-only catalog and RegistryV2.

Each commit is independently testable but production-forbidden until commit 7
and the clean-main release matrix are complete.

## Evidence Matrix

Unit:

- exact input shape, fixed argv/environment, canonical output parsing;
- every domain hash, cap, strict schema, and recursively frozen DTO;
- no exported candidate DTO can issue, verify, prepare, or activate authority.

Filesystem integration:

- non-empty output, stale dist, symlink, hardlink, special file, case collision,
  unsafe Unicode, mode/owner/link-count drift;
- source/toolchain/output overlap and mutation during each capture;
- package/lock/compiler/build-command drift;
- unequal double builds and equal content with distinct occurrence hashes;
- no attestation bytes under the release content root.

Concurrency/crash:

- two build requests on one source context;
- failure between first and second build;
- two publishers for one stable content hash with distinct attestations;
- crash before/after content rename and attestation append;
- verifier racing publication or root replacement.

End to end:

- real current source lock under an authenticated test host fixture;
- deterministic double build into fresh roots;
- prepared -> verified -> RegistryV2 transition;
- CLI and API runner exports reproduced from verified bytes.

Production GO remains blocked until clean `main` performs two independent
builds and all production host/ownership/network checks without a test
constructor or guard bypass.
