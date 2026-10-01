# Private Output Parent Fixtures Design

## Bounded purpose and current evidence

Repair test preparation, not production ownership policy. Task6a's genuine
clean-main `npm test` stopped in scripts with 1623 passes and 21 failures. One
bundle positive and five cases in each of four native fixture suites failed the
same output-parent guard. The private constructor closed its captured test and
PostgreSQL children and retained a complete failure journal; this is not a
successful full test proof or production cutover.

The scrubbed environment intentionally omits `TMPDIR`. On this Darwin host,
fresh directories under `/private/tmp` inherit GID 0, whereas the ordinary
process UID/GID is 501/20. A fresh reproduction observed UID 501, GID 0,
mode 0700 and a real directory. All five builders require current UID **and**
current GID. Existing fixtures canonicalize paths and chmod 0700, but do not
establish GID. Their normal user-specific temporary parent had hidden this
preparation assumption. The guard is correct; the fixture is incomplete.

## Decision and alternatives

Use one test-only helper for newly created fixture output parents. Pin its own
directory identity, establish current process GID on its held descriptor when
necessary, and verify UID/GID/mode and path binding before returning.

Changing the private PostgreSQL wrapper to select another `TMPDIR` would add
environment and retained-footprint behavior and conceal the fixture assumption.
Copying ambient `TMPDIR` would break the scrubbed environment contract. Relaxing
builder GID checks would weaken a real security gate. None is selected.

The user delegated bounded choices and implementation to the primary owner.
Root remains the sole writer; independent agents only inspect source and diffs.
Existing worktrees, builds, dirty changes and private cluster footprints remain
untouched. Only newly created ordinary test-owned directories are prepared;
there is no chown of an existing, supplied, system or foreign directory and no
change to process credentials, ACLs, global configuration or live access.

## Interface and ownership lifecycle

`createPrivateOutputParent(prefix: string, io = nodeFs): string` lives under
`scripts/__tests__/fixtures/`. `prefix` is an absolute ordinary mkdtemp prefix
supplied by test code. Reject a non-string, relative, empty, non-normalized,
over-4096-byte or NUL-containing prefix before any filesystem effect. It is not
an existing directory or production selector.
The helper creates exactly one new directory, observes its UID and mode, resolves
its canonical path, opens it with `O_DIRECTORY | O_NOFOLLOW | O_RDONLY`, and pins
the created, held, alias-path and canonical-path device/inode identities.

Before group preparation, every observation must be a real directory owned by
current UID with exact mode 0700 and the same captured inherited GID. Unexpected
preparation-time group drift is refused, not normalized. Process real/effective
UID and GID must agree.
If its inherited GID differs, `fchownSync` changes only that held directory to
the already current UID/GID. Afterward fresh held and path observations must
still agree on identity and have current UID/GID/mode 0700; canonical resolution
must remain identical. A successful descriptor close is required before return.

Any creation, canonicalization, open, validation, group preparation or close
failure throws. An opened descriptor is closed exactly once, including failure
paths; if operation and close both fail, preserve both errors in an AggregateError.
Failed directories are not deleted or retried by the helper. Caller-owned test
cleanup remains where it already exists. The returned path is canonical, empty
under the ordinary creation recipe, and confers no production/native authority.
Builder guards still make their own fresh decision, including emptiness and
exclusive output publication.

`io` is a test-only filesystem seam. Tests interpose a single OS boundary while
keeping real creation, descriptors, metadata and rebinding effects. It is not a
runtime extension point or a source of production evidence.

## Integration and negative cases

Replace mkdtemp creation in the five affected suites with the helper, retaining
their prefixes, canonicalization, chmod, builders, native assertions and cleanup.
All positive, timeout, tool-error, retained-stage, process-group and O_EXCL cases
must enter their intended branch rather than fail early on inherited GID.
Public-mode and nonempty denial fixtures first get correct ownership, then make
their existing intentional mode or membership violation. This improves those
tests: an unrelated GID violation can no longer satisfy their negative assertion.

No production builder, PostgreSQL constructor/journal, package script, dependency,
migration, runtime guard, native source, deployment selector or live service changes.

## Verification and acceptance

1. Observe the existing bundle test fail under an environment without `TMPDIR`:
   builder exit 1 instead of 0 and the output-parent guard message.
2. Add direct real-filesystem checks for current GID/canonical mode-0700 parents,
   canonical alias handling, group-change failures, descriptor failures, pre- and
   post-effect rebinding, invalid ownership/mode and dual operation/close errors.
   These must refuse before returning; foreign/rebound paths are not repaired.
3. Run helper and five complete suites serially with `TMPDIR` absent. Original
   guard denials, timeout and exclusive-publication branches must still pass.
4. Run normal script coverage, source contracts and proportional verification,
   then independent exact diff review and ordinary PR delivery.
5. A new guarded clean-main build and newly reviewed full private PostgreSQL
   graph are still required. Earlier partial or standalone passes cannot be
   stitched into full success. Protected-origin, continuous exclusion/fence,
   genesis, migrations 32/33 and host cutover remain separately gated.

## File Map

| Path | Responsibility |
| --- | --- |
| `scripts/__tests__/fixtures/private-output-parent.mjs` | Fresh test-owned directory preparation only |
| `scripts/__tests__/private-output-parent.test.js` | Real metadata and fail-closed descriptor/identity regression coverage |
| `scripts/__tests__/node-toolchain-provisioner-bundle.test.js` | Bundle fixture preparation and actual builder consumer |
| `scripts/__tests__/platform-release-bootstrap-darwin-filesystem-fixture-v2.test.js` | Filesystem native fixture setup |
| `scripts/__tests__/platform-release-bootstrap-darwin-host-self-observation-fixture-v2.test.js` | Host observation native fixture setup |
| `scripts/__tests__/platform-release-bootstrap-suspended-exec-controller-fixture-v2.test.js` | Suspended controller native fixture setup |
| `scripts/__tests__/platform-release-content-store-filesystem-fixture-v2.test.js` | Content-store native fixture setup |
| This spec and matching plan | Causal relation, ownership boundaries and fresh delivery evidence |

Spec self-review: one test-preparation concern; no absent platform permission is
claimed, no false native authority and no weakened production guard. Every
acceptance item is mapped to the plan. No open implementation choice remains.
