# Task6A held runtime worktree candidate capability

Root is the sole writer. The existing held physical catalog has already proved
directory/path identity and two-pass Git topology, but the diagnostic receipt
protocol introduced by PR #217 still receives an unauthenticated physical port.
Expose a short-lived, root-scoped capability only while the catalog's held
first-pass callback is active. This is a causal preparation for physical
producer authentication, not an owner receipt or cutover permission.

## File Map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`:
  add a backwards-compatible second callback argument. It may be used once,
  only for a unique runtime-zone linked-Git candidate without a local blocker.
  Recheck held path/descriptor and Git topology before and after the nested
  callback; return only an exact frozen physical tuple and reject after-close,
  unawaited, crossed, retained, missing, or drifted use. Keep the full catalog
  result and its diagnostic labels unchanged.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`:
  RED/GREEN runtime-positive and retained/missing/repeat/late/churn refusal.
  Existing two-pass drift and cleanup tests remain regressions.

Focused physical tests, pure suite, TypeScript, source manifest/digest checks,
independent read-only review, exact-head PR review, SHA-bound merge and
clean-main build/test are required. No live role, service, selected CLI,
credential, migration, worktree deletion, database write, or guard change.
The callback does not authenticate a DB port or generated source and cannot
promote `unverified` provenance or create an owner.

## Verification record

- RED: new runtime/retained/late capability tests failed because the callback
  did not provide a held capability.
- GREEN: focused physical catalog 47/47; the callback supplies one scoped
  runtime linked-Git capability and refuses retained, missing, repeat, late,
  Git-admin churn and unawaited use.
- Independent review identified a hold-cleanup race if the outer callback
  returned or rejected with nested work still pending. The holder now awaits
  nested settlement on both exits before descriptor cleanup; deferred tests
  cover both paths. TypeScript passed after repair.
- After the repair, pure suite 346/346, source manifest 18/18, migration
  digests, TypeScript and diff check passed. Independent re-review found no
  remaining Medium+ issue. Exact-head PR review and clean-main build pending.
