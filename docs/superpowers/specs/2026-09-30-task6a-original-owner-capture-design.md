# Task6A original-owner no-write receipt capture

## Causal scope and decision

PR247 repaired owned receipt cleanup. Protected startup still cannot consume the
original user's V1 receipts: its public successor resolvers fsync the commit
parent, and replacing their original home/UID/0700/0600 semantics is forbidden.
Root alone implements this next prerequisite under the owner's explicit decision
delegation. Preserve the frozen startup branch and every historical worktree.

Choose a separate zero-input diagnostic capture directly composing the existing
private retained commit-chain reader. Reject using the public V1 resolver because
it writes durability state. Reject copying two transient prerequisite DTOs because
they omit the successor selection, original physical inventory and history.
All existing V1 selectors, parsers, resolvers and durability calls stay unchanged.

## Interface and retained interval

`observeInternalProductionTask6aOriginalOwnerReceiptCaptureNoWriteV1()` accepts
zero runtime arguments and returns a deeply frozen diagnostic object. It accepts
no caller path, pair, body, callback, URL, environment selector or authority port.
Reject arguments and a burned receipt cleanup latch before allocation.

Hold the existing zero-input workspace anchor under the original current UID.
Bracket the capture with the existing executing-checkout clean source/build
observer. Open the private complete pinned commit chain; retain its eight members,
historical inventory pins and successor/seal/commit parent guards. Then open the
existing strict post-visible original inventory owner, retaining its ten original
directories and five original files. This deliberately preserves literal original
device/inode/UID/bytes checks; remount/device drift must refuse, not be normalized.

Copy immutable base64 strings and complete regular-file identity metadata from
these held members, never return raw descriptors or mutable Buffers. Eight roles
are ordered predecessor operation, successor edge, quarantine disposition,
successor operation, authority-v31, pending migration, activation seal, commit.
Five original roles follow the existing fixed original locator list. Retain the
authenticated historical inventory, including presence/absence and parents,
unchanged within the captured disposition plus its explicit diagnostic projection.
Capture does not need P3/status/manifest records and does not claim that broader
closure. A later genuine runtime-manifest promotion must retain those separately.

Recheck anchor, chain and originals immediately after the only semantic await,
before and after copying, around the final source observation, and before return.
Require source observations equal. Bound aggregate raw member bytes to16MiB and
serialized diagnostic data to32MiB, in addition to existing1MiB member bounds.
Close originals, chain and anchor through the delivered attempt-all latch helper.
Retain primary and every cleanup cause; any uncertain close rejects the result and
future receipt capture. No ambiguous descriptor retry and no readiness publication.

## Evidence is not authority

The diagnostic object explicitly identifies itself as capture-only. It cannot
grant promoted V2 authority, startup readiness, DB access, migration, per-effect
ownership or admission. Same-UID malicious writers are not excluded by retained
descriptors; a trusted protected executable/capture process and continuous writer
fence remain prerequisites for any promoter. Root-owned copies or self-hashes
remain insufficient origin attestation. No root invocation of user-owned Node,
account/ACL/LaunchAgent/namespace/DB/selector change occurs in this slice.

## Verification

TDD executes the real private capture composition and member projection bodies
with real temporary held descriptors. Authentication/source ports are controlled
protocol fixtures, not authentic positive source proof. Cover complete ordering,
defensive immutable byte copies, absent history, bounds, crossed member relations,
drift before yielding, source drift, original-inventory rejection, argument/latch
denial, exhaustive three-owner cleanup and primary/all cleanup causes. No production
testing seam is introduced. Existing real copied-fixture receipt/durability and
cleanup regressions must remain green. Run source/test strict TS and contracts,
independent read-only review, exact-head cloud/security/thread audit, SHA-bound PR
delivery and ordinary clean-main build. Only then run a no-write actual original-
owner host probe; report exact refusal if literal authenticity fails. No fake
positive fixture or protected-startup delivery follows a refusal.
