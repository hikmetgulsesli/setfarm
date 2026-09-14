# Retirement Test Process Isolation

## Goal and authority

Complete the existing cold-recovery verification without losing retirement
tests to cumulative Node heap exhaustion. This is a test-infrastructure root
fix within the standing owner-authorized internal-production goal, not a change
to production admission, migration, process authority, or delivery gates.

## Evidence

On clean `5ab68065`, the adjacent verification worker exhausted approximately
4 GiB after 100 of 163 retirement top-level test registrations had reported.
The outer Node summary did not account for the remaining 63. Unique copied
module imports plausibly retain cumulative ESM state; no heap profile establishes
an application memory leak. The separate timeout/spawn fixture injections were
bound to the wrong direct-helper occurrences and are repaired independently.

## Alternatives and decision

Use one fresh serial process per registered retirement test. This preserves the
original test file and invocation, bounds retained module state to one test, and
gives every registered name a parent result. It adds process startup overhead,
which is small relative to the existing real-process fault scenarios.

Fixed multi-test shards would use fewer processes, but introduce an additional
partition inventory and leave shard-specific cumulative memory ceilings. Raising
the heap limit does not solve missing coverage accounting and is not selected.

## Test-only architecture

The owning retirement file defines a private test-registration adapter. Full invocations
register all existing test names in their existing order, then execute each name
in a fresh child running the same file with an escaped exact name selector.
The parent waits for each child before starting the next. Test bodies and their
independent private fixtures are unchanged.

Explicit CLI name selection retains native node:test behavior. The child uses
that same existing selection mechanism, not a new environment authority or a
production test bypass. Full gate commands have no name selector and therefore
cannot enter the focused path. Duplicate names are rejected, and the full-run
registration count is pinned to 169: the independently audited 163 existing
tests plus six adapter regression tests. Completion
accounting must match all registered names in order.

For each child, require zero exit status, no terminating signal, exactly one
successful requested top-level TAP test, a complete one-test top-level plan,
and consistent terminal counters with zero failures, cancellations, skips or
todos. Nested subtests are included in the child's counters. Truncated output,
missing completion, a mismatched name, extra top-level tests, and abnormal exits
fail the parent even if Node omits an explicit crash event. Bound captured output
and emit a compact diagnostic with the child count after success.

No database URL or runtime configuration is introduced. Children inherit the
existing verification environment except `NODE_TEST_CONTEXT`, which must be
removed for Node to launch an actual new test runner rather than inherit worker
mode. No source guard or heap override is added.
Only disposable test processes are launched. Cleanup remains owned by each
existing test; an abnormal child is reported, not repaired by indiscriminate
process killing or directory deletion.

## File map and verification

- `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`:
  two scoped fixture injections, private serial registration/subprocess adapter,
  fail-closed completion accounting, and six real subprocess regressions.
- Existing cold-recovery plan and this design record causal scope and evidence.
- Keep this implementation within the already mapped retirement test file;
  no new test paths, frozen source tuple changes, or adjacent command changes.
  Regressions extract the actual private adapter declarations using TypeScript's
  AST into disposable child fixtures, not a separately maintained copy.

First demonstrate shared per-file state defeating the fresh-process contract,
then implement the adapter and prove real child processes isolate that state.
Exercise failure, missing output and completion validation with controlled
fixtures. Run the repaired sixteen-mode cold-controller test, the complete
169-registration retirement file, all adjacent checks, and finally the exact
clean-checkpoint P3 matrix. No prior SHA's passes substitute for that final run.
