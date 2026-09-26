# Task6A V2 ongoing spawn refusal design

## Decision

The merged pre-schema V2 check protects an ordinary spawner only when its
`main()` starts. An already-running spawner can enter `spawnAgentNow()` after a
current-entry operation appears and before the through-33 journal is applied.
This is the same Task6A cutover objective, not a new admission authority.

Call the existing no-write `assertTask6aPreSchemaOrdinaryStartupV2()` as the
first statement of `spawnAgentNow()`. Its present-operation/not-through33 case
rejects before ordinary spawn effects, gateway cleanup/restart, runtime tracking, `/tmp`
unlink, `claimStep()`, or a child launch. Absent-operation and exact through33
continue into the unchanged gates. Reuse the exact refusal code; add no flag,
fallback, or new evidence shape. Special direct/cold startup keeps its prior
ordering because this change is inside the ordinary spawn path.

This is a sampled new-spawn refusal, not a continuous DB/OS writer fence. The
already-running poller's other maintenance writes, direct CLI `claimStep()`,
existing sessions, and same-role database connections remain separate gaps.
Do not call it Task6A admission or a completed cutover. A global `claimStep()`
guard would alter the shared CLI/integration contract and requires its own
isolation and tests. Live credential, role, service, and launcher transitions
remain outside this code-only slice.

## File Map and verification

- `src/spawner.ts`: first-statement V2 preflight in `spawnAgentNow()`.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN source-order and extracted first-statement effect-boundary test.
- `docs/superpowers/plans/2026-09-26-task6a-v2-ongoing-spawn-refusal.md`:
  implementation and verification sequence.

Run the focused test RED then GREEN, pure/cutover suites, TypeScript and source
contracts, and independent read-only review before PR delivery. Preserve all
historical and deployment worktrees; root is the sole writer.
