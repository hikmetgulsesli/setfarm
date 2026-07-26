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
- exact `xattr` and ACL-observation executables;
- exact sandbox executable, network wrapper module, wrapper export, and
  canonical sandbox policy;
- one code-owned unprivileged runtime UID/GID identity distinct from every
  root-owned bootstrap/tool file;
- exact macOS product/build/kernel identity;
- exact non-system dynamic library closure;
- one verifier identity shared by every host-owned file receipt;
- versioned metadata, network, and module-export receipt ABI identities.

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
- exact required export names;
- module load success;
- bounded process evidence;
- output occurrence identity.

The two stable export projections must be canonical-byte equal. Process and
physical occurrence evidence must remain distinct.

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
the category.

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

1. Add host-composition receipt schemas and opaque private sub-authority.
2. Add authenticated metadata, network, and module-export operation ABIs.
3. Add pure observed runtime/environment/catalog/build candidate builders.
4. Add one-shot pair claim and internal composition state.
5. Split production terminal issuance from the test JSON writer.
6. Implement selected-root ownership transfer and terminal cleanup.
7. Run the full adversarial matrix and update the audit.
8. Begin B5E separate durable release store at migration 27+.

Production activation, live Setfarm runs, Mission Control projection, RegistryV2,
and generated-project recovery remain forbidden during these steps.
