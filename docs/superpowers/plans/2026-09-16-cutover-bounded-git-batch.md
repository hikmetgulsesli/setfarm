# Bounded historical Git batch reads

Root is sole writer; agents review read-only. This causally necessary cutover
root fix preserves all gates and performs no service, archive, link or DB changes.

## Evidence and design

The first actual authenticated default-context inspection spends minutes in Git
children. The retained tree has 1624 paths / 1615 unique blobs. Each complete
source pass launches 1625 children; after env-absence acquisition, the composition
requires about 9750 children before sampling. Mission Control legitimately
renames its scheduler state every 30 seconds, invalidating held parent timestamps.
Do not bypass guards, suppress that writer, cache mutable source state or retry
within a failed epoch.

Replace only historical per-blob subprocess reads with bounded fixed Git batch
reads. First validate exact ordered batch-check OID/type/size records; then read
byte-budgeted batches. Validate exact binary framing, reported lengths, order,
object hashes, EOF, child status/stderr, file and aggregate limits. Preserve all
source/ref/status checks, physical identity pins, current-byte comparisons,
rechecks, duplicate-reference aggregate accounting and public observations.

## File map

- scripts/build-generation-retention.mjs: private bounded batch helper and
  historical inventory call site; no new public authority.
- scripts/__tests__/build-generation-retention.test.js: source-boundary contract,
  real historical blob/hash equality and existing mutation/ABA regressions.
- scripts/__tests__/build-generation-git-batch.test.js: focused private helper
  fixtures, binary/empty/duplicate positives, malformed/error/budget negatives,
  subprocess-count ceiling.

## Sequence and proof

- [x] Failing tests proving missing batch behavior and required refusal cases.
- [x] Smallest implementation; independent review; focused and genuine gates.
- [ ] Scoped reviewed PR and normal clean-main build in independent clone.
- [ ] Fresh bounded host epoch; never reuse a failed qualification.

The remaining filesystem/helper/phase, controller and journaled transition gates
are unchanged. No whole-goal completion claim follows this optimization.

## Evidence ledger

- Missing private helper RED20/20; implemented reader GREEN26/26, including actual
  Git exact32MiB and split payload batches, maximum10000 entries, binary/empty/
  duplicate inputs, both object hash lengths and malformed/error refusal cases.
- Focused existing retention authority29/29; standard serial genuine28/28 in45.1s;
  bootstrap/retained-profile94/94 including nested genuine28/28. Noemit passed;
  source manifest18/18, English1563/path892 passed. Full retention234/234 passed
  in293.5s (session82238), including existing mutation/ABA/close-loss guards.
- Independent read-only safety review found no blockers. Suggested exact-size
  and maximum-entry boundary tests were added and passed. Independent compatibility
  review also found no blockers; payload-phase child failures now covered too.
- Actual pre-fix host session40673 exited1 with sanitized BOOTSTRAP_REFUSED after
  several minutes. No completed host qualification; exact refusal stage unknown.
