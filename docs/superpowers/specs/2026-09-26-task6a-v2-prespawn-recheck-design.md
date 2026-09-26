# Task6A V2 prespawn continuation recheck design

## Decision

`spawnAgentNow()` samples the V2 ordinary-start refusal at entry, but then
awaits the background-workflow query, optional OpenClaw gateway restart and
optional gateway readiness. A fixed current-entry operation or shutdown can
appear during any await. The later continuation can queue a retry, clean
OpenClaw state, restart the gateway or begin claim-related filesystem work.

Recheck the existing no-write V2 assertion and shutdown state immediately
after each awaited prespawn boundary, before the next effectful branch. Keep
the existing branch order, retry behavior and capacity check. Do not add a
new authority result, alter direct/cold bootstrap, or change the admission
classifier. These are sampled gates: an operation arising after a sample or
an already-running effect is not continuously fenced.

## File Map and verification

- `src/spawner.ts`: recheck after background-defer, optional gateway restart,
  and gateway-readiness awaits, before subsequent effects.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  source-extracted RED/GREEN ordering and refusal/permit/shutdown interleavings.
- `docs/superpowers/plans/2026-09-26-task6a-v2-prespawn-recheck.md`:
  scoped delivery steps.

Run focused, pure/cutover, relevant spawner tests, TypeScript and source
contracts, plus independent read-only review. Root is sole writer; preserve
selected historical build/link and all retained worktrees.
