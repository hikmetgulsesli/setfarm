# Finite pre32 host-pair refusal classification

Status: diagnostic-only follow-up to PRs #156–#157. No owner or cutover authority.

## Evidence and decision

The authenticated V4 pre32 host-pair command still refused after the physical catalog was made capable of reporting periodic Git-admin churn as an unresolved blocker. A subsequent standalone read-only physical catalog completed with 55 visible candidates and 269 named blockers. The authenticated default-context command had separately qualified both passive launchers and zero legacy counts. The bootstrap currently collapses all V4 nested errors and its own envelope validation into a single `pre32-host-pair` stage, so the next root fix cannot be selected from the refusal.

An independent review found that error-message classification would be misleading: the physical catalog wraps between-pass database callback errors in its own generic error, and the launcher can wrap database errors. Instead, the code-owned zero-input V4 observer tracks only its own finite execution phase: `launcher-load`, `launcher-acquire`, `passive-qualification`, `pre-physical-recheck`, `physical-first-pass`, `database-callback`, `physical-second-pass`, `pair-validation`, `post-pair-recheck`, or `launcher-cleanup`. On failure it discards the original error and cause, emits a new plain fixed-message Error with one immutable phase data property, and always attempts held launcher cleanup; cleanup failure overrides the phase. The callback phase is set before invoking the database callback and the second-pass phase only after it resolves. A physical-catalog wrapper cannot relabel database failure.

For this verb only, the authenticated bootstrap accepts the phase solely from a non-Proxy plain Error with the fixed message and exact own data descriptor; otherwise its `pre32FailurePhase` is `unknown`. Retain the existing bootstrap scope/stage, `cleanupFailed:null`, no stdout and generic refusal marker. Bootstrap-envelope validation, unexpected errors, accessors, proxies and spoofed phases remain `unknown`. Do not attach original messages, causes, paths, URLs or credentials. Other verbs and successful result shapes remain byte-compatible. This is a diagnostic phase, never a permission or retry instruction.

## File map

- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: code-owned V4 phase transitions and generic phase-tagged error without original cause.
- `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`: real V4 composition fixture for DB callback, physical passes, cleanup, and postcheck failure phases.
- `scripts/deployment-cutover.mjs`: strict finite phase acceptance at the pre32 nested catch only.
- `scripts/__tests__/deployment-cutover.test.js`: authenticated fixture tests for accepted phase and unknown/secret/malformed refusal.
- `docs/superpowers/plans/2026-09-25-pre32-refusal-classification.md`: TDD, review, delivery and host evidence.
