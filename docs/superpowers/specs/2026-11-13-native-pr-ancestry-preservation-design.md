# Preserve native candidate ancestry through PR integration

## Goal and observed failure

Let a native V3 QA failure reach its existing bounded repair path after PR integration. Run04c produced a genuinely verified candidate, then QA correctly rejected missing game behavior. Preparing the repair failed because the accepted candidate was absent from the integrated target's ancestry.

The original accepted commit and the integrated target both exist. They have the same parent and tree, and `merge-base --is-ancestor` exits1. The original workflow journal records an exact-head `gh pr merge --squash`. The downstream authentication in `v3-native-implementation-attempt.ts` correctly requires the accepted commit to be an ancestor. Squash integration violates that existing provenance contract.

This is a necessary platform fix for the existing generate, test and repair objective. The failed run, its actual QA findings and all original evidence remain unchanged. The separately observed canvas-assertion gap is outside this change: existing QA already rejected the product.

## Design

Add a final optional parameter to `tryAutoMergePR`:

```typescript
mergeMode: "legacy-squash" | "preserve-ancestry" = "legacy-squash"
```

The existing V3 verify caller selects `preserve-ancestry` from the persisted `verifyRunProtocol.protocol`. It still supplies the authenticated, configured-build/test/lint-tested head SHA. Other callers keep the existing default.

In `preserve-ancestry` mode, require an explicit valid full expected head before any command. Execute one normal `gh pr merge --merge --delete-branch --match-head-commit <head>`. A failure returns false to the existing pending-verification path. This mode has no admin, squash or unchecked-head fallback. The existing legacy path keeps its behavior.

Keep exact review rereads, owned checkout authentication, configured premerge checks, head-drift checks, postmerge synchronization/build checks and downstream ancestry authentication. Do not replace ancestry with tree equality, reconstruct accepted receipts, rewrite history or repair the old run. No new role, API endpoint, database schema, timeout, budget, provider or runtime exception is introduced.

## Alternatives

Preserving the candidate through a normal merge fits the current commit-identity authority. Reinterpreting a squash result as equivalent would require a different provenance protocol and could weaken ownership checks. Rewriting the already failed project's history would hide the demonstrated platform failure. Neither is required here.

## File map

- `src/installer/pr-state.ts`: explicit ancestry-preserving merge mode, required tested head and one protected merge attempt.
- `src/installer/step-ops.ts`: select that mode only for the persisted V3 verify protocol.
- `tests/execution-attempts/subscription-owned-stage-evidence-v1.test.ts`: actual caller-mode contract and native refusal boundaries in the existing finite source-data realm.
- `tests/execution-attempts/native-pr-merge-ancestry.test.ts`: execute the actual production merge function body against an owned local Git fixture; the command port performs real Git merges and never calls GitHub.
- `tests/claim-log-lifecycle.test.ts`: retain the existing review-settle, merge, cache and recheck source-order assertions with the explicit merge-mode argument.

## Verification and delivery

First commit tests without production changes. A real local Git regression must show the old helper returning success while the accepted candidate is not an ancestor of the squash target. A valid normal merge must preserve ancestry. Also verify the V3 caller forwards the tested SHA and mode, native protection refusal performs no admin retry, and native mode cannot capture an unchecked head. Existing legacy and head-mismatch tests remain required.

Use the maintained execution-test runner for exactly the two named files, then TypeScript checking. Check the affected source-order test with `node --import tsx --test tests/claim-log-lifecycle.test.ts`. No PG cluster, browser, provider call or new test selector is needed. Root remains the sole delivery owner; use independent review, a scoped PR and ordinary protected merge. The clean-main build and existing guarded rollout follow actual merge. A new clean run, rather than rearming the failed run, supplies later live qualification.
