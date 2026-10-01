# Candidate runtime fresh-root ownership V2

## Evidence and bounded objective

The genuine fourth unchanged private-Postgres `all` graph on main095220 reached
product compiler1391 tests:1390PASS/1FAIL, no cancellations or skips. The actual
failure at materializer test5323 reaches `createLayout`755 and rejects root
freshness/ownership. The failed root was automatically removed: its GID was not
captured. `/private/tmp` is group0, ordinary process group20, and the source
creates its root there without descriptor-based group preparation. A fresh
actual-constructor RED must capture the created root's metadata before removal.
This systemic production-source fix is necessary to continue the same complete
verification/internal-production objective, not generated-project rescue.

## Alternatives and chosen design

1. Prepare only each newly created root through a held descriptor and retain
   the original identity across close. Chosen: production and fixture calls
   use identical preparation while existing strict ownership gates stay intact.
2. Change TMPDIR or fixture parents. Rejected: hides production constructor bug.
3. Path-based chown or accepting inherited GID. Rejected: alias replacement or
   weakened runtime ownership contract.

Root uses the user's standing bounded design/implementation authorization;
no repeated approval gate, no implementation delegation. Review is read-only.

## Contract

Introduce one internal fresh-root constructor, not a repair-existing-path API.
Input is the code-owned absolute normalized prefix, at most4096 characters and
without NUL. Derive POSIX UID/GID; require matching real/effective credentials.
Create with mkdtemp, pin bigint device/inode/fullmode/UID/inheritedGID, require
empty nonsymlink directory0700/currentUID and a stable canonical path.
Open O_RDONLY|O_DIRECTORY|O_NOFOLLOW. Verify descriptor and alias/canonical
paths against the original pin before exactly one fchown(currentUID,currentGID).
Verify original device/inode/UID/mode and resultingGID afterward. Close once;
surface primary and close errors in ordered AggregateError with primary cause.
After close recheck BOTH paths against the ORIGINAL pin, not a newly adopted
identity. Return frozen path/device/inode only after all fences succeed.
No serialized receipt or runtime authority is granted by that internal value.

`createLayout` consumes this result, checks bigint identity before children,
binds the numeric identity to that original bigint pin, rechecks immediately
before its first child effect and after bundle identity capture before return,
and preserves every existing UID/GID/0700/canonical/empty-root check. Remove its
pre-pin path chmod and unconditional failure-path recursive rm. Failed partial
layouts are retained because Node path deletion cannot atomically condition on
the pinned inode. Successful materializer destruction keeps its existing exact
identity/census cleanup contract unchanged. No old directory is repaired or
removed; no guard is disabled. Do not alter production prefixes, PG wrapper,
fixed test graph, dependencies, live selector or source inventories elsewhere.

## Verification

Execute the actual unexported createLayout source in a finite test-only VM
module using TypeScript transpilation and real imported dependencies; expose
only that function in the test context. No production test API, no copied
constructor, no source-text assertion, no DB or native compiler invocation.
Fresh real roots and scoped syscall fault injection exercise both code-owned
prefixes, GID correction, pre/post identity drift, group failure, close failure,
ordered dual failure, post-close path rebind, and later-layout retention.
Same-owner empty replacements at numeric stat, empty census and after bundle
capture must refuse without adopting, creating children or deleting replacement.
Every denial must retain its owned root and any test-owned replacement and
never modify/delete a replacement. Fault hooks are restored and held FDs closed.
Existing runtime identity and proportional DB-free compiler suites, noemit and
contracts follow. Commit/push/review/normal PR merge, a NEW clean-main guarded
build and one NEW independently reviewed unchanged all invocation follow.
Only actual complete epoch output may prove DB-backed realization or full npm.
Protected native origin/cutover remain separate and unproven.

## File Map

- New src/product-compiler/node-candidate-runtime-attempt-root-ownership-v2.ts:
  fresh-root descriptor preparation only.
- Modify src/product-compiler/node-candidate-runtime-private-materializer-v2.ts:
  call constructor, bind original inode, retain failed layouts.
- New tests/product-compiler/node-candidate-runtime-root-ownership-v2.test.ts:
  actual constructor filesystem and denial regressions.
- This spec and its corresponding implementation plan: scope and evidence.

Self-review: one cause, explicit pins/errors/retention, no placeholder, no new
native/PG/credential authority, no existing-root API or unrelated refactor.

Actual semantic reproduction: with ambient TMPDIR, production prefix inherited
GID0 and failed while fixture prefix inheritedGID20 and passed. With TMPDIR
absent (the unchanged wrapper's scrubbed environment), BOTH actual prefixes
inheritedGID0 and failed the existing group guard. The fresh created metadata
was captured before old cleanup. No claim about the discarded fourth-run root's
unobserved metadata is needed. First fault-expanded run0PASS10FAIL/exit1.
