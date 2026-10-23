# Owned Source verification buffers

The actual controlled old-handler run on main454ef7c4 exceeded its unchanged
120000ms purpose. Original59288/session93270 ended naturally with code1 after
125679.588583ms; its first expired sample followed Source check24 at122060.064ms.
Both prepares, five SQL queries and database close had completed. Source close
returned once, descriptor identities12→12 matched, pending operations/timers
settled, and8640 material pins remained unchanged. This is a measured component
failure, not a genuine private-phase or full8 result.

Root evidence is
`logs/2026-10-21-controls-current-evidence-v1/task7e-real-source-old-root-qualification-454ef7c4-v1.json`,
7025 bytes, SHA256
`d011b9385c8999a6860072b3a7e19d64a3458d3e49bd672f5927ab1adc2276a2`.
The readonly options report is
`task7e-repeated-source-proof-cost-options-v1.md`,15526 bytes,
`fd6ba1776ad6c6b131db0accb0576a95ae462944564e99c149fccb620085dbbd`.

## Decision and alternatives

Choose a private verification buffer in the helper's ordinary complete pins
check. That consumer needs a fresh digest of every byte, while its current
implementation allocates and returns full file buffers which it discards.
Keep ordinary byte-return callers on their current route.

The alternative of skipping repeated pure ancestor setup inside the stock
retention holder is deferred. It touches the single raw-retention hash shared
by M and immutable T and would require a separate admission design. Removing
filesystem observations, combining distinct temporal proofs, caching positive
results, changing the Git executable/native resolver or widening a deadline is
outside this change.

This candidate removes allocation work; it is not proven sufficient to fix
the deadline. The older sampled profile attributed only about5.5% directly to
the helper. Indirect allocation effects and hash-update overhead are unknown.
No time saving, universal lower bound or future fit is asserted.

## File Map

- `tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs`:
  private read/verification implementation and ordinary pins-check dispatch.
- `scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js`: contained
  actual private-pins tests and their explicit-position/allocation observations.
- This design and its implementation plan: causal relation, exact invariants,
  evidence and remaining qualification gates.

Only the existing sole writer changes. SourceM454, fixed T161, live services,
installationI5, credentials, runtime data and retained originals stay immutable.

## Verification contract

For one ordinary pins pass, lazily allocate at most one65536-byte zero-filled
scratch buffer and one distinct one-byte EOF buffer. Their lifetime ends with
that synchronous pass. Each file gets a new SHA256 state and an already
established expected digest; verification never initializes or refreshes one.
Every file byte is freshly read and hashed in order on every pass. Hash only
the positive returned prefix, including short reads; never hash stale tails.

Preserve the current physical-path predicate, pre/post named and held metadata
checks, original expected identity/content, integer positive read-result bounds,
explicit file positions and requests `min(65536,size-position)`. The scratch
destination offset is zero. Request exactly one byte at position=size and
require EOF0, including empty files. Accept the digest only after EOF and the
post-read metadata checks. A zero-size file hashes the empty stream.

Keep the actual check order: resource/context → first full pins → retained M
owner/identity → independent M/T observers → second full pins → context.
Keep all stock checks, topology/absence checks, file observations and close
proofs. There is no caller-visible mode, skip flag, new public API, retained
digest success or reusable observation.

H_HELD files use their original retained descriptors. STOCK_HELD files use one
temporary descriptor at a time under the same retained T owner, exact flags,
physical checks, nonreentrancy and custody ledger. Content, metadata, hashing,
allocation and close faults refuse permanently. A close fault burns before
release/recycled-FD reuse and remains UNKNOWN; it dominates another failure.
Never retry a close or inspect a recycled numeric descriptor.

Keep ordinary `file()` byte-return behavior, target graph/membership reads,
resolver facade and handoff residual loops intact. Shared private machinery is
permitted to avoid duplicating the metadata/read/custody algorithm, provided
the verification entry is fixed and cannot leak into those byte-return routes.
No implementation should copy the existing read/temporary-close algorithm as
a second independently maintained success path.

## Test and delivery contract

Use the existing contained actual private-pins seam; no successful fake Source
owner and no native/private constructor. Verify exact independent digests for
sizes0,1,65535,65536,65537 and multiple chunks, cross-file reuse and positive
short reads. Corrupt first/middle/last bytes; reject zero, negative, noninteger
and oversized reads, thrown reads, trailing data and pre/mid/post metadata
drift. Cover H_HELD and delegated files, same-owner proof, temporary close
failure/recycled FD/combined failure, reentrancy and post-close refusal.

Assert explicit read positions, lengths and coverage independently of the
destination buffer. Preserve strict legacy offsets for ordinary byte-return
reads. Observe allocation counts only within the verification call; do not
replace crypto or data predicates with permissive stubs. Two consecutive
checks must independently reread every file, and mutation between them must
refuse. Existing stock/public/observer/close counts must not change.

Root executes RED before implementation and GREEN after the smallest fix,
using the three explicitly selected safe suites, helper syntax and path
contract. Generic npm test selects unrelated protected PM work and is excluded.
Fresh independent spec/quality review and final whole-diff review precede
delivery. Root alone commits, pushes and normally merges a reviewed PR; never
commit directly to main or bypass a guard. A new clean-main stock build and
new exact material/initial-loading admission precede any fresh actual Source
measurement. Do not replay the consumed454 case or refresh its expectations.

## Authority and completion

The user's continuing instruction and Standing Owner Authorization v1 cover
this ordinary reversible refinement of the same measured failure. No repeated
design/commit/push/merge question is needed. That authority does not permit any
new credential/access-control/service action or weakened safety/runtime gate.

Allocation tests passing establish only the source change's behavior. The
120s failure remains until a separately admitted successor measurement proves
otherwise. Native/current-material/initialTCB/OS/DB/genuine/full8/rollout gates
stay open, including current d756 unknown/cancelled no_go1of8 and13 UNKNOWN
native families. Project completion cannot follow from this change alone.

Self-review: all interfaces and paths are concrete, M/T remain distinct,
verification reads all bytes afresh, and allocation reduction is separate from
unproven timing improvement. The scope is one helper behavior with one test
seam; no unrelated cleanup or feature work is included.
