# Task6a source creator write custody

## Problem and bounded outcome

The retained cold-pre32 probe is verified at11527271. Protected-origin V2 still
has no genuine source publisher. Its staged consumer can check a supplied test
admission, but that consumer does not prove exclusive creation or completion of
the original writes. This prerequisite implements only the private creator's
directory and four source-write lifecycle in the existing trusted bootstrap.
The existing owner-admitted architecture remains the governing design:
`2026-09-30-task6a-protected-origin-bootstrap-v2-design.md`.

The bootstrap's first unconditional refusal, final unconditional refusal,
uninitialized staged admission, TypeScript V2 refusal and frozen guarded32 stay
closed. No privileged execution, source transport, helper import, vendor fetch,
archive selection, Node execution, production namespace or new authority.
This slice is source implementation and ordinary-host mechanical calibration.

## Private lifecycle

Only bootstrap-private functions can create, write, finish and release. Creation
accepts zero arguments. It requires root real/effective UID and primary/effective
GID0, an unused creator, no active foreign descriptor realm, settled helpers and
the unchanged bootstrap deadline. There is no caller path, nonce, owner, handle,
hash, callback, source DTO or cleanup receipt.

Private interfaces are `task6a_origin_create_source_root()` (zero arguments),
`task6a_origin_write_source_member(role,bytes)` (two arguments),
`task6a_origin_finish_source_writes()` and
`task6a_origin_release_source_creator()` (both zero arguments). Each returns
`{scope:'source-creator-write-custody-diagnostic-only',productionAuthority:false,
sourceCount}`; successful release adds `handlesClosed:10`. Arity refusal burns.

These live predicates apply again at every create/write/finish boundary and
before/after each retained noncleanup primitive, including final publication.
Recheck all acquired directories at those epochs. Expiry, a new foreign realm or
unsettled helper burns permanently before any next effect. No deadline renewal.
Disposal/release depends only on sealed original close obligations, never on
renewed owner, deadline, helper or path validity. Include armed ordinary modeled
clock/helper changes during a genuine write in the controls.

Retain read-only no-follow directory originals for `/`, `/private`, `/private/tmp`
with their observed identity and expected protected owner/mode. The sticky parent
is root-owned01777. Acquire a separate `/dev/urandom` original, retain it before
return inspection, configure it nonblocking/CLOEXEC, read exactly32 bytes and
definitively close it once. Derive one private `/private/tmp/task6a-source-v2-`
plus64 lowercase hexadecimal bytes path. Exclusive `mkdir` success establishes
the creator event; a collision, lost response or exception burns the lifecycle.
Never adopt an existing directory or retry a different path. Create root0700
and source0700, retain directory originals, and check same dev/inode and owner
across path/descriptor observations before and after every subsequent effect.
Directory link counts can change during the creator's own child creation;
identity comparisons do not pretend these mutable counts are fixed.

The write function accepts only the next fixed policy role and ordinary bounded
byte scalar. Its framed Git blob identity must match the existing literal policy
before any file acquisition. The creator derives the exact path; no traversal
or alternate role/order is accepted. Files are acquired once with
O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW|O_NONBLOCK and0600. Each original output cell is
retained before sysopen. Original FH/fd and exact close primitive are sealed
before return-value, flag, stat, clock or content inspection. An exposed handle
from false/throw remains an owned disposal obligation. Proven live aliases are
not enrolled twice; incomplete classification permanently records uncertainty.

One syswrite must complete all bytes without exception or errno. No partial
write retry. Readback uses that same original O_RDWR descriptor after seek0,
bounded exact sysreads, exact EOF and SHA256/byte agreement. Seal mode0400 for
helpers and0444 for entry through the original handle, verify original identity,
single link, owner, size, mode, nonblocking and CLOEXEC, then close exactly once
and require both success and absence of a live descriptor. Refusal closes other
known originals once, but never retries a failed/uncertain close.

Finish requires all four writes definitely closed and their path identities
still equal to the creator's originals. It seals the held source directory0555,
keeps root0700 and retained directory originals, and returns only an inert
diagnostic (scope, false productionAuthority, sourceCount). The incomplete tree
cannot satisfy staged custody: vendor members and final root0711 are absent.
Release closes only retained original handles, requires all definitely closed,
and does not remove paths. After release or any failure, creation/write/finish
cannot resume. Partial artifacts remain evidence. Future full publication must
join its own vendor selection and readonly handoff to this same private creator;
it cannot convert this diagnostic into staged admission.

## Testing and evidence boundaries

Default tests refuse root and non-macOS before any local Perl child. On this
ordinary Mac, an in-memory copy removes only the two unconditional call guards
and substitutes the creator's private UID for the ordinary test UID and process
GID predicate for the ordinary primary GID. Actual Darwin fixture creation
inherits the root-owned parent's GID0; that observed artifact check stays0.
Ancestors and entropy retain the real root-owned checks. This models the
privileged owner predicate; it is not root-authentication or delivery evidence.
Actual mkdir/sysopen/write/read/chmod/stat/close run in ordinary owned fixtures.
No source file on disk is opened for root execution or modified to allow entry.

Fault controls replace exact creator primitive sites only in memory. They must
show that the relevant effect occurred: exposed-open throw/false, partial write,
readback drift, same-byte inode replacement, alias output and failed close. Check
the sticky refusal, single acquisition/no retry, exact originals closed once,
retained uncertain original, no path deletion and no staged admission. A missing
function before implementation is interface RED only. In-memory mutants removing
the relevant checks must fail behavioral assertions after the baseline works.
Observe every real native acquisition independently of the creator ledger and
require one close attempt, including an exposed false/throw output. A deliberately
unclassifiable magical output remains uncertain, retained and unclosed without
FETCH or guessed disposal. Independently snapshot actual bytes/modes/owner/GID
before cleanup; require a positive partial write or a complete actual write
before a modeled midwrite expiry/helper/foreign intervention. Include an omitted
enrollment mutant to show that the independent oracle catches a hidden original.
Ordinary fixture cleanup is outside production, identity-checked and limited to
the test-owned tree after the original child naturally terminates. Uncertain
termination retains the fixture. No old receipt is relabeled.

## File Map

- `scripts/task6a-protected-origin-bootstrap-v2.pl`: private creator lifecycle;
  keep every admission/refusal and source policy identity unchanged.
- `scripts/__tests__/task6a-source-creator-write-custody-v2.test.js`: dedicated
  ordinary-host actual IO, explicitly modeled owner/fault ports and omissions.
- This spec and the paired plan: authority/evidence limits and delivery record.

Adjacent test prerequisite discovered by actual full bootstrap verification:
the staged modeled vendor/native backings used fixed old package.json/README
sizes. Current package24741B differs from the old22734B fixture, causing230 of
1419 cases to refuse in fixture setup before reaching their control. Replace
only these two inert backing choices in
`scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js` with new
`scripts/__tests__/fixtures/task6a-staged-{vendor,native}-backing-v2.txt`.
Keep literal76/82B and vendor SHA25646bb5c40ae918a624f6c6e298334c4041d34d3dd90fa6aca1dd230a840999a75
in the modeled harness. No archive/native parsing or production pin changes.
This removes unrelated source-file churn from the modeled custody fixtures.

The package's existing test:scripts glob covers the new file. No package,
dependency, canonical migration, protected helper or live-service change.

## Verified ordinary checkpoint

Final sequential1421 tests pass with zero failures/skips, including28 creator
controls. Two independent source reviews C0/I0/M0 and independent83-assertion
terminal audit agree on the source/evidence scope. Root UID/GID predicate remains
modeled in tests, default production entry stays refused, and staged admission
is unset. The paired plan records natural original PID/status and exact receipt.
This checkpoint does not open privileged helper initialization or full publisher.
