# Task6A source closure cleanup design

## Causal scope

Protected startup needs a separately authenticated read-only source closure.
Original-owner V1 successor holders are potential capture prerequisites, but
their first-close-error loops skip owned resources. Repair that systemic defect
independently; do not ship the incomplete protected initializer with this fix.
PR247 cloud P1 at634b64d exposed raw-member callers outside the first owner
set. The same prerequisite must cover every raw-member release: frontier,
publication, post-visible originals/status, historical authority, retained
status and source observers. Publication ownership slots must be revoked before
close; replacement ownership transfers before releasing the predecessor.
Pre-schema observers must track newly opened members before validation can
throw. Progress status must likewise track a returned nested owner before
crossed-operation/source validation can throw. No new receipt semantics or
source authority follows from this refinement.
Five immediate borrower wrappers must not discard the newly retained child
cleanup errors. Original holders, both raw return branches, selected pass and
progress pass preserve all causes through synchronous or awaited attempt-all
cleanup. The private async helper burns the latch at each failure immediately;
it aggregates already collected errors without re-invoking resource releases.
The startup worktree and its dirty files remain preserved and paused. Root is
the sole writer in this scoped branch; reviewers are read-only.

Exact-head cloud review at16e7b78d found two further raw descriptor/guard
groups: receipt-store snapshot reading and recovery candidate parent durability.
Both must attempt the descriptor and guard even after either close fails,
preserve the operation's primary rejection, and reject subsequent allocation
after cleanup uncertainty. Existing read validation and fsync ordering are
unchanged; testing the durability body's resource protocol does not perform a
production fsync or grant publication authority.
The immediate authentic held-writer owner and selected progress CAS child must
also obey the same contract; an outer attempt-all wrapper cannot exhaust a
child whose own first-error loop leaks pins. Release and revoke acquisition-only
writer pins before transfer, revoke rejected link descriptors before close,
retain link/acquisition cleanup evidence, and preserve the ordinary bounded
EEXIST collision retry when cleanup succeeds. CAS member acquisition, stability
and release share the latch. Immediate presence/root/directory and publisher
context wrappers retain primary plus nested cleanup failures. Generic CAS
mutation/publication machinery is excluded; no unrelated refactoring follows.
Actual copied physical-present and E1 regressions require retaining all child
causes through E1 resource grouping and policy/common/content-shard/entry-content
endpoint borrower catches as well. Their old first-error/suppression behavior
cannot discard evidence from the repaired directory owner. Test-only aggregate
tree projection checks exact primary and independent cleanup causes in causal
order, preserving FD, close-count, reverse-order, topology and semantic checks.

## Chosen contract

Keep every existing parser, fixed home/UID, 0700 parent, 0600 leaf, strict final
link-count, Git/migration and durability rule. Do not copy or chown receipts,
add a service UID, invoke fsync, grant startup readiness or publish a V2 capture.

Reject first-error cleanup (leaks later owners) and retrying ambiguous OS closes
(can close a reused FD). Instead revoke each owner before cleanup, attempt all
its releases exactly once and aggregate errors. Idempotent chain/inventory/
parent close retains any failure; receipt guards retain double-close refusal.
Construction failures retain both acquisition and cleanup causes. Lower member
acquisition and two-link final rejection must latch uncertainty even before a
record is transferred into the outer owner's tracked list.

A module-private irreversible receipt-cleanup latch denies subsequent member,
record, parent, inventory, chain and directory-guard acquisition and invalidates
held stable observations. Check it before allocation and after the chain's first
semantic await. Cleanup itself remains allowed after the latch burns so other
already-owned resources can still be released. This is process-local fail-closed
resource handling, not arbitrary same-UID JavaScript or administrator exclusion.

## Verification and delivery

Execute actual private TypeScript function bodies through AST extraction with
real temporary FDs. Only semantic/owner helper ports and OS-close failure are
controlled; no production export or injectable authority seam is added. A fault
releases the FD then reports uncertainty, modeling ambiguous close without
retries. Independent EBADF assertions detect skipped real resources. Tests
cover construction/normal cleanup, retained errors, rejection before tracking,
two-link inode, shared-owner revocation and an in-flight semantic await.
The refinement also executes actual owner-local callbacks, finalizers, catch
blocks and the progress nested-owner loop. Publication effects are controlled
and do not authenticate publication; real acquired FDs and transfers are tested.
Track each acquisition generation so legitimate numeric FD reuse is accepted
but ambiguous re-close is rejected. Preserve primary plus multiple independent
cleanup causes rather than just the first failure.

These are resource protocol tests, not genuine source/Git/positive startup
authentication. Temporary fixtures are owned private directories; exact known
members are removed after all descriptors are released. No ambient PostgreSQL,
protected production namespace, live service, selector or account mutation.

Focused tests, source/test strict TS, existing anchored and pure regressions,
source-chain contract and all repository contracts precede independent exact-head
review and PR delivery. Merge only the reviewed SHA after cloud/security/thread
gates. Ordinary clean standby main build follows; existing selected deployment
and all worktrees/branches remain preserved. No whole-suite or cutover claim.
