# Execution private fresh-root ownership v2

## Objective and evidence

Repair the fresh-directory preparation seam exposed by the fifth genuine private
ALL at delivered main9b63901e. Compiler1405 tests passed, including the previously
failing CLI/API realization. Execution1160 tests ended949PASS173FAIL36CANCELLED
2SKIP. The strict retained journal is1960822bytes2139records, SHA256
b1ca2f82c89820375995412b1d8306cf9eb433d25f0a23020511be4ddf67bceb;
owned exit/close, sixEOF, two quiescence samples, admin/server close and separate
outerexit1 are definite. No later graph or cutover outcome is implied.

Independent review reconciles every failure-report block. Most failures occur
when a code-owned mkdtemp root is subsequently required to have current process
GID. Source inspection identifies missing group preparation; the journal did not
log every failed root's actual GID. New controlled constructor REDs must establish
that edge before implementation. The two passwordless restricted-login failures
are independent and will be corrected in a separate test-authentication slice;
this slice neither changes SCRAM/HBA nor provisions live credentials.

## Decision and trust boundary

Reuse the already reviewed
createNodeCandidateRuntimeAttemptRootInternalV2(prefix) filesystem operation.
Its name is runtime-specific, but its behavior is precisely a new empty private
directory constructor: normalized absolute prefix, ordinary POSIX ownership,
original bigint device/inode/full mode/UID/inherited-GID, held no-follow directory
FD, one fchown on that original fresh directory, before/after/after-close identity
and canonical emptiness checks, once-close and ordered failure causes. It returns
an internal filesystem pin, never execution, source, compiler or admission
authority. Its existing source and tests remain unchanged.

Alternatives are duplicating this operation in each constructor, which creates
more independently maintained security boundaries, or relaxing current-GID
checks/repairing a caller directory, which is outside the accepted contract.
Use the existing operation only for genuinely new empty UID-owned roots. Never
apply it to an existing root, supplied output directory, retained stage, foreign
sentinel, intentionally malformed fixture or old worktree. Nested roots already
under a corrected private parent do not need unrelated changes.

Each consumer binds its first stat/anchor to the constructor's ORIGINAL device
and inode. No post-helper repinning of a same-owner empty replacement is allowed.
Numeric consumers require safe/injective conversion before comparison. Remove
redundant pre-capture path chmod. Invalid initial-root evidence is retained,
not recursively removed by pathname. Existing source-admission exact-anchor
cleanup remains unchanged. Independent review found that four mapped ordinary
fixture builders discard the original pin before state capture or cleanup.
Actual replacement REDs establish this as a causally required refinement:
carry the original pin, reject later replacement captures and refuse cleanup of
a mismatched root. The existing pathname deletion is not atomic conditional
unlink; these are bounded identity observations, not continuous kernel writer
exclusion. No atomic cleanup or production authority claim follows.

The source-admission allocator will use a private create-and-anchor operation:
create through the existing helper, then anchor only if original device/inode
match, retaining existing UID/GID/0700/canonical guards. Context, compiled-output,
environment and install roots use that operation before children or commands.
Existing partial-allocation states and unanchored-root preservation remain;
after allocation fault callbacks, reuse/check the original anchor rather than
recapturing a replacement. Source-stage emptiness checks are followed by an
original-anchor check before the first child mutation.

The host Node probe root and positive fixture creators use the same preparation.
Node/npm pair ownership remains strict; normalizing the new fixture parent before
creating its children establishes the correct installation pairing. Adversarial
external/symlink/capture roots remain literal negative fixtures.

## File Map

Source changes:
- src/product-compiler/platform-release-content-store-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-darwin-local-package-trust-audit-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-darwin-metadata-probe-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-module-export-probe-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-required-module-closure-probe-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-darwin-host-self-observation-test-support-v2.ts
- src/product-compiler/platform-release-bootstrap-darwin-suspended-exec-binding-test-support-v2.ts
- src/product-compiler/host-node-toolchain-authority-v2.ts
- src/product-compiler/platform-release-bootstrap-installed-metadata-operation-test-support-v2.ts
- src/execution/platform-release-source-admission-v2.ts

Positive test fixture changes:
- tests/execution-attempts/platform-release-bootstrap-darwin-filesystem-native-fixture-v2.test.ts
- tests/execution-attempts/platform-release-build-toolchain-capsule-v2.test.ts
- tests/execution-attempts/platform-release-host-node-toolchain-authority-v2.test.ts
- tests/execution-attempts/platform-release-terminal-writer-v2.test.ts

New regression: tests/execution-attempts/private-fresh-root-ownership-v2.test.ts.
This design and its corresponding implementation plan complete the17-file map.
Host-self and suspended-exec test files need no fixture change: their standalone
capture roots are adversarial, and their actual native consumer suites passed
without changing those roots. Their source builders retain the original pin
across pre-dispatch and pre-receipt checks; finite no-native boundary tests cover
both replacements. These snapshot checks do not prove continuous exclusion.
The installed-metadata builder is a causal refinement: after fresh Node/npm
pairing became valid, the actual capsule test reached and rejected its GID0
target root with INSTALLED_METADATA_OPERATION_FIXTURE_BUILD_FAILED. Correct its
new-root preparation and preserve the original pin through state and cleanup.
Installed-network-negative scratch remains unchanged: it uses a different fixed
occurrence-path ABI and no observed current-GID failure justifies changing it.

## Verification and delivery

Test-only finite VM exports execute complete actual unexported constructors with
real imports, not copied algorithms or new production test APIs. No DB/native
compiler/process observer is needed for constructor REDs. Real new-directory
metadata proves exact current UID/GID/0700/canonical identity and original inode;
real same-owner empty rebinds must refuse without chmod/removal/adoption.
Source/probe tests stop at controlled ordinary boundaries without native/DB work.
This new regression leaf explicitly skips non-Darwin hosts: its installed
builders and fixed private probe parent are Darwin-specific. No Linux/Windows
coverage or emulated macOS claim is made; this host has no skipped regression.
Existing source-admission, host, content-store, terminal and native fixture tests
remain consumer verification after focused construction is green. Run them only
with their actual required private/ordinary effect clearance; never default a
DB-backed command to live5432. Keep conditional coverage explicit.

Root alone edits and delivers. Preserve canonical repos, every old worktree,
archives, private roots, shared dependency bytes and live selection. Use this
isolated9b63901e branch, docs-first commit, TDD, independent exact diff review,
ordinary scoped commit/push/PR and normal SHA-bound merge. No main commit,
force/history rewrite, dirty-build/runtime bypass, secret/access/billing/signing
or public-release change. Clean-main build and future ALL each need genuine new
evidence; previous partial groups cannot be stitched into full success.

Standing owner authorization supplies the user's execution decision; no repeated
approval question is required for this causal bounded root fix. The later native
origin/fence/genesis/32/33/live-handoff obligations remain unresolved, and the
protected bootstrap remains unconditional refusal.
