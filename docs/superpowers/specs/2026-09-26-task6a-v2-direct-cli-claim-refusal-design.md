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

## Causal standard-install compatibility correction

Exact-head PR review found that the existing V2 assertion itself denied every
ordinary installation without the Mac mini's fixed `~/ai/setrox` workspace.
This affects the earlier spawner entry points as well as the new CLI call.
Correct the shared V2 assertion before delivery: only a module executing
outside the fixed workspace may treat the fixed workspace as absent, and only
after a no-follow, descriptor-held two-pass proof that exactly `~/ai` or
`~/ai/setrox` is missing. A module inside the fixed workspace, a present
workspace or operation, a symlink/malformed ancestor, uncertain identity, or
close failure retains fail-closed behavior. The check honors the supported
Darwin `/var` to `/private/var` alias and checks the prior close-failure poison
latch before any absence exemption. The strict fixed-operation observer
and all existing admission gates remain unchanged. This is a sampled
applicability distinction, never evidence that another writer is excluded.

## File Map and verification

- `src/cli/cli.ts`: import the existing V2 assertion and await it immediately
  before `claimStep()` in the `step claim` route.
- `src/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts`:
  no-write, no-follow stable absence for an external ordinary checkout only;
  canonical source and present/malformed workspace retain strict refusal.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN exact claim-route order, extracted effect boundary, standard-home
  missing workspace, present operation, malformed/symlink and canonical-source
  tests.
- `docs/superpowers/plans/2026-09-26-task6a-v2-direct-cli-claim-refusal.md`:
  implementation and verification sequence.

Run focused tests, pure/cutover suites, TypeScript and source contracts, and
independent read-only review before PR delivery. Keep all development,
deployment, and historical worktrees visible; root is the sole writer.
