# Task6A GitHub delivery object protocol

## Causal scope and decision

Reviewed PR250 is delivered as mainb553919c with ordinary clean-main build,
actual compiled source/build observation and75 focused regressions passing.
Full actual private PG31 is positive but diagnostic only. Protected controller
origin remains missing; coherently copied JS/manifests are not compiler proof.
Root alone writes and delivers; all old worktrees and dirty19 are preserved.

Choose a builtin-only Git object verifier as the first small source-origin
prerequisite. Actual read-only experiments reconstructed an existing signed
GitHub merge, nonrecursive trees and a tracked MJS blob without Git execution.
Reject a generic hash/JSON receipt as origin. Reject executing /usr/bin/git as
already protected: its libxcselect shim selects Xcode under admin-writable
/Applications. An independently authenticated CLT/helper closure is possible,
but larger than testing the necessary object protocol directly.

This slice performs no HTTPS, source installation, root operation, Node vendor
download/execution, DB change, selector change or production admission. Every
caller-provided API object and expected SHA is untrusted protocol data, not
delivered/reviewed provenance. Output is frozen protocol-only characterization
with productionAuthority:false. A future reviewed fixedHTTPS publisher must
establish fresh stable-main/mergedPR/review/check evidence and an independently
admitted initial Node/native execution before using these checks for origin.

Fixed bounds: payload64KiB, signature16KiB, tree4096entries, each tree name255
UTF8bytes and blob2MiB. Every textual field must round-trip exact UTF8; every
size is a nonnegative safeinteger. No coercion or inherited/accessor metadata.

## Signed merge subset

Consume a bounded plain GitHub Git-commit API record plus a40lowercasehex object
identity. Require matching sha, verification.verified:true/reason:valid and
bounded exact UTF8 payload/signature with no CR/NUL/unpaired surrogate. Accept
only tree, exactly two distinct parent, author, committer headers in canonical
order and one blank header/body separator. The header tree and ordered parents
must match the API tree/parents. Unsupported extra headers, unsigned/multiple
signatures, non-PGP armor or malformed actor/timezone forms refuse.

Insert the gpgsig header after committer, preserving all payload and signature
bytes including the signature trailing newline and space-folded continuation
lines. Recompute SHA1 of commit<SP>byteLength<NUL>rawBytes and compare to the
expected/API identity. This verifies object framing only: the supplied GitHub
verification verdict is NOT independently verified local GPG authority.

## Nonrecursive tree and blob subset

Require a bounded nonrecursive plain tree response, exactsha and truncated:false.
Entries have one portable UTF8 basename, unique exact and case-folded names,
known regularblob100644/100755 or directory040000 mode/type, valid40hex OID and
bounded integral size where a blob. Reject slash/dot/dotdot/NUL names, symlink
120000, gitlink160000, unknown mode/type, duplicate/ambiguous members and overflow.
Ignore API URLs; do not follow returned locators. Canonical Git tree ordering
compares byte names with directory trailing slash semantics, not locale order.
Serialize mode<SP>name<NUL>raw20byteOID with tree mode40000, frame tree object
length and recompute SHA1. A tree record is not recursive inventory coverage.

Blob input is a bounded plain API response with base64encoding and exactsha/
size. Allow documented line-wrapped base64 only, require canonical decode and
exact byte length. Compute framed blobSHA1 and independentSHA256. No file read,
write, path selection or executable evaluation occurs. Object functions require
exact arity and plain data descriptors; malformed input fails closed without
partial positive output. API metadata does not reconstruct a runtime holder.

## File Map and verification

- scripts/task6a-github-delivery-object-v2.mjs: builtincrypto-only pure commit,
  tree and blob framing/validation; no producer authority or external effects.
- scripts/__tests__/task6a-github-delivery-object-v2.test.js: actual exported
  functions with independently fixed literal object identities and adversarial
  framing/header/order/encoding/shape/bounds cases. Default test:scripts glob
  already selects this file; no privileged/network test becomes default.
- this spec and companion plan: causal relation, contracts and evidence limits.

Use TDD: assert missing public behavior RED before implementation, then wrong
framing, mismatched API header relations, altered byte/order/encoding and bounds
must refuse. Independent read-only review before delivery. Focused pure tests,
source TypeScript, version/English/path/frozenmigration/12MC and diff checks;
scoped PR, exact fresh cloud/security/thread gate and clean-main build/observer.
No ambient all-tests or dirty-build/runtime-guard bypass. Future fixedTLS/
publisher/native/held-origin work remains independently reviewed and unproven.

Primary protocol references: https://git-scm.com/docs/gitformat-signature and
GitHub REST Git commits/trees/blobs documentation. Root experimentally confirmed
e15a11fc exact commit framing; trimming signature or adding payload newline
changes the hash. This experiment is feasibility, not protected origin.
