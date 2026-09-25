# Finite held-physical refusal point for pre32 diagnosis

Status: diagnostic-only follow-up to PR #158. No cutover authority or catalog acceptance rule changes.

## Evidence and decision

Authenticated V4 refused at `physical-first-pass` before its database callback. A subsequent standalone built physical catalog completed in about 80 seconds with 56 visible candidates and 269 unresolved blockers, so a permanently malformed inventory is not established. The first pass includes mandatory holds, discovery, project-parent Git listings, candidate Git and `lsof +D` checks, and a final held recheck. Its generic failure currently gives no safe discriminator among intermittent drift, command timeout and PID observation races.

At the existing physical observer refusal boundary, record only a frozen finite `physicalFailurePoint` containing schema, operation, and candidate ordinal. Operations distinguish scope hold, base discovery, parent Git listing, candidate Git, candidate `lsof`, candidate record assembly, first-pass recheck, between-passes, post-database stability, second-pass candidate Git/`lsof`/comparison, and result. The ordinal is 0–255 only for candidate operations and null otherwise. Keep the existing generic Error and local cause for current tests; never publish cause text, path, PID or environment. Cleanup override may conservatively lose this point.

The code-owned zero-input V4 observer validates that exact data point directly on the physical observer Error, discards the original error/cause as before, and adds only the finite point to its already generic phase-tagged Error. The authenticated bootstrap validates the immutable point and emits it only alongside an accepted physical V4 phase. First-pass operations may only accompany `physical-first-pass`, and post-database or second-pass operations may only accompany `physical-second-pass`; `between-passes` is never published as a physical point. Invalid, proxy, accessor, crossed or absent points are not published. Other commands and all successful result shapes stay unchanged. A point describes the operation during refusal, not its root cause or owner authority.

## File map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`: finite local operation/ordinal and error data point at the existing refusal boundary.
- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: validate/copy only that point in the zero-input V4 generic phase error.
- `scripts/deployment-cutover.mjs`: strict finite point acceptance in pre32 refusal JSON only.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`: first-pass `lsof` and drift point evidence.
- `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`: physical point propagation without original error/cause.
- `scripts/__tests__/deployment-cutover.test.js`: authenticated acceptance and malformed-point refusal.
- `docs/superpowers/plans/2026-09-25-pre32-physical-refusal-point.md`: TDD and delivery evidence.
