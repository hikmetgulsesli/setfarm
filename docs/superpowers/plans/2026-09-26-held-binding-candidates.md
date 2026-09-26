# Held binding candidates implementation

## Causal scope

PR #177's V7 journal/binding pair remains diagnostic and lacks physical execution provenance. The existing non-pre32 active-binding pair has the required active rows and held physical bracket, but drops the first-pass identities before a code-owned row-to-root join. This slice exposes only a receipt-required candidate relation while preserving all unresolved physical and database state. It does not mint a receipt or change cutover gates.

## Steps

1. [x] Confirm clean isolated branch at reviewed main `9fa0d56d`, current active-binding and physical-callback contracts, and unaffected V1–V7 behavior.
2. [x] Write RED tests for strict held candidate join, unresolved cases, retained roots, callback/cardinality and second-pass mismatch, bootstrap authority/hash/argv refusal. A review-found cross-root duplicate session case was reproduced RED and fixed before GREEN.
3. [x] Implement pure bounded join, separate active-binding held pair, zero-input launcher flow and authenticated verb without changing V1 outputs.
4. [ ] Run focused and proportional suites, contracts, independent read-only review, then commit/push reviewed PR. Resolve all evidence-backed findings. Verification before delivery: pure 159/159, cutover 424/424, manifest 18/18, scripts 819/819 plus genuine integration 43/43, TypeScript no-emit, repository contracts and diff check passed. Read-only re-review found no important or critical defect; PR delivery remains.
5. [ ] Fast-forward separate clean-main clone, run normal guarded build and authenticated no-write host probe; report exact refusal or diagnostic output, not inferred owner authority.

## File Map

See the design's bounded file map. No migration, runtime producer, admission, live service, selected dist/link, worktree cleanup or Mission Control change is in scope.
