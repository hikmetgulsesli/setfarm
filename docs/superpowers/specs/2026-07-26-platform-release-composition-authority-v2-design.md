# Platform Release Composition Authority V2

Date: 2026-07-26
Status: approved refinement of the Product Compiler V3 release plan

## Purpose

B5C now produces one authentic, pathless
`PlatformReleaseDependencyMaterializedPairV2`. It owns two independently built
and dependency-materialized output roots behind private state. It does not yet
contain enough host authority to truthfully produce a release manifest.

The current complete manifest fixture supplies release bootstrap, metadata,
network, runtime user, catalog, and module evidence as caller-authored JSON.
The current terminal writer verifies that such JSON matches one stage tree, but
it does not prove that the JSON came from the authentic B5C producer. Treating
that path as production would repeat the system defect this architecture is
intended to remove: missing upstream authority would be replaced by a late
validator.

This design adds the missing producer boundary before release composition.

## Evidence

The following facts are proven in the current source:

- the dependency pair retains authentic source, toolchain, compiled
  occurrences, dependency materializations, and physical output identities in
  module-private state
  (`src/execution/platform-release-source-admission-v2.ts:704-769`);
- pair inspection is pathless and production roots are exposed only through a
  test callback (`:7871-8188`);
- the declared `dependency_materializing -> release_completed` transition has
  no producer (`:338-346`, `:2695-2721`);
- external runtime resolution requires independently admitted bootstrap files,
  runtime UID/GID, exact host identity, and executable closure
  (`src/execution/schemas/external-runtime-resolution-v2.ts:120-215`);
- the environment capsule requires exact metadata tools/bootstrap and network
  authority
  (`src/execution/schemas/evidence-environment-capsule-v2.ts:56-165`);
- the existing network context is explicitly `test_fixture` and forbidden for
  production (`src/execution/network-sandbox-v2.ts:435-554, 694-700`);
- the terminal writer currently accepts caller-authored root, manifest,
  attestation, and metadata callback
  (`src/execution/platform-release-terminal-writer-v2.ts:158-203, 712-769`);
- live read-only preflight found migration max 21, 78 semantic artifacts, zero
  platform-release artifacts, zero release CAS discriminators, and no release
  store tables or configured production release root.

## Decision

Keep the approved linear authority chain. Add one private composition
sub-authority to the existing authenticated host authority:

```text
PlatformReleaseHostNodeToolchainAuthorityV2
  owns private PlatformReleaseHostCompositionAuthorityV2

AdmittedPlatformReleaseSourceStageV2
  -> PlatformReleaseBuildToolchainCapsuleV2
  -> PlatformReleaseCompiledOutputPairV2
  -> PlatformReleaseDependencyMaterializedPairV2
  -> CompletedPlatformReleaseStageCandidateV2
```

The composition sub-authority is not a second caller argument. It is installed,
authenticated, retained, and freshly revalidated by the same host owner that
already supplies the exact Node/npm process authority. The build capsule carries
the host handle privately, so the dependency pair can reach the composition
sub-authority without accepting a path, JSON candidate, executable name,
runtime UID, policy, catalog, receipt, or callback from its caller.

This preserves the approved invariant that only the dependency-materialized
pair can derive the complete release.

### Selected production provenance DAG

The production composition authority is an aggregate of four separately owned
leaf authorities. The single-root `ForTest` fixture is not its installation
model.

```text
zero-input lower host projection N
  + installed verifier package V
  + installed release-composition package R (verified by V)
  + fixed Darwin system anchors S (verified by V)
  + durable runtime-account authority A (observed by V)
  -> production composition authority C
```

`V` is rooted at
`/Library/Application Support/Setfarm/bootstrap/host-composition-verifier-v2`
and contains an exact root-owned manifest plus a native verifier executable.
The executable must not acquire ambient Node, shell, or `PATH`; otherwise its
interpreter and non-system dynamic-library closure become additional admitted
members.

The verifier executable is not compiled on the production host. One
code-owned per-architecture distribution catalog binds exact artifact hash and
length, source-tree hash, build-recipe hash, ABI hash, and authenticated
build-attestation policy. The external root of trust is the notarized
Developer-ID-signed Setfarm installer distribution and macOS AMFI enforcement
of V's exact designated requirement, Team ID, hardened-runtime policy, and
library-validation policy. The signed installer carries an offline-release-key
attestation over the source tree, build recipe, ABI, per-architecture bytes,
minimum distribution epoch, and package manifest. The corresponding public key
and designated requirement are code-owned policy inputs and are also embedded
in V.

The installed-package builder accepts only an opaque distribution handle
recovered from that signed installer payload and its authenticated installer
receipt. It accepts no raw bytes, compiler locator, command, environment,
current-source module, or callback from a caller. V's complete V2 ABI is frozen
before distribution authentication and includes `SELF_ATTEST_V2`,
`VERIFY_PACKAGE_V2`, `VERIFY_SYSTEM_ANCHORS_V2`, and
`LOOKUP_LOCAL_ACCOUNT_V2`. Its first execution is `SELF_ATTEST_V2`; AMFI admits
the process, and the native result binds the running executable identity,
embedded release key, complete ABI hash, build attestation, and the parent's
descriptor capture. A distribution epoch below either the code-owned minimum
or registry-owned durable installed floor fails closed. Package removal does
not lower that floor; reinstalling an older epoch requires a distinct
offline-signed rollback authorization bound to the current floor, exact target
artifact, host policy, and expiry. If any signature, installer receipt, catalog
entry, self attestation, or build evidence is absent, production composition
remains typed unavailable.

`R` is rooted at
`/Library/Application Support/Setfarm/bootstrap/platform-release-composition-v2`
and contains an exact root-owned manifest, release executable, release module,
metadata module, and network wrapper module. Its manifest binds every-and-only
member refs, content/mode/media identity, required export names, operation ABI
hashes, provisioning receipt, root physical identity, and directory
membership.

`S` admits exact `/usr/bin/xattr`, `/bin/ls`, `/bin/chmod`, and
`/usr/bin/sandbox-exec` files plus the exact `/usr/bin` and `/bin` parent
identities. It does not claim every-and-only membership of those operating
system directories. Xattr observe and clear are two logical bindings to the
same physical xattr receipt; ACL observe and clear bind the distinct `ls` and
`chmod` receipts.

`A` resolves only the durable
`SETFARM_PLATFORM_RELEASE_RUNTIME_V2` account and binds its provisioning
receipt, host identity, UID, GID, record identity, primary-group identity,
provisioner-package identity, and V observation. V exposes a read-only,
versioned `LOOKUP_LOCAL_ACCOUNT_V2` ABI using native account lookup. Account
mutation belongs to a separate fixed-root, root-only native package at
`/Library/Application Support/Setfarm/bootstrap/runtime-account-provisioner-v2`;
V cannot create, update, repair, or delete an account. The provisioner package
has an exact root-owned canonical manifest, every-and-only `.`/`bin` layout,
one signed native executable, distribution/build attestation, installation
receipt, physical root identity, and fixed
`PLAN_LOCAL_ACCOUNT_V2`/`APPLY_LOCAL_ACCOUNT_V2`/`ROLLBACK_LOCAL_ACCOUNT_V2`
ABI hashes. It uses direct native directory-service APIs, never shell,
`PATH`, `dscl`, `id`, or caller command text. It is authenticated by the same
external signed-installer policy as V and then independently admitted and
physically verified by V before any mutation. A accepts no caller UID/GID,
never adopts an existing record without its exact durable provisioning receipt
or matching active preclaim, and requires both values to be nonzero and
distinct from every root-owned composition file owner. Issuance requires two
equal V observations around the durable receipt and host fences.

Account provisioning is receipt-last and crash recoverable. Before mutation the
root-only provisioner obtains two equal V absence observations, chooses the
identity from the fixed record policy, and durably publishes a
generation-specific preclaim containing the exact account name, group name,
UID, GID, record UUIDs, host identity, provisioner-package identity, V identity,
and intent hash. It then performs direct native directory-service mutation,
observes the exact result twice through V, and publishes the durable receipt
last. Recovery may finalize an exact record only when it matches the active
preclaim byte-for-byte. Cleanup may delete only identities proven to belong to
that same generation, records a tombstone, and otherwise fails terminally
without touching the record. An unreceipted record with no authentic matching
preclaim is foreign state, not an adoption candidate.

Package member receipts bind their leaf package ref, manifest hash, manifest
entry hash, root identity, directory membership, content hash, physical
identity, and verifier identity. They do not bind the leaf or aggregate receipt
hash back into the member identity. Thus the aggregate identity is acyclic:

```text
V = H(host, authenticated native distribution, verifier manifest,
      verifier physical closure, verifier ABI)
R = H(host, V, release manifest and physical closure)
S = H(host, V, fixed system anchors and logical bindings)
A = H(host, V, account provisioner package, durable account provisioning,
      two equal native account observations)
C = H(N, V, R, S, A, operation ABIs)
```

### Shared bootstrap namespace and transaction authority

The Node provisioner, V, R, and the account provisioner share
`/Library/Application Support/Setfarm/bootstrap` as their physical parent.
The existing Node installer owns a package-specific census: it rejects every
sibling that is not one of its root, receipt, claim, lock, staging, or rollback
receipt names. Therefore installing V or R before changing that contract would
make the next Node inspect/install/rollback classify valid platform state as
foreign corruption.

B5D-0b first adds one code-owned bootstrap-package registry and shared parent
serialization authority. The registry contains the exact package refs, fixed
roots, active receipt/claim/staging basenames, rollback-receipt namespace, and
shared lock identity. It is not caller configuration. A package operation:

1. acquires the shared parent descriptor lease;
2. reproduces the exact registry and parent identity;
3. classifies every parent entry to exactly one registered package lifecycle
   or the shared lock;
4. rejects unknown, ambiguous, malformed, or transplanted state;
5. mutates only its own registered lifecycle generation;
6. re-captures the full parent namespace before releasing the lease.

Node migration preserves its existing package and receipt identities, including
the package-specific legacy lock that those receipts already bind. Cutover uses
a registry activation receipt and a new shared parent lock:

1. while no registered sibling exists, the migrator acquires the legacy Node
   lock, reproduces the complete Node lifecycle and parent census, and creates
   then acquires the shared lock while the legacy lease is still held;
2. no steady-state registry-aware operation may start before activation, so
   this one-time `legacy -> shared` acquisition cannot form a lock cycle;
3. the migrator durably publishes the registry activation receipt last, binding the
   registry version, shared-lock identity, legacy-lock identity, Node lifecycle
   identity, and parent identity;
4. registry-aware operations thereafter acquire shared lock first and then
   their package lock;
5. pre-registry Node binaries classify the shared lock or activation receipt as
   foreign state and therefore fail before mutation;
6. V, R, and account-provisioner installation require a fresh authentic
   activation receipt and may not race the cutover.

The legacy Node lock remains as an immutable package sentinel and continues to
protect its existing receipt identity; it is not a competing parent
serialization mechanism. A crash after shared-lock creation but before
activation is a typed incomplete migration: old binaries remain fail-closed,
and only the same migrator may resume under the legacy lock and exact shared
lock identity. The activation receipt is irreversible while any registered
sibling state or history exists. A rollback may disable the new leaves but may
return only to a registry-aware compatibility version. Merely adding V/R names
to a local allow-list is rejected because it would provide no cross-package
serialization, ownership, cutover, or rollback boundary.

The registry additionally owns the fixed root-owned files
`bootstrap-package-registry-v2.activation-receipt.v2.json`,
`bootstrap-package-registry-v2.epoch-floor.v2.json`, and
`.setfarm-bootstrap-package-registry-v2.epoch-claim.v2.json` beneath the shared
bootstrap parent. Activation publishes the exact genesis epoch state with
generation zero, null prior-state hash, and one entry for every registered
package using epoch zero and a null artifact hash. Every later strict epoch
state contains the registry version, monotonically increasing generation,
prior-state hash, transaction identity, and exact canonical map from package
ref to highest admitted distribution epoch and artifact hash. The fixed state
file is itself the sole receipt-last authority; there is no separate or
generation-named epoch receipt namespace. It is updated only while holding the
shared lease:

1. reproduce the activation receipt, current epoch state, package lifecycle,
   and exact absence of another epoch claim;
2. durably publish a claim binding prior state, target state, package install
   generation, and any offline rollback authorization;
3. finish or recover the bound package installation without issuing its
   production authority;
4. atomically publish the exact target epoch state last with no unrelated
   package-floor change;
5. issue the package authority only after reproducing that state, then remove
   only the exact claim.

If a crash leaves a claim, recovery may finalize only the exact prior-or-target
state and matching package generation. Any third state is terminal corruption.
Removing or rolling back package bytes never lowers the highest-seen floor. An
older artifact is executable only under an exact offline-signed rollback
authorization; the durable floor remains unchanged and the V/installation
receipt binds the authorization hash. The public registry receipt is a pathless
projection of the fixed state hash; package receipts bind that epoch-state hash
and expose no locator.

Descriptor capture and sealed-root publication mechanics become shared internal
primitives, while each package keeps its own strict manifest/layout/schema and
typed lifecycle. The physical primitive owns `O_NOFOLLOW|O_NONBLOCK`,
descriptor/path/parent fences, bounded exact read plus EOF, BigInt
nanosecond fingerprints, every-and-only membership, buffer zeroing, and
two-capture equality. The publication primitive owns claim-before-root,
exclusive staging, fsync, atomic no-replace publication, receipt-last,
generation-specific rollback, and exactly-one cleanup ownership. Neither
primitive exposes a generic production opener, path-bearing receipt, or
caller-supplied policy.

The B5D-0a single-root aggregate receipt remains a non-promotable mechanics
fixture. Production uses separate V, R, S, and A schemas. In particular, S
binds two distinct parents: `/usr/bin` for xattr and sandbox-exec, and `/bin`
for ls and chmod. The xattr observer and clearer are two logical bindings of
one physical xattr receipt; they are not duplicate physical members.

The no-input composition opener privately opens the lower root-owned Node/npm
bootstrap and reproduces `N`; the outer platform host owner compares the
resulting composition projection to its own `N` across a before/after fence.
It does not accept `N`, a host handle, a path, or a receipt from a caller.
The existing outer Node/npm receipt intentionally remains the Node/npm identity;
`C` enters the B5D production attestation as separate canonical operational
evidence. This avoids both an identity cycle and a retroactive B5C receipt
mutation.

## Rejected Boundaries

### Public host-composition argument

Rejected. A composer accepting `pair + host JSON/handle` would let the caller
mix authorities after B5C and would weaken the linear chain.

### Manifest-first composer

Rejected. Building manifest factories before production metadata/network/runtime
authority exists would turn fixture values into apparent platform evidence.

### Path getter from the dependency pair

Rejected. A production root getter would split ownership across modules, create
TOCTOU and double-delete windows, and permit a stale predecessor to outlive its
successor.

### Semantic artifact CAS for release bytes

Rejected. B5E release content has different ownership, restart, immutability,
and attestation-occurrence semantics. It remains a separate store.

## Host Composition Sub-Authority

Add a versioned, bounded, pathless inspection schema and an opaque operational
handle. Private state owns exact physical file anchors and operational
capabilities.

The authority contains:

- one separately installed root-owned release bootstrap executable and module;
- the existing authenticated Node executable and npm authority;
- exact metadata bootstrap module and export;
- exact `xattr` observer/clear executable, ACL observer executable, and distinct
  ACL clear executable;
- exact sandbox executable, network wrapper module, wrapper export, and
  canonical sandbox policy;
- one code-owned unprivileged runtime UID/GID identity distinct from every
  root-owned bootstrap/tool file;
- exact macOS product/build/kernel identity;
- exact non-system dynamic library closure;
- one verifier identity shared by every host-owned file receipt;
- versioned metadata, network, and module-export receipt ABI identities.

Composition host files use a composition-specific exact physical-file receipt.
It supports read-only `0444`, executable `0555`, and system executable `0755`
members. It must not widen `ExactHostOwnedFileRefV2`, whose existing
`0444|0555` contract is already part of release V2 schemas. The composition
receipt binds descriptor-captured device/inode, owner/group, mode, single-link
count, byte length/hash, timestamps, parent identity, verifier binding, and
every-and-only installed-package membership.

Public inspection contains hashes, counts, stable refs, host identity, runtime
UID/GID, policy hashes, and lifecycle state. It contains no filesystem path,
file descriptor, environment, command, nonce, mutable callback, or constructor
capability.

The production constructor:

1. requires the root-owned release producer before acquiring a lifecycle;
2. obtains installed paths only from the independently installed bootstrap
   authority, never caller input or ambient `PATH`;
3. anchors every file and parent, requires exact mode/UID/GID/link count, reads
   bounded bytes from descriptors, and records device/inode/content identity;
4. proves one host/verifier identity across all file receipts;
5. proves the runtime UID/GID exists, is unprivileged, and differs from the
   release owner;
6. issues the opaque authority only after a second full capture is equal.

Tests use a separate `ForTest` constructor with temporary roots and
`test_fixture` scope. A test-scoped authority can never enter the production
composer.

The repository currently has an independently installed Node-toolchain
provisioner package, but no release-composition bootstrap package, durable
runtime-account receipt, or installed host verifier. That Node provisioner
must not be relabeled as the release bootstrap. Until a separately packaged
fixed-root release bootstrap and runtime-account authority exist, the
production composition opener is deliberately unavailable and returns a typed
bootstrap-unavailable failure. It must not fall back to fixture UID/GID,
`/usr/local/libexec` guesses, current source files, ambient `PATH`, or the
calling process identity.

## Operational ABIs

### Metadata probe

Replace direct ad hoc `xattr`/`ls`/`chmod` use as release evidence with one
authenticated host operation. The operation owns fixed executable refs, argv,
environment, timeout, stdout/stderr caps, and receipt parser.

It revalidates bootstrap and tools before and after execution and emits a
versioned receipt containing:

- probed root binding hash;
- exact tool and bootstrap hashes;
- canonical clear-policy hash;
- observed xattr/ACL state;
- process termination and bounded output hashes;
- occurrence identity outside stable release content.

Tree normalization may continue to use internal metadata mechanics, but the
manifest/environment claim is derived only from this admitted operation.
ACL observation and mutation are distinct roles: the current implementation
observes with `ls` and clears with `chmod`; one executable cannot be claimed as
both merely because a fixture used that value.

### Network negative probe

Refactor the existing sandbox engine into a scope-independent internal
operation. Production context construction receives only authentic private host
and output capabilities. The existing public `ForTest` context remains
test-only.

Production failure is terminal for the composition attempt. It never resets the
same authority to `ready`. Scratch roots are anchored, identity-checked, and
cleaned with the same hostile-replacement preservation policy as B5C.

### Module export probe

Add one authenticated Node operation with fixed no-shell argv and deny-all
environment. It loads every required launcher, runner, codec, receipt, adapter,
and network module from each output independently.

The result binds:

- canonical module locator;
- observed module bytes;
- exact required export name and runtime kind;
- the code-owned verification policy and its semantic outcome;
- module load success and zero-input projection hash where required;
- bounded process evidence;
- output occurrence identity.

The two stable export projections must be canonical-byte equal. Process and
physical occurrence evidence must remain distinct.

Before this probe exists, add one zero-input
`PlatformReleaseRequiredModuleClosureV2`. It names every runtime implementation
module locator and required export actually consumed by launchers, runners,
network isolation, invocation codecs, receipt handling, and adapters. A
declarative catalog hash without an implementation locator/export is not module
authority. The closure is reproduced from code-owned definitions and observed
bytes; the composer cannot accept or infer entries.

The canonical V2 closure is one exact ordered 17-entry tuple:

1. CLI bootstrap-source module;
2. HTTP bootstrap-source module;
3. adapter-definition catalog module;
4. evidence-definition catalog module;
5. delivery-profile catalog module;
6. invocation-codec catalog module;
7. invocation-codec runtime module;
8. invocation-evidence evaluator;
9. CLI launcher;
10. HTTP launcher;
11. network sandbox with both `runNetworkIsolatedV2` and the actual
    `acquireNetworkSandboxLaunchContextInternalV2` runtime export;
12. evidence-receipt ABI module;
13. durable evidence-result ABI module;
14. CLI runner;
15. command runner;
16. HTTP runner;
17. invocation-runner core used by the thin CLI/HTTP runners.

Each entry binds required export `{name, kind}` records plus one code-owned
verification policy. Bootstrap policies prove source/hash pairs; catalog and
ABI policies execute zero-input exports and compare their canonical projection
to the manifest; runtime policies require exact function kinds. Entries are
tagged `runtime`, `bootstrap_source`, `code_owned_definition`, or
`test_fixture_runtime_blocked`. The command runner is currently the final
blocked category because its issuer/publication path is test-only. The
adapter-definition catalog currently declares an empty operational catalog and
production blockers; the closure proves those exact definition bytes but must
not claim that a missing production RegistryV2 adapter implementation exists.
Static transitive imports remain covered by the complete platform tree hash and
ESM linking; they are not inflated into caller-selected closure entries.

`PlatformReleaseRequiredModuleClosureV2` becomes an explicit stable manifest
component. The module-export occurrence receipts bind its closure hash, exact
module-ref hashes, required export sets, load outcomes, and first/second output
identities outside stable release content.

The exported candidate binder is deliberately not an admission authority. It
strictly snapshots and hashes a complete candidate, but production composition
must derive every module ref from a fresh canonical output-tree capability and
must not accept the binder's refs from a caller. `PlatformRuntimePayloadV2`
stores a full-tree binding, not the entry list. Therefore the manifest schema
joins the closure to that binding and to all catalog/environment identities,
while the terminal writer and B6 verifier independently recapture the tree and
join every one of the 17 module refs to an actual file entry. Duplicating the
tree entry list in the stable manifest solely to make the candidate parser look
authoritative is rejected.

## Code-Owned Composition

Pure internal builders derive candidates from observed state. They accept no
unknown or caller-authored DTO:

- runtime payload from fresh `dist`, dependency, and package bindings;
- external resolution from production closure plus host composition authority;
- environment capsule from metadata and network authorities;
- launcher/runner/module catalogs from zero-input definitions and observed
  module bytes/exports;
- one complete build receipt for each occurrence;
- one stable manifest from the common deterministic projection;
- one occurrence attestation containing both distinct build receipts.

Every builder:

- constructs the exact identity without its self-hash;
- computes the domain-separated hash;
- passes the bounded strict schema/parser;
- returns a recursively frozen object;
- compares its two occurrence-stable projections before returning.

No builder may read an environment variable, resolve `PATH`, accept a default
catalog, trust a fixture, or infer a missing field.

The production attestation extends its existing exact source admission,
toolchain, and two build receipts with:

- the full authenticated host-composition admission receipt and its hash;
- the required-module requirement and closure hashes;
- an ordered first/second occurrence tuple, each containing the full host
  dependency-install evidence, full npm materialization receipt, dependency
  physical identity and output binding, metadata-probe receipt,
  network-negative-probe receipt, module-export receipt, and each receipt hash;
- the exact output occurrence and physical identities already joined by the
  corresponding build receipt.

Its strict refinement requires both occurrences to bind the same source,
toolchain, host-composition authority, requirement, closure, runtime,
dependency graph, environment, and catalog projection. Their process,
filesystem, dependency-install, metadata, network, and module-load occurrence
identities must be distinct. Equality is computed from one explicit stable
projection; it is never inferred by dropping fields ad hoc.

Terminal sealed-root evidence is not part of this pre-write attestation. B5E
records the later seal/publication receipt and binds it to the already fixed
manifest and attestation hashes. Putting terminal evidence into the object
whose bytes must exist before terminalization would create a circular identity.

Test source admission intentionally has no production
`SourceAdmissionReceiptV2`. Therefore the test composition path produces a
distinct `CompletedPlatformReleaseStageCandidateForTestV2` and test envelope.
It exercises physical, concurrency, equality, and cleanup mechanics but cannot
be parsed, cast, serialized, or passed to B5E as a production completed handle.
Tests must never synthesize a production source receipt to close this gap.

## One-Shot Ownership Transaction

Composition remains adjacent to the private dependency-pair registry. It does
not export pair internals.

The transaction is:

```text
pair.ready + source.dependency_materializing
  -> pair.consuming
  -> fresh pair and host revalidation
  -> metadata, network, and module-export probes for both outputs
  -> pure candidate construction and equality joins
  -> terminal manifest write on selected first output
  -> complete selected output slot transferred to transaction ownership
  -> second output, source, toolchain, and scratch cleanup
  -> pair.consumed + source.release_completed
  -> selected output slot transferred to completed-handle ownership
  -> CompletedPlatformReleaseStageCandidateV2
```

The pair claim occurs before the first `await`. A second compose, dispose, or
revalidate call receives a typed in-flight/consumed result and cannot perform
destructive recovery.

Success transfers exactly one selected output slot: both its anchored private
parent and its anchored output root. The old source cleanup registry is updated
atomically with a non-owning transferred tombstone so later predecessor
disposal cannot delete it. The composition transaction owns that slot while it
removes the second output and every remaining private source/toolchain/scratch
root. Only after cleanup and the `release_completed` transition does ownership
move from the transaction to the completed handle.

The source handle remains a pathless `release_completed` tombstone with no
physical ownership. Inspection may return its immutable admission receipt, but
every materialization/revalidation API treats it as stale. Explicit source
disposal after successful composition only retires this tombstone; it cannot
re-enter physical cleanup or reach the transferred slot.

Any failure before ownership transfer destroys the full source context. A
failure after terminal bytes exist must end in one of two explicit states:

- selected candidate root still owned by the composition transaction and
  removed; or
- selected root registered under the completed handle and every predecessor
  permanently consumed.

An unowned terminal root is forbidden.

## Terminal Writer Boundary

Preserve the terminal writer's exclusive create, no-follow checks, canonical
write, file fsync, directory fsync, reread, root revalidation, and read-only
finalization. In production it is a physical operation, not the authority
issuer: it returns sealed-root evidence to the still-owning composition
transaction, and only the pair-adjacent composer can issue the completed
handle.

Split issuance:

- production terminalization is an authenticated low-level primitive whose
  result is non-authoritative sealed-root evidence; it cannot issue a
  completed handle on its own;
- caller-authored JSON/path/callback writing is explicitly `ForTest` and returns
  a distinct non-promotable test-candidate handle;
- only the authentic production path can issue
  `CompletedPlatformReleaseStageCandidateV2` accepted by B5E.

The completed private state retains admission scope, predecessor/composer
identity, the selected private-parent plus output-root anchors, manifest,
attestation, canonical manifest bytes, metadata/network occurrence receipts,
and cleanup ownership. Public inspection remains pathless.

## Failure Taxonomy

Composition uses typed producer-owned categories:

- `HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE`;
- `HOST_COMPOSITION_AUTHORITY_INVALID`;
- `RUNTIME_IDENTITY_INVALID`;
- `METADATA_PROBE_FAILED`;
- `NETWORK_PROBE_FAILED`;
- `MODULE_EXPORT_INVALID`;
- `PAIR_SOURCE_DRIFT`;
- `STABLE_OUTPUT_MISMATCH`;
- `MANIFEST_INVALID`;
- `ATTESTATION_INVALID`;
- `TERMINAL_WRITE_FAILED`;
- `OWNERSHIP_TRANSFER_FAILED`;
- `CLEANUP_FAILED`;
- `ALREADY_CONSUMED`.

Low-level causes remain attached. No error-message regex or agent prose decides
the category. The no-input production opener reports
`HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE` when the fixed-root release bootstrap,
installed verifier, or durable runtime-account authority is absent; it never
normalizes that state into generic invalid input and never selects a fallback.

## Compatibility

All release V2 identities remain pre-first-durable-write. Immediately before the
first production publication, a fail-closed preflight must prove:

- zero matching semantic artifact rows;
- zero V2 manifest/attestation CAS envelopes;
- zero release directories or attestation files;
- zero release-store authority/publication tables or rows;
- no active release writer.

If any occurrence exists, the identity-breaking chain advances together to V3:
npm receipt, production closure/graph, external/environment artifacts, build
receipt, attestation, manifest, envelope, completed handle, and store records.
Historical readers stay exact, bounded, and read-only. No rewrite, adapter, V1
fallback, or dual publication is allowed.

Migrations 22 through 26 already exist in source. B5E release-store persistence
therefore starts at migration 27 or later, never migration 26.

## Verification Matrix

Unit:

- forged, proxied, serialized, mixed-scope, and caller-authored authorities
  fail before side effects;
- exact schema/hash/cap/freeze tests for host and operation receipts;
- runtime UID/GID is host-derived, unprivileged, and distinct from owner UID;
- production APIs expose no JSON/path/callback issuance path.

Filesystem and process:

- missing/wrong bootstrap, tool, module, export, mode, owner, link count, or
  dynamic library fails;
- root/parent/file replacement and swap-and-restore at every async boundary;
- metadata and network scratch replacement is preserved, never recursively
  deleted as trusted state;
- two output occurrences produce equal stable catalogs and distinct occurrence
  evidence.

Concurrency and fault:

- two compose calls have exactly one winner;
- compose versus dispose/revalidate has deterministic typed outcomes;
- faults after claim, each probe, each builder, terminal file write/fsync/root
  seal, second-root cleanup, source cleanup, and completed registration;
- every fault leaves exactly one known owner or no candidate root.

End to end:

- authentic B5C test pair to complete manifest/attestation and terminal handle
  with zero caller JSON/path;
- current release module set with exact ESM export proof;
- test authority can exercise mechanics but cannot issue a production-scoped
  completed handle;
- B5E accepts only the authentic completed handle.

## Implementation Order

1. Add the candidate-only zero-input required runtime-module closure, bind it
   into runner toolchain identity and the manifest, and require terminal
   physical recapture of all entries.
2. Add the B5D-0a host-composition receipt schemas, opaque fixture-only
   sub-authority, private host retention, and terminal revalidation ownership.
3. Extract the complete B5D-0b fixed V/R/S/A package and operation ABI contract,
   including native self-attestation, account lookup, distribution epoch and
   rollback policy.
4. Add the code-owned shared bootstrap-package registry, dual-lock activation
   migration, compatibility receipt, and parent serialization authority.
5. Add shared internal descriptor-bounded physical admission and sealed-root
   publication/rollback primitives; migrate the Node installer behind a
   characterization-preserving adapter before another production sibling is
   installed.
6. Add the authenticated per-architecture native verifier and account-
   provisioner distributions, V package build/preparation/install/rollback,
   registry-owned epoch-floor transaction, and zero-input installed V
   authority.
7. Add the installed V-verified root-only account-provisioner package with
   preclaim/recovery, durable A authority, and two-parent Darwin S authority.
8. Implement the authenticated metadata, network, and module-export operation
   ABIs, then build/install R and issue its zero-input authority from the
   already-frozen ABI contract.
9. Add the zero-input aggregate production opener with
   `N-before -> V/R/S/A -> second leaf capture -> N-after` fences.
10. Add pure observed runtime/environment/catalog/build candidate builders and
   the exact two-occurrence attestation extension.
11. Add one-shot pair claim and internal composition state.
12. Split production terminal issuance from the test JSON writer.
13. Implement selected-root ownership transfer and terminal cleanup.
14. Run the full adversarial matrix and update the audit.
15. Begin B5E separate durable release store at migration 27+.

Production activation, live Setfarm runs, Mission Control projection, RegistryV2,
and generated-project recovery remain forbidden during these steps.
