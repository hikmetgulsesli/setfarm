# Task6A V2 direct CLI claim refusal design

## Decision

PR #193 samples V2 pre-schema refusal before an already-running spawner starts
an ordinary agent. The direct `setfarm step claim` CLI route still reaches
`claimStep()` without that check. A current-entry operation can appear after the
CLI process starts, and `claimStep()` may perform recovery, cleanup, worktree,
or database effects before a claim envelope is printed.

Call the existing no-write `assertTask6aPreSchemaOrdinaryStartupV2()` directly
before the CLI route's `claimStep(target, callerAgent)` call. The already
validated present-operation/not-through33 case must reject before entering
`claimStep()` and before printing `NO_WORK` or an envelope. Absent operation or
exact through33 journal continues to the unchanged claim path and its normal
gates. Keep the same fixed refusal code and sanitized top-level error path;
add no bypass, new evidence shape, or fallback.

Do not insert this guard in the exported shared `claimStep()` for this slice:
isolated-DB integration tests call that library directly but the fixed
current-entry discriminator resolves the real host, independent of test DB or
cwd. A library-wide change would conflate production operation state with
test-fixture claims. `step peek` can also perform cleanup despite its name;
the poller, maintenance timers, existing sessions, and same-role database
connections remain separate gaps. This is sampled direct-CLI claim refusal,
not continuous writer exclusion, zero-owner evidence, or Task6A admission.

## File Map and verification

- `src/cli/cli.ts`: import the existing V2 assertion and await it immediately
  before `claimStep()` in the `step claim` route.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN exact claim-route order and extracted effect-boundary test.
- `docs/superpowers/plans/2026-09-26-task6a-v2-direct-cli-claim-refusal.md`:
  implementation and verification sequence.

Run focused tests, pure/cutover suites, TypeScript and source contracts, and
independent read-only review before PR delivery. Keep all development,
deployment, and historical worktrees visible; root is the sole writer.
