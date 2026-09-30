# Task6A source closure cleanup design

## Causal scope

Protected startup needs a separately authenticated read-only source closure.
Original-owner V1 successor holders are potential capture prerequisites, but
their first-close-error loops skip owned resources. Repair that systemic defect
independently; do not ship the incomplete protected initializer with this fix.
The startup worktree and its dirty files remain preserved and paused. Root is
the sole writer in this scoped branch; reviewers are read-only.

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

These are resource protocol tests, not genuine source/Git/positive startup
authentication. Temporary fixtures are owned private directories; exact known
members are removed after all descriptors are released. No ambient PostgreSQL,
protected production namespace, live service, selector or account mutation.

Focused tests, source/test strict TS, existing anchored and pure regressions,
source-chain contract and all repository contracts precede independent exact-head
review and PR delivery. Merge only the reviewed SHA after cloud/security/thread
gates. Ordinary clean standby main build follows; existing selected deployment
and all worktrees/branches remain preserved. No whole-suite or cutover claim.
