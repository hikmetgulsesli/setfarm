# Spawner Finalizer V2 Regression Alignment

## Causal scope

The clean-main `npm test` after reviewed Task6A journal PR #207 and a
successful build stops in `tests/recovery-coordinator-boundaries.test.ts`.
Its source regex still requires `if (!postClaimOwnershipTransferred)`, while
the already-shipped Task6A V2 refusal change at `5a33a8dd` intentionally uses
`if (!postClaimOwnershipTransferred && !postClaimRefusedV2)`. The separate
`baseline-task6a-preschema-ordinary-refusal-v2.test.ts` asserts that exact
exception and its retained-claim behavior. This test-only correction is
causally necessary to finish the clean-main verification of PR #207; it does
not change runtime behavior or loosen the finalizer for ordinary failures.

## File map and checks

- `tests/recovery-coordinator-boundaries.test.ts`: name the normal-finalizer
  and V2-retained-refusal split, and pin the full two-condition source guard
  before the existing child-kill and durable-owner-release assertions.
- No production source, package, data, service, credential or generated
  artifact change.
- RED: the focused test fails on merged main with the stale one-condition
  regex. GREEN: focused recovery test and Task6A V2 refusal test pass on the
  updated branch. Run source/diff checks and independent read-only review,
  deliver by scoped PR, then re-run clean-main build and full `npm test`.

Preserve all historical and deployment worktrees; root alone writes.
