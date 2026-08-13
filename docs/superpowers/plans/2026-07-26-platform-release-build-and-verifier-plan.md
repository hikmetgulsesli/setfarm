# Platform Release Build, Publication, and Verifier Plan

Date: 2026-07-26
Status: approved architecture implementation plan; all slices remain
shadow-blocked until clean-main activation

## Autonomous loop checkpoint — 2026-08-13

The credential-free production-admission readiness slice now exposes the
zero-input `setfarm platform-release preflight --json` diagnostic. Its strict
receipt is bounded, canonical, mutation-free, and permanently states
`productionAuthority:false` and `productionAdmission:"blocked"`. It reports
the current host enforcement baseline separately from missing Developer ID
Application/Installer identities in the active Security search list,
unverifiable external notarization credential configuration, absent fixed
installed Setfarm distribution/helper evidence, unconfigured production trust
material, and unavailable prepared-store, fresh-verifier, and registry
activation authorities.

On 2026-08-13, the source CLI exited `2`, wrote one JSON line to stdout, and
wrote no stderr. Its redacted typed receipt classified both Developer ID
identity classes as `not_observed_in_active_search_list` with count `0`; it did
not make a global keychain-absence claim. `notarytool` was `available`, known
profile metadata was `not_observed_at_known_service_names`, credential
readiness was `unverifiable_without_external_credential_configuration`, and
ticket evidence was `not_observed_without_exact_distribution`. Gatekeeper,
SIP, and authenticated root were `enabled`, and AMFI was `running`, but AMFI
runtime admission remained `unavailable_requires_authenticated_running_helper`.
The fixed expected distribution root and helper were both `absent`; the
Installer package identifier was `unconfigured`, its receipt was
`not_observed_configuration_unavailable`, exact payload binding was `absent`,
production trust configuration was `unavailable`/`forbidden`, and build
provenance remained `v1_build_provenance_only` with no platform-release
authority. The receipt recorded 15 bounded command observations and no
sensitive raw-output pattern was detected during the in-memory validation.

This checkpoint does not sign, notarize, install, query an invented package
identifier, execute a helper, restart a service, or open production authority.
The next production-admission slice remains externally credentialed and must
join an exact signed distribution, stapled ticket, Installer receipt/payload,
authenticated running helper/AMFI observation, prepared store, fresh verifier,
and registry activation authority under a separate approved design.

The focused and adjacent matrix passed exactly **63/63** tests; the source CLI
contract passed **4/4**, native package-member capture passed **4/4**, and the
script matrix passed **53/53**. Static contracts passed: TypeScript no-emit;
English **1,404 files**; paths **816 files**; source-suite imports **1/1**;
migration digests current; and `git diff --check` clean. Independent
adversarial source review returned `CLEAR` with no critical, high, or medium
finding. These diagnostic and test results are not production admission.

## Autonomous loop checkpoint — 2026-08-06

The resumed audit completed the credential-free B5D-3 network-negative pair
slice without widening production authority. Global physical identity remains
the exact `hostIdentityHash/objectKind/device/inode` tuple and mutable metadata
remains a separate fingerprint. Two real installed sandbox occurrences now join
their exact host, launch, policy, dependency, payload, process, receipt, and
physical identities under one private dependency-pair lease with strict
before/between/after fences. Pair drift, coherent rehashing, swapped or aliased
occurrences, target symlinks, same-byte inode replacement, detached layout, and
cleanup failure all fail closed. The runner also preserves the first terminal
cause and kills the detached process group. Evidence stays literal test-only,
non-promotable, and `productionAdmission:"forbidden"`; independent review found
zero critical, high, or medium issue.

The final execution-attempt regression is **974/974 across 122 suites**; root
tests are **858/858**; focused network, adjacent host/source, pair, and native
aggregate sets are **10/10**, **33/33**, **4/4**, and **47/47**. TypeScript and
whitespace checks pass. An exact tracked-and-untracked clean local `main`
snapshot completed the guarded prebuild/build/postbuild chain and emitted its
terminal clean-main manifest; the intentionally dirty canonical branch was not
built. The snapshot is recoverable in macOS Trash.

Live admission remains fail-closed. Mission Control, Setfarm dashboard, and
OpenClaw endpoints return HTTP 200; Mission Control is healthy with 220 projects
and 270 runs. PostgreSQL has zero active runs, zero open claims, 188/188 released
runtime sessions, and zero active attempt leases. Migrations 22 through 26 are
still pending. The host has zero valid code-signing identities, Gatekeeper is
enabled, and no installed Setfarm root/app, package/DMG, matching receipt, or
authenticated helper exists. Developer ID, notarization, AMFI admission, the
production composition opener, B5E durable prepared-store authority, B6 fresh
verifier, and B7 activation therefore remain blocked. No migration, credential,
signing, notarization, installation, commit, or push was performed.

## Autonomous loop checkpoint — 2026-08-05

The resumed whole-session audit found no new census or false-authority
regression. The approved stable identity remains the exact
`hostIdentityHash/objectKind/device/inode` tuple, while owner, mode, link count,
size, content, and nanosecond timestamps remain a separate mutable
fingerprint. TypeScript no-emit and whitespace checks pass. Mission Control's
normal build passes all version, English, path, and Setfarm contract checks.

The current Setfarm matrix is green for the affected and adjacent authority
surfaces: the focused physical-census group is **22/22**, scripts are
**37/37**, evidence is **104/104**, execution attempts are **941/941 across 118
suites**, root tests are **858/858**, findings are **126/126**, recovery is
**4/4**, and evals are **49/49**. A clean `main` snapshot of the exact current
workspace also completed the normal release build and passed the compiled
step/status suites at **365/365** and **12/12**. The normal build verified all
26 semantic migration digests and all eight Mission Control contract
artifacts.

Running the compiled step suite directly from the intentionally dirty feature
worktree initially produced 12 identical
`MIGRATION_UNKNOWN_VERSION: Migration journal contains unknown version 26`
failures. This was not a source or migration defect: the isolated test runner
applied the current source migration chain while the step tests imported the
ignored, deliberately unrebuilt `dist/` generation. The exact current source,
compiled through the required clean-main build path without any dirty-build
bypass, passes all 377 compiled step/status tests. The stale local `dist/` was
not promoted, edited, or used as release evidence.

The full product-compiler run is **1271 tests / 163 suites: 1267 pass, 4
fail**. The only failures remain the same pre-existing generated-scaffold
golden-hash assertions at
`node-scaffold-private-materializer-v2.test.ts:1946`, `:2409`, `:6005`, and
`:6446`. No physical-census, bootstrap, registry, artifact-store, launcher,
command-runner, or candidate-runtime test failed, so the generated fixtures
were not rewritten to conceal that historical drift.

Fresh live admission evidence remains fail-closed. Mission Control reports
healthy gateway/database/disk/memory checks (270 runs, disk 32%, memory 70%),
its project endpoint returns 220 projects, and Mission Control, the Setfarm
dashboard, and the OpenClaw gateway all return HTTP 200. PostgreSQL has zero
active runs, zero open claims, and zero active attempt leases; its attempt
ledger remains seven `inconclusive` and two `produced_delta` rows. Recent live
events are heartbeat responses rather than a new product attempt.

The host still has zero valid code-signing identities, Gatekeeper assessments
remain enabled, and `/Library/Application Support/Setfarm` plus its bootstrap,
toolchain, and audit children are absent. No `.pkg`, `.dmg`, or `.app` artifact
exists in the canonical workspace. Consequently there is no Developer ID,
notarization ticket, installer receipt/payload, or authenticated running helper
from which AMFI runtime admission could be proven. Migrations 22 through 26 are
still pending and strict verification stops at
`MIGRATION_INCOMPLETE: Migration 22 is pending`. No migration or external
credential operation was attempted. Both canonical repositories still have no
open GitHub PR.

The next credential-free B5D-2 ownership slice is now real but deliberately
non-promotable. An authentic test-fixture dependency pair is synchronously
claimed before the first `await`; fresh pair/toolchain revalidation precedes
an atomic transfer of the complete first private-parent/output-root slot. The
source registry receives a pathless non-owning transferred tombstone, the
second output and source/toolchain context are exactly removed, and the source
enters `release_completed` without retaining physical ownership. A distinct
`PlatformReleaseCompositionOwnershipTransferForTestV2` handle becomes the
only selected-slot cleanup owner. Its strict pathless receipt keeps
`hostIdentityHash/objectKind/device/inode` separate from the mutable directory
fingerprint, binds the authentic dependency-pair inspection, and states
`terminalizationState:not_performed_manifest_attestation_still_required` plus
`productionAuthority:false`. It is rejected by the production completed-stage
inspector. The one-winner concurrency test and all five claim/transfer/cleanup/
completion fault checkpoints prove that no selected or discarded root becomes
unowned; the affected suite is **64/64** and is included in the **941/941**
execution-attempt result. The same exact source passed a clean-snapshot normal
build and compiled step/status suites at **365/365** and **12/12** without a
dirty-build bypass.

No production opener was widened by this audit. The remaining production path
is still the authenticated B5D-2 composer/terminal bridge, B5E durable prepared
store and migration, B6 independently installed fresh verifier, and B7
verified-release-owned registry/evidence chain on a clean signed/notarized
host.

## Autonomous loop checkpoint — 2026-08-03

The next credential-free destructive boundary is closed: candidate-runtime
`package-lock.json` cleanup now joins exact BigInt device/inode, owner, and
object-kind identity from the original sealed source checkpoint, revalidates
the bundle root and target immediately before unlink, and preserves the
pathless public receipt ABI. Its replacement/kind-drift regression is **1/1**;
independent review is GREEN; TypeScript and whitespace checks pass. The latest
broad execution-attempt run was **935 tests / 118 suites: 934 pass, 1
transient shared-lock test-harness timeout**; the exact Darwin fixture rerun
passed **47/47**. The selective product fixture reached this boundary and
still ends only at the
known unrelated story-plan golden-hash mismatch, so no generated fixture was
rescued.

Live admission evidence is unchanged: Mission Control health is healthy,
dashboard and gateway return HTTP 200, memory is 69%, code-signing identities
are zero, `spctl` assessments are enabled, install roots/artifacts are absent,
and migrations 22–26 remain pending. No production opener or credential was
promoted.

## Autonomous loop checkpoint — 2026-08-02

The global physical census design is now characterized through the complete
aggregate leaf join: every stable physical identity is the separate
`hostIdentityHash/objectKind/device/inode` tuple, while owner/mode/link/size/
content/time values remain a mutable fingerprint. V, R, S, and A relations are
rejoined only as frozen, pathless, hash-only observations with
`semanticReady:false`, `productionAuthority:false`, and
`productionAdmission:"forbidden"`. The aggregate mapper also recomputes
component hashes and checks the source census, held locks, exact recursive
tree, parent graph, directory membership, and global locator alias fence.

The current execution-attempt regression is **933 tests / 118 suites / 0
failures**; the focused host/execution/capsule/native slices are 24/24,
41/41, 58/58, and 21/21 respectively. TypeScript and whitespace checks pass.
Mission Control builds cleanly and the live Mission Control, Setfarm
dashboard, and OpenClaw endpoints all return HTTP 200. The full product-
compiler run is **1257/1261 passing across 162 suites**, with the same four
generated-fixture golden-hash failures; they are not a platform admission
failure and are not being rescued. The V2 exact-identity bridge now also
fences claim-owned interrupted-tree root cleanup and both rollback quarantine
final removals immediately before destructive `rmdir`, so no numeric-only root
deletion fence remains in the durable Node provisioning and bootstrap paths.
The final provisioning/rollback command slice is 32/32, with the host authority
slice 19/19; the independent rollback review found no uncovered rollback root
entry point.
Direct production-opener probes also remain fail-closed: Node provisioning
rejected with `NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID`, bootstrap package
with `NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_INVALID`, installed bootstrap
with `NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID`,
and the Darwin descriptor backend with `DARWIN_FILESYSTEM_BACKEND_UNAVAILABLE`.
An independent B5D/B6 review passed the selected release-boundary mechanics
50/50. It found no new credential-free production slice: B5D-0b provenance,
the real composer/ownership-transfer terminal capability, and B6 fresh
verifier/prepared-store authority remain absent. The legacy V2 host-composition
numeric projection is intentionally left non-production until the V3 receipt
bridge; changing it now would not close an admitted path.
Live PostgreSQL currently contains 7 `inconclusive` and 2 `produced_delta`
attempts. The migration plan remains pending for versions 22–26. The host has
no valid code-signing identity, no installed Setfarm root, and no
package/DMG/app artifact; the working branch has no GitHub PR and its Setfarm
build guard correctly refuses non-`main` builds. Independent boundary review
found no additional credential-free release-composition slice. One adjacent
numeric-identity defect was still actionable without credentials: the durable
Node provisioning and bootstrap-installation V2 directory/ready-plan fences
could have accepted rounded device/inode values. The durable open/revalidate
paths and the bootstrap root inspection now capture exact bigint stable
identity before projecting into the unchanged V2 numeric receipt ABI and fail
closed when the projection is not injective; focused provisioning/bootstrap
tests and the exact-identity regression pass. Other candidate inspection DTOs
remain non-authoritative until the full V3 receipt bridge is landed.

These facts reclassify the next production slice as the authenticated B5D-2
composer/terminal bridge and then B6 fresh verifier. They require a clean-main
host with installed, independently authenticated Developer ID/notary/AMFI
helpers, durable release-store migrations, and real descriptor-relative
two-pass captures. No serialized fixture or coherently rehashed foreign DTO is
allowed to cross that boundary.

### Fresh resumed audit — exact destructive cleanup fences (2026-08-02)

The resumed loop found a credential-free root slice in the durable Node and
bootstrap cleanup paths. Four staged/claim-owned unlink/rmdir boundaries, the
two rollback child-cleanup loops, and both rollback-root `renameSync` boundaries
now recapture exact `lstatSync(..., {bigint:true})` stable identity immediately
before mutation, require the expected object kind, and reject symlinks or
non-injective projections into the unchanged V2 numeric receipt ABI. Rollback
roots use the identity captured before the writable-transition hook, so a
post-hook replacement cannot be quarantined. Existing mutable
owner/mode/link/size/content checks remain in force; V2 receipt hashes and
schemas are unchanged. The exact bridge is data-only and never creates a
production capability.

The same loop then closed the next production-facing disposal boundary in
`node-toolchain-private-tree-v2.ts`: authenticated file, child-directory,
normalized-tree-root, and private-stage-root deletion now use the retained
state fingerprints plus the exact BigInt/object-kind matcher. Best-effort
failure cleanup remains deliberately unchanged. Its focused product-compiler
slice is **7/7 passing**, with TypeScript still clean.

The following prepared-package disposal boundary in
`node-toolchain-provisioner-bootstrap-prepared-package-v2.ts` now retains each
captured directory's absolute path internally and exact-fences all four payload
file unlinks, `bin`/`lib`/`runtime` child-directory removals, the payload root,
and the stage root immediately before deletion. The unchanged prepared-package
receipt ABI is still numeric/pathless; the exact matcher is only a
credential-free destructive guard, and `safeRemoveFailedStage` remains
untouched. The combined provisioning/bootstrap/identity focused slice is
**34/34 passing** after this patch.

The next retained-state boundary is now fenced in
`node-toolchain-distribution-authority-v2.ts`: authenticated receipt-failure
cleanup and public archive disposal exact-check the private archive as an
ordinary file before unlink and the private root as a directory before rmdir,
using the retained root/archive fingerprints. The earlier primary-failure
`copyAndVerifyArchive` cleanup still has no retained state and remains the
best-effort path-only fallback. Receipt, handle, and production/test scope
ABIs are unchanged; the focused distribution authority regression is **7/7
passing**.

The authenticated archive-inventory finally path now applies the same guard in
`node-toolchain-archive-inventory-v2.ts`: successful private staging retains an
internal root fingerprint, and inventory cleanup exact-checks the archive file
before unlink and private root before rmdir. The pre-success staging failure
fallback remains path-only because it has no retained root/archive state.
Inventory receipt, handle, and tar-adapter ABIs are unchanged; its focused
regression is **8/8 passing**.

The host-toolchain probe cleanup now retains a safe projection of the probe
root's exact BigInt identity after chmod and verifies that identity plus
directory kind immediately before the dynamic npm-cache tree's recursive
removal. Capture, replacement, and removal errors are typed
`PROBE_CLEANUP_FAILED`; when the identity cannot be bound, cleanup is skipped
rather than deleting an untrusted path. The host authority focused regression
is **19/19 passing**, the host-node execution/capsule focus is **67/67
passing**, and the platform-release error translation map remains exhaustive.

The bundle-authority stage root was reviewed but intentionally not changed:
its builder-owned tree has dynamic children and recursive pathname cleanup, so
a root-only fence would not prove child ownership and would create a false
authority boundary. A descriptor-relative/per-child cleanup design is a larger
slice and is not needed to clear the current external admission gate.

The candidate-runtime private attempt's lower-level failure cleanup remains
deferred for the same reason: its authenticated path performs a recursive
`makeWritable` walk before removal, so a root-only exact fence would not prove
the ownership of every child that the walk can chmod or that recursive removal
can traverse. The explicit scaffold/private-stage and execution-environment
root slices above are bounded root-owned cases; candidate-runtime per-child
descriptor cleanup is a separate larger authority design.

The authenticated scaffold private-stage destroy now applies the same exact
BigInt `device/inode` plus directory/non-symlink fence to the retained private
root immediately before recursive removal in
`node-scaffold-private-materializer-v2.ts`. Its existing numeric/type/realpath/
owner/mode admission gate and status ordering are unchanged, while the
best-effort `safeRemoveOwnedAttemptV2` path remains intentionally untouched.
The targeted materialize-and-replacement-root regression is **2/2 passing**;
TypeScript and whitespace checks pass. The full scaffold file still has four
known generated-fixture golden-hash mismatches (21/25 passing), matching the
existing product-compiler fixture class rather than this cleanup path; it is
not a platform-admission failure and was not repeatedly rerun.

The authenticated execution-environment destroy now exact-checks its retained
private root with a BigInt `device/inode`, directory/non-symlink, and owner
fence immediately before recursive removal in
`node-scaffold-execution-environment-v2.ts`. The prior full mutable fingerprint
and canonical-path gate, lifecycle transition, and void ABI remain unchanged;
the focused replacement-root regression is **1/1 passing**, with TypeScript and
whitespace checks clean. Lower-level creation-failure cleanup still has no
durable identity and remains the deliberately lower-authority path-only
fallback.

The source-admission module's four authenticated private-root cleanup paths now
recheck their retained exact BigInt directory identity (including owner and
non-symlink kind) immediately after the writable traversal and immediately
before recursive `rmSync`. The source, build-toolchain, and production-
dependency paths use domain-specific failure callbacks, so their public error
codes and lifecycle/receipt ABIs remain unchanged. The full source-admission
focused suite is **9/9 passing**, with TypeScript and whitespace checks clean.
The recursive child walk remains a larger descriptor-relative containment
boundary; this slice closes the root replacement window without claiming that
larger authority.

The npm install normalization boundary now retains an internal exact BigInt
census keyed to the original raw-entry array (captured root path plus root and
every locator) without changing the public `RawNpmInstallEntryInternalV2` DTO.
The hidden
`.package-lock.json` file and each validated `.bin` directory are revalidated
against that original census: the root exact identity is checked first, then
the target exact device/inode, owner, and object kind immediately before
deletion in the scaffold, build-toolchain, and production-dependency
materializers. A missing, foreign, or root-path-mismatched census fails closed through the
existing domain-specific install-tree errors; a census captured only after
validation is never accepted. The replacement-target regression is **4/4**,
the combined build-toolchain/dependency focused file is **58/58**, and
TypeScript/whitespace checks pass. Recursive cleanup of arbitrary dependency
children remains outside this explicit-target slice.

The candidate-runtime production normalization boundary now carries the same
exact identity discipline for its explicit `package-lock.json` unlink. The
sealed source checkpoint keeps an internal BigInt sidecar keyed to the
original frozen file object, and the source-before/source-after join requires
the exact file identity to remain unchanged. Immediately before unlink, the
candidate bundle directory and package-lock target are each re-lstated with
exact device/inode, owner, and object-kind checks; the public pathless source
checkpoint and materialization receipt remain unchanged. A replacement-file or
directory-kind regression is **1/1 passing**, and TypeScript/whitespace checks
remain clean. The recursive candidate-attempt failure cleanup is still
deferred because its writable child walk and recursive removal need a larger
descriptor-relative/per-child authority design. The selective existing
candidate-runtime fixture reached the new boundary successfully; it still
ends at the pre-existing generated-fixture story-plan golden-hash mismatch at
`node-scaffold-private-materializer-v2.test.ts:6005`, so that fixture failure
is not attributed to this slice or rescued.

### Fresh resumed audit — hybrid CAS physical identity (2026-08-03)

The production-reachable `artifact-store.ts` CAS writer, reader, inventory,
and hybrid authority paths now use the global physical census internally.
Every root, lock, staged temp, canonical final, and inventory entry captures
exact BigInt `device/inode/objectKind`; the mutable file fingerprint remains
separate as `size/mtimeNs/ctimeNs/mode/uid/nlink`. All `lstat` and descriptor
`stat` observations use `{ bigint: true }`, and the owned-temp unlink,
attempt/staging `rmdir`, lock cleanup, and final-link checks re-capture the
stable identity immediately before mutation. The public CAS, batch, inventory,
lease, and receipt ABIs remain unchanged.

The focused CAS/authority/inventory/reader/publisher group is **187/187**;
the independent artifact-store review reran the relevant suites at **61/61**
and marked the slice GREEN. TypeScript and whitespace checks pass. The full
product-compiler regression remains **1264 tests / 162 suites: 1260 pass,
4 fail**, with exactly the known generated-scaffold story-plan golden-hash
fixtures at lines 1946, 2409, 6005, and 6446; no artifact-store test failed
and no generated fixture was modified.

The review records three bounded follow-ups rather than claiming a larger
authority boundary: descriptor-relative unlink/rmdir to eliminate the final
pathname micro-TOCTOU, a transition-aware mutable-fingerprint policy for the
intentional hard-link `nlink` changes during staging, and consistent
`O_NOFOLLOW` treatment for standalone root handles. None is an active
false-authority failure in the current hybrid path.

### Fresh resumed audit — V3 build and sealed-runtime census (2026-08-03)

The production V3 build capture in `src/execution/v3-build-artifact.ts` now
uses an internal exact BigInt `device/inode/objectKind` identity with a
separate `mode/size/mtimeNs/ctimeNs` fingerprint. Every path walk, file and
directory rescan, and final worktree fence uses `{ bigint: true }`; the root
final fence intentionally compares physical identity only, while files and
directories compare the full mutable fingerprint. V3 receipt fields
`byteLength`, `totalBytes`, `executable`, hashes, and evidence references stay
numeric/pathless and unchanged. The focused V3 build/sealed/deploy group is
**44/44**; independent review is GREEN.

The downstream `src/execution/v3-sealed-runtime.ts` capture chain now follows
the same policy for accepted source files, copied build files, dependency
trees, sealed-runtime manifest traversal, state directories, and seal
authority reads. Exact BigInt values are converted to bounded numeric values
only at capacity admission or the unchanged manifest/authority DTO boundary;
all mode masks use BigInt literals. The combined build, sealed manifest,
deploy-executor, receipt-ledger, and Darwin-isolation focus is **49/49**;
independent review is GREEN; TypeScript and whitespace checks pass.

A fresh execution-attempt regression after both V3 capture slices remains
**935/935 across 118 suites**. No production opener, schema, or credential
boundary was widened. The next ranked credential-free identity candidate is
the private bootstrap package capture/revalidation path; it will be handled
only if its public receipt ABI can remain unchanged, with the broader bounded
file-reader migration kept as a separate coordinated slice.

The bootstrap package capture/revalidation slice is now complete. Its private
`FingerprintV2` uses exact BigInt `device/inode/objectKind`, owner/mode/link/
size, and `mtimeNs/ctimeNs`; every `lstatSync`/`fstatSync` uses
`{ bigint: true }`, and bounded file bytes become numbers only after an exact
BigInt limit and safe-integer check. Manifest, verified-handle, process, and
launcher ABIs remain unchanged. The provisioning/bootstrap/command focus is
**36/36**, independent review is GREEN, and the full product-compiler run is
**1264 tests / 162 suites: 1260 pass, 4 fail** with exactly the four known
generated-scaffold golden-hash assertions; no bootstrap test failed.

The next local authority candidate is the private Node toolchain tree’s
capture/revalidation fingerprint (raw/normalized tree receipts expose hashes,
not physical IDs). The public command-v2 inspection path is deliberately
separate because its numeric filesystem entry fields are part of a V2 schema;
it requires an exact sidecar plus injective compatibility projection rather
than a direct field replacement.

That private-tree slice is now complete. `node-toolchain-private-tree-v2.ts`
captures every authoritative raw/normalized file and directory observation
with exact BigInt `device/inode/objectKind`, separate BigInt mode/owner/link/
size/`mtimeNs`/`ctimeNs` mutable state, and `{ bigint: true }` for every
`lstatSync`/`fstatSync`. Buffer allocation crosses to `number` only after an
exact bound and safe-integer check; the pathless receipt, bundle, and public
entry byte-length ABI remain unchanged. Authenticated file, child-directory,
normalized-root, and stage-root disposal now rechecks exact identity and
object kind immediately before `unlinkSync`/`rmdirSync`; best-effort failure
cleanup remains intentionally non-authoritative. The exact helper and private
tree focus is **10/10**, TypeScript/whitespace checks are clean, and independent
review is GREEN. The broader product-compiler run is **1264 tests / 162
suites: 1260 pass, 4 fail**; all four are the same generated-scaffold
golden-hash assertions at lines 1946, 2409, 6005, and 6446, with no
private-tree, provisioning, or command failure. No generated fixture was
modified.

The follow-on execution-attempt regression reached **935 tests / 118 suites**
with 934 passing and one Darwin native fixture timeout while a test helper
waited for an external shared-lock holder. Re-running that exact fixture in
isolation passed **47/47**, so the broad failure is classified as transient
test-harness contention rather than a platform regression.

The next bounded deployment slice closes all six filesystem observations in
`src/execution/v3-deploy-executor.ts`: `ensureSafeRuntimeLog` compares exact
descriptor/path device/inode and ordinary-file kind, while lease, deployment,
isolation-control, and build-artifact readers use `{ bigint: true }`, BigInt
mode masks, and exact owner checks. Symlink, canonical-path, and 0600 guards
remain unchanged; public deployment receipt, lease, state, and artifact ABIs
are untouched. Deploy/Darwin-isolation focus is **23/23**, the adjacent V3
build/sealed/deploy group is **39/39**, TypeScript/whitespace checks pass, and
independent review is GREEN. Descriptor-relative unlink and retained mutable
fingerprints remain separate follow-ups.

The private Node test command now captures its single admitted test member
with exact BigInt descriptor/path kind, link, mode, device/inode, and
`mtimeNs`/`ctimeNs` checks. It rejects oversized input before allocation and
uses a fixed-size read loop plus EOF probe before projecting the unchanged
result `testByteLength` after a safe-integer check;
the focused Darwin-gated command tests pass **3/3** and the result ABI is
unchanged. The CLI plan-file reader then received the same transport-local
fence: descriptor and path `BigIntStats` are compared across the bounded read,
while the serialized V2 plan schema and hashes remain numeric/unchanged. The
provisioning/private-tree focused loop is **39/39**, with TypeScript and
whitespace checks clean; independent review is GREEN. A serialized V2 plan
still cannot carry a private WeakMap sidecar, so command/installation-plan
physical census transport remains a separately designed V3 boundary.

The next command boundary is therefore explicitly classified as a transport
slice, not a numeric field replacement. `node-toolchain-provisioner-command-v2`
and `node-toolchain-provisioner-bootstrap-installation-plan-v2` serialize
inspection/plan/claim/receipt JSON, so an in-process WeakMap cannot protect
plan-to-apply or CLI round trips. The approved V3 shape will reuse the existing
physical-census contracts: a decimal `StableFsObjectIdentity` carrying
`objectKind/device/inode`, a separately hashed decimal ns mutable fingerprint,
and a scope hash. Those exact observations must travel through the plan,
operation/rollback evidence, and CLI plan-file envelope (or a hash-bound
sidecar) before the production command can claim exact identity. Until that
transport is implemented end-to-end, V2 numeric inspection remains explicitly
non-authoritative for this census dimension; no lossy compatibility patch is
being promoted.

The product-compilation projection replay gate now also uses exact BigInt
descriptor/path observations and a fixed-size read loop with EOF probe. It
checks ordinary-file kind, one link, full mode/owner/size, device/inode, and
`mtimeNs`/`ctimeNs` before accepting bytes; the canonical projection receipt
and numeric `byteLength` schema stay unchanged. Workspace/repository/recovery
focused tests pass **16/16**, TypeScript and whitespace checks pass, and the
independent review found no false-authority regression.

The V3 seal-capacity lock is now bound to an exact BigInt ordinary-file
identity (`device/inode/owner/objectKind`, with one link) alongside its
canonical mutable lock bytes. Acquisition captures the identity from the
open descriptor and matches it to the path before returning; abandoned-lock
reaping and normal release compare the retained bytes and identity, then
recheck the exact identity immediately before `unlinkSync`. The public
reservation and lock schema are unchanged. The focused identity regression is
**2/2**, the sealed-runtime suite is **15/15**, the Darwin native aggregate
fixture is **47/47**, and independent review is GREEN.

The durable artifact-store authority now uses the same exact physical census
internally: every root, marker, kernel-lock, staging directory/file, canonical
stage, and binding-claim identity is captured with BigInt `device/inode` plus
`objectKind`; mode/owner/link/size/time remain a separate mutable fingerprint.
All authenticated staging temp unlinks, abandoned-attempt `rmdir`, canonical
stage cleanup, and post-crash binding-claim cleanup re-capture that exact
identity immediately before mutation. V1 JSON, lease, and receipt ABIs are
unchanged. The authority and staging regressions are **42/42**, with
TypeScript/whitespace checks clean; no foreign or same-byte replacement is
accepted as owned authority.

The full product-compiler regression after this change is **1264 tests / 162
suites: 1260 pass, 4 fail**. The four failures are the same pre-existing
generated-scaffold golden-hash mismatches at the known story-plan fixture
assertions; no artifact-store authority or staging test failed, and no
generated project was altered to make the run green.

The focused provisioning/bootstrap/bridge regression is **34/34 passing**;
the direct identity/object-kind unit slice is **2/2**; TypeScript and
whitespace checks pass; and a fresh broad execution-attempt regression after
these cleanup slices, including the candidate-runtime and V3 lock fences, is
**935/935 passing across 118 suites**. Independent
review marked the cleanup,
rollback-child, rollback-root rename, authenticated private-tree disposal,
prepared-package disposal, distribution disposal, archive-inventory disposal,
host-probe cleanup, scaffold private-stage destroy, execution-environment
disposal, source-admission private-root fences, npm normalization target
fences, candidate-runtime package-lock/root fences, V3 seal-capacity lock, and
artifact-store authority/staging exact fences ownership GREEN; no RED remains
in these slices.

The live gate is unchanged: `security find-identity` reports zero valid
codesigning identities, `spctl` assessments are enabled, Setfarm install roots
and package/DMG/app/notary artifacts are absent, and contract-spine migrations
22–26 remain pending. Mission Control, Setfarm dashboard, and gateway remain
HTTP healthy (the latest Mission Control health response is healthy with
memory at 69%). No production opener was promoted and no external credential
was used. The latest zero-input host/composition/registry probes also remain
fail-closed (`HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID`,
`HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE`, and
`PRODUCTION_ACTIVATION_FORBIDDEN`).

### Fresh resumed audit — provisioner V3 physical-census transport (2026-08-03)

The approved global physical-census transport is now implemented end to end for
the Node toolchain provisioner. The additive V3 envelope carries the exact
seven-role census (`parent`, `root`, `receipt`, `claim`, `rollback_claim`,
`lock`, `staging`) with the exact
`hostIdentityHash/objectKind/device/inode` stable identity and a separately
hashed decimal-nanosecond mutable fingerprint. The transport plan member is
validated by the shared strict V2 plan schema; there is no permissive `unknown`
plan authority and no second command-local schema. All V3 DTO builders
recursively freeze their output; the canonical role-order tuple is runtime-
frozen as well, and the handle-level transport builder reparses through the
same recursive-freeze parser. `other` objects include `rdev` in the exact
capture comparison.

The default host identity no longer derives from hostname, kernel release,
architecture, or admission scope. On Darwin it hashes the code-owned
`IOPlatformUUID` returned by `/usr/sbin/ioreg`; on Linux it uses a bounded
`/etc/machine-id` or `/var/lib/dbus/machine-id` source. The raw machine value
never enters a receipt, and absence or malformed output fails closed. Scope
fields remain independently bound to architecture and admission scope, so one
machine identity cannot be silently forked by target selection.

The V2 publisher and rollback state machines now expose one additive
precondition callback that runs after their kernel lease is acquired and before
any publication/destructive mutation. V3 apply and rollback re-capture the
exact census in that lease window, in addition to the initial transport check.
The only allowed census delta is the code-owned preparation transition:
production-parent creation and `lock/staging` absent-to-present setup; the
parent stable identity/owner/mode and the complete code-owned parent member
fence remain checked. `verify_existing` performs the same final check
immediately before opening the ready authority. The historical V2 plan/receipt
numeric ABI is unchanged. A descriptor-relative directory snapshot for a
non-cooperating external writer remains a larger follow-up; the current lease
and member fence serialize cooperating Setfarm writers.

V3 CLI failures use a new
`setfarm.node-toolchain-provisioner-cli-failure.v3` schema, while the V2
failure schema and command-ref enum remain readable by existing V2 consumers.
V3 plan/apply/rollback commands continue to use bounded descriptor/path
BigInt reads, canonical bytes, and no-follow/unaliased file fences.

Focused verification is **6/6 physical-census tests**, **32/32 provisioner
command tests**, and TypeScript clean. The subsequent product-compiler run is
**1265/1269 passing across 163 suites**; the only four failures remain the
known generated-scaffold story-plan golden-hash fixtures at lines 1946, 2409,
6005, and 6446. No V3, provisioning, or CLI test failed, and no generated
fixture was changed. The transport slice is therefore closed; the next ranked
work remains the authenticated B5D-2 composer/terminal bridge and B6 verifier,
which are externally gated by credentials, installed roots, and migrations.

The same resumed loop closed one adjacent physical-identity gap in the
code-owned network sandbox: fixed executable/module captures and the optional
scratch-root fence now use exact BigInt `lstat` values, retain
`objectKind/device/inode` as a stable identity, and keep owner/mode/link/size/
nanosecond-times/content as a separate mutable fingerprint. The external V2
receipt and launcher fields remain unchanged; only the private physical hash
domain is versioned to reflect the lossless payload. The network sandbox suite
is **5/5**, the Darwin network-observation suite is **2/2**, and TypeScript plus
whitespace checks remain clean. Downstream integration was rerun without
promoting any authority: the combined network/launcher/process slice is
**24/24**, host-composition is **12/12**, the Darwin filesystem backend is
**5/5**, registry activation is **21/21**, and the release-component/build
capsule checks are **86/86**. The one attempted combined invocation exceeded
its normal quiet interval because the build-capsule fixture is intentionally
long-running; its completed result was green and no test process remains.

The next adjacent test-only authority gap is also closed: Node CLI and Express
API launcher source captures now use exact BigInt stat comparisons, preserve
stable `objectKind/device/inode`, and keep owner/mode/link/size/nanosecond-time/
content values in a separate mutable fingerprint. Their existing pathless V2
receipt fields remain unchanged; only the private physical hash domains move
to V3. The launcher/network/private-process regression is **22/22** with
TypeScript and whitespace checks clean.

The same treatment now covers the test command-evidence runner: its source
module fence rejects non-files, hard links, symlinks, and any exact BigInt stat
drift, while the private runner hash retains a separate stable identity and
mutable fingerprint. The command/launcher/component regression is **37/37**;
no production runner capability or V2 receipt field was changed.

The candidate-runtime sealed-file capture is now lossless as well. Descriptor,
post-read, and path observations compare exact BigInt stable/mutable stat
values (including `rdev`, nanosecond times, owner, mode, and link count), and
the private file hash uses a nested V3 stable identity plus mutable fingerprint
while the source-checkpoint ABI remains V2. The exact-identity and candidate
runtime boundary checks are **2/2**. The full scaffold materializer remains
**21/25** only because the four pre-existing generated-story-plan golden-hash
fixtures still differ; no generated output was edited or rescued.

The follow-up census scan found no additional safe partial migration: the
remaining numeric projections belong to the legacy bootstrap/install and
scaffold receipt ABIs, so changing only their private capture would create a
second unjoined authority rather than close production admission. They remain
deferred behind the planned V3 receipt bridge. The unchanged distribution
authority audit is **7/7** and confirms its existing exact cleanup projection
remains closed without widening that ABI.

### Fresh resumed live-admission audit — 2026-08-03

The resumed read-only admission audit reconfirmed the external boundary. The
host reports **0 valid code-signing identities** while `spctl` assessments are
enabled; no Setfarm installation root or `.pkg`/`.dmg`/`.app` artifact is
present. Mission Control, the Setfarm dashboard, and the gateway remain
healthy on their existing local ports. PostgreSQL's contract-spine plan shows
migrations **1–21 adopted/applied** and **22–26 pending**; the verifier stops
at the first missing release migration with `MIGRATION_INCOMPLETE: Migration 22
is pending`. No migration write was attempted: the apply command correctly
requires a clean release worktree, while this feature branch intentionally
retains the uncommitted implementation under review.

The latest local health sample remains live: Mission Control reports healthy
database/gateway/disk checks (270 runs, disk 32%, memory 83%), the Setfarm
dashboard is HTTP 200, and the gateway health endpoint is live. GitHub still
shows no open Setfarm or Mission Control pull request for this worktree.
The live execution ledger is unchanged at **7 inconclusive** and **2
produced_delta** attempts; the most recent events are completed heartbeat
responses, not a new product attempt.

No new credential-free production slice is justified by this evidence. The
remaining work stays classified as the authenticated B5D-2 composer/terminal
bridge, B5E prepared store, B6 fresh verifier, and B7 verified-release registry
chain.

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

The native-distribution admission contract is now frozen before attempting live
AMFI success. It designates the host verifier executable as the filesystem-
backend provider; contains exactly one ordered arm64 and x64 artifact entry;
binds exact artifact length/content/CDHash, source tree, build recipe, build
attestation, package manifest, registry/global-operation/backend/capture ABI
hashes, positive epoch, installer ID and macOS signing-policy commitments; and
verifies a domain-separated canonical Ed25519 catalog signature. Catalog-wide
semantic-role separation rejects fully rehashed cross-family aliases while the
selected entry projects every evidence, ABI, policy, envelope, and receipt join.
Local tests use an ephemeral key only through a mechanics API whose frozen
receipt states `productionAuthority:false`; same-key cross-catalog replay cannot
select. No catalog DTO, test signature, or caller-supplied public key reaches
the private backend constructor or zero-input production opener. Real Developer
ID/notary credentials, production public key, installer receipt, durable epoch
floor, signed binaries, and Security.framework self-attestation remain explicit
blockers.

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

Before physical cutover implementation, add one pure JSON physical-census
foundation. A strict self-hashed bootstrap filesystem-scope identity binds the
registry contract and a 256-bit nonce. The later physical activator, not this
foundation slice, generates the nonce with an operating-system cryptographic
RNG, binds it into activation claim/staging, and publishes the fixed scope
document. Do not derive it from host-composition authority and do not add a
registry name, stage member, or reducer transition in this slice.

The foundation models stable object identity, occurrence fingerprint, and
path-entry capture separately. Stable identity contains only filesystem scope,
object kind, device, and inode. The fingerprint contains mutable owner, mode,
link-count, byte-length, and unsigned nanosecond observations. The entry fence
joins the exact classification and parent to the object/fingerprint plus
raw-byte evidence for a regular file or one bounded self-hashed, uniquely
UTF-16-sorted basename/object-kind membership identity for a directory (with
explicit empty membership allowed). The full physical census joins the exact
logical census one-for-one in the same order, requires one directory parent,
rejects transplanted scope/parent state, and forbids raw filesystem-locator
aliases among global direct children. The alias key binds scope, device, and
inode without object kind, preventing cross-kind relabeling from bypassing
parent/child or child/child uniqueness. Transaction, package-root, and
generation-staging classifications are directories; current remaining
lifecycle entries are ordinary files. Bound owner UID/GID to
`0..4294967294`, and enforce canonical byte caps in exported schemas as well as
their parser/builders.

Build every package lifecycle physical projection only by filtering that full
census in global order. It binds both source census hashes, requires exactly
one package lock, and derives the lock's stable object identity. The Node
lifecycle is an adapter view of the same projection, not an independent
physical census.

The pure activation observation now carries the complete self-hashed
filesystem-scope document and, for an exact namespace, the complete physical
census. Its duplicate logical census must be canonically equal to the physical
census's logical source. An epoch-claim observation carries only the full
source-bound package lifecycle physical projection; no independently supplied
package snapshot or lock hash is reducer authority. Reproduction against the
current namespace rejects a valid projection transplanted from a different
scope, census, or replacement lock inode. The Node adapter is derived from and
joined to that same projection. The later physical activator must still
generate and publish the fixed external scope document; without that
separately installed anchor, replacement of an entire observation together
with its internally consistent scope remains outside this pure reducer's trust
boundary.

Every exact semantic registry document observation also carries the observed
occurrence fingerprint and raw-content hash, and joins those fields plus its
stable object identity to the one matching full-census capture. Activation and
epoch claims are included; self-hash equality never substitutes for this
physical join. Published JSON bytes are code-owned canonical UTF-8 with no
trailing newline, and their raw hash is SHA-256 over those exact bytes. The
legacy Node lock retains its existing fixed content. Each non-Node package lock
uses the code-owned V2 lock bytes binding the registry contract hash and package
ref; the shared lock uses its contract-owned fixed content hash. The parent
boundary joins its full fingerprint to the physical-census parent.

Crash-safe activation is claim-first through the fixed activation claim and
fixed transaction-staging directory. The claim binds the current Node lifecycle
snapshot, pre-activation physical namespace capture, staging-directory
physical identity, a claim-independent staged-payload census over each fixed
member's logical content identity and physical object identity, staged
shared-lock physical identity, exact genesis hash, and expected
activation-receipt hash. The final shared lock, genesis floor, and activation
receipt must be the same physical objects that were staged, not replacements
with equal bytes. Once the receipt is present, cleanup uses
`shared parent -> legacy Node`; this is separate in the migrator protocol
identity from its pre-receipt `legacy Node -> shared parent` order and from the
steady-state policy requiring claim and staging absence. The same protocol
identity commits the fixed cleanup member order and the partial-census domain
`setfarm.platform-release-bootstrap-registry-activation-cleanup-remaining-census.v2`.
Cleanup removes the staged activation receipt, genesis state, and shared lock
in that fixed order, then the empty directory, then the claim. After a crash,
`cleanup_partial` preserves the exact directory physical identity and initial
claim-bound census while a domain-separated current census is reproduced from
the exact remaining-member suffix with both identities. Exact staging starts
cleanup, partial staging resumes at the first remaining member, and absent
staging reconstructs the initial logical/physical census from the final
objects before removing the claim. A foreign, unknown, reordered, skipped, or
replaced member is never cleanable. Every retry holds
`shared parent -> legacy Node`, and every steady registry operation remains
blocked until claim and staging are both absent. Claimless activation staging
is only a legacy-lock cleanup orphan; it cannot resume cutover. It is cleanable
only when the staging directory fingerprint, self-hashed structured membership,
typed ordinary-file entry captures, and orphan census reproduce one exact safe
known set. A nonempty activation orphan is cleanable only as the full fixed
triplet: its shared-lock logical/raw hashes are the code-owned lock bytes, its
genesis logical/raw hashes are the exact code-owned genesis document, and its
receipt logical/raw hashes are recomputed from the exact legacy lock, Node
lifecycle, parent, and staged shared-lock physical identity. A claimless epoch
orphan has no authority for any target document, so only its demonstrably empty
directory is cleanable. Opaque hashes, foreign content, ambiguous or changing
membership, or any member not bound to that exact directory yield corruption
and `no_mutation`. Staging carries no `claimHash`; the sibling claim joins through
transaction, staging, census, and expected payload identities outside the
staged census.

Absent activation targets use no-replace hard-link publication. The exact
staged occurrence moves through link counts `1 -> 2 -> 1`: stage only,
stage/final overlap, then final only after durable stage unlink. Its occurrence
fingerprint changes, but its stable filesystem-object identity does not. Every
staged payload observation is a strict typed member containing its logical
identity, exact code-owned basename/classification, full staging-directory
parent stable identity/hash, derived ordinary-file stable identity, full
occurrence fingerprint, and raw content hash. The directory's structured
membership must canonically equal those exact live entry captures. Staging
census hashes deliberately project the logical and stable-object identities so
that the expected link-count transition does not change claim identity. Every
global ordinary file defaults to `nlink=1`; a raw scope/device/inode alias is
otherwise forbidden:
the only activation exceptions are the exact staged-receipt/final-receipt,
staged-genesis/final-floor, and staged-shared-lock/final-shared-lock relations,
with stage-only `nlink=1`, live overlap `nlink=2` on both occurrences, equal
bytes, and otherwise canonically equal fingerprints, then final-only
`nlink=1`. A staged member may never alias the legacy or package lock, the
namespace parent, or another staged member; hidden links on an unrelated or
final-only ordinary file are corruption.

The registry also owns durable monotonic per-package distribution-epoch floors.
The fixed epoch-floor state is itself the sole receipt-last authority: updates
are claim-first and atomically replace that state under the shared lock, without
an unbounded receipt namespace. Removal never lowers a floor; an older exact
artifact can run only with a distinct offline-signed rollback authorization
bound to the current floor and target artifact.

Epoch claims carry both full strict prior and target state documents plus their
hashes. The target is exactly the safe next generation, binds the prior hash
and claim transaction, changes only the declared package entry, and strictly
increases that entry's distribution epoch while every other entry remains
canonically exact. The current floor must canonically equal the full prior or
target document. Epoch recovery also binds the source-bound package lifecycle
physical projection, observed installation generation, stage
directory/census, parent, shared lock, and distinct claim identities. The
projection is the canonical filter of every full physical-census entry owned by
the claimed package and must include its package lock. For Node, the same
projection's logical census hash must also equal the exact Node lifecycle
snapshot and its derived lock object identity must equal the legacy Node lock.
Epoch staging has one
exact target member whose logical state hash and physical object identity
derive the claim-bound initial census. Prior-state recovery requires that exact
stage carrying the full target document canonically equal to the claim target.
After the target object is atomically consumed, only target-state recovery may
use `epoch_target_consumed`, with the unchanged initial census, the same target
physical identity, an exact empty remaining-member projection, and its
domain-separated current census. No sibling `claimHash` is staged. A claimless
epoch-floor staging directory is cleanable only from a fully activated
receipt/lock/floor boundary under the shared lock; it is never transaction
authority.

Epoch-floor publication uses same-filesystem atomic replacement of the staged
target, not hard linking. Its only valid physical sequence is
`prior + exact -> target + epoch_target_consumed -> target + absent`.
`target + exact` is fail-closed by the reducer. The consumed rename relation
requires the claim-bound staged and target stable object identities and raw
bytes to match while each captured occurrence has `nlink=1`; unlike activation,
it is never accepted as a live hard-link overlap. The pure production entry
point remains zero-input and physically inert until the descriptor-based
observer and fixed external scope publication primitive are implemented.

The shared capture work starts with a non-promotable cooperative Node slice.
Its private core and facade now produce existing stable-object, occurrence
fingerprint, directory-membership, and path-entry DTOs from BigInt descriptor
observations. They enforce normalized direct-child inputs, parent and child
`lstat -> O_NOFOLLOW|O_NONBLOCK descriptor -> fstat -> path lstat` fences,
exact bounded reads with an EOF probe, buffer zeroing, two equal full captures,
and two equal every-and-only directory enumerations. The file cap is derived
from the largest code-owned registry-document protocol cap. Focused tests cover
ordinary files and directories, exact cap boundaries, malformed paths,
symlinks, FIFOs, hard links, content/path/parent/membership changes, late
checkpoint swaps, injected failures, and exact retries.

This facade is tagged `cooperative_writer_process_crash`, has no production
barrel consumer, and cannot issue production authority. Before physical
activation, add an authenticated Darwin capability backend with pinned parent
descriptors, `openat`/`fstatat`, `linkat`/`unlinkat`, `renameatx_np`,
directory-descriptor enumeration, `O_NOFOLLOW_ANY` or `O_RESOLVE_BENEATH`, and
`F_FULLFSYNC`. The later publication micro-slice may exercise no-replace link,
rename, and crash replay through the cooperative test backend, but production
cutover stays inert until the native backend and its ABI are authenticated.

The cooperative fixed-scope publication micro-slice is also implemented. It
uses one code-owned target and deterministic stage basename, OS-generated
256-bit nonce, canonical UTF-8, exclusive private staging, file-before-directory
sync, no-replace hard-link publication, exact `nlink 1 -> 2 -> 1` replay, and
pathless physical evidence. Every injected process-crash boundary converges
through stage-only, same-inode overlap, or final-only state while completing
any missing file or directory durability barrier. Final evidence is joined
back to the admitted staged locator and bytes. Invalid and hidden-link state is
preserved and rejected. A different valid EEXIST winner is cleanable only when
the current invocation created or first durably admitted the target-absent
stage; ambiguous mixed state present at entry is preserved as conflict. This
remains a cooperative fixture, not the native fixed-scope authority.

The cooperative activation-member publication micro-slice is implemented for
the fixed staged receipt, genesis epoch state, and shared-lock names. Its input
binds the full strict filesystem scope, expected raw hash, and claim-derived
stable ordinary-file identity before any filesystem mutation. Publication
allows only stage-only `nlink=1`, same-inode overlap `nlink=2`, and final-only
`nlink=1`; a same-inode EEXIST race is reobserved and converged while any
different or historical inode is preserved and rejected even when its bytes
match. Replay completes the target-file, target-directory, and
staging-directory barriers, fences both parents, re-reads the exact admitted
inode and bytes, and requires two final observations of stage absence. Every
fixed checkpoint, late stage recreation, hidden link, special file, parent
replacement, and same-byte inode replacement is covered by the focused
process-crash tests. The result is pathless and retains the cooperative
capability tag; production activation still cannot import it.

The cooperative epoch-floor replacement micro-slice is implemented for the
fixed transaction-staging direct child, its sole
`staged_target_epoch_state` member, and the fixed epoch-floor target. Before
mutation it binds the full strict scope, the fresh-census prior floor stable
identity and raw hash, the claim-bound staging-directory stable identity, and
the claim-bound target stable identity and raw hash. It accepts only
`prior + exact`, `target + epoch_target_consumed`, and `target + absent`;
same-byte prior or target replacement inodes, `target + exact`, hidden links,
foreign members, and third-state content are preserved and rejected.

The durability sequence is staged-file sync, source-directory sync, atomic
same-filesystem rename, target-file sync, destination-directory sync, consumed
source-directory sync, exact empty-directory removal, and final parent sync.
Every process-crash checkpoint reobserves one of the three exact states. An
exact peer rename or rename-plus-cleanup race is also reobserved rather than
misclassified from an intermediate `ENOENT`. Final success fences the parent,
re-reads the exact target inode and bytes, and observes the staging directory
absent twice. This remains pathless cooperative evidence; Node's path-based
rename has no expected-destination-inode compare-and-swap and cannot promote
the primitive into production authority.

The fixed filesystem-scope document is now part of the code-owned registry
namespace rather than an unclassified sibling. Every activation census must
contain that ordinary file, and its physical capture must join the canonical
scope bytes to the same scope identity used by the parent and every child.
This closes the previous contradiction in which publishing the required
external anchor made the subsequent global census reject its own namespace.

The Darwin production-backend boundary is frozen as one exact self-hashed ABI.
Its operations define bounded request/result fields, fixed operands and
no-replace mappings, preconditions, opaque-slot transitions, postconditions,
and closed error sets. Irreversible link, unlink, sync, and epoch replacement
operations bind stable identity, mutable fingerprint, and exact content before
mutation. Capability admission joins the signed distribution catalog and
monotonic epoch floor to executable/build identity, joins AMFI self-attestation
and code-signing policy, joins the three native filesystem proofs, and finally
joins a fresh bounded live session. Serialized receipts remain DTOs only; a
private branded bridge and rolling transcript are required for authority. The
zero-input opener still returns typed unavailable because no authenticated
native distribution or external proof bundle is installed.

The ABI now also freezes a complete fixed-operand catalog, including exact
parent relation, code-owned name, object kind, root-owned metadata, content,
and link policy. Strict bounded wire DTOs parse every request, success, and
failure frame and then enforce operation-specific relations: slots are
pairwise distinct, directory/file kinds cannot be confused, fingerprints join
the expected stable identity, mutation fingerprints follow the exact
link/rename/write transition, and unlink/remove success carries a twice-
observed self-hashed absence bound to the expected parent and operand.
Rehashing a structurally valid response therefore cannot splice another inode,
slot, fingerprint, or cleanup target. The per-session operation cap is 65,536.
The compatibility-safe pagination contract keeps the existing one-response
operations frozen and adds a separate code-owned transcript vocabulary. A
directory capture occurrence has exactly two observation passes, each split
into at most 32 pages of at most 512 globally indexed member bindings. Every
page is independently capped below the
1 MiB wire limit and binds the live session occurrence, capture occurrence,
directory slot and stable identity, page index and count, global start index
and total entry count, both whole-membership commitments, the preceding page
hash, observation ordinal, and its own self-hash. The first page of each pass
has an explicit null predecessor; every later page must name the immediately
prior page. Empty directories have exactly one terminal empty page per pass.
The terminal commitments bind both final pages, exact ordered semantic and
slot/inode aggregates, and count; the two passes must agree. Skipped,
duplicated, reordered, replayed, rebound, cross-slot, and cross-occurrence pages
therefore fail closed.

Regular-file evidence uses the same two-pass occurrence-bound shape: at most
four raw chunks per observation of at most 256 KiB cover at most 1 MiB. Each
chunk binds its global byte
offset, index/count, total byte length, preceding chunk hash, raw chunk hash,
and final whole-content commitment. Every non-final chunk is exactly 256 KiB;
the final chunk covers the exact remainder, with an explicit one-zero-byte-
chunk representation per pass for an empty file. Both passes must produce the
same full-content commitment. Raw length is rejected before copying
or base64 allocation, every encoded chunk is canonical, and the terminal
commitment recomputes the full content hash and exact coverage. Transcript
parsing snapshots each candidate under a separate bound and never promotes a
serialized transcript into a live slot-ledger capability. The live production
driver must still prove that page/chunk slots were issued by the same open
session and that descriptors remained pinned across the occurrence.

The implemented read-only aggregate fixture uses a separately bounded NDJSON
terminal stream: at most 16,384 census entries, 1 MiB per regular file, 8 MiB
aggregate regular-file bytes, and 64 MiB captured stdout. Those test-fixture
limits cannot silently raise the production wire cap. Standalone frame parsing
also cannot prove that a later exact-entry slot was issued by an earlier
directory binding; that association remains a live-session slot-ledger
obligation until the authenticated driver implements and tests it.

The first Darwin-native mechanics slice is now implemented as a permanently
non-authoritative fixed-scope publication fixture. Its C kernel accepts only an
inherited pinned directory descriptor plus the exact scope bytes, owns the two
fixed operand names, snapshots caller bytes privately, and uses
`openat`/`fstatat`, bounded reads with an EOF probe, `F_FULLFSYNC`, `linkat`,
and `unlinkat`. It reports stable device/inode identity separately from the
mutable occurrence fingerprint and accepts only stage-only, same-inode overlap,
or final-only replay. Eight real child `SIGKILL` boundaries converge through a
fresh process; partial files, foreign bytes, symlinks, and hidden links are
preserved and rejected. The universal Mach-O builder compiles only captured
private source copies into an external empty mode-0700 directory and emits a
pathless `test_fixture`, `productionAuthority:false`,
`adhoc_or_unsigned_test_fixture` receipt. It is not part of `npm build`,
`dist`, the signed distribution catalog, the native ABI capability, or the
production opener. Signed self-attestation, full operation coverage, and the
external durability proof remain mandatory before production activation. An
arbitrary process death inside the initial `pwrite` loop can still leave a
private partial fixed stage. The fixture preserves and rejects that stage; it
does not claim cleanup ownership without a durable claim or equivalent locked
ownership proof. Claim-first partial-write recovery is therefore a production
blocker, not one of the eight post-write replay checkpoints.

The physical activator contract is frozen separately from production
authority. It maps every reducer action exactly once, requires a fresh native
session for each observe-plan-lock-revalidate-reobserve-one-action-close round,
fixes the three lock-order transitions, reserves 512 operations, and bounds
convergence to 32 rounds with two identical no-progress observations. A
mechanics-only core now enforces that loop through an exact non-generic session
surface, unique session occurrences, contract/ABI binding, one-use WeakMap
plan handles, and a fresh locked-observation token whose binding hash commits
the exact session occurrence, contract, and observation. Every action consumes
that same private slot-ledger token. Deferred shared-lock publication is fenced
against same-vector action drift, while close/abort failures carry an
invocation-private runtime brand and are terminal. Its result is explicitly
not production authority. The
contract still forbids production use until an authenticated native driver
exists, and permanently declares the Node fixture non-authoritative. The
production activator therefore remains zero-input and physically inert.

A Darwin mechanics fixture now binds the activated executor path to real
`lockf` leases. It accepts only the four exact migration, cleanup, and steady
lock vectors, requires all three role files to be distinct direct children of
one parent, owner, and mode boundary, pins that parent once, and requires every
lease to report the same exact BigInt device/inode identity. Parent pathname
replacement between role acquisitions fails closed, releases in reverse order,
and closes the pinned descriptor. The lease also captures each lock object with
one BigInt `lstat`/descriptor/`lstat` chain, keeping exact physical identity and
nanosecond mutable state free of Number rounding. Copied lock bytes are zeroed.
A seven-round transition test drives legacy, claim, shared, genesis, receipt,
staging cleanup, claim removal, and activated observations through fresh real
fixtures. It proves the reducer vectors legacy-only, legacy-to-shared,
shared-to-legacy, and shared-to-package at their action boundaries, including
deferred shared acquisition before receipt-last publication and reverse release
after every round. This proves mechanics ordering only and remains
non-authoritative.

The existing Node bootstrap install and rollback paths now enforce the
receipt-last cutover boundary explicitly. They require the activation receipt
absent before entering the legacy path and recheck it after the legacy kernel
lease is held, before any lifecycle mutation. Receipt presence at either point
returns the typed lock failure requiring the shared-parent-then-package adapter;
the old legacy-only order cannot cross cutover. Exact post-activation Node
mutation remains blocked until the authenticated native global census and Node
package projection can drive that adapter; registry siblings are not weakened
into a legacy allow-list. Tests cover receipt presence before install and
rollback entry plus a real two-actor Darwin `lockf` race: the Node operation
waits on legacy, receipt-last publication wins while the activator still owns
the lock, and the post-acquisition recheck rejects before claim, staging,
quarantine, root, or receipt mutation.

The Node fixture boundary is an exact self-hashed incompleteness catalog, not
a structural driver. Existing cooperative exports fully cover only genesis
floor and activation receipt publication; return/no-mutation are terminal
mechanics, and the other eight reducer actions remain partial or unsupported.
The catalog fixes the five missing full-driver capabilities, rejects rehashed
promotion/completeness claims, and is absent from both the mechanics core and
production activation import graphs.

The bounded read-only aggregate observer slice is implemented and remains
non-authoritative. One fresh Darwin fixture process pins the bootstrap parent,
acquires the exact activated shared-to-registered-package lock vector,
enumerates every direct child twice, captures every classified entry twice
through descriptor-relative `openat`/`fstatat`, and returns pathless stable
identity, mutable fingerprint, content, and directory-membership evidence.
Pure code builds the exact global physical census and derives the Node logical
and physical package projections. The fixture joins the physical projection's
package-lock stable identity to the exact held Node lock. Its native kernel now
also exposes one opaque stateful session: baseline and fresh recapture occur
while the same shared-to-package leases remain held, close performs one final
fresh two-pass census and reverse release, abort releases in reverse, and a
second open cannot consume an existing session. The fixture's exact
length-prefixed fd4 protocol proves the abort path through a code-owned
test-support adapter: native OPEN and OBSERVATION bytes are mapped by the pure
controller, one challenge/hash-bound ACK_ABORT is half-closed within a stricter
measured five-second fixture budget, native TERMINAL_ABORT is followed by fd4
EOF and exit zero, and a code-owned paired `lockf` probe observes release. The
adapter returns a separate frozen, self-hashed live-run receipt that is
explicitly `productionAuthority:false`; its pathname probe is
`toctou_limited`, its path-spawned binary is unverified, recursive evidence is
absent, and serialized replay is never live authority. Unknown members,
absence, replacement, aliasing, membership drift, dirty stdout/stderr, stdio
failure, protocol overflow, cleanup/reap failure, or a lock/projection mismatch
fail closed. A separate recursive semantic-live fixture and adapter now add
the exact ready-tree ACCEPT path described below without promoting this legacy
abort receipt or enabling Node mutation. Neither fixture mints the production
backend capability. Production still requires the
signed/notarized native distribution, AMFI self-attestation admission, pinned
`openat(O_NOFOLLOW)`/`fstat` binary and exact-lock probe authority instead of
pathname TOCTOU, all-component beneath resolution, arbitrary-write crash
ownership, and external durability proof. The ABI now binds each enumerated
basename and object kind to one opaque slot and stable identity, bootstraps the
scope identity from the fixed scope document rather than caller input, and
carries discriminated regular-file bytes or directory membership. Production
blockers remain: the signed live driver must maintain the slot ledger across
frames, authenticate the now-demonstrated recursive semantic ACCEPT occurrence,
and carry the now-frozen bounded pagination/chunk transcript through that same
descriptor-backed occurrence. The ten-second
native deadline and five-second controller budget are measured fixture bounds,
not a maximum-size production timing proof. The separate fixed-scope native
publication fixture now records `CLOCK_MONOTONIC_RAW` syscall-return latency for
each of its eight semantic `F_FULLFSYNC` roles plus whole-run elapsed time at
the exact 65,536-byte payload cap. Every real SIGKILL checkpoint and its exact
recovery suffix are covered. Timing travels only on the dedicated test fd4 and
is labeled `characterization_only_no_sla` and
`syscall_return_latency_not_power_loss_proof`; no duration upper bound is a
passing condition.

The Node semantic contract slice is implemented without reusing the logical
package projection hash as ready-state authority. Namespace-only ready/empty
observations are logical-projection mechanics with `productionAuthority:false`.
The strict, self-hashed semantic snapshot binds canonical
claim/receipt/rollback documents, exact recursive root-tree evidence, manifest
and installed-tree hashes, root physical identity, rollback predecessor
history, held package-lock evidence, and both source census hashes. The strict
V3 mapper now projects the fixed eight-role native recursive evidence while
remaining explicitly non-semantic. A separate same-stream bridge extracts the
canonical lifecycle documents, joins every recursive entry and source hash,
builds the four-frame live transcript through ACK_ACCEPT, and binds the
acknowledgement frame hash as the native opaque semantic commitment.

The native fixture preserves the old recursive ABORT-only command and adds a
distinct COMPLETE-only semantic-live command. Its test-support adapter now
drives one real occurrence through `open -> locked recursive observation ->
semantic accept -> unchanged native recapture -> reverse release -> terminal ->
EOF/exit -> paired release probe -> declarative close -> fresh semantic
rejoin`. The frozen receipt binds the raw stream, projections, recursive and
semantic hashes, transport frames, final transcript, release probe, and both
lock identities. Negative tests cover incomplete and noncanonical lifecycle
state, recursive drift, trailing protocol bytes, noisy/nonzero settlement, and
the unchanged legacy abort path. Serialized preparations, sessions, joins, and
adapter receipts remain self-asserted DTOs requiring explicit rejoin and have
`productionAuthority:false`.

The newest local slice is intentionally another non-authoritative fixture
mechanic: a native challenge-bound slot catalog and two exact descriptor-capture
frames are joined by a private TypeScript WeakMap ledger before a test ACCEPT.
Its receipt is explicitly pre-ACCEPT content-join evidence, carries unsigned /
AMFI-unproven / notarization-unproven markers, and never authorizes production.
It does not consume a native rolling self-hashed transcript; it reconstructs a
frozen transcript from equal raw chunks only. The remaining production blockers
are signed and notarized native distribution, AMFI self-attestation,
authenticated rolling transcript consumption, production timing, and an
authenticated terminal receipt. Darwin still provides no literal public
exec-by-fd primitive; the mapped-vnode/fd5 gate remains a local fixture binding
proof until signed admission replaces fixture trust. One-shot output,
transferred fds, a serialized adapter receipt, or a generic Node callback under
helper locks still cannot authorize the mutator.

The next local mechanics slice now exercises claim-before-payload binding and
replay mechanics
without promoting it to the reducer: a test-only session preallocates the
fixed three staging member inodes, records their stable
`objectKind/device/inode` identities in a self-bound claim envelope, and
observes `FileHandle.sync()` return for that claim and its parent before
writing any nonzero member bytes; power-loss durability remains unproven.
Fresh inspection derives each mutable fingerprint separately, accepts only an
exact prefix on the same stable inode, and resumes the remaining bytes from
the observed length. Partial or foreign claims, claimless skeletons,
same-byte inode replacements, prefix splices, symlinks, and hard links fail
closed without cleanup. The envelope and receipt explicitly carry
`productionAuthority:false`, `productionAdmission:"forbidden"`,
`ownershipAuthority:false`, and `cleanupAuthority:false`; the production
`prepare_and_publish_activation_claim` driver remains unsupported until a
signed native session owns crash recovery and terminal cleanup. The fixture is
confined to a private `setfarm-claim-first-v2-*` temp root, revalidates the
root and parent identities across pathname-relevant checkpoints before the next
pathname durability operation/final success, and performs a final inspection;
its opaque caller-supplied document/hash snapshot is surfaced only as a
receipt-bound hash and is not the production activation claim schema. Close
rejects while a member write or inspection is active, so hook reentry cannot
deadlock or zero an in-flight payload.

The following characterization slice observes the actual host signing surface
without pretending to admit it. A private universal Darwin test binary calls
Security.framework on its own running code object and reports the observed
architecture, signing flags/status, identifier/Team, designated-requirement
hash, runtime/library-validation flags, stapled-ticket presence, and raw
unique-digest length plus a domain-separated commitment. Its executable frame
also carries a host-UUID-derived stable host scope plus the global stable
`objectKind/device/inode` identity and a separate mutable metadata/content
fingerprint; the adapter binds both to a fresh challenge, pins the build-time
bytes/inode, and revalidates that same pin after the child exits. The frame
is strict UTF-8 canonical JSON and reordered, forged, or authority-bearing
projections fail closed. This is `test_fixture` evidence only:
`productionAuthority:false`, AMFI/notarization admission `unproven`, installer
receipt admission `absent`, and no production backend or registry path consumes
it. A Developer ID identity, notarized installer/package, code-owned
catalog/public key, and authenticated installed helper remain the next
production-only blockers.

The next credential-free characterization slice is a private unsigned flat
package audit. A test-only 0700 root builds one fixed-ID package with
`pkgbuild`, then runs only bounded, shell-free read-only probes in a fixed order:
`pkgutil --pkg-info-plist` before and after, `pkgutil --check-signature`,
`spctl --assess --type install --raw --ignore-cache --no-cache`, and
`xcrun stapler validate`. The package is
captured through one descriptor before and after the probes, binding stable
`objectKind/device/inode` identity and a separate mutable content/metadata
fingerprint. Probe output is retained only as byte length/hash plus exact exit
status, with each channel capped at 64 KiB in both the runner and schema;
localized prose is not authority. A receipt is classified `absent` only when
the exact empty-stdout length/hash and diagnostic stderr length/hash all agree.
The Gatekeeper probe explicitly
disables assessment-cache read/write. Because the tools accept a pathname,
the audit records `pathname_only_unproven` and keeps an exact-object command
binding blocker; the before/after descriptor join is not promoted to trust.
The receipt is always
`admissionScope:"test_fixture"`, `credentialUse:"none"`,
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`trustConclusion:"characterization_only"`; AMFI runtime admission remains
`requires_authenticated_running_helper`, and `spctl` is labeled Gatekeeper
install assessment only. It deliberately does not invoke
`installer`, `notarytool`, keychain/security identity enumeration, or any
production opener. Apple Installer receipt presence is treated as metadata
only, and a raw Mach-O Gatekeeper result or stapled-ticket absence is never
reinterpreted as installer/notarization authority.

The implemented first locally testable production-admission mechanic is
deliberately named `pinned_descriptor_to_running_mapped_vnode_binding`, not
exec-by-fd. The adapter opens and hashes the fixture binary through a pinned
descriptor, inherits that object as fd5, and a distinct native mode compares
fd5's device/inode identity to the process's main loaded Mach-O vnode before
OPEN. Parent-side descriptor identity, fingerprint, length, and content hash
must remain equal through clean settlement. Same-byte pathname replacement,
wrong or missing fd5, symlink and descriptor drift tests fail before protocol
authority. The receipt remains an unsigned, nonproduction fixture claim;
signing, notarization, AMFI, catalog membership, live transcript-ledger
consumption, and authenticated terminal authority remain separate blockers.

The implemented local mechanic replaces the pathname `/usr/bin/lockf` release check
with a distinct pinned native probe process. The semantic adapter retains the
same fd3 registry parent and fd5 binary object through semantic settlement,
then launches the probe with one owned bounded fd4 stream. The probe repeats
the mapped-vnode gate before any lock operation; opens the two fixed basenames
with descriptor-relative `openat(O_NOFOLLOW)`; joins stable identity, mutable
fingerprint, and exact fixed content; takes nonblocking `F_TLOCK` leases in
`shared -> Node` order; releases in `Node -> shared` order; and publishes no
success frame until final revalidation and reverse cleanup complete. It must be
a separate PID because same-process Darwin record-lock reacquisition cannot
prove that a previous lease was released. Its self-hashed pathless receipt is
joined to the semantic occurrence and remains `productionAuthority:false`.

The implementation also exposes four code-owned test-only stop boundaries for
shared-held, both-held, Node-released, and all-released states. They use an
uncatchable in-kernel `SIGSTOP`, not an arbitrary callback, so no test hook can
open or close the same vnode and silently alter process-owned record locks.
Separate-process contenders prove the exact lock vector at every boundary.
Same-byte inode replacement, parent fingerprint drift, missing or wrong fd5,
partial acquisition, hostile replay input, trailing/noisy probe settlement,
and bounded kill/reap paths all fail without a probe receipt.

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

Implementation checkpoint: the credential-free test boundary now exercises a
Darwin module/export receipt for two independently materialized output
occurrences. The fixture loads the actual payload bytes in a bounded Node
child, binds exact export names and runtime kinds, captures stable
`hostIdentity/objectKind/device/inode` separately from the mutable byte,
owner, mode, and timestamp fingerprint, and revalidates both occurrences
before and after execution. Process evidence carries the Node executable's
matching stable identity and mutable fingerprint, a bounded PID/time
occurrence identity, and a schema-derived process hash joined to the same
host identity. Its private handle and receipt remain
`productionAuthority:false`, `productionAdmission:forbidden`, and
`trustConclusion:characterization_only`; no installed module, signed package,
or production registry path consumes it. A running authenticated helper and
the independent verifier are still required for production admission.

The pair-adjacent checkpoint now derives that observation from one authentic
test dependency-pair capability with no caller JSON or caller path. It claims
the pair synchronously as `probing` before its first await, derives the exact
17-entry module closure from both sealed outputs, and launches two distinct
bounded child processes per entry against private code-owned paths. The child
imports the full namespace but returns only the exact code-owned required
names and observed runtime kinds; extras therefore cannot redefine the
requirement. Every module and the exact realpath Node executable are captured
before/after with stable host/object-kind/device/inode identity separated from
their mutable fingerprints, and the same captured Node path is the executable
actually spawned. A fresh pair/toolchain post-fence releases the exclusive
lease after success or stable semantic failure; pair or physical drift instead
invalidates and cleans the exact owned roots. The strict collection receipt
embeds the pair-derived closure, all 17 two-occurrence probe receipts, unique
challenges, and an ordered stable-projection set hash. It remains
`test_fixture`, `productionAuthority:false`, `productionAdmission:forbidden`,
`mutationAuthority:false`, and `characterization_only`; the authenticated
installed `release-bootstrap` operation, terminal manifest/attestation writer,
and B6 verifier remain production blockers. Verification passed 68/68 focused
tests, 945/945 execution-attempt tests, 858/858 root tests, TypeScript checking,
and a no-bypass clean disposable `main` prebuild/build/postbuild.

The credential-free metadata checkpoint is now equally explicit and
non-promotable. A private Darwin fixture runs only the code-owned absolute
`/usr/bin/xattr` and `/bin/ls` observers with `shell:false`, an empty
environment, fixed argv/cwd tokens (the private pathname never enters the
receipt), an 8-second timeout, and 64 KiB channel caps. Each tool and the
target carries the global test-host/object-kind/device/inode identity plus a
separate owner/mode/link/size/content/time fingerprint; the root namespace is
revalidated after both children exit. The receipt commits xattr and ACL state,
including the explicitly allowed system-managed `com.apple.provenance` name,
and rejects relevant metadata, forged policy/state, target drift, and same-byte
inode replacement. Its `implementationScope:"test_fixture_direct_tools_v2"`,
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`trustConclusion:"characterization_only"` markers are schema literals. The
before/after snapshots intentionally reuse the single interstitial metadata
observation and command receipts; they prove the physical fence around that
observation, not an installed production clear-role authority. Parent-anchor,
bootstrap/module, descriptor-transport, and authenticated host/verifier joins
remain production blockers.

The next S-leaf checkpoint is also present as a non-promotable Darwin
characterization. It descriptor-captures the exact `/bin` and `/usr/bin`
parents plus `/bin/chmod`, `/bin/ls`, `/usr/bin/sandbox-exec`, and
`/usr/bin/xattr`, with the global host/object-kind/device/inode identity kept
separate from the owner/mode/link/size/content/time fingerprint. Parent
identity is joined into every file observation; pre/post descriptor fences
revalidate both parents and files, require root-owned `0755` policy, and bind
all five logical roles. The xattr observer and clearer are aliases of one
physical xattr file, while ACL clearer/observer and sandbox each bind their
own exact file. The private handle/fixture receipt is marked
`implementationScope:"test_fixture_direct_descriptor_capture_v2"`,
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`trustConclusion:"characterization_only"`; no system-anchor receipt is
consumed by the production host-composition opener or registry. The installed
signed verifier, fd3 native transport, real host identity, and production
parent-anchor proof remain outstanding.
This fixture still uses a path-based directory membership read while its
descriptor is held; the production fd3 verifier must enumerate and join the
parent/child objects descriptor-relatively and re-capture the parent after the
file set, so this characterization cannot be promoted by hash replay.

The S-to-registry join now has a separate test-only relation adapter. The
package physical snapshot builder accepts a complete S observation, re-runs
the code-owned S parser (including its self-hash, two-capture fence, topology,
and false-authority markers), and emits only a five-field hash relation. A
caller-supplied relation or arbitrary observation hash is rejected before the
snapshot is built. The serialized relation remains pathless and explicitly
`productionAuthority:false`; external rejoin to an authenticated installed V
and the future descriptor-relative S authority are still required.

The A leaf now has a similarly narrow test-only characterization relation. It
parses the existing strict fixture runtime-account receipt plus two distinct
`LOOKUP_LOCAL_ACCOUNT_V2` presence observations, requires equal stable record
state and receipt UID/GID/host joins, and emits only hashes and explicit
false-authority markers. The relation carries no account name, UID/GID, path,
credential, mutation, or capability. It is not a durable account receipt and
does not prove the installed V-verified provisioner, native Directory Services
mutation, preclaim/recovery, or production aggregate opener; those remain
blockers and require external rejoin to the original observations.

The next bounded hardening slice closes the serialized scope-replacement gap
without promoting cooperative evidence. A test-only filesystem-scope rejoin
adapter consumes the serialized four-package physical snapshot and one
separately published scope-publication record. It requires the exact
`filesystemScopeIdentityHash`, the canonical UTF-8 scope-document SHA-256, an
ordinary-file stable `host/objectKind/device/inode` identity, and a matching
mutable fingerprint (`0600`, one link, exact byte length). It emits only a
frozen pathless relation containing the package snapshot hash, scope identity
hash, publication-observation hash, and explicit
`productionAuthority:false`/`productionAdmission:"forbidden"` markers. The
publication is cooperative test evidence, not an authenticated fixed scope
anchor; production still needs a separately installed, independently
authenticated scope document and descriptor-relative V/registry rejoin. A
self-consistent foreign scope replacement remains possible in this serialized
fixture lane by design; its output stays test-fixture and forbidden rather
than being promoted by hash replay. The bounded parser is the sole untrusted
input boundary; callers must not invoke any raw Zod schema directly.

The first V-member checkpoint now fills the next physical gap without changing
the global census contract. A test-only mapper derives the exact host-verifier
root from the package snapshot and accepts separately captured `bin/`, manifest,
and signed executable children. It preserves the original ephemeral Ed25519
verification receipt while invoking native selection, then binds the selected
architecture/epoch/member, root/bin topology, root-owned modes and link counts,
manifest raw content hash, and executable byte length/content hash. Its output
is only a frozen hash relation with `productionAuthority:false` and
`productionAdmission:"forbidden"`; it contains no locator, bytes, capability,
or credential. The manifest hash is intentionally only a raw-content join in
this fixture: no semantic manifest schema, signed installer receipt, Developer
ID/notary/AMFI proof, or descriptor-relative authenticated two-pass capture is
claimed. The fixture DTO carries the expected direct-child basenames, but it is
still caller-labelled evidence rather than an opaque descriptor slot; a fresh
full-census rejoin and descriptor-relative role binding remain production V
blockers.

The R release-composition member checkpoint extends the same boundary to the
built release leaf. A test-only mapper takes the R package root from the
serialized package snapshot and binds separately captured `bin/`, `lib/`, the
manifest, executable, and all three exact modules. It checks one global
`scope/device/inode` locator space (without treating `objectKind` as a
separate physical locator), root-owned `0555|0444` topology, link/size limits,
parent identities, directory membership, raw member content hashes, and the
code-owned required-export commitments. The optional sealed-root value is
carried only as a provenance hash; no bytes, module load, semantic manifest,
build attestation, or production capability is emitted. The result is frozen,
pathless, explicitly `productionAuthority:false` and
`productionAdmission:"forbidden"`. Because the root is still sourced from a
serialized snapshot and member hashes/exports are caller-supplied fixture
observations, an authenticated signed R receipt, fresh full-census/
descriptor-relative two-pass capture, semantic manifest, module-load proof,
and the production V/R join remain blockers.

The next aggregate checkpoint is deliberately a hash-only test join rather
than another native stream version. A bounded mapper re-parses one complete
recursive aggregate fixture plus the V, R, S, and A false-authority relations,
requires one shared serialized scope/snapshot/publication identity, and checks
that the aggregate Node root and the V/R package roots are distinct. The
rejoin also checks the Node projection against the aggregate source physical
census, held-lock identities/fingerprints, and the exact eight-role recursive
tree before hashing. Relation component hashes are recomputed from their
pathless fields, so an outer join hash cannot launder a forged projection.
It emits only the aggregate projection hash, leaf relation hashes, and explicit
`semanticReady:false`/`joinStatus:native_capture_only_requires_ts_aggregate_join_v2`
markers. It does not add V/R/S/A frames to the mutually rejecting V2/V3 stream,
does not consume a production opener, and cannot prove a full four-package
capture. A coherently rehashed foreign all-leaf DTO remains possible at this
serialized characterization boundary and is intentionally non-authoritative.
The zero-input production opener still requires
`N-before -> V/R/S/A -> second leaf capture -> N-after` under authenticated
descriptor-relative locks and durable terminal evidence.

The B5D-1 network-negative leaf now has the same non-promotable physical
boundary. A private Darwin fixture runs the unchanged deny-all sandbox probe
under a code-owned mode-0700 scratch root whose `home`, `tmp`, and `cache`
directories are pre-created and retained until fixture disposal. It captures
the wrapper module, fixed `sandbox-exec`, and Node executable through
`O_NOFOLLOW|O_CLOEXEC` descriptors with bounded reads and an EOF probe. Every
object carries the same test-host `hostIdentityHash`, `objectKind`, canonical
device/inode identity separately from owner/group/mode/link/size/content/time
fingerprint, and a before/after snapshot fences the probe plus its exact root
namespace. The old loopback, DNS-denied, outbound-denied, redirect-without-
follow, empty-stderr, bounded-child receipt remains joined by hash and is
required to stay `admissionScope:"test_fixture"`. Its wrapper, sandbox, and
Node content hashes are semantically joined to the corresponding descriptor
observations, and the nested runtime identity must equal the outer host
identity; a self-rehashed receipt cannot splice another executable or host.

The new observation receipt is literal
`productionAuthority:false`, `productionAdmission:"forbidden"`,
`credentialUse:"none"`, and `trustConclusion:"characterization_only"`;
its private handle owns cleanup only and no production backend, registry, or
host helper consumes it. Root membership is still read through the fixture's
path while its descriptor is held, and the supplied scratch-root bridge is
test-only. The receipt explicitly labels its source payload as the TS
characterization module rather than the release `dist` payload, and fixture
disposal plus the generic runner cleanup revalidate the original root's
physical identity before recursive removal. A signed helper must replace the
bridge with descriptor-relative fd3 transport, complete child namespace
census, authenticated running-vnode proof, and durable cleanup before this
network evidence can participate in production composition.

The complete required-module closure now has a matching credential-free
export-shape/physical characterization leaf (not semantic closure authority).
A private Darwin fixture materializes the exact
code-owned 17-role order in two independent `dist`-shaped output roots (34
regular files), derives each portable module ref from bounded descriptor
bytes, and runs every file through a no-shell Node child with an empty
environment, fixed argv, fd3 input, timeout, and output caps. Each entry binds
the definition's source locator, module locator/ref, required export names and
kinds, observed export set/kind hashes, semantic projection, process
occurrence, implementation/verification-policy projection, and entry hash. The two occurrences share the semantic projection
and executable identity but have distinct physical `(hostIdentity,
objectKind, device, inode)` identities and distinct process occurrences.

The file identity is intentionally split: stable physical identity is never
used as a mutable content claim; owner/group, mode, link count, byte length,
content hash, and timestamps are a separate fingerprint. The fixture also
re-censuses the exact private directory membership and rechecks every module
before and after all 34 child loads. The directory census is still a
test-fixture path read while descriptors are held; it intentionally documents
the production fd3/descriptor-relative gap. Its generated bytes are export stubs
bound to the code-owned TypeScript source locators, so the receipt is explicit
`payloadBinding:"typescript_source_fixture_only_v2"` and does not claim that
the release `dist` payload was built or installed. The receipt's
`productionAuthority:false`, `productionAdmission:"forbidden"`,
`credentialUse:"none"`, and `trustConclusion:"characterization_only"` values
are schema literals; no registry, host-composition opener, or production
verifier consumes it. The fixture does not execute the definition-specific
catalog, bootstrap-source, ABI, profile, or runner semantics; those remain
production joins. A production implementation still needs the authenticated
installed helper, descriptor-relative fd3 census of the complete output tree,
real release bytes/transitive closure, and signed Developer ID/notary/AMFI
authority before this leaf can participate in admission.

The semantic gap now has a separate credential-free companion receipt rather
than being hidden inside the export-shape fixture. It imports the exact
code-owned TypeScript source namespaces, reads each source file through a
bounded `O_NOFOLLOW|O_CLOEXEC` descriptor fence with stable
`hostIdentity/objectKind/device/inode` identity separate from its mutable
owner/mode/link/size/content/time fingerprint, verifies bootstrap source/hash constants, captures
the full adapter/evidence/profile/transport/receipt catalog projections, and
checks every required runtime export name and kind. The command runner is
inspected but remains a literal `test_fixture_runtime_blocked` row; no command
lease or product process is invoked. Full catalog values are schema-validated
against their code-owned getters, so changing a catalog and merely rehashing
the receipt cannot pass. The companion receipt joins every row to the physical
17-module probe, challenge, source fence, and exact policy, but remains
`productionAuthority:false`, `productionAdmission:"forbidden"`, and
`trustConclusion:"characterization_only"`. It closes the source-semantic
characterization gap only; release dist/source correspondence, transitive
closure, signed/notarized Developer ID plus AMFI authority, authenticated
installed helper, descriptor-relative fd3 transport/census, terminal registry,
and real runner execution remain production blockers. The source fixture's
descriptor is still opened from a path and its parent/root census is not an
authenticated descriptor-relative production census; a source/dist/transitive
helper must replace that test boundary before any admission decision.

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

Current B5D-2 checkpoint (real test ownership transfer, non-promotable):
`platform-release-composition-test-v2.ts` defines pathless sealed-root evidence
with physical directory identity, mutable fingerprint, fsync durability markers,
and a strict one-shot lifecycle
(`pair_ready -> pair_consuming -> terminalizing -> selected_root_owned ->
predecessors_consumed -> release_completed`). The contract-only builder remains
separate, while the pair-adjacent test rehearsal now claims a real authentic
dependency pair, transfers the complete first parent/output slot behind a
distinct opaque test handle, installs a pathless predecessor tombstone, and
exactly removes the second output plus source/toolchain context. Its separate
strict receipt explicitly records that terminalization was not performed and
therefore cannot be parsed, cast, or passed as a completed-stage handle or enter
B5E. No production path getter was added. The terminal writer now has a private
terminalization core and a distinct
`terminalWritePlatformReleaseManifestForTestV2` boundary: its result is a
frozen pathless observation with nanosecond mutable root fingerprint,
`productionAuthority:false`, and no `CompletedPlatformReleaseStageCandidateV2`
issuance. The ForTest boundary accepts only code-owned temporary fixture roots
and keeps post-seal cleanup in that explicit test owner; the low-level
terminalization core never deletes a sealed root autonomously. The actual
composer bridge remains blocked on the authenticated host-composition opener
and operational probes, occurrence attestation extension, production
ownership-transfer capability, the remaining zero-caller external/environment/
catalog/manifest/attestation builders, and production terminal capability.

Follow-on B5D-2 checkpoint (authentic pair-derived runtime/module candidate,
still non-promotable):
`derivePlatformReleaseCompositionModuleClosureForTestV2` accepts exactly one
opaque authentic dependency-pair handle and no caller JSON, path, module list,
catalog, callback, or second pair. It freshly revalidates the pair on both sides
of its synchronous derivation, obtains the runtime-account receipt only through
the pair's private host-toolchain/composition chain, and derives the canonical
runtime payload from the pair-owned dist binding, dependency binding, and exact
package bytes. It independently extracts the code-owned 17 required module refs
from both canonical dist occurrences, requires their refs to be byte-equal while
their output-stage physical identities remain distinct, and binds the resulting
module set to the zero-input required-module closure. The strict receipt embeds
the complete pathless dependency-pair inspection and runtime-account receipt,
recomputes every stable projection and module-set join, and remains literal
`test_fixture`, `productionAuthority:false`,
`productionAdmission:"forbidden"`, `mutationAuthority:false`, and
`trustConclusion:"characterization_only"`. It cannot issue a completed stage,
transfer a root, run module-export probes, construct a manifest/attestation, or
enter B5E.

The checkpoint rejects missing modules without consuming an otherwise healthy
pair, rejects proxy/caller-path/cross-pair shapes, supports concurrent read-only
derivations, rejects fully rehashed stable-output/module-set detachments, and
produces different closure/tree hashes for source fixtures with different module
bytes. Verification on 2026-08-05: TypeScript no-emit and focused tests passed;
the complete build-toolchain/dependency suite passed 66/66; the complete
execution-attempt suite passed 943/943 across 118 suites; root tests passed
858/858 across 82 suites. A first build command invoked from the feature-branch
working directory was correctly refused by the clean-main guard with no bypass
or tracked-source mutation. The retained exact-source snapshot was then sealed
as a disposable clean local `main`; normal prebuild/build/postbuild passed and
the snapshot was moved recoverably to macOS Trash.

Follow-on B5D-2 checkpoint (authenticated installed test operation bridge,
still non-promotable): the four pathless target-bound host, metadata,
module-export, and network-negative operation ABIs use
`authenticated_target_root_v2`; the seven owner-package operations remain
bound to `installed_owner_package_root_v2`, with rehashed cross-policy swaps
rejected. This makes each request's authenticated target-root identity
executable without adding a path field or granting authority. The pair observer
no longer launches an embedded local `-e` program
or `process.execPath`. It obtains the freshly fenced exact Node executable,
installed `release-bootstrap` executable and module, fixed direct argv, ABI
hashes, physical identities, content hashes, limits, empty environment, and cwd
policy through the private host-toolchain/composition capability chain. Each of
the 17 modules is loaded in two distinct authenticated child occurrences via
the exact fd3 self-hashed request and canonical stdout receipt. The collection
explicitly records
`authenticated_test_host_composition_fixed_abi_fd3_isolated_observer_child`,
stays pathless and
`productionAuthority:false`, and cannot enter the production composer.

The installed test operation uses a bounded `MAX+1` fd3 reader, zeroizes input
and process buffers, fences candidate module bytes before and after import, and
emits the shared canonical self-hashed operation-failure wire with a finite
code-owned policy instead of stderr prose. The parent accepts a typed failure
only when occurrence, operation ABI, host-composition receipt, phase/retry tuple,
diagnostic hash, canonical bytes, termination, and empty stderr all agree;
otherwise it remains an opaque process failure. Tests cover wrong export kind,
wrong installed command, invalid installed output, composition drift, exact cwd
policy, concurrent pair claims, rehashed false promotion, post-failure lease
release, and exact candidate-schema export closure.

The capability join is now common to all four target-bound ABIs. A fresh global
composition census selects only the code-owned installed implementation member:
host and module-export use the release-bootstrap module, metadata uses the
metadata module, and network-negative uses the network-wrapper module. The
combined host-toolchain capability then joins that member to the exact admitted
Node executable, release-bootstrap executable, ABI hash, module export, direct
argv, empty environment, cwd policy, time/output limits, and pre/post authority
fences. Unknown and prototype-inherited ABI keys fail closed. This checkpoint
only exposes private launch contexts; host, metadata, and network-negative are
not yet executed, do not produce operation evidence, and gain no production or
mutation authority.

Verification on 2026-08-05: focused TypeScript/contract/host/build tests passed
93/93; the complete execution-attempt suite passed 947/947 across 118 suites;
root tests passed 858/858 across 82 suites; TypeScript no-emit and
`git diff --check` passed. A disposable clean `main` snapshot of the exact
tracked and untracked source passed the normal prebuild/build/postbuild path,
including version, English/path, migration-digest, and Mission Control contract
checks, then moved recoverably to
`~/.Trash/setfarm-release-bridge-build-v2.dsyY7o-20260805`. The canonical dirty
feature branch was not built.

Live truth remained unchanged: no valid code-signing identity, Gatekeeper
enabled, no workspace pkg/dmg, no installed Setfarm system roots, and all four
local HTTP endpoints returned 200. Mission Control reported healthy gateway and
database, 220 projects, disk 33%, and memory 66%. PostgreSQL held 270 runs, zero
open claims, 188 released runtime sessions, zero active attempt leases, and only
migrations 1 through 21. Read-only contract-spine verification therefore failed
closed as expected with `MIGRATION_INCOMPLETE: Migration 22 is pending`; no
migration was applied. Production remains blocked on Developer ID/notary/AMFI,
an installed verified package and real production composition opener, production
occurrence attestation/ownership transfer, and the remaining B5D/B5E/B6/B7
authority chain.

Follow-on verification on 2026-08-05 closed the target-operation cwd and
trusted-emitter review findings. The installed module-export controller keeps
the public fd3 request, occurrence, and host-composition authority in a process
that never imports candidate code. Candidate import occurs only in a nested
bounded observer child that receives a code-owned module ref plus one fresh
256-bit fd3 challenge, never the occurrence ID or host receipt. The controller
validates the challenge-bound private observation, performs 16 MiB `O_NOFOLLOW`
descriptor/content fences, and alone emits the canonical public success or
failure wire. fd3, process chunks, diagnostics, and module buffers are bounded
and zeroized. Every one of the 34 child occurrences now reacquires both its
exact pair/target-root authority and Node/composition launch context before
spawn and again after settlement.

Hostile regressions mutate stdout, exit, JSON/Object/Buffer, filesystem builtin
exports, crypto prototypes, `process.binding("fs")`, and
`process.reallyExit`. Surface mutations cannot replace the trusted public
receipt; Node-internal mutation remains confined to the nested child and yields
one authenticated failure. The execution marker and compatibility hashes bind
the isolated-observer protocol. Independent review has no high or medium
finding. The two remaining low caveats—same-realm inner observation is not a
native security proof, and path import is not yet rooted in an immutable
foreign-owned production tree—remain explicit reasons this evidence is
`characterization_only` and `productionAdmission:"forbidden"`.

The focused four-operation contract/authority tests passed 42/42; the
successful, wrong-kind, wrong-command/output, and hostile-global real-operation
tests passed; TypeScript no-emit and `git diff --check` passed. The complete
execution-attempt suite passed 949/949 across 118 suites and root tests passed
858/858 across 82 suites. A new exact-source disposable clean `main` snapshot
passed normal prebuild/build/postbuild and was moved recoverably to
`~/.Trash/setfarm-release-isolated-observer-v2.NN3KkD`; the canonical dirty
branch was not built. Live truth still showed zero signing identities, Gatekeeper
enabled, no pkg/dmg or installed Setfarm roots, four HTTP 200 responses, 220
projects, 270 runs, zero open claims, 188 released runtime sessions, zero
active attempt leases, and migrations 1 through 21 only. Read-only contract
verification again failed closed with migration 22 pending; no migration was
applied.

The terminal test observation now also has a separate strict bounded schema,
canonical-cap parser, and recomputation of both sealed-root and outer hashes.
The parser preserves the false-authority markers and rejects fully rehashed
production-promotion attempts; no production consumer or completed-handle
issuer is wired to it.

Follow-on B5D-2 checkpoint (authenticated installed metadata observation,
still non-promotable): the exact installed metadata module is now dispatched
through the admitted Node and `release-bootstrap` executable with the frozen
metadata ABI, empty environment, authenticated target-root cwd, bounded fd3
input, canonical self-hashed output, finite authenticated failure policy, and
fresh launch/target fences before and after settlement. The outer collector
owns an opaque private `0700` fixture capability and records the approved stable
`hostIdentityHash/objectKind/device/inode` identity separately from owner, mode,
link count, size, entry-set hash, and nanosecond timestamps. It returns one
strict recursively frozen evidence object with literal `test_fixture`,
`productionAuthority:false`, `productionAdmission:"forbidden"`,
`mutationAuthority:false`, and `characterization_only` fields.

Only the installed xattr and ACL observer roles are returned; clear-role
locators are withheld. Xattr observation is names-only and is cross-checked
against the fixed `ls -lde@` observation, so unauthorized attribute values are
not read into the controller. An unauthorized xattr reaches the installed child
and is accepted by the parent only as the exact authenticated rejection. Both
generic composition and host-Node target-operation acquisition now reject this
test-only metadata ABI for `production_host`, closing the specialized-context
bypass without widening another ABI.

Literal private copies of `/usr/bin/xattr` and `/bin/ls` were consistently
killed by macOS with `SIGKILL`/137 despite passing local code-signature
validation. The executable fixture therefore uses immutable `/bin/sh` wrappers
that delegate the fixed operation argv to the canonical tools. The wrapper
bytes are censused, but `/bin/sh`, `/usr/bin/xattr`, and `/bin/ls` are not yet
independent members of this single-root fixture. Execution also remains
pathname-based and runs as the test owner rather than the receipt runtime
UID/GID. These three limitations are explicit test-scope reasons the receipt is
not production admission evidence; production still requires the native
descriptor-relative installed-package/system-anchor and runtime-account
boundary.

Independent security review finished with zero high and zero medium findings.
Focused contract/operation/context tests passed 37/37 and the real Darwin
collector E2E passed 4/4, including repeated stable identity, fresh occurrence
evidence, same-byte inode drift, direct-entry drift, and authenticated
unauthorized-xattr rejection. TypeScript no-emit and `git diff --check` passed.
The complete execution-attempt suite passed 957/957 across 120 suites and root
tests passed 858/858 across 82 suites. A disposable exact-source clean local
`main` snapshot passed normal prebuild/build/postbuild, including version,
English/path, migration-digest, and all eight Mission Control contract checks;
it was moved recoverably to
`~/.Trash/setfarm-release-metadata-bridge-final-v2.20260805`. The canonical dirty
feature branch was not built.

Fresh live truth remained fail-closed: Mission Control health is healthy with
gateway/database up, 270 runs, disk 33%, and memory 67%; its root, health, and
220-project endpoints, the Setfarm dashboard, and OpenClaw gateway all returned
HTTP 200. PostgreSQL has zero active runs, zero open claims, 188/188 released
runtime sessions, zero active attempt leases, and the same seven
`inconclusive` plus two `produced_delta` attempts. Only migrations 1 through 21
exist; read-only verification stops at
`MIGRATION_INCOMPLETE: Migration 22 is pending`. The host still has zero valid
code-signing identities, Gatekeeper assessments enabled, no installed Setfarm
root, no package/DMG/app artifact, and no matching installer receipt. No
migration, credential, signing, notarization, installation, commit, or push was
performed.

Follow-on B5D-2 checkpoint (pathless dependency-pair metadata observation,
still non-promotable): the installed metadata child now emits a separate stable
metadata projection over the policy, authenticated host composition, exact
direct-entry name set/count, and satisfied outcome. It deliberately excludes
the target inode, mutable timestamps, occurrence UUID, process identity, and
allowed system-managed metadata. The raw catalog and observation hashes remain
occurrence-bound and must differ across the two physical output roots.

The pair-adjacent observer accepts only one authentic private dependency-pair
handle, claims `ready -> probing` synchronously before its first await, derives
the exact first and second output roots only from private pair state, runs one
installed child per ordered occurrence, and revalidates pair/host/target
authority between children and after final settlement. Its strict pathless
evidence embeds the full self-hashed dependency-pair inspection, joins each
metadata target's stable identity and mutable fingerprint back to the ordered
compiled output-stage physical hash, and computes one higher-level stable
projection over ABI, policy, stable launch identity, host/toolchain/composition
receipts, stable dependency output binding, payload-only root layout, and the
child metadata projection. Physical target, raw catalog, receipt, process, and
occurrence identities must be distinct.

The root-exposing test callback previously remained `ready` across an async
callback and could overlap a claimed module or metadata probe. It now holds the
shared pair-API `probing` lifecycle from before its first await through a fresh
post-callback fence. Stable callback or authenticated metadata-policy failure
releases the pair back to `ready`; any witnessed authority drift invalidates
the pair and destroys only its exact still-owned context. Ordinary test root
strings can still outlive that API lease, so evidence states this limitation
and relies on every physical pre/post fence; it does not claim a global
filesystem lease. Evidence also records the wrapper-delegate, pathname-ABA,
and test-owner/runtime-account limitations. It cannot terminalize, transfer
ownership, or acquire production authority.

Verification on 2026-08-06 closed this pair checkpoint with zero high and zero
medium findings across the independent inventory, security, and test reviews.
The focused metadata/host/composition contract set passed 46/46, the installed
metadata operation passed 5/5, the complete execution-attempt suite passed
963/963 across 120 suites, and root tests passed 858/858 across 82 suites.
TypeScript no-emit and `git diff --check` also passed. A first disposable build
was correctly refused because its dependency symlink was untracked; after the
symlink was bound in the disposable snapshot's own clean test commit, the exact
tracked-and-untracked source passed the normal prebuild/build/postbuild path,
including version, English/path, migration-digest, and all eight Mission Control
contract checks. The snapshot was moved recoverably to
`~/.Trash/setfarm-release-metadata-pair-v2.20260805`; the canonical dirty feature
branch was not built.

Fresh live truth remained fail-closed: Mission Control reported healthy
gateway/database checks, 270 runs, disk 34%, and memory 70%; its root, API
health, and 220-project endpoints plus the Setfarm dashboard and OpenClaw
gateway returned HTTP 200. PostgreSQL contained zero active runs, zero open
claims, 188/188 released runtime sessions, seven `inconclusive` attempts, and
two `produced_delta` attempts. Migration plan state still had only versions 1
through 21 installed; read-only verification stopped at
`MIGRATION_INCOMPLETE: Migration 22 is pending`. The host still had zero valid
code-signing identities, Gatekeeper assessments enabled, no installed Setfarm
root or app, no package/DMG artifact, and no matching installer receipt. No
migration, credential, signing, notarization, installation, commit, or push was
performed in the canonical repositories.

Follow-on B5D-3 checkpoint (pathless dependency-pair network-negative
observation, still non-promotable): the installed network-negative operation is
now executable only through the test host-composition capability and its exact
Node, release-bootstrap executable/module, network wrapper, sandbox, policy,
ABI, direct argv, empty environment, cwd, timeout, and output-limit joins. The
policy remains literal test-only deny-all, permits exactly one code-owned probe,
and records DNS only as supplementary characterization rather than enforcement.
The production host path rejects the ABI and no serialized value can recreate
the private launch capability.

The raw observer assigns the target one global physical identity over
`hostIdentityHash/objectKind/device/inode` and keeps owner, mode, link count,
size, direct-entry names, and nanosecond timestamps in a separate mutable
fingerprint. The operation receipt, nonce, canonical stdout bytes, direct-entry
payload root, sandbox/process identity, host-composition receipt, and fresh
before/after target fences are all joined. A target symlink, same-byte inode
replacement, noncanonical stdout/stderr, detached operation binding, unexpected
network result, or post-settlement drift fails closed without producing
evidence. The bounded runner preserves the first terminal cause and terminates
the detached process group, including a same-group grandchild, for timeout and
output-limit settlement.

The pair observer accepts only one authentic dependency-pair handle, claims its
shared lifecycle synchronously, derives the two ordered output roots from
private pair state, and performs strict before/between/after pair, host, target,
and launch fences around two installed child occurrences. The physical target,
process, operation receipt, network receipt, and occurrence identities must be
distinct while the stable host/launch/policy/dependency/payload semantics remain
equal. A stale or drifting pair is terminally invalidated; every still-owned
exact output/scratch root is cleaned, while identity-replaced roots are never
followed. Scratch cleanup failure is itself terminal and cannot be hidden by a
later successful output cleanup. Exclusive lease replay, swapped/aliased
occurrences, detached payload layout, direct-entry forgery, coherent rehashing,
and cross-host or cross-launch pair forgery are rejected.

The evidence explicitly states that its self-hashes authenticate canonical
binding, not external origin; the dependency inspection does not serialize the
live host receipt; pathname ABA and successful descendant absence remain
test-only limitations. Those boundaries, plus the fixture owner/runtime-account
gap, remain literal reasons for `productionAuthority:false`,
`productionAdmission:"forbidden"`, `mutationAuthority:false`, and
`trustConclusion:"characterization_only"`. No completed-stage issuer,
production opener, content-store publisher, or B5E consumer accepts this
receipt. Independent inventory, adversarial, and security reviews finished
with zero critical, high, or medium implementation finding.

Verification on 2026-08-06: the focused network sandbox/installed-operation set
passed 10/10, host-composition/host-Node/source-admission set passed 33/33,
network pair set passed 4/4, and Darwin native aggregate set passed 47/47. The
complete execution-attempt suite passed 974/974 across 122 suites; root tests
passed 858/858 across 82 suites; TypeScript compilation and `git diff --check`
passed. One full-load readiness flake was traced to a polling lock-holder test
helper and replaced with the existing descriptor readiness-byte handshake; its
standalone 47/47 suite and the final full-load run both passed. A disposable
exact-source clean local `main` snapshot passed the normal
prebuild/build/postbuild path, including version, English/path,
migration-digest, eight Mission Control contract checks, TypeScript output, and
terminal clean-main release-manifest generation. It was moved recoverably to
`~/.Trash/setfarm-release-network-pair-v2.mdORRi-20260806`; the canonical dirty
feature branch was not built.

Fresh live truth remained fail-closed: Mission Control, its health and
220-project endpoints, the Setfarm dashboard, and OpenClaw gateway all returned
HTTP 200. Mission Control reported healthy gateway/database checks, 270 runs,
disk 34%, and memory 72%. PostgreSQL contained zero active runs, zero open
claims, 188/188 released runtime sessions, zero active attempt leases, seven
`inconclusive` attempts, and two `produced_delta` attempts. Only migrations 1
through 21 were installed; read-only planning reported 22 through 26 pending
and verification stopped at `MIGRATION_INCOMPLETE: Migration 22 is pending`.
The host still had zero valid code-signing identities, Gatekeeper assessments
enabled, no installed Setfarm root or app, no workspace package/DMG artifact,
and no matching installer receipt. AMFI admission remains unproven because no
authenticated installed helper exists. No migration, credential, signing,
notarization, installation, commit, or push was performed.

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
Tests use a separate test constructor and temporary root. The production
publication target remains:

1. preflights canonical manifest and attestation envelopes independently;
2. acquires exact content and attestation leases;
3. atomically renames the completed content root to
   `releases/<manifestPayloadHash>`;
4. adopts an existing identical content winner only after a full fresh
   filesystem reproduction;
5. publishes the attestation as a separate no-replace canonical item;
6. issues `PreparedPlatformReleaseV2` only after both identities are durable.

No attestation occurrence bytes are written beneath the stable release root.
Conflicting bytes at either identity are corruption, never overwrite targets.

Migrations 22 through 26 already exist. Release-store persistence starts at
migration 27 or later. Prepared-handle restart rehydration requires both the
exact durable database record and a full fresh store reproduction while holding
store authority; a row, path, or JSON object alone cannot recreate authority.

Implementation checkpoint (credential-free, non-promotable):
`platform-release-content-store-test-v2.ts`, its test support, and the separate
Darwin-native kernel, builder, and runner now characterize one private temporary
snapshot with separate `.staging`, `.locks`, `releases`, and `attestations`
directories. This fixture does not implement the production whole-content-root
rename above. It uses `mkdirat` to reserve the release directory, publishes the
staged manifest and attestation independently with no-replace `linkat`, validates
the exact same-inode overlap, and performs descriptor-relative exact
`unlinkat`/known-shape cleanup. Identical complete winners may be adopted only
after fresh descriptor-bounded reproduction; a partial pair or ambiguous residue
fails closed.

The runner exposes all 13 native checkpoints. ABA displacement tests stop at
checkpoint 9 before attestation publication and checkpoint 11 before stage
cleanup. Real `SIGKILL` replay covers checkpoints 2, 4, 8, 10, and 12: checkpoints
2 and 12 recover to a complete result, while 4, 8, and 10 preserve the exact
ambiguous residue and return a terminal state conflict. A stopped live owner
holding `F_TLOCK` is neither stolen nor unlinked. Stale-lease recovery is
explicitly unauthenticated fixture characterization and succeeds only after
exact inode revalidation plus successful `F_TLOCK`; Darwin supplies neither a
same-UID atomic conditional unlink primitive nor an authenticated lease ledger.

The fixture captures one host/object-kind/device/inode identity per fenced object
plus a separate mutable fingerprint, performs canonical bounded writes, and
returns an explicitly unsigned, `test_fixture`-scoped receipt with
`productionAuthority:false`, `productionAdmission:"forbidden"`, and the
single-snapshot limitation. Its stable fence captures the persistent `.staging`,
`attestations`, and `releases` directory objects as well as the release root and
both canonical files. The receipt carries the explicit
`ephemeral_lock_lease_excluded_from_stable_receipt_v2` policy: the `.locks`
directory is checked during the fixture fence but its lease inode is intentionally
not a stable receipt identity. Exact nonrecursive cleanup also preserves
same-UID foreign root/descendant replacements in the builder, runner, and
high-level fixture. The focused Darwin verification buckets are 33/33
high-level schema/support cases, 13/13 raw native runner/crash cases, and 4/4
native builder cases, for 50/50 total.

This checkpoint cannot create `PreparedPlatformReleaseV2`, touch the registry,
or use migrations. Production still requires the authenticated bootstrap/store
lease and lease ledger, safe conditional cleanup, append-only
multi-release/multi-attestation census, whole-content-root atomic rename,
authenticated restart recovery, canonical release payload layout, restart
persistence from migration 27+, and the B5D composer bridge.

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
   - production release-store leases, whole-content-root atomic rename/adoption,
     separate attestation CAS, and prepared brand;
   - non-promotable fixture-only `mkdirat` reservation plus manifest/attestation
     no-replace `linkat` characterization.
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
- production crash before/after whole-content-root rename and separate
  attestation CAS;
- fixture ABA stops at checkpoints 9/11, real `SIGKILL` replay at checkpoints
  2/4/8/10/12, active-`F_TLOCK` non-steal, and fail-closed ambiguous residue;
- verifier racing publication or root replacement.

End to end:

- real current source lock under an authenticated test host fixture;
- deterministic double build into fresh roots;
- prepared -> verified -> RegistryV2 transition;
- CLI and API runner exports reproduced from verified bytes.

Production GO remains blocked until clean `main` performs two independent
builds and all production host/ownership/network checks without a test
constructor or guard bypass.
