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

The first implementable admission slice is a serialized native-distribution
contract, not a live capability. It binds the host-verifier package and exact
`BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2` member as the Darwin filesystem backend
provider, requires exactly ordered `arm64` and `x64` entries, and joins each
artifact's exact length/content, code-directory, source-tree, build-recipe,
build-attestation, and package-manifest hashes to the registry contract, global
operation ABI, Darwin backend ABI, capture-transcript contract, positive
distribution epoch, installer identifier, Developer Team/designated
requirement, hardened-runtime, and library-validation policy commitments.
Entry, catalog, and signed-envelope hashes are domain-separated. The signing
preimage is exact bounded canonical bytes and Ed25519 verification rejects a
wrong key identity, malformed/noncanonical signature, tamper, missing or
reordered architecture, cross-package/member splice, and epoch downgrade.

This contract is `productionAuthority:false`. Until a code-owned production
public key and the real installer/AMFI evidence exist, signature verification
is exposed only as caller-supplied-key mechanics and cannot mint or open the
filesystem backend. Developer ID application/installer identities, notarization
ticket, root-owned installer receipt, durable epoch floor, exact installed
binary, and live Security.framework designated-requirement/Team/CDHash/runtime/
library-validation checks remain external prerequisites.

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

The test-only registry join accepts a complete S observation rather than a
free-standing hash relation. Its adapter revalidates the code-owned S parser,
self-hash, equal pre/post snapshots, exact two-parent/four-file/five-role
topology, and false-authority markers, then publishes only a pathless
five-field relation. Raw relations and arbitrary observation hashes are
rejected at the builder boundary; the serialized relation remains
`productionAuthority:false` and is not an S authority. The future aggregate
opener must still obtain S from the installed authenticated V path and perform
the external rejoin before any production capability could exist.

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

The current credential-free A checkpoint is intentionally weaker than this
production contract. A test-only adapter parses one strict fixture
runtime-account receipt and two distinct post-mutation
`LOOKUP_LOCAL_ACCOUNT_V2` presence observations, requires their stable record
projection and receipt UID/GID/host joins to agree, and emits only a frozen
pathless hash relation. It carries no account name, UID/GID, path, credential,
mutation, or capability and is explicitly `productionAuthority:false` with
`trustConclusion:"characterization_only"`. The relation is opaque after
serialization and must be externally rejoined to the original observations;
it does not prove a V-verified installed provisioner, native Directory
Services mutation, durable receipt, preclaim/recovery, or aggregate C.

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

The physical namespace foundation separates three identities that must never be
substituted for one another:

- a stable filesystem-object identity hashes only the persisted bootstrap
  filesystem-scope identity, object kind, device, and inode;
- an occurrence fingerprint additionally binds owner, mode, link count, byte
  length, and unsigned nanosecond modification/change observations;
- a path-entry capture joins one exact logical classification and parent
  identity to the child object, its occurrence fingerprint, and discriminated
  content evidence.

The filesystem scope is a strict self-hashed identity containing the registry
contract and a 256-bit lowercase-hex nonce. A later physical activator will
generate that nonce with an operating-system cryptographic RNG, bind it into
the activation claim and stage, and publish one fixed host-scope registry
document. It is deliberately not derived from V/R/S/A host-composition
authority, so activation has no composition-authority cycle. This foundation
slice defines and validates the pure JSON identity only; it does not yet add a
registry basename, activation-stage member, or reducer transition.

Every physical census carries the full filesystem scope, exact logical census,
parent directory identity and fingerprint, and one physical capture for every
logical entry in the same order. Parent and child scope identities must agree;
the parent is never a child; every child points to that exact parent; and
global direct-child filesystem object locators are pairwise unique. That
domain-separated alias key binds filesystem scope, device, and inode but
deliberately excludes object kind, so a hostile cross-kind relabel cannot hide
a parent/child or child/child alias. A regular file carries bounded raw-byte
content evidence. A directory carries a strict, bounded, self-hashed
direct-membership identity whose entry count equals its uniquely UTF-16-sorted
basename/object-kind members; the empty membership is explicit and valid.
Logical document self-hashes are later semantic joins and never replace
raw-byte or membership evidence. Classification fixes object kind:
transaction/package/generation staging roots are directories and every other
current registry lifecycle entry is an ordinary file. Owner UID/GID are
bounded to `0..4294967294`; every exported compound physical schema enforces
its canonical byte cap even when invoked directly.

Mutable fingerprint equality is not a cross-phase identity fence. A hard-link
publication intentionally changes link count and change time while preserving
device/inode identity. Raw locator aliases are therefore forbidden among
global direct children regardless of the claimed object kind. The activation
reducer models a stage/global alias only as one of the exact code-owned
publication relations described below.

The claimed-package lifecycle view has one source of truth: it is a canonical
filter of the full physical census in global order, binds both source census
hashes, and contains exactly one package lock whose stable object identity is
derived rather than supplied. Node compatibility is an adapter view of this
projection joined to the legacy Node lock and lifecycle semantics, not an
independent Node-only physical capture.

The logical package projection is not the Node lifecycle semantic snapshot.
Its hash proves only the classified package basenames. Every ready/empty
observation derived from that hash states `productionAuthority:false` and
`logical_namespace_projection_only_never_node_semantic_authority_v2`. The
implemented strict, self-hashed Node semantic snapshot separately binds
canonical active claim and receipt bytes, the exact recursive installed tree,
root stable identity and mutable fingerprint, canonical manifest and payload
hashes, ordered canonical rollback receipts and predecessor-history summary,
fixed held package-lock evidence, and both source census hashes. It is still a
captured-evidence DTO rather than authority. The implemented four-frame
open/observation/acknowledgement/close contract and explicit semantic join are
also declarative and non-authoritative: the observation frame commits to the
recursive evidence by hash, while the separately supplied semantic snapshot
carries that evidence and is joined explicitly. A serialized join receipt is a
self-asserted DTO with `productionAuthority:false`; every use must explicitly
rejoin it against the complete session and semantic snapshot. Neither
commitment proves that a native process captured the recursive evidence while
holding the locks. The implemented Darwin fixture now has an opaque native
session that holds `shared -> package` across baseline observation, a real
TypeScript ACK_ABORT, native abort, and reverse release. Its exact fd4 binary
protocol is exercised by a code-owned test-support adapter that observes native
terminal, EOF, clean exit, and a paired release probe, then emits a distinct
frozen self-hashed receipt. That receipt remains `productionAuthority:false`:
the release probe uses pathname `lockf` and is explicitly TOCTOU-limited, the
binary is spawned by an unpinned path, the five-second acknowledgement
measurement is fixture timing rather than production deadline proof, recursive
evidence is absent, and serialized replay is never live authority. The pure
controller therefore has no ACCEPT surface. Production still requires one
authenticated native session to capture the recursive pathless evidence while
holding the same locks, join semantic acceptance to those exact bytes,
recapture unchanged state, emit a signed terminal receipt, and only then
release in reverse order. It also requires pinned descriptor-based binary
admission and exact-object lock probing rather than the current pathname test
fixture.

#### Fixture Composite Recursive Observation

The next fixture-only slice does not add a second fd4 state machine. It keeps
the existing length-prefixed OPEN/OBSERVATION/ACK/TERMINAL envelope, but the
OBSERVATION payload uses a new exact aggregate-recursive stream language and
capability. There is no legacy/new parser union or fallback. An old parser
rejects the new header, and the new parser rejects the legacy aggregate-only
header, so missing recursive evidence cannot be interpreted as an empty tree.
The fixed stream order is header, parent, held locks, `N` global namespace
entries, exactly one Node recursive-evidence frame, and footer. The footer binds
`namespaceEntryCount=N`, `recursiveFrameCount=1`, `frameCount=N+5`, and a
completed marker. The complete type-2 payload, including frame overhead, stays
inside the existing 64 MiB fixture cap.

The recursive frame has an exact `root_absent`, `layout_not_exact`, or
`complete` disposition. Only `complete` can later reach semantic ACCEPT; it
contains the code-owned Node topology in the existing semantic role order:
root, bin directory, launcher, lib directory, bundle, manifest, runtime
directory, and runtime file. Capture is a fixed component walk, not caller-
supplied generic recursion. Every component is opened descriptor-relative with
`O_NOFOLLOW`; path-before, descriptor, and path-after observations must agree.
All four directory memberships are complete and raw-byte ordered, every file
has one link, all eight device/inode pairs are distinct and on the root device,
and no nested object may alias a global direct child. Files are hashed through
their pinned descriptors with a fixed scratch buffer; raw bundle/runtime bytes
are not serialized. Each file's code-owned contract cap and the exact aggregate
recursive-read cap are enforced.

The composite capture participates in every native equality fence: the two-pass
baseline, ACCEPT recapture, and final close recapture compare global namespace,
held-lock bindings, recursive stable identities, mutable fingerprints,
memberships, lengths, and content hashes. Every pass reopens descendants rather
than retaining baseline child descriptors. The recursive frame is self-hashed
and joins the filesystem scope, global physical census, Node physical
projection, root identity/fingerprint, and package-lock identity. Aggregate SHA
alone proves only byte co-occurrence; these relations prevent a freshly hashed
aggregate/recursive splice.

The aggregate-recursive mapper and semantic bridge are implemented as separate
fail-closed layers. The mapper remains `semanticReady:false`; the bridge owns
one copied V3 stream, extracts canonical claim, receipt, and rollback documents
from those same native bytes, constructs the existing strict semantic snapshot,
and prepares an ACK whose semantic commitment is the exact acknowledgement
frame hash. It accepts only `complete` evidence with the exact ready Node
projection. Foreign packages may coexist in the global census but cannot enter
the Node artifact parser or splice across its positional capture joins.

The fixture now has a distinct `recursive_semantic_live` control rather than
weakening the existing ABORT-only recursive command. The code-owned test-support
adapter drives one real fd4 occurrence through strict OPEN and OBSERVATION,
same-byte semantic preparation, ACK_ACCEPT, native unchanged recursive
recapture, reverse release, terminal echo, EOF, silent exit, paired lock probe,
declarative close, and a fresh explicit semantic-snapshot rejoin. Native code
treats the semantic hash as an opaque 32-byte fixture commitment and allows
ACCEPT only for a baseline `complete` recursive status; `root_absent`,
`layout_not_exact`, legacy streams, malformed canonical lifecycle state, and
post-observation drift produce no terminal ACCEPT authority.

This path remains `productionAuthority:false`. The binary is still spawned by
pathname, but the implemented pinned-descriptor mode proves before OPEN that
the process's main loaded Mach-O vnode is the same physical object held at fd5.
That is not descriptor execution. The release probe remains pathname-based and
TOCTOU-limited only for the preserved legacy abort adapter. The semantic-live
path now retains fd3/fd5 and uses a second pinned native process for exact
descriptor-relative `F_TLOCK` release proof, but pathname spawn is still not
descriptor execution. Native semantic parsing is absent, the terminal authority
is self-asserted fixture state, and serialized preparations, sessions, joins,
and adapter receipts are never replay authority. Production still requires
signed/notarized admission and AMFI evidence, production timing proof, a live
slot-ledger implementation of the now-frozen pagination/chunk transcript
contract, and an authenticated terminal receipt.

#### Bounded Directory and Content Transcripts

The production wire cap remains 1 MiB per frame and the legacy single-response
DTOs remain frozen for compatibility. Full-envelope capture uses distinct
serialized transcript DTOs without granting them live authority. A directory
capture occurrence contains exactly two observation passes of one through 32
pages, each carrying at most 512 of the globally ordered 16,384 member bindings.
Session occurrence, capture
occurrence, directory slot and stable identity, whole first/second membership
commitments, page index/count, global start/count, predecessor hash, and page
self-hash are mandatory on every page. Exactly one empty page per pass
represents an empty directory. The terminal commitment joins both final page
hashes to exact semantic-membership and member-slot/inode aggregates; both
passes must agree, rejecting gaps, duplicates, reorder, replay, rebinding,
cross-slot, and cross-occurrence splice attempts.

Regular-file evidence contains exactly two observation passes of one through
four chunks, each at most 256 KiB raw bytes, for a maximum 1 MiB file. Chunk
index/count, exact offset and total,
session/capture/entry-slot/stable-identity binding, predecessor hash, raw chunk
hash, canonical base64, and whole-content commitment are mandatory. Non-final
chunks are full-size and the final chunk covers the exact remainder; an empty
file is one exact zero-byte terminal chunk per pass. Builders reject the raw
bound before copying or encoding, and transcript verification recomputes exact
coverage and requires both passes to produce the same full content hash. Each
DTO is independently below the wire cap. These
contracts close the mathematical frame-size gap but remain
`productionAuthority:false` until the authenticated native driver maintains
the descriptor-backed slot ledger and rolling live transcript across them.

The local slot-ledger fixture now exercises only the mechanics boundary: native
challenge-bound catalog slots and two exact descriptor-capture observations are
joined by a private TypeScript `WeakMap` ledger before a fixture ACCEPT. Its
receipt is pre-ACCEPT content-join evidence with explicit unsigned,
AMFI-unproven, and notarization-unproven markers. The fixture still spawns by
pathname, does not consume a native rolling self-hashed transcript, and cannot
be promoted into the authenticated production driver or terminal authority.

#### Security.framework Host Self-Observation Characterization

The Darwin host self-observation fixture is a separate read-only
characterization boundary. A private universal test binary uses
Security.framework to observe its own code object and emits the actual
architecture, signing flags/status, identifier and Team (when present),
designated-requirement hash, runtime/library-validation markers, stapled-ticket
presence, and Security.framework unique digest. The unique digest retains its
raw byte length and is represented by a domain-separated commitment, so an
Apple CDHash is never widened into a fabricated 256-bit identity. The same
observation carries a host-UUID-derived stable host scope plus the executable's
stable `device/inode/objectKind` identity, and a separate mutable metadata /
content fingerprint, all bound to a challenge and
revalidated against the exact fixture inode after the process exits.

This observation is deliberately not self-authentication: its scope is
`test_fixture`, `productionAuthority:false`, AMFI admission is `unproven`,
notarization admission is `unproven`, and installer receipt admission is
`absent`. The wire frame is strict UTF-8 canonical JSON and the TypeScript
adapter rejects reordered or forged frames. It is not imported by the
production backend or registry activator. Developer ID identity, notarized
installer/package evidence, code-owned catalog/key material, and an
authenticated installed helper remain required before production admission.

#### Local Unsigned Installer Trust Audit Boundary

The smallest credential-free installer/notary characterization is a private
unsigned flat package, not a production artifact. The test-only adapter creates
one fixed-ID package under a 0700 root, captures its descriptor-backed stable
`objectKind/device/inode` identity and separate mutable fingerprint, and runs
only exact bounded probes: `pkgutil --pkg-info-plist` before and after,
`pkgutil --check-signature`, `spctl --assess --type install --raw
--ignore-cache --no-cache`, and
`xcrun stapler validate`. It uses absolute tool paths, `shell:false`, a fixed
locale/environment, 64 KiB per-channel caps, and kill/reap timeouts; command
output is stored only as byte lengths, hashes, exit status, and signal. A
receipt is classified `absent` only when the exact empty-stdout length/hash and
diagnostic stderr length/hash all agree. It never calls
`installer`, `notarytool`, or keychain/security identity enumeration.

The resulting receipt is diagnostic characterization only:
`admissionScope:"test_fixture"`, `authorityScope:"diagnostic_observation_only"`,
`credentialUse:"none"`, `mutationAuthority:false`,
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`trustConclusion:"characterization_only"`. A failed unsigned-package
signature, install assessment, or local stapler check is a typed negative
observation, not proof that a future signed package is invalid. Installer DB
receipt presence is metadata only and must be joined to original package
signature, notarization, and exact payload evidence before any production
capability could exist. Raw Mach-O Gatekeeper results and missing stapled
tickets are not installer/notarization authority. `spctl` is recorded as a
Gatekeeper install assessment, never as AMFI runtime admission; AMFI remains
`requires_authenticated_running_helper`. Since these tools consume a pathname,
the receipt carries `targetBinding:"pathname_only_unproven"` and a permanent
exact-object blocker even when the package descriptor is unchanged before and
after the probes. The private `pkgbuild` step is setup evidence, separate from
the five read-only probe observations.

#### Fixture Claim-Before-Payload Recovery Boundary

The claim-first fixture is a separate mechanics-only boundary. It creates the
three fixed staging member files as private, unaliased skeleton inodes, captures
their stable physical identities, and places those identities in a canonical
self-bound claim envelope. The claim file also binds the namespace parent,
staging directory, transaction identity, and fixture-computed hashes of the
caller-supplied member bytes.
The claim file is written and its `FileHandle.sync()` plus parent-directory
sync return before any nonzero payload write; this is cooperative sync-return
mechanics only, not process-crash or power-loss proof. A fresh recovery
invocation may inspect or resume only when the claim's own stable
identity and every staged member identity still match; the non-authoritative
receipt carries the bound opaque-document and claim-byte hashes, and it derives a new mutable
fingerprint for each observation and accepts only the exact expected prefix.

Claimless skeletons, partial or noncanonical claims, foreign claim documents,
same-byte inode replacement, wrong prefixes, symlinks, and hard links are
rejected without deletion or truncation. The fixture is restricted to a
private `setfarm-claim-first-v2-*` temporary root, revalidates that root and
both parent identities across pathname-relevant checkpoints before the next
pathname durability operation and final success, and performs a final
inspection before returning a session; it binds the caller's opaque
snapshot/hash document only; it does not parse or mint the production
activation-claim schema. It deliberately exposes no
cleanup or ownership capability and labels its receipt
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`claimSemantics:"opaque_fixture_claim_document_join_only"`. It proves only the
ordering and replay mechanics of preallocating stable member slots; it does
not implement the production activation reducer, durable crash ownership,
signed native admission, or terminal receipt authority.
An active member write or inspection rejects `close()` with a typed lifecycle
error; callers retry close after the operation settles, preventing hook
reentrancy from zeroing an in-flight payload or deadlocking recovery.

#### Fixture Pinned Descriptor to Running Vnode Binding

Darwin exposes no public `fexecve` or `execveat`, so the implemented fixture
does not claim literal execution by descriptor. The semantic-live adapter
instead opens the code-owned fixture binary with `O_NOFOLLOW`, captures and
hashes that pinned regular-file descriptor, and inherits it as fixed fd5 while
the child is still spawned by pathname. A distinct fixed native control
performs the first native operation before OPEN: it resolves the main loaded
Mach-O mapping through the current process and compares that mapped vnode's
device/inode identity to fd5.
Missing fd5, a non-file descriptor, a symlink-derived or wrong object, and a
same-byte pathname replacement whose loaded vnode differs from the pinned inode
all fail before any protocol authority is emitted.

The parent retains the descriptor through child settlement and requires equal
pre/post descriptor identity, mutable fingerprint, length, and content hash.
The resulting receipt binds the pinned binary stable identity and content hash
to the successful semantic-live occurrence, but remains
`productionAuthority:false` and `adhoc_or_unsigned_test_fixture`. This proves a
physical path-spawn-to-running-vnode binding only. It does not prove Developer
ID signing, notarization, AMFI acceptance, hardened runtime, library validation,
or signed catalog membership, and therefore does not activate the production
opener.

#### Fixture Descriptor-Relative Exact-Object Release Probe

Release availability must be observed by a separate process. Darwin record
locks are process-owned, so reacquiring an overlapping `F_TLOCK` in the same
process can merge with that process's existing lock and cannot prove release.
After the semantic child has reached EOF and clean settlement, the adapter
therefore starts the same pinned native binary as a second, distinct probe PID.
The adapter retains the original registry-parent descriptor and pinned-binary
descriptor across both children. The probe inherits the parent as fd3, one
owned bounded result stream as fd4, and the binary as fd5. Before opening a
lock or emitting success evidence, it repeats the fd5-to-running-main-Mach-O
mapped-vnode check.

The probe uses only the fixed code-owned shared and Node lock basenames. It
opens them relative to fd3 with `openat(O_RDWR | O_CLOEXEC | O_NOFOLLOW |
O_NONBLOCK)`, requires path-before, descriptor, and path-after metadata to be
the same exact ordinary single-link object, and checks fixed content plus EOF
with positioned reads. It then acquires `shared -> Node` with nonblocking
`F_TLOCK`, revalidates after every boundary, releases `Node -> shared` with
`F_ULOCK`, and performs final identity, fingerprint, content, and parent fences.
Partial acquisition and every failure release and close in reverse order. A
success frame is emitted only after both exact objects are proven available
and all probe leases are gone.

The strict pathless probe receipt joins its fresh occurrence, raw native frame,
parent identity/fingerprint, both lock identities/fingerprints/content results,
fixed acquisition/release orders, clean EOF/exit, and pinned-binary descriptor
binding to the same semantic occurrence and global census scope. The old
pathname `/usr/bin/lockf` probe is not authority. This remains a self-asserted
`test_fixture` with `productionAuthority:false`: pathname process creation,
unsigned/adhoc code, absent AMFI/catalog admission, unauthenticated terminal
state, and unavailable production backend capability remain blockers.

The pure activation observation contains the full self-hashed filesystem scope
and complete physical namespace census; its duplicate logical census must be
canonically equal to the physical census's logical source. Epoch observation
does not accept free package snapshot or lock hashes: it accepts the complete
source-bound physical projection and reproduces that projection from the
current namespace. A structurally valid foreign-scope projection, or one made
before a package-lock inode replacement, is therefore not authority. The
future authenticated Node adapter must derive its semantic snapshot and
legacy-lock join from the same projection. The separately installed fixed
scope document remains required
from the future physical activator: an internally consistent replacement of an
entire observation together with its scope cannot be distinguished by this
pure reducer alone.

The credential-free characterization now includes a bounded external-scope
rejoin adapter. It consumes the serialized package physical snapshot plus a
separate cooperative scope-publication observation, joins the exact scope
identity hash, canonical scope-document content hash, stable
`host/objectKind/device/inode` identity, and mutable fingerprint, and emits
only a pathless hash relation. The relation is explicitly test-fixture,
unsigned, non-mutating, and production-forbidden. It demonstrates the
required external rejoin boundary but is not a fixed scope authority: a
production activator must obtain the scope document through the future
authenticated descriptor-relative V/registry path and rejoin it independently.
A self-consistent foreign scope replacement therefore remains a
characterization-only result, never production authority; the bounded parser,
not a raw exported Zod schema, is the untrusted input boundary.

The next V characterization binds the host-verifier package's exact root,
`bin/` directory, manifest, and signed executable child captures to the
original ephemeral native-selection receipt. It joins stable scope/kind/device/
inode identities, separate mutable fingerprints, root-owned topology policy,
manifest raw-content hash, and selected executable length/content hash, but
emits only a pathless false-authority hash relation. It does not establish
semantic manifest bytes, Developer ID/notarization/AMFI admission, an
installer receipt, or authenticated descriptor-relative two-pass capture; the
production V authority therefore remains unavailable. The fixture records
expected direct-child basenames but not an authenticated opaque descriptor
slot; production must bind each role through the fresh full census and
descriptor-relative revalidation.

The R leaf has the corresponding test-only member characterization. It joins
the release-composition package root from the serialized package snapshot to
caller-supplied `bin/`, `lib/`, manifest, executable, and three exact module
captures. Stable physical identity uses one global scope/device/inode locator
space (object kind is not a second locator), while mutable fingerprints remain
separate. The mapper checks root-owned modes and link/size limits, exact parent
identities and directory memberships, bounded raw member hashes, and the
code-owned required-export lists. An optional sealed-root value is retained
only as a hash provenance marker. The returned relation is frozen, pathless,
unsigned, non-mutating, and production-forbidden. It does not prove a signed R
catalog/receipt, semantic manifest, module-load behavior, fresh full-census or
descriptor-relative two-pass capture, or a V/R production join; the serialized
root and caller-labelled member observations therefore cannot be promoted.

The aggregate leaf checkpoint remains a separate hash-only test relation. It
re-parses the complete recursive fixture mapping and the V/R/S/A leaf
relations, joins their shared serialized scope/snapshot/publication hashes,
checks the Node projection against the aggregate source physical census and
held-lock identities, and revalidates the exact eight-role recursive tree,
parent graph, global locator boundary, and identity/fingerprint joins. Its
component projection/leaf hashes are recomputed from the returned fields, so a
rehashed outer join cannot launder a forged component. It rejects a
Node-root/V-root/R-root locator alias. Its frozen output carries
only selected aggregate and leaf hashes plus the recursive fixture's explicit
`semanticReady:false` and `native_capture_only_requires_ts_aggregate_join_v2`
markers. It does not alter the legacy/new stream languages or create an
aggregate capability; a coherently rehashed foreign all-leaf DTO remains a
characterization-only result because this serialized boundary has no external
source context. Authenticated full-census, dual-pass V/R/S/A capture,
descriptor-relative locks, and durable production rejoin remain required.

Every exact semantic registry document is physically source-bound, not merely
self-hashed. Its observation carries the occurrence fingerprint and raw-content
hash and joins those plus stable object identity to the one matching full
census capture; activation and epoch claim documents are included. Exact
published JSON encoding is code-owned canonical UTF-8 with no trailing newline,
and raw content identity is SHA-256 over those bytes. The existing Node lock
keeps its legacy fixed bytes. Non-Node lock bytes bind the V2 registry contract
hash and package ref, while the shared lock uses its fixed contract content.
The parent observation likewise joins the complete physical-census parent
fingerprint. A current inode with stale, foreign, or merely self-consistent
semantic bytes is not authority.

Node migration preserves its existing package and receipt identities, including
the package-specific legacy lock that those receipts already bind. Cutover uses
a registry activation receipt, a new shared parent lock, the fixed activation
claim
`.setfarm-bootstrap-package-registry-v2.activation-claim.v2.json`, and the
fixed transaction staging directory
`.setfarm-bootstrap-package-registry-v2.transaction-staging.v2`:

1. while no registered sibling exists, the migrator acquires the legacy Node
   lock, reproduces the complete Node lifecycle and parent census, exclusively
   prepares the shared lock, genesis state, and expected activation receipt in
   the fixed staging directory, and fsyncs that exact stage;
2. no steady-state registry-aware operation may start before activation, so
   this one-time `legacy -> shared` acquisition cannot form a lock cycle. The
   code-owned migrator protocol identity commits three separate policies:
   pre-receipt `legacy Node -> shared parent`, post-receipt cleanup
   `shared parent -> legacy Node`, and steady-state admission only after both
   activation claim and transaction staging are absent;
3. before publishing any final registry entry, the migrator durably publishes
   the exact activation claim. The claim binds one transaction, the code-owned
   migrator protocol, shared- and legacy-lock identities, Node lifecycle,
   current Node lifecycle snapshot, parent identity, pre-activation physical
   namespace capture, transaction-staging directory identity and
   claim-independent payload census, exact genesis, and the deterministically
   expected activation-receipt hash;
4. the migrator atomically publishes then acquires the shared lock while the
   legacy lease is still held, atomically publishes the exact genesis state,
   and durably publishes the registry activation receipt last;
5. publication of the receipt changes the cleanup lock order: cleanup acquires
   the shared parent lock and then the legacy Node lock, reproduces the exact
   genesis-only/no-non-Node-sibling boundary, and removes staged members in the
   fixed order `staged_activation_receipt`,
   `staged_genesis_epoch_state`, then `staged_shared_lock`, followed by the
   empty staging directory and finally the exact activation claim. The
   code-owned migrator protocol hash commits both that member order and the
   partial-census domain
   `setfarm.platform-release-bootstrap-registry-activation-cleanup-remaining-census.v2`.
   A receipt with its matching claim is activated cleanup recovery, not a
   second cutover, and no steady registry operation may start until both claim
   and staging are absent;
6. registry-aware operations thereafter acquire shared lock first and then
   their package lock;
7. pre-registry Node binaries classify the claim, staging directory, shared
   lock, or activation receipt as foreign state and therefore fail before
   mutation;
8. V, R, and account-provisioner installation require a fresh authentic
   activation receipt and may not race the cutover.

The legacy Node lock remains as an immutable package sentinel and continues to
protect its existing receipt identity; it is not a competing parent
serialization mechanism. A crash after shared-lock creation but before
activation is a typed incomplete migration: old binaries remain fail-closed,
and only the exact durable activation claim may authorize the same transaction
to resume under the legacy lock and exact shared lock identity. Staging without
a claim is an orphan that may only be removed when its directory fingerprint,
self-hashed structured membership, typed ordinary-file captures, exact parent
relations, and orphan census reproduce one known safe set. Opaque hashes,
foreign content or members, or ambiguous/changing membership are corruption
with no mutation. A nonempty activation orphan is safe only as the full fixed
receipt/genesis/shared-lock triplet: the shared lock and genesis bind their
code-owned logical and published-byte hashes, while the receipt is recomputed
from the exact legacy lock, Node lifecycle, parent, and staged shared-lock
physical identity and binds both its semantic and published-byte hashes.
Shared lock or genesis state without the exact claim or final receipt is
corruption. The
activation receipt is irreversible while any registered sibling state or
history exists. A rollback may disable the new leaves but may return only to a
registry-aware compatibility version. Merely adding V/R names to a local
allow-list is rejected because it would provide no cross-package serialization,
ownership, cutover, or rollback boundary.

The transaction-staging directory has an exact physical identity distinct from
its derived census digest. That census covers only the fixed staged transaction
payload captured before claim publication; each member contributes both its
logical content/state identity and its physical object identity. It excludes
the activation-claim document, so the claim may bind the census without a
self-hash cycle. Activation staging additionally binds the pre-activation
namespace capture, shared-lock content plus physical identity, genesis-state
hash plus physical identity, and activation-receipt hash plus physical
identity. Atomic publication must preserve each staged physical identity into
its final name; equal bytes in a replacement inode are corruption. The claim
is reproduced from those staged identities and the current Node snapshot
before receipt publication. If staging has already been removed after receipt
publication, the initial census is reproduced from the final shared lock,
genesis floor, and activation receipt logical/physical observations before the
claim may be removed. The stage does not contain or report a `claimHash`; the
separately observed activation claim is a sibling outside the staged-payload
census and joins through the transaction, staging-directory, initial-census,
and expected payload identities.

Publication of each absent activation target uses a no-replace hard link from
the exact staged inode: the staged occurrence has link count one, the
stage/final overlap has link count two, and durable stage unlink leaves the
final occurrence at link count one. The changing occurrence fingerprints do
not change the stable object identity. The stage-internal alias is an explicit
transaction relation and is not a second global direct child. Each staged
payload is a strict typed capture of its logical identity, exact code-owned
basename/classification, full staging-directory parent stable identity/hash,
ordinary-file stable identity, full occurrence fingerprint, and raw bytes
hash. The directory's self-hashed structured membership canonically equals
those exact live entry captures. The claim-bound staging census projects
logical plus stable-object identities so the expected mutable fingerprint
transition does not alter claim identity. Every global ordinary file defaults
to link count one.
Only the staged receipt/final receipt, staged genesis/final floor, and staged
shared lock/final shared lock may alias: stage-only requires `nlink=1`, a live
equal-bytes overlap requires `nlink=2` on both observations and otherwise
canonically equal fingerprints, and final-only requires `nlink=1`. The parent,
legacy/package lock, another staged member, or any unrelated global child can
never share the staged locator. A hidden link on a final-only or unrelated
ordinary file is corruption.

Receipt-present cleanup is crash-safe at every member boundary. An exact stage
starts cleanup. After any fixed-order member removal, `cleanup_partial` carries
the unchanged exact staging-directory identity, the initial claim-bound census,
an exact projection of the remaining fixed member kinds with their logical and
physical identities, and a separately domain-separated current census hash
reproduced solely from that projection. Only suffixes produced by the fixed
deletion order are valid, including the empty suffix before directory removal.
A retry resumes at the first remaining member; an exact stage cleans, a partial
stage resumes, and an absent stage removes the claim only after the final
objects reproduce its initial census. Unknown, foreign, reordered, skipped, or
logical- or physical-identity-replaced members are corruption and never cleanup
authority. After staging removal, the persisted claim carries the same initial
evidence for the final claim-removal check.

The registry additionally owns the fixed root-owned files
`bootstrap-package-registry-v2.activation-receipt.v2.json`,
`bootstrap-package-registry-v2.epoch-floor.v2.json`, and
`.setfarm-bootstrap-package-registry-v2.epoch-claim.v2.json` beneath the shared
bootstrap parent. Activation and later epoch-floor transactions reuse the same
fixed transaction staging directory and are mutually exclusive through their
distinct exact claims; the staging directory is never an authority or history
namespace. Activation publishes the exact genesis epoch state with
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
2. durably publish a claim binding the full exact prior and target state
   documents as well as their hashes, package install generation, and any
   offline rollback authorization;
3. finish or recover the bound package installation without issuing its
   production authority;
4. atomically publish the exact target epoch state last with no unrelated
   package-floor change;
5. issue the package authority only after reproducing that state, then remove
   only the exact claim.

If a crash leaves a claim, recovery may finalize only the exact prior-or-target
state document by canonical equality and matching package generation. The
target generation is exactly prior generation plus one without safe-integer
overflow, its ancestry and transaction identity exactly join the claim, only
the claimed package map entry may change, and that entry's distribution epoch
strictly increases. Every other package entry is canonically unchanged. Any
third state or cross-package delta is terminal corruption.
Epoch recovery additionally requires an exact claimed-package lifecycle
physical projection and observed installation generation. The projection is
canonically reproduced by filtering the complete exact physical namespace
census to every entry owned by the claim's tagged package; it must be nonempty,
globally ordered, bind both source census hashes, and contain exactly one
package lock whose stable object identity is derived. For Node, the same
projection's logical census hash must equal the exact Node lifecycle snapshot
and its derived package-lock object identity must equal the legacy Node lock
identity. Zero claimed-package entries, an omitted lock, a valid projection
transplanted from another census or scope, a replacement lock inode, or a
mismatched Node adapter join is corruption. Those identities, the claim
transaction/prior/target/self hashes, stage directory/census, and
parent/shared-lock identities are pairwise distinct except for explicit
relational equality joins.

Epoch staging contains exactly one target member and its initial census is
derived from the member's logical target-state hash and physical object
identity. Both the staging-directory physical identity and the target physical
identity are claim-bound. A prior-state recovery requires the exact stage
carrying the full target state canonically equal to the claim target. After
atomic target publication consumes that only member, target-state recovery may
instead observe `epoch_target_consumed`: it preserves the exact transaction,
directory, initial census, full target, and target physical identity, while its
remaining-member projection is exactly empty and produces a separately
domain-separated current census. This consumed state is not valid at the prior
floor or without the exact claim, and a same-bytes replacement target object is
corruption. Epoch staging likewise carries no sibling claim hash. Claimless
activation staging is cleanable only before cutover under the legacy lock.
Claimless epoch-floor staging is cleanable only after full activation under the
shared lock, and because no claim authenticates a target, only when the
directory is demonstrably empty. Neither orphan is a resume authority.

The physical epoch publication state machine is exactly
`prior + exact -> target + epoch_target_consumed -> target + absent`.
Same-filesystem atomic replacement renames the staged target inode over the
prior floor and therefore consumes the only stage member in that syscall. A
`target + exact` observation is fail-closed rather than normalized as a
hard-link overlap; epoch publication is rename-based, not hard-link-based. The
reducer enforces this sequence. Its consumed rename relation requires the
claim-bound staged and target stable object identities and raw bytes to match,
with each captured occurrence at `nlink=1`; it never accepts a live two-link
overlap. Production activation remains a zero-input, physically inert failure
stub until the descriptor observer and fixed external scope publication
primitive exist.

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

The first shared capture slice is deliberately narrower than that production
contract. `platform-release-bootstrap-filesystem-capture-core-v2.ts` performs
BigInt descriptor observations, exact bounded reads plus a one-byte EOF probe,
buffer zeroing, parent/child descriptor and path fences, two equal entry
captures, and two equal bounded directory-membership enumerations. Its
code-owned file limit is the maximum `maxCanonicalBytes` in the fixed registry
document protocol catalog rather than the unrelated physical-DTO canonical
size limit. The cooperative facade returns only pathless physical-census
objects tagged `cooperative_writer_process_crash`; test checkpoints live in a
separate support module and are absent from the production import graph.

This Node facade is not production authority. Node exposes path-based
enumeration, link, unlink, and rename, leaf-only `O_NOFOLLOW`, and ordinary
`fsync`; it does not expose the descriptor-relative Darwin operations or
`F_FULLFSYNC` needed to defeat a hostile ancestor swap or claim strict
power-loss durability. Production activation therefore remains inert until an
authenticated Darwin backend supplies pinned-parent `openat`/`fstatat`,
`linkat`/`unlinkat`, `renameatx_np`, `O_NOFOLLOW_ANY` or
`O_RESOLVE_BENEATH`, directory-descriptor enumeration, and `F_FULLFSYNC`.
The cooperative facade proves process-crash mechanics only and cannot be
promoted into that backend by relabeling its result.

The cooperative fixed-scope publication fixture uses only the code-owned
`setfarm-bootstrap-filesystem-scope-v2.json` target and
`.setfarm-bootstrap-filesystem-scope-v2.stage` name. It generates the nonce
from the operating-system RNG, writes canonical UTF-8 to an exclusive private
stage, synchronizes the staged file and parent, publishes with a no-replace
hard link, synchronizes the parent, removes only the exact admitted stage, and
synchronizes the parent again. Process-crash replay accepts only stage-only
`nlink=1`, same-inode overlap `nlink=2`, or final-only `nlink=1`. It completes
missing file and directory barriers before returning. The final result is
re-read and must preserve the admitted stage locator, canonical bytes, and raw
hash.

A different valid EEXIST winner may be adopted only when the competing stage
was created or admitted from a target-absent state and made durable by the
current invocation. A valid target plus a different valid stage already
present at entry is ambiguous and is preserved with a conflict; invalid,
symlinked, special, or hidden-link state is likewise never removed. The result
contains the full scope identity and pathless stable/fingerprint/raw evidence
but retains the cooperative capability tag and is not the production fixed
scope authority.

The cooperative activation-member publisher covers only the three code-owned
activation mappings: staged receipt to final receipt, staged genesis state to
the fixed epoch floor, and staged shared lock to the final shared lock. It
strict-parses the scope and claim-bound stable ordinary-file identity before
opening either parent, then requires every stage, overlap, and final observation
to preserve that exact scope/device/inode identity and expected raw hash.
Stage-only `nlink=1`, same-inode overlap `nlink=2`, and final-only `nlink=1`
are the only accepted states. A same-inode EEXIST race is reobserved; a
different inode is never adopted merely because its bytes match.

Successful replay completes target-file, target-parent, and staging-parent
sync barriers, fences both held parents, re-reads the admitted target identity
and bytes after the last injectable checkpoint, and observes the fixed stage
absent twice before returning. A recreated stage, hidden link, special file,
parent replacement, or same-byte historical target inode therefore fails
closed without cleanup authority. This module also returns only pathless
`cooperative_writer_process_crash` evidence and is not reachable from the
production activation entry point.

The cooperative epoch-floor publisher covers the fixed staging direct child,
its sole `staged_target_epoch_state` member, and the fixed epoch-floor target.
Its pre-mutation input binds the strict scope, fresh-census prior floor stable
identity and raw hash, claim-bound staging-directory stable identity, and
claim-bound staged target stable identity and raw hash. Directory membership is
captured twice and must be either the one exact target member or exactly empty.
The only state language is `prior + exact`, `target +
epoch_target_consumed`, and `target + absent`; `target + exact`,
`prior + consumed`, third-state bytes, hidden links, foreign members, and
same-byte replacement inodes fail closed.

The cooperative durability order is staged-file sync, source-directory sync,
atomic same-filesystem rename, target-file sync, destination-directory sync,
consumed source-directory sync, exact empty staging-directory removal, and
final namespace-parent sync. Replay after every injected boundary, including a
peer-completed exact rename or rename-plus-removal observed as `ENOENT`,
reobserves and converges only through the exact state language. Before returning
it fences the namespace parent, re-reads the authority-bound target inode and
bytes, and observes the staging directory absent twice. This pathless result
retains the cooperative capability tag. Node still lacks an
expected-destination-inode rename compare-and-swap, descriptor-relative
ancestor safety, and `F_FULLFSYNC`, so the module cannot authorize production
cutover.

The permanent filesystem-scope document is an exact registry-owned namespace
member. A global physical census is valid only when it includes this ordinary
file and its raw content hash equals the canonical filesystem-scope identity
used by the parent and every captured child. The scope stage remains a
pre-census recovery artifact owned by the fixed scope publisher. Publishing
the external anchor therefore cannot create a foreign sibling in the namespace
that the anchor is intended to authorize.

The authenticated Darwin filesystem boundary is an exact self-hashed semantic
ABI, not a generic native-call escape hatch. Each operation fixes its bounded
request and result fields, legal code-owned operands, opaque-slot transition,
precondition, postcondition, and closed error set. Directory enumeration
returns opaque member slots; callers never select entries by raw basename.
No-replace links and expected-prior epoch replacement bind stable identity,
mutable fingerprint, and exact content before irreversible mutation.

The fixed-operand catalog binds every operand to its exact parent, code-owned
name, object kind, root-owned mode, content policy, and permitted link state.
Each bounded request/success/failure DTO is strict and self-hashed, but a hash
alone is not authority: the parser also joins the response to its exact
request. Opaque slots are pairwise distinct, physical kinds match the
operation, child identities remain on the parent's scope and device, and
remove/unlink success proves the exact target absent in two distinct
observations. Hard-link publication permits only the fingerprint transition
from one link to two while preserving ownership, mode, size, and modification
time. Rename preserves those fields with one link, and bounded write preserves
ownership, mode, and one link while binding the resulting size and monotonic
timestamps. A rehashed physical splice is rejected.

Production admission requires one relational evidence chain:
`catalog + epoch floor + executable/build -> AMFI self-attestation and
code-signing policy -> syscall/resolution/conditional-replace/durability
proofs -> fresh bounded live session`. Its initial transcript must remain
immutable while the current transcript advances monotonically; its live bridge
must be privately branded and revalidated; and the session must not exceed the
exact operation cap. A serialized receipt cannot mint or reconstruct that
future capability.
The zero-input production opener remains physically inert until the signed
per-architecture native distribution and every external proof are available.

An unsigned Darwin-native fixture may exercise one closed mechanics slice
without satisfying that admission chain. The selected first slice is the fixed
filesystem-scope publication only: an inherited pinned directory descriptor,
the two code-owned operand names, private bounded input snapshot, exact
`openat`/`fstatat` capture, `F_FULLFSYNC`, no-replace `linkat`, exact
`unlinkat`, and the stage-only/overlap/final-only replay language. Its builder
must compile captured private source copies into an external empty private
directory, stay outside the ordinary TypeScript build and distribution payload,
and label every result `test_fixture`, `productionAuthority:false`, and
`adhoc_or_unsigned_test_fixture`. Real `SIGKILL` replay is required at every
safe post-write mutation boundary. This fixture never mints the authenticated
backend capability and cannot be promoted by copying its receipt or binary. A
death during the initial `pwrite` may leave a private partial fixed stage; the
fixture preserves and rejects it because no durable claim proves cleanup
ownership. Production requires claim-first or equivalent locked ownership plus
fault coverage at write offsets before this slice can be called arbitrary-crash
convergent.

The same fixture has a separate, opt-in fd4 timing channel. At the exact
65,536-byte payload cap it characterizes every semantic `F_FULLFSYNC` role,
every one of the eight post-mutation SIGKILL prefixes and recovery suffixes,
and one complete fresh run with `CLOCK_MONOTONIC_RAW`. The ordinary stdout
result and stderr failure language remain unchanged. Each bounded timing frame
states `test_fixture`, `productionAuthority:false`,
`characterization_only_no_sla`, and
`syscall_return_latency_not_power_loss_proof`; tests assert sequencing and
arithmetic but no performance ceiling. These local syscall-return samples are
not cold-cache percentile evidence, hardware/power-loss durability evidence,
or a production deadline.

Physical activation orchestration has its own exact self-hashed contract. One
production round requires a fresh authenticated session and performs full
observation,
pure reduction, exact lock acquisition, revalidation, locked reobservation,
at most one reducer action, final revalidation, and close or abort. The
contract maps all reducer actions to closed crash microprotocols, fixes the
legacy-to-shared, shared-to-legacy, and shared-to-package lock vectors, reserves
protocol capacity beyond the maximum census, and fails closed after 32 rounds
or two identical no-progress observations. A mechanics-only executor enforces
this control loop with contract/ABI-bound unique session occurrences, an exact
method surface with no generic operation escape hatch, one-use session-bound
plan handles, and a fresh private slot-ledger token bound to the locked
observation and session occurrence. An action receives and consumes that exact
token; the public plan never becomes mutation authority. The shared-lock
publication action is the sole deferred-lock case; any locked reobservation
that changes that action closes and restarts rather than executing under one
missing lock. Close/abort failures use an invocation-private runtime brand, so
caller-thrown lookalike errors cannot suppress abort. The mechanics result is
explicitly non-authoritative and cannot admit cooperative Node mechanics into
production.

The Node fixture publishes a separate exact coverage catalog rather than
pretending to be a full session driver. Existing cooperative exports completely
cover only genesis-floor and activation-receipt member publication; terminal
return/no-mutation needs no filesystem mutation, while the remaining eight
actions are partial or unsupported. The separate aggregate-census fixture now
proves the read-only observation mechanics and exposes an opaque stateful
kernel session plus a real abort-only fd4 test-support adapter. It holds both
leases through the TypeScript abort decision, rejects dirty protocol/process
settlement, and proves native reverse release; its separate live-run receipt
records those observed facts without promotion. It still lacks recursive
semantic evidence, semantic ACCEPT, authenticated binary admission, and a
pinned exact-object release probe. The catalog therefore continues to freeze
the missing authenticated aggregate/recursive integration, absence, lock,
session-revalidation, production recapture/release, and private-ledger
capabilities, sets `fullSessionDriverAvailable=false`, and rejects rehashed
promotion claims. Later test-support extensions now demonstrate recursive
semantic ACCEPT, mapped-vnode/fd5 binding, exact-object release, and bounded
capture transcript verification, but they do not rewrite that cooperative
coverage catalog or promote it. Production admission depends only on the future
authenticated native driver with a descriptor-backed live slot ledger; the Node
fixture is permanently non-authority.

The mechanics test lane may use real Darwin kernel leases without changing that
boundary. Its exact legal vectors are legacy-only, legacy-to-shared,
shared-to-legacy, and shared-to-package; every role is a distinct direct child
of one pinned physical parent boundary, and each acquired lease must reproduce
that exact BigInt device/inode identity. Each lock path and inherited lock
descriptor are likewise joined through exact BigInt physical identity and
nanosecond mutable fingerprints. Parent replacement fails closed; acquisition
failure releases in reverse order and closes the pinned descriptor. The full
activation transition uses fresh real fixtures for legacy-only,
legacy-to-shared, shared-to-legacy, and shared-to-package rounds, with deferred
shared acquisition completed before receipt-last publication. Separately, the
legacy Node installer and
rollback implementation must check the receipt-last cutover marker both before
the legacy path and after acquiring its legacy lease. Any receipt presence
forbids mutation under the old order. Until the authenticated native observer
can reproduce the exact global registry census and Node package projection,
post-activation Node mutation remains fail-closed rather than admitting registry
siblings through a widened legacy census.

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

The current credential-free B5E characterization is permanently
non-promotable. The production target remains an authenticated atomic rename of
the completed content root plus a separate no-replace attestation CAS, durable
authority records beginning at migration 27 or later, and authenticated restart
recovery. The test fixture proves a narrower Darwin-native protocol: `mkdirat`
release-directory reservation, independent no-replace `linkat` publication of
the staged manifest and attestation, exact same-inode overlap validation, and
descriptor-relative exact `unlinkat`/known-shape cleanup. It never relabels
those mechanics as the production whole-root rename.

The native runner exposes 13 checkpoints. ABA displacement characterization
stops at checkpoints 9 and 11; real `SIGKILL` replay covers checkpoints 2, 4, 8,
10, and 12, including exact fail-closed preservation of ambiguous stage/link
residue. A live owner holding `F_TLOCK` is not stolen or unlinked. Fixture stale
lease recovery is unauthenticated and requires exact inode revalidation plus a
successful `F_TLOCK`; same-UID atomic conditional unlink and an authenticated
lease ledger remain absent production blockers. The fixture result is unsigned,
`test_fixture` scoped, `productionAuthority:false`, and
`productionAdmission:"forbidden"`. Exact nonrecursive cleanup also preserves
same-UID foreign root/descendant replacements in the builder, runner, and
high-level fixture. Its focused Darwin verification buckets are 33/33
high-level schema/support cases, 13/13 raw native runner/crash cases, and 4/4
native builder cases, for 50/50 total. None of those cases creates
`PreparedPlatformReleaseV2`, writes a release-store migration, or weakens the
authenticated B5E boundary.

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

The current installed-metadata execution bridge is a deliberately narrower
test characterization, not the production operation described by this design.
It binds the admitted Node, release-bootstrap executable, metadata module, ABI,
observer-wrapper bytes, empty environment, fd3 request, target cwd, and exact
pre/post censuses. Target identity is the stable
`hostIdentityHash/objectKind/device/inode` tuple; owner, mode, link count, size,
entry-set hash, and nanosecond timestamps remain a separate mutable
fingerprint. Xattr observation is names-only, ACL observation is read-only, and
clear-role locators are not returned. Its generic composition and Node launch
contexts accept only `test_fixture`, and its strict evidence literals forbid
production and mutation authority.

The wrappers delegate to `/bin/sh`, `/usr/bin/xattr`, and `/bin/ls`, execution
reopens pathname targets, and the collector runs as the fixture owner. Those
delegate identities, transient pathname ABA window, and runtime-account
isolation are not proven by the fixture. A production metadata receipt must
instead join the independently authenticated V/R/S/A package and system-anchor
censuses, execute through a native descriptor-relative boundary under the exact
runtime UID/GID, and preserve two distinct occurrence receipts. No hash replay,
scope cast, or specialized-context bypass may promote the characterization.

The test characterization has a pair-bound extension for the authentic B5C
dependency pair. Its public surface accepts only the opaque pair handle: it
accepts no path, callback, second handle, precomputed receipt, or caller JSON.
The pair owner synchronously claims the shared pair-API probe lease before any
await, selects both private output roots internally, and performs a fresh
claimed-pair fence before, between, and after exactly two installed metadata
children. The test-only raw-root callback holds the same API lease for its
complete async lifetime so it cannot overlap metadata, module export, disposal,
or ownership transfer through a pair API. Escaped ordinary test locators can
outlive this lease; the characterization states that limitation and does not
mislabel the API lease as global filesystem exclusion.

Pair evidence embeds the strict dependency-pair inspection and joins each
ordered target `device/inode/mode/uid/gid` projection to the corresponding
compiled output-stage physical hash. Occurrence evidence retains the complete
stable target identity, separate mutable fingerprint, child receipt, process
observation, and stable launch projection. Equality uses an explicit pair
stable projection over the operation ABI, metadata policy, stable Node,
bootstrap, module, and observer identities, host/toolchain/composition
receipts, stable dependency output binding, exact `payload` entry-set policy,
satisfied outcome, and child stable metadata projection. It excludes occurrence
UUIDs, PIDs, times, target inode, stdout/receipt hashes, and raw metadata
catalog hashes. Those excluded values remain distinct occurrence evidence; PID
inequality is not required because operating systems may reuse PIDs.

An authenticated stable policy rejection releases the probe lease without
producing partial evidence. Authenticated child authority drift preserves its
drift classification. Pair, target, launch-module, or observer authority drift
invalidates the pair and destroys only the exact still-owned roots. The result
remains recursively frozen `test_fixture` characterization with literal false
production and mutation authority plus explicit wrapper-delegate,
pathname-ABA, escaped-test-locator, and runtime-account limitations. It is not
a production composition, terminal writer input, or ownership-transfer
capability.

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
  only a frozen pathless observation with separate stable
  `hostIdentity/objectKind/device/inode` root identity, exact directory
  membership, and nanosecond mutable fingerprint; it never constructs a
  completed-stage handle. `ForTest` is restricted to code-owned temporary
  fixture roots; its explicit test owner handles post-seal cleanup and reports
  typed cleanup failure, while the production terminal primitive never deletes
  a sealed root without a composer ownership capability;
- the pathless observation has a separate strict bounded parser that
  recomputes its sealed-root and outer hashes; parsing it never changes its
  `productionAuthority:false` / `productionAdmission:"forbidden"` state and
  cannot issue a completed handle;
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
