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

### B5D-0 — Host Composition Authority

Read-only post-B5C audit proved that the dependency pair does not yet carry the
production release-bootstrap, metadata-tool, network-sandbox, runtime UID/GID,
or module-export authority required by the existing external/environment
schemas. The complete fixture currently fabricates those values, and the
current network probe is explicitly test-only.

Before any manifest builder, attach one private
`PlatformReleaseHostCompositionAuthorityV2` sub-capability to
`PlatformReleaseHostNodeToolchainAuthorityV2`. The sub-capability is retained
through the build capsule and dependency pair; it is not a new composer
argument. It admits and freshly revalidates:

- exact release bootstrap executable/module;
- metadata bootstrap/export plus distinct exact xattr observer/clear, ACL
  observer, and ACL clear tools;
- sandbox executable, network wrapper/export, and canonical profile;
- unprivileged runtime UID/GID distinct from the root owner;
- exact host/verifier identity and non-system dynamic-library closure;
- metadata, network, and module-export receipt ABIs.

Production construction is bootstrap-owned and root-only. Tests use a distinct
`test_fixture` constructor that cannot promote.

The existing `ExactHostOwnedFileRefV2` is not widened: it permits only
`0444|0555`, whereas exact system executables are commonly `0755`. B5D adds a
composition-specific descriptor-captured file receipt with
`0444|0555|0755`. The existing Node provisioner bootstrap is not the release
bootstrap. Until the fixed-root release package, installed verifier, and
durable runtime-account receipt exist, the production composition opener fails
closed with no fixture/current-source/ambient fallback.

#### B5D-0 delivery split and selected production provenance

`B5D-0a` is the identity-only mechanical slice. It owns the strict pathless
receipt, exact ten-role requirement, descriptor-bounded test-fixture capture,
opaque capability, private host-Node retention, fresh host/composition fences,
terminal capsule revalidation ownership, and exhaustive typed capsule-to-pair
error translation. Its production opener remains zero-input and deliberately
returns `HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE`.

`B5D-0b` is the mandatory production-provenance slice. It is one private
authority DAG, not a list of interchangeable designs:

1. a code-owned bootstrap-package registry and one shared parent serialization
   authority for every package installed beneath
   `/Library/Application Support/Setfarm/bootstrap`;
2. an independently installed native host-composition verifier package under
   `/Library/Application Support/Setfarm/bootstrap/host-composition-verifier-v2`;
3. an independently installed release-composition package under
   `/Library/Application Support/Setfarm/bootstrap/platform-release-composition-v2`;
4. a Darwin system-anchor authority for exact `/usr/bin/xattr`, `/bin/ls`,
   `/bin/chmod`, and `/usr/bin/sandbox-exec` physical files and their two exact
   parents;
5. a separately packaged root-only runtime-account provisioner and durable
   `SETFARM_PLATFORM_RELEASE_RUNTIME_V2` OS-account authority;
6. the zero-input aggregate composition opener, which independently reproduces
   the base Node/npm host projection, opens all four leaf authorities, performs
   two equal full captures, and issues the production capability.

The existing Node-toolchain installer currently treats every unrecognized
sibling beneath the shared bootstrap parent as a conflict. Therefore V or R
must not be installed by merely widening the Node installer allow-list. The
registry owns the exact sibling namespace, package-specific lifecycle basename
sets, and one shared parent lock. Unknown siblings still fail closed; a package
installer may mutate only its own registered generation while holding the
shared lease. Node installation and rollback must first be characterized and
migrated to that registry without changing the existing Node package identity.

The native verifier is not compiled on the production host. Its distribution is
selected from a code-owned architecture catalog and admitted through exact
artifact hash, byte length, source-tree hash, build-recipe hash, and authenticated
build-attestation policy. The external bootstrap root is a notarized
Developer-ID-signed Setfarm installer distribution plus macOS AMFI enforcement
of V's designated requirement. V's first fixed operation is a native
`SELF_ATTEST_V2` result that binds its running executable, embedded release key,
complete ABI, build attestation, and admitted descriptor identity. Missing,
downgraded, or unauthenticated distribution evidence is a typed
bootstrap-unavailable result. Raw caller bytes, current-source builds, ambient
compiler discovery, shell launch, `PATH`, and an authenticated-Node substitute
are forbidden. The latter would make V depend on the same Node runtime it is
meant to independently check.

The verifier and release packages each carry an exact root-owned manifest,
every-and-only directory membership, provisioning receipt, member hashes/modes,
and physical root identity. Public receipts contain stable refs and hashes, not
locators. The xattr observer and clearer are two logical roles bound to the same
physical `/usr/bin/xattr` receipt. Package membership binds manifest entry and
root/directory identities without referring back to the aggregate receipt, so
the identity graph is acyclic.

V also owns a read-only, versioned `LOOKUP_LOCAL_ACCOUNT_V2` ABI implemented
with native account lookup rather than parsed `dscl`/`id` prose. Account
creation, update, and deletion remain the exclusive responsibility of the
separate root-only provisioner package installed at
`/Library/Application Support/Setfarm/bootstrap/runtime-account-provisioner-v2`.
It is a notarized, signed native package admitted and physically verified by V,
with exact `PLAN_LOCAL_ACCOUNT_V2`, `APPLY_LOCAL_ACCOUNT_V2`, and
`ROLLBACK_LOCAL_ACCOUNT_V2` ABIs. A production account authority requires its
durable provisioning receipt plus two equal V observations; it never adopts an
unreceipted and unclaimed pre-existing record, repairs a mismatch, or accepts
caller UID/GID. An exact active preclaim is the only receipt-recovery authority.

Shared-lock cutover is explicit. The legacy Node package lock remains an
immutable package sentinel because existing Node receipts bind it. A new
registry activation receipt and shared parent lock are published while holding
both locks. After activation, new operations acquire shared lock first and then
their package lock. Pre-registry Node binaries see the activation receipt as
foreign state and fail before mutation. V/R/account installation is forbidden
until a fresh migration receipt proves the cutover. Rollback may return only to
a registry-aware compatibility release; the activation receipt is not removed
while any registered lifecycle or rollback history exists.

The registry also owns durable monotonic per-package distribution-epoch floors.
The fixed epoch-floor state is itself the sole receipt-last authority: updates
are claim-first and atomically replace that state under the shared lock, without
an unbounded receipt namespace. Removal never lowers a floor; an older exact
artifact can run only with a distinct offline-signed rollback authorization
bound to the current floor and target artifact.

The B5D-0a ten-role aggregate receipt is a mechanics fixture, not the production
leaf topology: it models one installed root and one tools parent. Production
B5D-0b uses separate strict V, R, S, and A schemas because `/usr/bin/xattr` and
`/usr/bin/sandbox-exec` are anchored under `/usr/bin`, while `/bin/ls` and
`/bin/chmod` are anchored under a distinct `/bin` physical parent. The two xattr
roles remain logical aliases of one physical file.

The existing single-root constructor remains structurally test-only. An
`origin` string never proves package provenance. No B5D-1 production operation
may execute until all B5D-0b leaf authorities exist and the zero-input aggregate
opener succeeds. B5D-1 mechanics may be exercised with the non-promotable test
authority, but those results cannot unlock production composition.

### B5D-1 — Operational Evidence ABIs

Add authenticated, fixed-argv, no-shell, bounded host operations for metadata,
network negative probing, and module/export loading. Each operation revalidates
its exact host files and output root before and after execution. Production
failure is terminal; the same unchanged physical authority is not reset for
another attempt.

First add a zero-input `PlatformReleaseRequiredModuleClosureV2` covering every
actual launcher, runner, network, codec, receipt, and adapter implementation
module/export. Each export binds name, runtime kind, and a code-owned semantic
verification policy; bootstrap source/hash pairs and zero-input catalog
projections are not reduced to name-presence checks. Existing declarative
catalog hashes without implementation locators are insufficient module
authority. It is an exact 17-entry stable manifest component, while
per-occurrence ESM load/export results remain in the attestation. The
test-fixture-only command runner and definition-only entries retain explicit
production blockers; an empty operational adapter catalog is never promoted
into a fictional implementation.

The candidate binder remains non-authoritative: it accepts observed refs only
to construct a strict, hashed candidate. Production composition derives those
refs from the freshly recaptured output capability. The manifest stores the
complete-tree binding rather than duplicating every tree entry; the terminal
writer and B6 verifier join all 17 refs to fresh captured tree entries.

### B5D-2 — One-Shot Composition And Ownership Transfer

The composer claims the pair before its first `await`, derives every artifact
from private observed state and zero-input definitions, terminal-writes one
selected output, transfers the complete selected private-parent/output-root
slot to transaction ownership, destroys the second output and remaining
source/toolchain/scratch context, and only then transitions
`dependency_materializing -> release_completed` and transfers the slot to the
completed handle. The predecessor remains only as a pathless completed
tombstone; later disposal cannot re-enter cleanup or reach the transferred
slot.

No production path getter is added. The terminal writer's JSON/path/callback
entry becomes explicit test-only issuance with a distinct non-promotable handle.
Production terminalization is a low-level authenticated physical operation
that returns no completed authority. Only the pair-adjacent composer may turn
its sealed-root evidence into the production completed handle.

Because test source admission deliberately has no production
`SourceAdmissionReceiptV2`, test composition returns a distinct structurally
non-promotable completed-test handle/envelope. It must not synthesize a
production receipt or enter B5E.

The production attestation extends the existing source/toolchain/two-build
evidence with the full host-composition admission receipt and two exact
occurrence records. Each occurrence owns its dependency-install evidence,
materialization receipt and physical/binding identity plus metadata, network,
and module-export receipts. The schema compares only their code-defined stable
projection for equality and requires their process/physical identities to be
distinct. Terminal seal/publication evidence is recorded by B5E after
terminalization; it is not placed in the pre-write attestation and therefore
cannot create a self-referential hash.

The normative detail is
`docs/superpowers/specs/2026-07-26-platform-release-composition-authority-v2-design.md`.

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

Migrations 22 through 26 already exist. Release-store persistence starts at
migration 27 or later. Prepared-handle restart rehydration requires both the
exact durable database record and a full fresh store reproduction while holding
store authority; a row, path, or JSON object alone cannot recreate authority.

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

Before RegistryV2 can be issued, replace the command runner's
`issueCommandEvidenceRunnerAuthorityV2ForTest` and
`publishCandidateEvidenceV2ForTest` path with a verified-release-owned
production execution lease and the canonical durable evidence publication
batch authority. This is a required production slice, not an optional adapter:
generated test-command evidence is part of acceptance. It accepts no caller
store, runtime path, catalog, or release identity. The existing test issuer
remains structurally test-only.

`compileEvidenceAdapterRegistryV2` accepts only
`VerifiedPlatformReleaseV2`. It derives producer, release, catalog, adapter,
runner, executable, profile, transport, and support fields from private verified
state. Public input contains none of them.

Registry verification recompiles from the verified brand and compares canonical
bytes. Registry V1 remains historical read-only. No V1 fallback or dual active
registry is permitted. Registry compilation fails closed while any required
runner retains `test_fixture_runtime_blocked`; it cannot publish a partially
usable RegistryV2 or silently omit command evidence.

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
   - B5D-0a test-scoped composition mechanics and private host retention;
   - B5D-0b shared bootstrap namespace/serialization, authenticated native
     verifier distribution, installed verifier/release packages, system
     anchors, and durable runtime-account authority;
   - authenticated operational ABIs frozen before the release package and
     observed
     runtime/external/environment/catalog builder;
   - authentic terminal-writer input.
5. `feat(release): publish immutable content`
   - release-store leases, rename/adoption, separate attestation CAS, prepared
     brand.
6. `feat(release): verify fresh release authority`
   - independently installed verifier capability, full recapture, verified
     brand.
7. `feat(evidence): derive registry v2`
   - verified-release-owned production command lease and durable publisher;
   - verified-release-only complete catalog and RegistryV2.

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
