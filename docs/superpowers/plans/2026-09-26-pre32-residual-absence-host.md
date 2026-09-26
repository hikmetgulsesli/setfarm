# Pre-32 residual absence host bootstrap plan

Root is the sole writer. Preserve all existing worktrees and selected deployment
artifacts. This follows the V3 diagnostic projection delivered by PR #182;
authenticated host exposure is necessary to measure that same cutover blocker
on the actual Mac mini, not a new owner or migration feature.

## File Map

- `scripts/deployment-cutover.mjs`: add a new V3 diagnostic command, while
  preserving V2, journal 32/33, and bootstrap safety gates.
- `scripts/__tests__/deployment-cutover.test.js`: fixture and negative contract
  tests for new command.
- `docs/superpowers/specs/2026-09-26-pre32-residual-absence-host-design.md`:
  exact bounded behavior and nonauthority boundary.

## Execution

1. Add tests for authenticated V3 success and refusals. Run focused new tests
   and observe RED before implementation.
2. Implement by reusing the existing V2 nested validation, then independently
   validate V3 wrapper and exact blocker partition. Re-run focused GREEN.
3. Run complete bootstrap tests, internal-production cutover/pure tests,
   TypeScript and source contracts. Ask an independent read-only reviewer to
   inspect the diff; resolve Important findings with RED/GREEN tests.
4. Commit the scoped branch, push, deliver a reviewed PR, then fast-forward
   only verified-clean deployment/selected-source checkouts. Run a normal
   clean-main build and authenticated no-write V3 host observation from an
   external CWD. Record hashes/counts and remaining blockers. Do not claim
   physical zero-owner or change live selected CLI or services.
